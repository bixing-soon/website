resource "cloudflare_worker" "web-worker" {
  account_id = var.account_id
  name = "website"
  subdomain = {
    enabled = false
  }
}

resource "cloudflare_r2_bucket" "web-bucket" {
  account_id = var.account_id
  name = "web-bucket"
  location = "oc"
  storage_class = "Standard"
}

resource "cloudflare_worker_version" "web-version" {
  account_id = var.account_id
  worker_id = cloudflare_worker.web-worker.id
  bindings = [{
    type = "r2_bucket"
    name = "bucket-bind"
    bucket_name = cloudflare_r2_bucket.web-bucket.name
  },
  {
    type = "assets"
    name = "assets-bind"
  }]
  assets = {
    directory = "${path.module}/../src"
    config = {
      not_found_handling = "404-page"
    }
  }
  compatibility_date = "2026-08-04"
  compatibility_flags = ["python_workers"]
  main_module = "worker.py"
  modules = [{
    name = "worker.py"
    content_type = "text/x-python"
    content_file = "${path.module}/worker.py"
  }]
}

resource "cloudflare_workers_deployment" "web-deploy" {
  account_id = var.account_id
  versions = [{
    version_id = cloudflare_worker_version.web-version.id
    percentage = 100
  }]
  script_name = "website"
  strategy = "percentage"
}

resource "cloudflare_workers_custom_domain" "web-domain" {
  for_each = var.domains
  account_id = var.account_id
  hostname = each.value
  zone_id = var.zone_id
  service = "website"
  depends_on = [cloudflare_workers_deployment.web-deploy]
}
