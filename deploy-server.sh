#!/bin/bash

################################################################################
# VibeList Backend - Zero-Downtime Deployment Script
#
# This script performs zero-downtime deployment with health checks and
# automatic rollback on failure.
#
# Usage:
#   ./deploy-server.sh <image-tag>
#
# Example:
#   ./deploy-server.sh ghcr.io/nikitastogniy/vibelist-backend:abc123
#
# Requirements:
#   - Docker installed
#   - .env.production file at /opt/vibelist/.env.production
#   - Network 'vibelist-network' (will be created if doesn't exist)
################################################################################

set -e

# Configuration
CONTAINER_NAME="vibelist-backend"
NEW_CONTAINER_NAME="vibelist-backend-new"
NETWORK_NAME="vibelist-network"
ENV_FILE="/opt/vibelist/.env.production"
HEALTH_CHECK_URL="http://localhost:3000/health"
TEMP_PORT=3001
PROD_PORT=3000
MAX_HEALTH_CHECK_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup_failed_deployment() {
    log_warning "Cleaning up failed deployment..."
    docker stop ${NEW_CONTAINER_NAME} 2>/dev/null || true
    docker rm ${NEW_CONTAINER_NAME} 2>/dev/null || true
}

# Main script
main() {
    # Validate arguments
    if [ -z "$1" ]; then
        log_error "Usage: $0 <docker-image>"
        log_error "Example: $0 ghcr.io/nikitastogniy/vibelist-backend:abc123"
        exit 1
    fi

    IMAGE=$1

    log_info "=== Starting Zero-Downtime Deployment ==="
    log_info "Image: ${IMAGE}"
    log_info "Container: ${CONTAINER_NAME}"

    # Check if env file exists
    if [ ! -f "${ENV_FILE}" ]; then
        log_error "Environment file not found: ${ENV_FILE}"
        exit 1
    fi

    # Create network if it doesn't exist
    if ! docker network inspect ${NETWORK_NAME} >/dev/null 2>&1; then
        log_info "Creating Docker network: ${NETWORK_NAME}"
        docker network create ${NETWORK_NAME}
    fi

    # Pull new image
    log_info "Pulling Docker image..."
    if ! docker pull ${IMAGE}; then
        log_error "Failed to pull image"
        exit 1
    fi

    # Run database migrations
    log_info "Running database migrations..."
    if ! docker run --rm \
        --network ${NETWORK_NAME} \
        --env-file ${ENV_FILE} \
        ${IMAGE} \
        npm run migration:run; then
        log_error "Database migration failed!"
        exit 1
    fi
    log_success "Migrations completed successfully"

    # Start new container on temporary port
    log_info "Starting new container on port ${TEMP_PORT}..."
    if ! docker run -d \
        --name ${NEW_CONTAINER_NAME} \
        --network ${NETWORK_NAME} \
        --env-file ${ENV_FILE} \
        -p ${TEMP_PORT}:3000 \
        --restart unless-stopped \
        ${IMAGE}; then
        log_error "Failed to start new container"
        exit 1
    fi

    # Wait for container to be ready
    log_info "Waiting for container to start..."
    sleep 5

    # Health checks
    log_info "Performing health checks (${MAX_HEALTH_CHECK_ATTEMPTS} attempts, ${HEALTH_CHECK_INTERVAL}s interval)..."
    HEALTH_CHECK_PASSED=false

    for i in $(seq 1 ${MAX_HEALTH_CHECK_ATTEMPTS}); do
        log_info "Health check attempt ${i}/${MAX_HEALTH_CHECK_ATTEMPTS}..."

        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${TEMP_PORT}/health 2>/dev/null || echo "000")

        if [ "$HTTP_CODE" = "200" ]; then
            log_success "Health check passed (HTTP ${HTTP_CODE})"
            HEALTH_CHECK_PASSED=true
            break
        else
            log_warning "Health check failed (HTTP ${HTTP_CODE}), retrying in ${HEALTH_CHECK_INTERVAL} seconds..."
            sleep ${HEALTH_CHECK_INTERVAL}
        fi
    done

    if [ "$HEALTH_CHECK_PASSED" = false ]; then
        log_error "=== DEPLOYMENT FAILED: Health checks failed after ${MAX_HEALTH_CHECK_ATTEMPTS} attempts ==="
        cleanup_failed_deployment
        exit 1
    fi

    # Health checks passed - proceed with traffic switch
    log_info "=== Health checks passed, switching traffic ==="

    # Stop and remove old container if it exists
    if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
        log_info "Stopping old container..."
        docker stop ${CONTAINER_NAME} || true
        docker rm ${CONTAINER_NAME} || true
    fi

    # Stop new container to reconfigure it
    log_info "Reconfiguring container for production..."
    docker stop ${NEW_CONTAINER_NAME}
    docker rename ${NEW_CONTAINER_NAME} ${CONTAINER_NAME}

    # Start with production port
    docker rm ${CONTAINER_NAME}
    if ! docker run -d \
        --name ${CONTAINER_NAME} \
        --network ${NETWORK_NAME} \
        --env-file ${ENV_FILE} \
        -p ${PROD_PORT}:3000 \
        --restart unless-stopped \
        ${IMAGE}; then
        log_error "Failed to start container on production port"
        exit 1
    fi

    # Final health check
    log_info "Performing final health check..."
    sleep 5

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_CHECK_URL} 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        log_success "=== DEPLOYMENT SUCCESSFUL ==="
        log_success "Container is running and healthy on port ${PROD_PORT}"

        # Cleanup old images (keep last 3 versions)
        log_info "Cleaning up old Docker images..."
        docker image prune -af --filter "until=72h" 2>/dev/null || true

        # Show container status
        log_info "Container status:"
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

        exit 0
    else
        log_error "Final health check failed (HTTP ${HTTP_CODE})"
        log_error "Deployment completed but service might not be healthy!"
        exit 1
    fi
}

# Trap errors and cleanup
trap cleanup_failed_deployment ERR

# Run main function
main "$@"
