# Personal Portfolio Website

A static, single-page portfolio site built with plain HTML and CSS.

## How development works

Everything runs inside a dev container, so you don't need any dev-tooling installed on your machine.
Open the project folder in the container (your IDE will pick up `.devcontainer/`) and work from there.

The container is Fedora with Node, Python 3, git, vim, and openssh. All the commands below are meant to run inside it.

### SSH agent

Your host's SSH agent socket is mounted into the container at `/.ssh-agent.sock`, and `SSH_AUTH_SOCK` points there.
This means git over SSH with your host's SSH agent. This allows you to work inside the container without copying private keys into it.

### Port 8000

Port 8000 is forwarded to your host and opens in your browser automatically.
That is the port the local server below listens on.

## Structure

```
src/                 site files (served as-is)
  index.html         the page
  styles.css         all styling
  favicon.svg        browser tab icon
  logo.svg           background watermark
scripts/
  http-test.sh       start a local HTTP server on port 8000
  setup-git.sh       set git name, email, and default branch
.devcontainer/       dev environment (Fedora + Node, Python, git)
```

## Editing

Edit the files in `src/` directly and refresh the browser. `index.html` holds the
content; `styles.css` holds the styling and theme colors.

## Running locally

```sh
./scripts/http-test.sh
```

Then open <http://localhost:8000>. The script serves `src/` on port 8000 with `python3 -m http.server` and kills any server already running there first.

## First-time git setup

```sh
./scripts/setup-git.sh
```

Sets the git name, email, and default branch inside the container.

## Deploying

The site is deployed to Azure Static Web Apps from `src/`.
