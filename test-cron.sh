#!/bin/bash

# Test script for archive cron job
echo "Testing Archive Cron Job Setup..."

# Load environment variables
source .env

# Test the cron endpoint with authentication
echo "1. Testing authenticated cron endpoint..."
response=$(curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3500/api/cron/archive-old-posts)

echo "Response: $response"

# Test without authentication (should fail)
echo ""
echo "2. Testing without authentication (should fail)..."
unauth_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  http://localhost:3500/api/cron/archive-old-posts)

echo "Response: $unauth_response"

# Test archive statistics
echo ""
echo "3. Checking archive statistics..."
stats_response=$(curl -s http://localhost:3500/api/posts/archive/stats)
echo "Stats: $stats_response"

echo ""
echo "Test completed!"