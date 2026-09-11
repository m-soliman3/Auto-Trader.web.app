variable "project_id" {
  description = "GCP project that hosts the backend (same project for prod and staging Hosting sites — there is no separate staging GCP project)."
  type        = string
  default     = "autotrader-b8851"
}

variable "region" {
  description = "Region of the Cloud Run service being fronted."
  type        = string
  default     = "europe-west1"
}

variable "cloud_run_service_name" {
  description = "Cloud Run service to front with the load balancer + Cloud Armor policy. Defaults to the public chatbot backend (handles /health, /v1/public-chat) since it takes no authenticated financial traffic — a safe first surface to validate the WAF against."
  type        = string
  default     = "auto-trader-chatbot-backend"
}

variable "rate_limit_threshold_count" {
  description = "Requests allowed per client IP within rate_limit_threshold_interval_sec before Cloud Armor starts throttling."
  type        = number
  default     = 100
}

variable "rate_limit_threshold_interval_sec" {
  description = "Sliding window (seconds) for the rate-limit rule."
  type        = number
  default     = 60
}
