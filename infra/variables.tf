variable "cf_api_token" {
  type = string
  description = "Cloudflare API token."
  sensitive = true
}

variable "account_id" {
  type = string
  description = "Cloudflare account ID."
  sensitive = true
}

variable "zone_id" {
  type = string
  description = "Cloudflare zone ID."
  sensitive = true
}

variable "domains" {
  type = set(string)
  description = "List of domains."
  default = ["bixing.me", "www.bixing.me"]
}
