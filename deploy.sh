#!/bin/bash

# Pull the latest changes
git pull

# Stop the existing containers
docker compose down

# Build and start the containers
docker compose up -d --build