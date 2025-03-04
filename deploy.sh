#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Pull the latest changes
git pull origin main

# Stop the existing containers and remove them along with their volumes
docker compose down -v

# Remove any dangling images
docker image prune -f

# Build and start the containers with --no-cache to ensure fresh environment variables
docker compose up -d --build --force-recreate 

# Display logs to verify deployment
docker compose logs -f
