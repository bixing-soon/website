# bixing.me

A small static site with a Cloudflare Worker in front of it. The site itself is plain HTML/CSS
under `src/`; the Worker serves those files and streams images out of a private R2 bucket. The
infrastructure is managed with Terraform.

FYI, the main site is at the root of `/src` and the portfolio one level down in `/src/portfolio`.

## Development

Everything runs inside a dev container, so you don't need any dev-tooling installed on your machine.
Open the project folder in the container (your IDE will pick up `.devcontainer/`) and work from there.

The container is Fedora with Node, Python 3, Terraform, git, vim, and openssh. All the commands below are meant to run inside it.

### SSH agent

Your host's SSH agent socket is mounted into the container at `/.ssh-agent.sock`, and `SSH_AUTH_SOCK` points there.
This means git over SSH with your host's SSH agent. This allows you to work inside the container without copying private keys into it.

### Port 8000

Port 8000 is forwarded to your host and opens in your browser automatically.
That is the port the local server below listens on.

## Running locally

```sh
./scripts/http-test.sh
```

Then open <http://localhost:8000/> or <http://localhost:8000/portfolio/>. The script serves `src/` on port 8000 with
`python3 -m http.server` and kills any server already running there first.

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

It must be **sourced**, not executed; if you run it as a command, it would put the variables in a child process.
It decrypts with `age-key.txt`, which is not in this repository.

## Terraform state

The state for `infra/` is kept in R2 rather than on disk. `infra/state.tf` only declares the key
(`website.tfstate`); the bucket and the S3 endpoint are passed when initializing Terraform.

So load the credentials and run `terraform init` before `plan` or `apply`.

## License

MIT. See [`LICENSE`](LICENSE).
