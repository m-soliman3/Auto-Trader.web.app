terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# A fresh, dedicated static IP for this load balancer. Firebase Hosting's own
# IPs/edge are completely untouched by anything in this file — this is a new,
# parallel entry point, not a replacement for existing routing.
resource "google_compute_global_address" "cloud_armor_poc_ip" {
  name = "cloud-armor-poc-ip"
}

# Serverless NEG pointing at the existing Cloud Run service. This does not
# modify the Cloud Run service itself — it's a read-only reference used as
# a load balancer backend target.
resource "google_compute_region_network_endpoint_group" "chatbot_backend_neg" {
  name                  = "chatbot-backend-serverless-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = var.cloud_run_service_name
  }
}

# Cloud Armor WAF policy: baseline preconfigured rule sets (SQLi, XSS) plus a
# per-IP rate limit. Nothing here is enforced against real user traffic until
# this policy's backend service is actually put in front of production DNS —
# see README.md in this directory.
resource "google_compute_security_policy" "api_waf_policy" {
  name        = "auto-trader-api-waf-policy"
  description = "Baseline WAF (SQLi/XSS) + rate limiting for backend API traffic. Attached to a standalone LB — not yet in front of any production domain."

  # Preconfigured SQL-injection rule set.
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection attempts (Google-managed rule set)."
  }

  # Preconfigured XSS rule set.
  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block cross-site scripting attempts (Google-managed rule set)."
  }

  # Per-IP rate limit: throttle instead of hard-blocking, so a burst of
  # legitimate traffic degrades gracefully rather than getting locked out.
  rule {
    action   = "throttle"
    priority = 2000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = var.rate_limit_threshold_count
        interval_sec = var.rate_limit_threshold_interval_sec
      }
    }
    description = "Rate limit per client IP."
  }

  # Required default rule — Cloud Armor policies must have one.
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule."
  }
}

resource "google_compute_backend_service" "chatbot_backend" {
  name                  = "chatbot-backend-service"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  security_policy       = google_compute_security_policy.api_waf_policy.id

  backend {
    group = google_compute_region_network_endpoint_group.chatbot_backend_neg.id
  }
}

resource "google_compute_url_map" "api_url_map" {
  name            = "cloud-armor-poc-url-map"
  default_service = google_compute_backend_service.chatbot_backend.id
}

# HTTP (not HTTPS) proxy deliberately, to avoid needing a managed SSL cert +
# domain validation for what is currently a validation-only endpoint with no
# DNS record pointing at it. Upgrade to HTTPS before this ever fronts real
# domain traffic.
resource "google_compute_target_http_proxy" "api_http_proxy" {
  name    = "cloud-armor-poc-http-proxy"
  url_map = google_compute_url_map.api_url_map.id
}

resource "google_compute_global_forwarding_rule" "api_forwarding_rule" {
  name                  = "cloud-armor-poc-forwarding-rule"
  target                = google_compute_target_http_proxy.api_http_proxy.id
  port_range            = "80"
  ip_address            = google_compute_global_address.cloud_armor_poc_ip.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
