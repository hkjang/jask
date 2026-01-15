#!/bin/bash

IMAGES_DIR="./images"

# Load images
echo "Loading Docker images..."
if [ -d "$IMAGES_DIR" ]; then
    for tar_file in "$IMAGES_DIR"/*.tar; do
        if [ -f "$tar_file" ]; then
            echo "Loading $tar_file..."
            docker load -i "$tar_file"
        fi
    done
else
    echo "Error: details directory '$IMAGES_DIR' not found."
    exit 1
fi

# Generate .env if not exists
if [ ! -f ".env" ]; then
    echo "Generating .env file with secrets..."
    JWT_SECRET=$(openssl rand -base64 32 | tr -d /=+ | cut -c -32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d /=+ | cut -c -32)
    
    cat <<EOF > .env
JWT_SECRET=${JWT_SECRET}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
EOF
    echo "Generated secrets in .env"
fi

# Run docker-compose
echo "Starting services..."
if [ -f "docker-compose.yml" ]; then
    # Pass .env file to docker-compose
    docker-compose up -d
    echo "Services started successfully."
else
    echo "Error: docker-compose.yml not found."
    exit 1
fi
