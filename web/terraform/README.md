## CloudFront infrastructure (Terraform)

- `cloudfront.tf` is the migrated config from the legacy LNWebServerless repo. It owns both CloudFront distributions:
  - `E38XGOGM7XNRC5` &rarr; dynamic/API traffic (`api.litternetworks.org`, `aws.litternetworks.org`, `static.litternetworks.org`, `litternetworks.org`)
  - `EWXIG6ZADYHMA` &rarr; static CDN (`cdn.litternetworks.org` backed by `lnweb-public`/`lnweb-docs`)
- `sync_terraform.sh` is the helper the legacy repo used to run `terraform apply` and invalidate both distributions afterwards.

### Usage

1. `cd web/terraform`
2. Ensure the `ln` AWS profile (or equivalent credentials) is available.
3. Run `terraform init` (first time) then `terraform apply`.
4. After a successful apply, run `./sync_terraform.sh` (or call `aws cloudfront create-invalidation` manually) if you need to flush caches.

> NOTE: this module still contains references to the legacy Lambda origins. Once lnweb-react fully replaces the serverless Lambda front-end you can update `cloudfront.tf` to point the default origin at the S3/React site instead.
