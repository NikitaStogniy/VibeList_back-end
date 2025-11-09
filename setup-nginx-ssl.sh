#!/bin/bash

################################################################################
# VibeList Backend - Nginx + SSL Setup Script
#
# This script sets up Nginx as a reverse proxy with Let's Encrypt SSL
# for https://api.vibelist.cc
#
# Usage:
#   1. Copy this script to your server
#   2. Make it executable: chmod +x setup-nginx-ssl.sh
#   3. Run as root: sudo ./setup-nginx-ssl.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="api.vibelist.cc"
EMAIL="nikitastognii@gmail.com"  # Change this to your email
NGINX_CONF="/etc/nginx/sites-available/vibelist"
NGINX_ENABLED="/etc/nginx/sites-enabled/vibelist"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

log_info "=== VibeList Backend - Nginx + SSL Setup ==="
log_info "Domain: ${DOMAIN}"

# Step 1: Install Nginx
log_info "Step 1: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt update
    apt install -y nginx
    log_success "Nginx installed"
else
    log_success "Nginx already installed"
fi

# Step 2: Install Certbot
log_info "Step 2: Installing Certbot (Let's Encrypt client)..."
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
    log_success "Certbot installed"
else
    log_success "Certbot already installed"
fi

# Step 3: Create temporary Nginx config (without SSL)
log_info "Step 3: Creating temporary Nginx configuration..."
cat > ${NGINX_CONF} <<EOF
# Temporary configuration for Let's Encrypt validation
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf ${NGINX_CONF} ${NGINX_ENABLED}

# Test and reload Nginx
log_info "Testing Nginx configuration..."
if nginx -t; then
    systemctl reload nginx
    log_success "Nginx configuration applied"
else
    log_error "Nginx configuration test failed"
    exit 1
fi

# Step 4: Create directory for Let's Encrypt validation
log_info "Step 4: Creating directory for Let's Encrypt validation..."
mkdir -p /var/www/certbot
log_success "Directory created"

# Step 5: Obtain SSL certificate
log_info "Step 5: Obtaining SSL certificate from Let's Encrypt..."
log_warning "Make sure DNS for ${DOMAIN} points to this server!"
read -p "Press Enter to continue or Ctrl+C to abort..."

if certbot certonly --nginx -d ${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email; then
    log_success "SSL certificate obtained successfully"
else
    log_error "Failed to obtain SSL certificate"
    log_error "Make sure:"
    log_error "  1. DNS is configured correctly (${DOMAIN} -> $(curl -s ifconfig.me))"
    log_error "  2. Port 80 is open in firewall"
    log_error "  3. Nginx is running"
    exit 1
fi

# Step 6: Install full Nginx configuration with SSL
log_info "Step 6: Installing full Nginx configuration with SSL..."
cat > ${NGINX_CONF} <<'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.vibelist.cc;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.vibelist.cc;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/api.vibelist.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vibelist.cc/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logs
    access_log /var/log/nginx/vibelist-access.log;
    error_log /var/log/nginx/vibelist-error.log;

    # Client body size
    client_max_body_size 10M;

    # Proxy to backend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    location /api/v1/health {
        proxy_pass http://localhost:3000/api/v1/health;
        access_log off;
    }
}
EOF

# Test and reload Nginx
log_info "Testing final Nginx configuration..."
if nginx -t; then
    systemctl reload nginx
    log_success "Nginx reloaded with SSL configuration"
else
    log_error "Nginx configuration test failed"
    exit 1
fi

# Step 7: Setup automatic certificate renewal
log_info "Step 7: Setting up automatic certificate renewal..."
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    log_success "Automatic renewal configured (daily at 3 AM)"
else
    log_success "Automatic renewal already configured"
fi

# Step 8: Test SSL certificate
log_info "Step 8: Testing SSL certificate..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/v1/health | grep -q "200"; then
    log_success "SSL is working! HTTPS endpoint is accessible"
else
    log_warning "Could not verify HTTPS endpoint. Check manually: https://${DOMAIN}/api/v1/health"
fi

# Summary
echo ""
log_success "=== Setup Complete ==="
echo ""
log_info "Your API is now available at: https://${DOMAIN}"
log_info "Health check: https://${DOMAIN}/api/v1/health"
log_info "API docs: https://${DOMAIN}/api/docs"
echo ""
log_info "SSL certificate will auto-renew via cron job"
log_info "Certificate expires: $(date -d "$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/${DOMAIN}/cert.pem | cut -d= -f2)" +%Y-%m-%d)"
echo ""
log_info "Useful commands:"
echo "  - Test Nginx config: sudo nginx -t"
echo "  - Reload Nginx: sudo systemctl reload nginx"
echo "  - Check SSL cert: sudo certbot certificates"
echo "  - Renew manually: sudo certbot renew"
echo "  - View logs: sudo tail -f /var/log/nginx/vibelist-error.log"
echo ""
