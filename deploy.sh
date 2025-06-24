#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Pull the latest changes
git pull origin main

# Stop the existing containers and remove them along with their volumes
docker compose down

# Remove any dangling images
docker image prune -f

# Build and start the containers with --no-cache to ensure fresh environment variables
docker compose up -d --build --force-recreate 

# Display initial logs for 10 seconds to verify deployment
docker compose logs --tail=50
sleep 10

# Continue with remaining deployment steps
# Add your SSH setup and postCheckout code here
