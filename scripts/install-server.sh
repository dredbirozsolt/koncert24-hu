#!/bin/bash

# Koncert24.hu Automatic Server Installation Script
# Usage: sudo ./install-server.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
APP_DIR="/var/www/koncert24"
APP_USER="www-data"
DOMAIN="koncert24.hu"
DB_NAME="dmf_koncert24"
DB_USER="dmf_koncert24"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Koncert24.hu Server Installation${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (use sudo)${NC}" 
   exit 1
fi

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    if [ -n "$default_value" ]; then
        echo -e "${YELLOW}$prompt [$default_value]:${NC}"
    else
        echo -e "${YELLOW}$prompt:${NC}"
    fi
    
    read -r input
    if [ -z "$input" ] && [ -n "$default_value" ]; then
        input="$default_value"
    fi
    
    eval "$var_name='$input'"
}

# Function to generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Get configuration from user
echo -e "${BLUE}Configuration Setup${NC}"
echo "======================================"

prompt_input "Domain name" DOMAIN "koncert24.hu"
prompt_input "Application directory" APP_DIR "/var/www/koncert24"
prompt_input "Database name" DB_NAME "dmf_koncert24"
prompt_input "Database user" DB_USER "dmf_koncert24"

# Generate passwords
DB_PASSWORD=$(generate_password)
SESSION_SECRET=$(generate_password)
ROOT_PASSWORD=""

echo -e "${YELLOW}Please enter MySQL root password (or press Enter if not set):${NC}"
read -s ROOT_PASSWORD

echo -e "${GREEN}Configuration completed!${NC}"
echo ""

# Step 1: Update system
echo -e "${BLUE}Step 1: Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

# Step 2: Install Node.js 16
echo -e "${BLUE}Step 2: Installing Node.js 16...${NC}"
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
echo -e "${GREEN}Node.js installed: $node_version${NC}"

# Step 3: Install MySQL
echo -e "${BLUE}Step 3: Installing MySQL Server...${NC}"
apt-get install -y mysql-server

# Start MySQL service
systemctl start mysql
systemctl enable mysql

# Step 4: Install other dependencies
echo -e "${BLUE}Step 4: Installing additional packages...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx ufw curl

# Step 5: Install PM2
echo -e "${BLUE}Step 5: Installing PM2...${NC}"
npm install -g pm2

# Step 6: Create application directory
echo -e "${BLUE}Step 6: Setting up application directory...${NC}"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"

# Step 7: Setup database
echo -e "${BLUE}Step 7: Setting up database...${NC}"

# Create MySQL commands
mysql_commands="
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
"

# Execute MySQL commands
if [ -n "$ROOT_PASSWORD" ]; then
    echo "$mysql_commands" | mysql -u root -p"$ROOT_PASSWORD"
else
    echo "$mysql_commands" | mysql -u root
fi

echo -e "${GREEN}Database setup completed!${NC}"

# Step 8: Create .env file
echo -e "${BLUE}Step 8: Creating environment configuration...${NC}"
cat > "$APP_DIR/.env" << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3000
BASE_PATH=/
DOMAIN=https://$DOMAIN

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Session Configuration
SESSION_SECRET=$SESSION_SECRET
SESSION_MAX_AGE=86400000

# vTiger CRM Configuration (Update these values)
VTIGER_URL=https://dmf.hu/crmtest
VTIGER_USERNAME=admin
VTIGER_ACCESS_KEY=3rQp0gZxmJPqr9n9

# Rate Limiting (Production settings)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50

# Cache Configuration
CACHE_TTL=600000

# Email Configuration (Update these values)
EMAIL_METHOD=smtp
EMAIL_HOST=smtp.elasticemail.com
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=iroda@dmf.hu
EMAIL_PASS=YOUR_EMAIL_PASSWORD
EMAIL_FROM=iroda@dmf.hu
EMAIL_TO=iroda@dmf.hu

# Booking notifications
BOOKING_EMAIL=iroda@dmf.hu

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# GeoNames API Configuration
GEONAMES_USERNAME=dredbirozsolt
EOF

# Step 9: Create PM2 ecosystem file
echo -e "${BLUE}Step 9: Creating PM2 configuration...${NC}"
cat > "$APP_DIR/ecosystem.config.json" << EOF
{
  "name": "koncert24-hu",
  "script": "server.js",
  "cwd": "$APP_DIR",
  "user": "$APP_USER",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3000
  },
  "log_file": "$APP_DIR/logs/pm2.log",
  "error_file": "$APP_DIR/logs/pm2-error.log",
  "out_file": "$APP_DIR/logs/pm2-out.log",
  "max_memory_restart": "500M",
  "restart_delay": 4000,
  "autorestart": true,
  "watch": false
}
EOF

# Step 10: Create Nginx configuration
echo -e "${BLUE}Step 10: Creating Nginx configuration...${NC}"
cat > "/etc/nginx/sites-available/$DOMAIN" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_redirect off;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri @proxy;
    }
    
    location @proxy {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;
}
EOF

# Enable site
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Step 11: Setup firewall
echo -e "${BLUE}Step 11: Configuring firewall...${NC}"
ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 3306  # MySQL (remove if not needed)

# Step 12: Set permissions
echo -e "${BLUE}Step 12: Setting up permissions...${NC}"

# Create www-data user if doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/logs"

# Step 13: Create post-deployment script
echo -e "${BLUE}Step 13: Creating deployment script...${NC}"
cat > "$APP_DIR/deploy.sh" << 'EOF'
#!/bin/bash

# Deployment script for Koncert24.hu
# Usage: ./deploy.sh

set -e

APP_DIR="/var/www/koncert24"
APP_USER="www-data"

echo "Starting deployment..."

# Navigate to app directory
cd "$APP_DIR"

# Install/update dependencies
echo "Installing dependencies..."
sudo -u "$APP_USER" npm install --production

# Run database migrations
echo "Running database migrations..."
sudo -u "$APP_USER" npm run migrate

# Restart application
echo "Restarting application..."
sudo -u "$APP_USER" pm2 restart koncert24-hu || sudo -u "$APP_USER" pm2 start ecosystem.config.json

# Reload Nginx
echo "Reloading Nginx..."
systemctl reload nginx

echo "Deployment completed successfully!"
EOF

chmod +x "$APP_DIR/deploy.sh"

# Step 14: Start services
echo -e "${BLUE}Step 14: Starting services...${NC}"
systemctl start nginx
systemctl enable nginx
systemctl reload nginx

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Completed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Upload your application files to: $APP_DIR"
echo "2. Run: cd $APP_DIR && sudo -u $APP_USER npm install"
echo "3. Run: cd $APP_DIR && sudo -u $APP_USER npm run migrate"
echo "4. Start application: sudo -u $APP_USER pm2 start ecosystem.config.json"
echo "5. Setup SSL: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo -e "${YELLOW}Generated passwords:${NC}"
echo "Database password: $DB_PASSWORD"
echo "Session secret: $SESSION_SECRET"
echo ""
echo -e "${YELLOW}Configuration files created:${NC}"
echo "- Environment: $APP_DIR/.env"
echo "- PM2 config: $APP_DIR/ecosystem.config.json"
echo "- Nginx config: /etc/nginx/sites-available/$DOMAIN"
echo "- Deploy script: $APP_DIR/deploy.sh"
echo ""
echo -e "${GREEN}Your server is ready for deployment!${NC}"
