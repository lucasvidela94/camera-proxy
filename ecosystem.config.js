// PM2 Configuration
// Alternative to systemd for process management
//
// Usage:
//   pnpm add -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup

module.exports = {
    apps: [{
        name: 'camera-proxy',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '256M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
            WS_PORT: 8080
        }
    }]
};
