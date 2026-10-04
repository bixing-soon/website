resource "cloudflare_worker" "web-worker" {
  account_id = var.account_id
  name = "website"
  subdomain = {
    enabled = false
  }
}

resource "cloudflare_worker_custom_domain" "web-domain" {
  for_each = var.domains
  account_id = var.account_id
  hostname = each.value
  zone_id = var.zone_id
  service = "website"
}

resource "cloudflare_worker_version" "web-version" {
  account_id = var.account_id
  worker_id = cloudflare_worker.web-worker.id
  bindings = [{
    type = "r2_bucket"
    name = "bucket-bind"
    bucket_name = cloudflare_r2_bucket.web-bucket.name
  }]
  assets = {
    directory = "$(path.module)/../src"
    config = {
      not_found_handling = "404-page"
    }
  }
}

resource "cloudflare_worker_deployment" "web-deploy" {
  account_id = var.account_id
  script_name = "website"
  strategy = "percentage"
  version = [{
    version_id = cloudflare_worker_version.web-version.id
    percentage = 100
  }]
}

# STORAGE:

resource "cloudflare_r2_bucket" "web-bucket" {
  account_id = var.account_id
  name = "web-bucket"
  location = "oc"
  storage_class = "Standard"
}
