# Camera Proxy

Sistema de streaming para camaras IP con proxy RTSP a HTTP.

## Requisitos

- Node.js >= 18
- pnpm
- FFmpeg

```bash
# Instalar FFmpeg (Debian/Ubuntu)
sudo apt install ffmpeg

# Instalar FFmpeg (Arch)
sudo pacman -S ffmpeg
```

## Instalacion

```bash
pnpm install
```

## Uso

```bash
# Desarrollo (con hot reload)
pnpm dev

# Produccion
pnpm start
```

## Configuracion

Variables de entorno opcionales:

| Variable | Default | Descripcion |
|----------|---------|-------------|
| PORT | 3000 | Puerto del servidor HTTP |
| WS_PORT | 8080 | Puerto del WebSocket |

Ejemplo:
```bash
PORT=8000 WS_PORT=9000 pnpm start
```

## API

### GET /api/cameras

Lista todas las camaras configuradas.

```json
[
  {
    "id": "cam1",
    "name": "Camara Principal",
    "ip": "192.168.100.74",
    "status": "online"
  }
]
```

### GET /stream/:cameraId

Stream de video MP4 fragmentado. Conecta al RTSP de la camara y convierte a MP4 via FFmpeg.

```
GET /stream/cam1
Content-Type: video/mp4
```

### WebSocket (puerto 8080)

Recibe actualizaciones de estado cada 5 segundos.

```javascript
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // type: 'status'
  // data: array de camaras con su estado actual
};
```

## Estructura

```
camera-proxy/
├── server.js          # Servidor Express + WebSocket
├── public/
│   └── index.html     # UI del panel de monitoreo
├── package.json
├── pnpm-lock.yaml
└── .gitignore
```

## Agregar una camara

Editar el array `cameras` en `server.js`:

```javascript
{
    id: 'cam4',
    name: 'Nueva Camara',
    ip: '192.168.100.XXX',
    rtspUrls: [
        'rtsp://user:pass@192.168.100.XXX/live',
        'rtsp://user:pass@192.168.100.XXX/stream1',
        // URLs alternativas para fallback
    ],
    currentUrlIndex: 0,
    status: 'offline'
}
```

El sistema intenta cada URL en orden hasta encontrar una que funcione.

## Detectar camaras en la red

```bash
# Escanear red local
nmap -sn 192.168.100.0/24

# Verificar puertos RTSP
nmap -p 554,8554 192.168.100.XXX

# Probar conexion RTSP
ffmpeg -rtsp_transport tcp -i "rtsp://admin:admin@192.168.100.XXX/live" -t 3 -f null -
```

## URLs RTSP comunes

Diferentes fabricantes usan diferentes paths:

```
rtsp://user:pass@IP/live
rtsp://user:pass@IP/stream1
rtsp://user:pass@IP/h264
rtsp://user:pass@IP/cam/realmonitor?channel=1&subtype=0
rtsp://user:pass@IP:554/Streaming/Channels/101
```

## Arquitectura

```
Clientes (Browser)
      |
      | HTTP / WebSocket
      v
+------------------+
|  Node.js Server  |
|  - Express       |
|  - WebSocket     |
+------------------+
      |
      | Spawn FFmpeg
      v
+------------------+
|     FFmpeg       |
|  RTSP -> MP4     |
+------------------+
      |
      | RTSP/TCP
      v
+------------------+
|   Camaras IP     |
+------------------+
```

## Troubleshooting

### Camara no conecta

1. Verificar conectividad:
   ```bash
   ping 192.168.100.XXX
   ```

2. Probar RTSP directamente:
   ```bash
   ffplay "rtsp://user:pass@192.168.100.XXX/live"
   ```

3. Revisar logs del servidor (muestra intentos de conexion)

### Stream lento o con lag

- Verificar ancho de banda de la red
- Reducir resolucion en la camara
- Usar substream en lugar de mainstream:
  ```
  rtsp://...?subtype=1  # substream (menor calidad, menos bandwidth)
  rtsp://...?subtype=0  # mainstream (mayor calidad)
  ```

### FFmpeg errores comunes

- `Connection refused`: Camara no responde en puerto 554
- `401 Unauthorized`: Credenciales incorrectas
- `Timeout`: Red lenta o camara sobrecargada

## Licencia

MIT
