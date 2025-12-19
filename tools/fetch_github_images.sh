#!/usr/bin/env bash
set -euo pipefail

# Baixa imagens do seu repositório GitHub para a pasta /images.
# Observação: o GitHub não lista diretórios via raw; você precisa declarar os nomes.

REPO_RAW_BASE="https://raw.githubusercontent.com/jonatanoficial-bit/Medical-simulator-1.0/main/images"
TARGET_DIR="$(cd "$(dirname "$0")/.." && pwd)/images"

mkdir -p "$TARGET_DIR"

FILES=(
  "avatar_01.png"
  "avatar_02.png"
  "avatar_03.png"
  "avatar_04.png"
  "avatar_05.png"
  "avatar_06.png"
)

echo "Baixando para: $TARGET_DIR"
for f in "${FILES[@]}"; do
  url="$REPO_RAW_BASE/$f"
  echo "- $f"
  curl -fsSL "$url" -o "$TARGET_DIR/$f"
done

echo "OK. Imagens atualizadas."
