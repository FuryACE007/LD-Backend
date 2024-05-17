#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Pull the latest changes
git pull https://$GITHUB_ACCESS_TOKEN@github.com/LD-Smart-Supply/smart-supply-system-backendV1.git

# Stop the existing containers
docker compose down

# Build and start the containers
docker compose up -d --build