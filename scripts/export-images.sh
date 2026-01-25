#!/bin/bash
set -e

# Configuration
VERSION="1.0.0"
OUTPUT_DIR="jask-offline-v${VERSION}"
IMAGES_DIR="${OUTPUT_DIR}/images"

# Images List
# Format: "image_name|tar_name"
DECLARE_IMAGES=(
    "pgvector/pgvector:pg16|postgres.tar"
    "redis:7-alpine|redis.tar"
    "jask-backend:latest|jask-backend.tar"
    "jask-frontend:latest|jask-frontend.tar"
)

echo "Starting Offline Package Export (v${VERSION})"
echo "--------------------------------------------"

# 1. Clean & Prepare
echo "[1/5] Creating output directory structure..."
rm -rf "${OUTPUT_DIR}"
mkdir -p "${IMAGES_DIR}"

# 2. Build Custom Images
echo "[2/5] Building custom images..."
echo "  Building Backend..."
docker build -t jask-backend:latest ./backend

echo "  Building Frontend..."
docker build -t jask-frontend:latest ./frontend

# 3. Pull External Images
echo "[3/5] Pulling external images..."
echo "  Pulling Postgres (pgvector)..."
docker pull pgvector/pgvector:pg16
echo "  Pulling Redis..."
docker pull redis:7-alpine

# 4. Save Images
echo "[4/5] Exporting images to .tar archives..."
for entry in "${DECLARE_IMAGES[@]}"; do
    IFS="|" read -r image_name tar_name <<< "${entry}"
    echo "  Saving ${image_name} -> ${tar_name}..."
    docker save -o "${IMAGES_DIR}/${tar_name}" "${image_name}"
done

# 5. Package Files
echo "[5/5] Packaging configuration and scripts..."
cp docker-compose.prod.yml "${OUTPUT_DIR}/docker-compose.yml"
cp scripts/install.sh "${OUTPUT_DIR}/install.sh"
chmod +x "${OUTPUT_DIR}/install.sh"

echo "Creating compressed archive..."
tar -czf "${OUTPUT_DIR}.tar.gz" "${OUTPUT_DIR}"

echo "--------------------------------------------"
echo "Success! Package created: ${OUTPUT_DIR}.tar.gz"
echo "Transfer this file to the target machine and run:"
echo "  tar -xzf ${OUTPUT_DIR}.tar.gz"
echo "  cd ${OUTPUT_DIR}"
echo "  sudo ./install.sh"
echo "--------------------------------------------"
