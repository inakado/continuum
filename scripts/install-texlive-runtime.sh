#!/bin/sh
set -eu

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  fontconfig \
  fonts-dejavu \
  fonts-noto \
  ghostscript \
  pandoc \
  texlive-full \
  wget
rm -rf /var/lib/apt/lists/*

fc-cache -f
pdflatex --version
dvisvgm --version
kpsewhich --version
pandoc --version
