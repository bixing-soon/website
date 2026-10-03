NAME="bixing-soon"
EMAIL="319032326+bixing-soon@users.noreply.github.com"
DIR="/workspaces/website"

git config --global user.name "$NAME" && \
git config --global user.email "$EMAIL" && \
git config --global init.defaultBranch "main"
git config --global --add safe.directory "$DIR"
