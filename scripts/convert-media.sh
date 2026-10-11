#!/bin/bash

set -euo pipefail
shopt -s nullglob

DIR="/workspaces/website"

if ! command -v ffmpeg >/dev/null 2>&1; then
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

# this is for creating webp fallbacks cuz some browsers like firefox android cant load webm from threejs
for video in "$DIR"/images/*.webm; do
	[[ "${video##*/}" == "sakiko-sip.webm" ]] && continue
	ffmpeg -y -i "$video" \
		-vf "fps=12,scale='min(320,iw)':-2:flags=lanczos" -an \
		-c:v libwebp_anim -loop 0 -quality 68 -preset picture \
		"${video%.webm}-fallback.webp"
done
