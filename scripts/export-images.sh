#!/bin/bash

# Configuration
VERSION="1.0.0"
OUTPUT_DIR="jask-offline-v${VERSION}"
IMAGES_DIR="${OUTPUT_DIR}/images"

# Define images to export
# Format: "image_name|tar_name"
DECLARE_IMAGES=(
    "pgvector/pgvector:pg16|postgres.tar"
    "redis:7-alpine|redis.tar"
    "jask-backend:latest|jask-backend.tar"
    "jask-frontend:latest|jask-frontend.tar"
)

# Create output directories
echo "Creating output directory structure..."
mkdir -p "${IMAGES_DIR}"

# Build custom images
echo "Building Backend..."
docker build -t jask-backend:latest ./backend

echo "Building Frontend..."
docker build -t jask-frontend:latest ./frontend

# Pull external images to ensure we have them
echo "Pulling external images..."
docker pull pgvector/pgvector:pg16
docker pull redis:7-alpine

# Export images
echo "Exporting images..."
for entry in "${DECLARE_IMAGES[@]}"; do
    IFS="|" read -r image_name tar_name <<< "${entry}"
    echo "Saving ${image_name} to ${tar_name}..."
    docker save -o "${IMAGES_DIR}/${tar_name}" "${image_name}"
done

# Copy configuration files
echo "Copying configuration files..."
cp docker-compose.prod.yml "${OUTPUT_DIR}/docker-compose.yml"
cp scripts/install.sh "${OUTPUT_DIR}/install.sh"
chmod +x "${OUTPUT_DIR}/install.sh"

# Create archive
echo "Creating archive..."
tar -czf "${OUTPUT_DIR}.tar.gz" "${OUTPUT_DIR}"

echo "Done! Offline package created at ${OUTPUT_DIR}.tar.gz"
