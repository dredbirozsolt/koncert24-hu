#!/bin/bash

# Quick deployment script for application updates
# Usage: ./quick-deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/koncert24"
APP_USER="www-data"

echo -e "${BLUE}Starting quick deployment...${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}" 
   exit 1
fi

# Navigate to app directory
cd "$APP_DIR" || {
    echo -e "${RED}Application directory not found: $APP_DIR${NC}"
    exit 1
}

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
sudo -u "$APP_USER" npm install --production

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
sudo -u "$APP_USER" npm run migrate

# Restart application
echo -e "${YELLOW}Restarting application...${NC}"
if sudo -u "$APP_USER" pm2 list | grep -q "koncert24-hu"; then
    sudo -u "$APP_USER" pm2 restart koncert24-hu
else
    sudo -u "$APP_USER" pm2 start ecosystem.config.json
fi

# Check application status
echo -e "${YELLOW}Checking application status...${NC}"
sudo -u "$APP_USER" pm2 status koncert24-hu

# Reload Nginx
echo -e "${YELLOW}Reloading Nginx...${NC}"
systemctl reload nginx

echo -e "${GREEN}Quick deployment completed successfully!${NC}"

# Show logs
echo -e "${YELLOW}Recent application logs:${NC}"
sudo -u "$APP_USER" pm2 logs koncert24-hu --lines 10
