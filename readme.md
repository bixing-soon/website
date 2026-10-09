# bixing.me

A static site built using ThreeJS and WebGL, served by a Cloudflare Worker, with the infrastructure managed by Terraform.

The Worker serves everything under `src/` as static assets, and streams `/images/*` out of a private R2 bucket. The images themselves are not in this repository.

## Development

Everything runs inside a dev container, so you don't need any dev-tooling installed on your machine. Open the project folder in the container and work from there.

The container is Fedora with Node, Python 3, Terraform, git, vim, age, rclone, and openssh.

### SSH agent

Your host's SSH agent socket is mounted into the container at `/.ssh-agent.sock`, and `SSH_AUTH_SOCK` points there. This means git over SSH uses your host's SSH agent, so you can work inside the container without copying private keys into it.

### Port 8000

Port 8000 is forwarded to your host and opens in your browser automatically. That is the port the local server below listens on.

## Running locally

```sh
./scripts/http-test.sh
```

Then open <http://localhost:8000/> or <http://localhost:8000/portfolio/>.

The script runs `scripts/serve.py`, which serves `src/` on port 8000 and maps `/images/` to the repo-root `./images` folder so images show up locally.
Keep the images you're working on in `./images` for local preview.

## Images

The site references images as `/images/...`. In production these are read from the R2 bucket by `infra/worker.py`.
Locally, `scripts/serve.py` maps them to the repo-root `images/` folder.

`images/` is gitignored, so images are pushed to R2 separately, but the container has `rclone`, and `load-creds.sh` puts the R2 access keys in your environment if you want to sync them.

## First-time git setup

```sh
./scripts/setup-git.sh
```

Sets the git name, email, and default branch inside the container.

## Credentials

To deploy, you need the Cloudflare API token, the account and zone IDs, and S3 keys for R2.
They are stored encrypted in `infra/creds.age` and decrypted into your current shell by:

```sh
source scripts/load-creds.sh
```

It must be **sourced**, not executed; if you run it as a command, it would put the variables in a child process. It decrypts with an age key, which is not in this repository.

## Terraform state

The state for `infra/` is kept in R2 rather than on disk. `infra/state.tf` only declares the key (`website.tfstate`).
The bucket and the S3 endpoint are passed when initializing Terraform.

So load the credentials and run `terraform init` before `plan` or `apply`.

## Deployment

`.github/workflows/main.yaml` runs Terraform (`init`, `validate`, `plan`, `apply`) on pushes to `main` and on pull requests. It needs these repository secrets: `CF_API_TOKEN`, `ACCOUNT_ID`, `ZONE_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_API_ENDPOINT`, and `R2_BUCKET_NAME`.

## License

MIT. See [`LICENSE`](LICENSE).
