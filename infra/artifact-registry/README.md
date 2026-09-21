# Artifact Registry cleanup policies

**Status: installed in dry-run mode on `cloud-run-source-deploy` (europe-west1).**
Nothing has been deleted. Run with `--apply` to enable deletion.

## Why this exists

Every deploy pushes a new container image, and nothing ever deleted the old ones:

- `.github/workflows/firebase-deploy.yml` runs `gcloud run deploy --source ./backend`,
  which builds through Cloud Build and pushes into `cloud-run-source-deploy`.
- `firebase deploy --only functions` stages its function builds in `gcf-artifacts`.

Artifact Registry bills storage per GB-month on everything ever pushed. Because
both repositories are append-only in practice, the bill grows with the number of
deploys rather than with traffic — it keeps climbing even in a quiet month, and
it never falls on its own.

## What the policy does

`cloud-run-cleanup-policy.json` keeps the 10 most recent `auto-trader-backend`
images and deletes `auto-trader-backend` images older than 30 days. Artifact
Registry evaluates **Keep rules ahead of Delete rules**, so those 10 survive
regardless of age. That ordering is the safety property that matters here: a Cloud
Run revision is pinned to an exact image digest, and deleting that digest would
leave already-running instances alone but break the next cold start.

Both rules are deliberately scoped to `auto-trader-backend` by
`packageNamePrefixes`. That package is the whole problem — it holds 407 of the
repository's images and nearly all of its 18.5 GB, against 21 for `ta-mcp-server`
and 2 for `auto-trader-chatbot-backend`.

The scoping is also what makes this safe. `auto-trader-chatbot-backend` has not
been rebuilt since 2026-03-12, so its live image is far older than 30 days and is
nowhere near the repository's 10 most recent. An unscoped policy could therefore
have collected the image that service is actually running, depending on whether
`keepCount` is counted per package or per repository. Scoping both rules removes
the question entirely: the other two packages are never considered.

`gcf-artifacts` is left to the Firebase CLI, which understands that repository's
layout. Firebase's own default retention is 1 day because those images are only
needed at deploy time; the script uses 7 to leave room to inspect a bad build.

## Running it

Dry run first — this installs the policy but deletes nothing, so you can read the
candidates out of the Artifact Registry logs before anything is removed:

    ./apply-cleanup-policies.sh

Then, once the logged candidates look right:

    ./apply-cleanup-policies.sh --apply

Overridable via environment: `PROJECT`, `LOCATION`, `FUNCTIONS_RETENTION_DAYS`.

## Before you run it

Needs `roles/artifactregistry.admin` (or equivalent) on `autotrader-b8851`, and a
current login — `gcloud auth login`.

## The one case to think about

If you roll `auto-trader-backend` back to a revision older than its 10 most recent
images, that revision's image may already have been collected and the rollback
will fail to start. Raise `keepCount` in the policy file if you want a deeper
rollback window; the trade is linear in storage.

If you ever add a package to the delete rule, check first whether its live image
is older than the age condition — as the chatbot backend's was.
