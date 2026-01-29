# Camera Proxy

Sistema de streaming para camaras IP con proxy RTSP a HTTP. Ideal para Raspberry Pi.

## Caracteristicas

- Convierte streams RTSP a HTTP/MP4 usando FFmpeg
- WebSocket para estado en tiempo real
- Sistema de fallback con multiples URLs RTSP por camara
- UI minimalista sin dependencias
- Bajo consumo de recursos
- Auto-restart y arranque en boot

## Requisitos

- Node.js >= 18
- pnpm
- FFmpeg

## Instalacion rapida (Raspberry Pi)

```bash
git clone https://github.com/lucasvidela94/camera-proxy.git
cd camera-proxy
./scripts/setup-rpi.sh
```

El script instala todas las dependencias y configura el servicio para iniciar en boot.

### Comandos del servicio

```bash
sudo systemctl start camera-proxy     # Iniciar
sudo systemctl stop camera-proxy      # Detener
sudo systemctl restart camera-proxy   # Reiniciar
sudo systemctl status camera-proxy    # Ver estado
journalctl -u camera-proxy -f         # Ver logs en vivo
```

## Instalacion manual

```bash
# Instalar FFmpeg
sudo apt install ffmpeg    # Debian/Ubuntu/RPi OS
sudo pacman -S ffmpeg      # Arch

# Instalar dependencias
pnpm install

# Ejecutar
pnpm start
```

## Desarrollo

```bash
pnpm dev   # Hot reload con nodemon
```

## Configuracion

Variables de entorno:

| Variable | Default | Descripcion |
|----------|---------|-------------|
| PORT | 3000 | Puerto HTTP |
| WS_PORT | 8080 | Puerto WebSocket |

```bash
PORT=8000 WS_PORT=9000 pnpm start
```

## Agregar camaras

Editar el array `cameras` en `server.js`:

```javascript
{
    id: 'cam4',
    name: 'Nueva Camara',
    ip: '192.168.100.XXX',
    rtspUrls: [
        'rtsp://user:pass@192.168.100.XXX/live',
        'rtsp://user:pass@192.168.100.XXX/stream1',
    ],
    currentUrlIndex: 0,
    status: 'offline'
}
```

El sistema prueba cada URL en orden hasta encontrar una que funcione.

## API

### GET /api/cameras

```json
[
  { "id": "cam1", "name": "Camara Principal", "ip": "192.168.100.74", "status": "online" }
]
```

### GET /stream/:cameraId

Stream de video MP4 fragmentado.

### WebSocket :8080

```javascript
const ws = new WebSocket('ws://raspberry-ip:8080');
ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  // type: 'status', data: array de camaras
};
```

## Estructura

```
camera-proxy/
├── server.js              # Servidor Express + WebSocket
├── public/
│   └── index.html         # UI del panel
├── scripts/
│   ├── setup-rpi.sh       # Setup automatico para RPi
│   └── uninstall.sh       # Desinstalar servicio
├── ecosystem.config.js    # Config PM2 (alternativa)
├── package.json
└── pnpm-lock.yaml
```

## Raspberry Pi - Hardware recomendado

| Modelo | RAM | Streams 720p | Streams 1080p |
|--------|-----|--------------|---------------|
| RPi 3B+ | 1GB | 2-3 | 1-2 |
| RPi 4 | 2GB | 4-5 | 2-3 |
| RPi 4 | 4GB | 6-8 | 4-5 |

Nota: Los limites dependen del bitrate de las camaras y el uso de CPU para transcoding.

## Detectar camaras en la red

```bash
# Escanear red
nmap -sn 192.168.100.0/24

# Verificar puerto RTSP
nmap -p 554 192.168.100.XXX

# Probar conexion
ffmpeg -rtsp_transport tcp -i "rtsp://admin:admin@192.168.100.XXX/live" -t 3 -f null -
```

## URLs RTSP comunes

```
rtsp://user:pass@IP/live
rtsp://user:pass@IP/stream1
rtsp://user:pass@IP/h264
rtsp://user:pass@IP/cam/realmonitor?channel=1&subtype=0
rtsp://user:pass@IP:554/Streaming/Channels/101
```

## Arquitectura

```
Clientes (Browser/App)
         |
         | HTTP/WebSocket
         v
+-------------------+
|  Raspberry Pi     |
|  camera-proxy     |
|  (Node.js)        |
+-------------------+
         |
         | FFmpeg (RTSP->MP4)
         v
+-------------------+
|  Camaras IP       |
|  (Red local)      |
+-------------------+
```

## Troubleshooting

### Puerto en uso

```bash
lsof -i :8080 -t | xargs kill -9
lsof -i :3000 -t | xargs kill -9
```

### Camara no conecta

1. `ping 192.168.100.XXX`
2. `ffplay "rtsp://user:pass@IP/live"`
3. Revisar logs: `journalctl -u camera-proxy -f`

### Stream lento

- Usar substream: `rtsp://...?subtype=1`
- Reducir resolucion en la camara
- Verificar ancho de banda

### Errores FFmpeg

- `Connection refused`: Puerto 554 cerrado
- `401 Unauthorized`: Credenciales incorrectas
- `Timeout`: Red lenta

## Alternativa: PM2

Si prefieres PM2 en lugar de systemd:

```bash
pnpm add -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Desinstalar

```bash
./scripts/uninstall.sh
```

## Licencia

MIT
