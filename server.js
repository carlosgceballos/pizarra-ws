import http from 'node:http';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Servidor HTTP: solo entrega la pagina de la pizarra
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' || req.url !== '/') {
    res.writeHead(404);
    return res.end();
  }
  try {
    const html = await readFile(new URL('./public/index.html', import.meta.url));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    res.writeHead(500);
    res.end('No se encontro public/index.html');
  }
});

// WebSocket montado sobre el mismo servidor y puerto
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Cliente conectado: ${ip} (total: ${wss.clients.size})`);

  ws.on('message', (data) => {
    broadcast(data, ws);
  });

  ws.on('close', () => {
    console.log(`Cliente desconectado: ${ip} (total: ${wss.clients.size})`);
  });
});

// Reenvia el mensaje a todos menos al que lo mando
function broadcast(data, origen) {
  for (const cliente of wss.clients) {
    if (cliente !== origen && cliente.readyState === WebSocket.OPEN) {
      cliente.send(data.toString());
    }
  }
}

function ipsLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

server.listen(PORT, HOST, () => {
  console.log(`Pizarra escuchando en el puerto ${PORT}`);
  console.log(`  En esta maquina: http://localhost:${PORT}`);
  for (const ip of ipsLocales()) {
    console.log(`  En la red:       http://${ip}:${PORT}`);
  }
});
