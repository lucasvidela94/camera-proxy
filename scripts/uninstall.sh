#!/bin/bash
set -e

echo "==================================="
echo "Camera Proxy - Uninstall"
echo "==================================="
echo ""

read -p "This will stop and remove the camera-proxy service. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

echo "Stopping service..."
sudo systemctl stop camera-proxy 2>/dev/null || true

echo "Disabling service..."
sudo systemctl disable camera-proxy 2>/dev/null || true

echo "Removing service file..."
sudo rm -f /etc/systemd/system/camera-proxy.service

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo ""
echo "Service removed. Project files are still in place."
echo "To fully remove, delete the project directory manually."
echo ""
