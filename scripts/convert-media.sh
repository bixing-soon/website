#!/bin/bash

set -euo pipefail
shopt -s nullglob

DIR="/workspaces/website"

if ! command -v ffmpeg; then
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

# firefox on android cant play webm in threejs so we gotta add a webp fallback for it
for video in "$DIR"/images/*.webm; do
	[[ "${video##*/}" == "sakiko-sip.webm" ]] && continue
	ffmpeg -y -hide_banner -loglevel error -i "$video" \
		-vf "fps=12,scale=220:-2:flags=lanczos,tile=5x9" -frames:v 1 -an \
		-c:v libwebp -quality 68 -preset picture \
		"${video%.webm}-fallback.webp"
done
