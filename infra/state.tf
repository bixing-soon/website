terraform {
  backend "s3" {
    key    = "website.tfstate"
    region = "auto"
    # bucket
    # endpoints
    # access_key
    # secret_key
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
