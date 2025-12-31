#!/usr/bin/env bash

# Build and tag multi-arch images (linux/amd64 and linux/arm64) using Docker Buildx.
# Make sure you have set up buildx and QEMU emulation (if building on a different arch).

set -ex

DH_USER=${1:-lalanza808}
TAG=moneroexplorer
VERSION=v1.0.0

echo -e "[+] Building ${TAG} multi-arch (amd64 & arm64)"
docker buildx build --platform linux/amd64,linux/arm64 \
    -t "${DH_USER}/${TAG}:${VERSION}" \
    -t "${DH_USER}/${TAG}:latest" \
    . --push