const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;
const CONNECTION_TIMEOUT = 10000;
const STATUS_INTERVAL = 5000;

const cameras = [
    {
        id: 'cam1',
        name: 'Camara Principal',
        ip: '192.168.100.74',
        rtspUrls: [
            'rtsp://admin:admin@192.168.100.74/live',
            'rtsp://admin:123456@192.168.100.74/live',
            'rtsp://admin:admin@192.168.100.74/stream1',
            'rtsp://admin:admin@192.168.100.74/h264',
            'rtsp://admin:admin@192.168.100.74/cam/realmonitor?channel=1&subtype=00'
        ],
        currentUrlIndex: 0,
        status: 'offline'
    },
    {
        id: 'cam2',
        name: 'Camara Secundaria',
        ip: '192.168.100.66',
        rtspUrls: [
            'rtsp://admin:123456@192.168.100.66/live',
            'rtsp://admin:admin@192.168.100.66/live',
            'rtsp://admin:123456@192.168.100.66/stream1',
            'rtsp://admin:admin@192.168.100.66/stream1',
            'rtsp://admin:123456@192.168.100.66/h264'
        ],
        currentUrlIndex: 0,
        status: 'offline'
    },
    {
        id: 'cam3',
        name: 'Camara Tercera',
        ip: '192.168.100.76',
        rtspUrls: [
            'rtsp://admin:admin@192.168.100.76/live',
            'rtsp://admin:123456@192.168.100.76/live',
            'rtsp://admin:admin@192.168.100.76/stream1',
            'rtsp://admin:admin@192.168.100.76/h264',
            'rtsp://admin:admin@192.168.100.76/cam/realmonitor?channel=1&subtype=00'
        ],
        currentUrlIndex: 0,
        status: 'offline'
    }
];

const activeStreams = new Map();

function getCameraRtspUrl(camera) {
    return camera.rtspUrls[camera.currentUrlIndex];
}

function nextRtspUrl(camera) {
    camera.currentUrlIndex = (camera.currentUrlIndex + 1) % camera.rtspUrls.length;
    return getCameraRtspUrl(camera);
}

function getCameraPublicData(cam) {
    return {
        id: cam.id,
        name: cam.name,
        ip: cam.ip,
        status: cam.status
    };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/cameras', (req, res) => {
    res.json(cameras.map(getCameraPublicData));
});

app.get('/stream/:cameraId', (req, res) => {
    const camera = cameras.find(c => c.id === req.params.cameraId);

    if (!camera) {
        return res.status(404).json({ error: 'Camera not found' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-cache');

    const attemptConnection = (attempt = 0) => {
        if (attempt >= camera.rtspUrls.length) {
            camera.status = 'offline';
            return res.end();
        }

        const rtspUrl = getCameraRtspUrl(camera);
        console.log(`[${camera.id}] Conectando (${attempt + 1}/${camera.rtspUrls.length})`);

        const ffmpegProcess = spawn('ffmpeg', [
            '-rtsp_transport', 'tcp',
            '-i', rtspUrl,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov',
            '-loglevel', 'error',
            '-analyzeduration', '1000000',
            '-probesize', '1000000',
            'pipe:1'
        ]);

        activeStreams.set(camera.id, ffmpegProcess);

        let dataReceived = false;
        const timeout = setTimeout(() => {
            if (!dataReceived) {
                console.log(`[${camera.id}] Timeout, siguiente URL...`);
                ffmpegProcess.kill();
                nextRtspUrl(camera);
                attemptConnection(attempt + 1);
            }
        }, CONNECTION_TIMEOUT);

        ffmpegProcess.stdout.on('data', (data) => {
            if (!dataReceived) {
                dataReceived = true;
                clearTimeout(timeout);
                camera.status = 'online';
                console.log(`[${camera.id}] Conectado`);
            }
            res.write(data);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error(`[${camera.id}] FFmpeg: ${data.toString().trim()}`);
        });

        ffmpegProcess.on('close', (code) => {
            clearTimeout(timeout);
            activeStreams.delete(camera.id);
            if (!dataReceived && attempt < camera.rtspUrls.length - 1) {
                nextRtspUrl(camera);
                attemptConnection(attempt + 1);
            } else {
                camera.status = 'offline';
                res.end();
            }
        });

        res.on('close', () => {
            clearTimeout(timeout);
            ffmpegProcess.kill();
            activeStreams.delete(camera.id);
            camera.status = 'offline';
        });
    };

    attemptConnection();
});

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Error: Puerto ${WS_PORT} en uso. Ejecuta: lsof -i :${WS_PORT} -t | xargs kill -9`);
        process.exit(1);
    }
    console.error('WebSocket server error:', err.message);
});

wss.on('connection', (ws) => {
    console.log('WebSocket: cliente conectado');

    const sendStatus = () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'status',
                data: cameras.map(getCameraPublicData)
            }));
        }
    };

    sendStatus();
    const interval = setInterval(sendStatus, STATUS_INTERVAL);

    ws.on('close', () => {
        clearInterval(interval);
        console.log('WebSocket: cliente desconectado');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
        clearInterval(interval);
    });
});

const server = app.listen(PORT, () => {
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`Camaras: ${cameras.map(c => c.name).join(', ')}`);
});

function shutdown() {
    console.log('\nCerrando servidor...');

    activeStreams.forEach((process, id) => {
        console.log(`Deteniendo stream: ${id}`);
        process.kill();
    });

    wss.close();
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
