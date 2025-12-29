#!/bin/bash

# Archive Posts Cron Job Script
# Add this to your server's crontab with:
# 0 2 * * * /path/to/this/script/archive-cron.sh >> /var/log/ecomatin-archive.log 2>&1

# Configuration
API_URL="${API_BASE_URL:-http://localhost:3500}/api/cron/archive-old-posts"
CRON_SECRET="${CRON_SECRET}"
LOG_FILE="/var/log/ecomatin-archive.log"

# Timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting archive job..."

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    echo "ERROR: CRON_SECRET environment variable not set"
    exit 1
fi

# Make the API call
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    "$API_URL")

# Parse response
http_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo "Response: $response_body"

# Check if successful
if [ "$http_code" -eq 200 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Archive job completed successfully"
    exit 0
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Archive job failed with status $http_code"
    exit 1
fi