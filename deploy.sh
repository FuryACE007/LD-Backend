#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Pull the latest changes
git pull origin main

# Stop the existing containers
docker compose down

# Build and start the containers
docker compose up -d --build