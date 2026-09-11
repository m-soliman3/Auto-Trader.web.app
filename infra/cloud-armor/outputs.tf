output "load_balancer_ip" {
  description = "Static IP of the Cloud Armor proof-of-concept load balancer. Test with: curl http://<this IP>/health"
  value       = google_compute_global_address.cloud_armor_poc_ip.address
}

output "security_policy_name" {
  value = google_compute_security_policy.api_waf_policy.name
}
