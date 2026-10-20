#!/bin/bash

DIR="/workspaces/website"

if [[ -z "$SSH_AUTH_SOCK" ]]; then
    echo "Please load the SSH agent so you can push to remote repositories."
    exit 1
fi

read -rp "Git Name: " NAME
read -rp "Git Email: " EMAIL
read -rp "SSH pub key for signing: " SIGN_KEY

git config --global user.name "$NAME"
git config --global user.email "$EMAIL"
git config --global init.defaultBranch "main"
git config --global --add safe.directory "$DIR"
git config --global gpg.format ssh
git config --global user.signingkey "$SIGN_KEY"
git config --global commit.gpgsign true
