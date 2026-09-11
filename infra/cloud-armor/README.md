# Cloud Armor proof of concept

**Status: applied and verified (2026-09-11).** Live at `8.232.74.122`.
Confirmed: `GET /health` → `200` (matches the backend directly); the same
request with a SQLi or XSS payload in a query param → `403`, blocked by
Cloud Armor before it reaches the backend. Nothing points real user traffic
at this IP yet — see "What this does *not* do" below.

## Why this exists

The app's frontend (Firebase Hosting) and backend (Cloud Functions + Cloud
Run, all in the single `autotrader-b8851` GCP project) have no WAF or
DDoS-mitigation layer in front of them beyond Firebase's own edge and basic
`cors()` middleware. Google Cloud Armor adds a WAF (SQL injection / XSS
blocking) and per-IP rate limiting.

Cloud Armor cannot attach directly to Firebase Hosting or to a Cloud Function
— it attaches to a Google Cloud external Application Load Balancer. This
directory stands up a **new, standalone** load balancer (its own static IP,
its own NEG pointing at the existing `auto-trader-chatbot-backend` Cloud Run
service) purely to prove the Cloud Armor policy works, without touching any
existing production traffic path.

## What this does *not* do

- It does **not** change Firebase Hosting's rewrites, DNS, or the `prod`/
  `staging` hosting targets in `firebase.json` — those keep serving traffic
  exactly as before.
- It does **not** change `environment.ts`'s `tradingBackendBaseUrl` /
  `chatbotBackendBaseUrl`, so the Angular app keeps talking to the same
  endpoints it always has.
- Nothing here is on the request path for any real user until someone
  deliberately points a domain (or the app itself) at the new load
  balancer's IP — see "Promoting to production" below.

There is no separate "staging" GCP project — `autotrader-b8851-staging` is
just a second Firebase Hosting *site* in the same project, and both hosting
targets already rewrite to the exact same Cloud Functions / Cloud Run
services (see `firebase.json`). So "staging" here means: a new, currently
unused load balancer in the one real project, safe to test in isolation.

## Applying

```sh
cd infra/cloud-armor
terraform init
terraform plan   # review before applying — creates real, billable resources
terraform apply
```

Cost: roughly $5/month for the security policy + $1/rule/month (3 rules
here ≈ $3/month) + negligible request volume charges, plus the load
balancer's own forwarding-rule cost. See Cloud Armor's published pricing —
this is the Standard tier, not Enterprise.

## Testing

```sh
curl -i http://$(terraform output -raw load_balancer_ip)/health
```

Should return the same response as the existing
`https://auto-trader-chatbot-backend-zcypdnoyqa-ew.a.run.app/health`, now
routed through Cloud Armor. To confirm the WAF is active:

```sh
curl -s -o /dev/null -w "%{http_code}\n" -G \
  "http://$(terraform output -raw load_balancer_ip)/health" \
  --data-urlencode "id=1' OR '1'='1"
```

should return `403` instead of reaching the backend (verified above).

Note: right after `terraform apply`, the global load balancer can take a
few minutes to propagate — expect connection timeouts or a stray `404`
for the first 1-3 minutes before it settles into consistent `200`s.

## Promoting to production

This PoC intentionally uses a plain HTTP proxy (no managed SSL cert) since
nothing points a real domain at it yet. Before using this for real traffic:

1. Switch `google_compute_target_http_proxy` to
   `google_compute_target_https_proxy` with a `google_compute_managed_ssl_certificate`
   for whichever hostname will point here (e.g. `api.invest-begin.com`).
2. Point that hostname's DNS `A` record at the load balancer's static IP.
3. Only then update `environment.ts` / callers to use the new hostname —
   do this as its own deliberate, reviewed change, not bundled with the
   Terraform.
4. Consider whether to front every individual Cloud Function this way (there
   are 20+ in `firebase.json`) or keep most traffic on Firebase Hosting's
   default rewrites and reserve this for specific high-risk endpoints.

## State is shared (GCS backend)

State lives in `gs://autotrader-b8851-tfstate/cloud-armor/` (bucket created
with versioning on, `europe-west1`), configured via the `backend "gcs"`
block in `main.tf`. Any machine/session with access to that bucket and the
`autotrader-b8851` project runs `terraform init` and sees the real, current
state — no more "only my laptop knows this exists." `terraform plan`
against this backend confirms 0 drift: the 7 resources below match exactly.

## Destroying

```sh
terraform destroy
```
Safe at any point before step 2 above — nothing depends on this once no
DNS record points at it.
