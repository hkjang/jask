#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Configuration
VERSION="1.0.0"
IMAGES_DIR="./images"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

log_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# 1. Check Prerequisites
log_info "1. Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    # try 'docker compose' as fallback
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed."
        exit 1
    fi
fi

# 2. Load Docker Images
log_info "2. Loading Docker images..."
if [ -d "$IMAGES_DIR" ]; then
    count=$(ls -1 "$IMAGES_DIR"/*.tar 2>/dev/null | wc -l)
    if [ "$count" -eq 0 ]; then
         log_warn "No .tar files found in $IMAGES_DIR. Assuming images are already loaded or pulled."
    else
        for tar_file in "$IMAGES_DIR"/*.tar; do
            filename=$(basename "$tar_file")
            log_info "  Loading $filename..."
            docker load -i "$tar_file"
        done
    fi
else
    log_error "Images directory '$IMAGES_DIR' not found."
    exit 1
fi

# 3. Configure Environment
log_info "3. Configuring environment..."
if [ ! -f "$ENV_FILE" ]; then
    log_info "  Generating .env file..."
    
    # Generate secure secrets
    # Fallback if openssl is not available? Most linux has it.
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32 | tr -d /=+ | cut -c -32)
        NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d /=+ | cut -c -32)
    else
        # Fallback using simpler method
        JWT_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
        NEXTAUTH_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
    fi
    
    cat <<EOF > "$ENV_FILE"
JWT_SECRET=${JWT_SECRET}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
# Ports Configuration
BACKEND_PORT=4000
FRONTEND_PORT=3000
EOF
    log_info "  .env created with generated secrets."
else
    log_info "  .env already exists. Skipping generation."
fi

# 4. Start Services
log_info "4. Starting services..."
if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    log_error "$DOCKER_COMPOSE_FILE not found."
    exit 1
fi

docker-compose --file "$DOCKER_COMPOSE_FILE" up -d --remove-orphans

# 5. Application Setup (Migrations & Seed)
log_info "5. Waiting for services to initialize..."
log_info "   This may take a minute for the database to be ready..."

# Wait loop for backend container to be running
MAX_RETRIES=30
RETRY_COUNT=0
BACKEND_CONTAINER="jask-backend"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker ps --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
        break
    fi
    echo -n "."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done
echo ""

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_warn "Backend container '$BACKEND_CONTAINER' did not start within expected time. Please check logs."
    # We proceed anyway, but migration might fail
fi

# Give DB a moment to accept connections exactly when backend starts
sleep 10

log_info "Running database migrations..."
if docker exec -i "$BACKEND_CONTAINER" npx prisma migrate deploy; then
    log_info "Migrations applied successfully."
else
    log_error "Migration failed. Check database logs."
    # Don't exit here, maybe transient.
fi

log_info "Running database seeding..."
if docker exec -i "$BACKEND_CONTAINER" npx prisma db seed; then
    log_info "Database seeded successfully."
else
    log_warn "Seeding failed or already applied. Check logs if this is unexpected."
fi

log_info "---------------------------------------------------"
log_info "   Deployment Complete!   "
log_info "---------------------------------------------------"
log_info "Access the application at:"
log_info "  Frontend: http://localhost:3000"
log_info "  API:      http://localhost:4000"
log_info "---------------------------------------------------"
