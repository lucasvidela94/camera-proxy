#!/bin/bash
set -e

# Camera Proxy - Raspberry Pi Setup Script
# Tested on: Raspberry Pi OS (Debian Bookworm)

echo "==================================="
echo "Camera Proxy - Raspberry Pi Setup"
echo "==================================="
echo ""

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null && [ -z "$FORCE_INSTALL" ]; then
    echo "Warning: This doesn't appear to be a Raspberry Pi"
    echo "Set FORCE_INSTALL=1 to continue anyway"
    read -p "Continue? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
echo "[1/6] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install FFmpeg
echo "[2/6] Installing FFmpeg..."
sudo apt install -y ffmpeg

# Check FFmpeg installation
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: FFmpeg installation failed"
    exit 1
fi
echo "FFmpeg version: $(ffmpeg -version | head -n1)"

# Install Node.js via NodeSource
echo "[3/6] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node -v)"
fi

# Install pnpm
echo "[4/6] Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    sudo npm install -g pnpm
else
    echo "pnpm already installed: $(pnpm -v)"
fi

# Install project dependencies
echo "[5/6] Installing project dependencies..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
pnpm install

# Setup systemd service
echo "[6/6] Setting up systemd service..."
SERVICE_FILE="/etc/systemd/system/camera-proxy.service"

# Get current user
CURRENT_USER=$(whoami)
WORKING_DIR=$(pwd)

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Camera Proxy Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$WORKING_DIR
ExecStart=$(which node) server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=WS_PORT=8080

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable camera-proxy

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "Commands:"
echo "  sudo systemctl start camera-proxy    # Start server"
echo "  sudo systemctl stop camera-proxy     # Stop server"
echo "  sudo systemctl restart camera-proxy  # Restart server"
echo "  sudo systemctl status camera-proxy   # Check status"
echo "  journalctl -u camera-proxy -f        # View logs"
echo ""
echo "The server will start automatically on boot."
echo ""
echo "Access the dashboard at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
