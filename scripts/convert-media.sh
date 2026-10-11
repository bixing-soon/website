#!/bin/bash

set -euo pipefail
shopt -s nullglob

DIR="/workspaces/website"

if [[ ! /usr/bin/ffmpeg ]]; then
    echo "ffmpeg is not installed."
    exit 1
fi

for gif in "$DIR"/images/*.gif; do
	ffmpeg -y -i "$gif" -an \
		-c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 \
		-pix_fmt yuv420p "${gif%.gif}.webm"
done

for png in "$DIR"/images/*.png; do
	ffmpeg -y -i "$png" -c:v libwebp -pix_fmt bgra -lossless 1 "${png%.png}.webp"
done
