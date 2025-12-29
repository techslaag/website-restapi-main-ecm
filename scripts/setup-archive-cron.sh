#!/bin/bash

# Archive Posts Cron Job Setup Script
# This script sets up a daily cron job to archive old posts

set -e

echo "Setting up archive posts cron job..."

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Create cron job script
CRON_SCRIPT="$PROJECT_DIR/scripts/archive-posts-cron.sh"

cat > "$CRON_SCRIPT" << 'EOF'
#!/bin/bash

# Archive Posts Cron Job Script
# This script calls the API endpoint to archive old posts

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
elif [ -f .env.local ]; then
    export $(cat .env.local | xargs)
fi

# Default values
API_URL="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-default_secret}"

# Log file
LOG_FILE="$HOME/logs/archive-posts-cron.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date)] Starting archive posts cron job..." >> "$LOG_FILE"

# Make API call
curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$API_URL/api/cron/archive-old-posts" \
    >> "$LOG_FILE" 2>&1

echo "[$(date)] Archive posts cron job completed." >> "$LOG_FILE"
EOF

# Make the script executable
chmod +x "$CRON_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "archive-posts-cron.sh"; then
    echo "Archive cron job already exists."
    echo "Current crontab:"
    crontab -l | grep "archive-posts-cron.sh" || true
else
    echo "Adding archive cron job..."
    
    # Create temporary crontab file
    TEMP_CRON=$(mktemp)
    
    # Get current crontab (ignore error if no crontab exists)
    crontab -l > "$TEMP_CRON" 2>/dev/null || true
    
    # Add new cron job - runs daily at 2 AM
    echo "0 2 * * * $CRON_SCRIPT" >> "$TEMP_CRON"
    
    # Install new crontab
    crontab "$TEMP_CRON"
    
    # Clean up
    rm "$TEMP_CRON"
    
    echo "Archive cron job added successfully!"
    echo "It will run daily at 2:00 AM"
fi

echo ""
echo "Setup completed!"
echo ""
echo "To manually test the archive job, run:"
echo "  $CRON_SCRIPT"
echo ""
echo "To view cron logs:"
echo "  tail -f $HOME/logs/archive-posts-cron.log"
echo ""
echo "To remove the cron job:"
echo "  crontab -e  # and delete the line containing 'archive-posts-cron.sh'"
echo ""
echo "Make sure to set CRON_SECRET in your environment variables for security."