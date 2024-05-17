#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Pull the latest changes
PAT=$1
git pull https://$PAT@github.com/LD-Smart-Supply/smart-supply-system-backendV1.git

# Stop the existing containers
docker compose down

# Build and start the containers
docker compose up -d --build