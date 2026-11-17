import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { PeerServer } from 'peer';
import selfsigned from 'selfsigned';

const PORT = Number(process.env.PORT) || 3000;
const PEER_PORT = Number(process.env.PEER_PORT) || 9000;
const HTTPS = process.env.HTTPS === 'true';
const HOST = '0.0.0.0';

// Con HTTPS=true se arma un certificado propio para localhost y las IPs de esta maquina.
// Hace falta porque el navegador no da la camara por http fuera de localhost
let ssl = null;
if (HTTPS) {
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'pizarra' }], {
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          ...ipsLocales().map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });
  ssl = { key: pems.private, cert: pems.cert };
}

// Archivos que entrega el servidor HTTP
const archivos = {
  '/': { ruta: './public/index.html', tipo: 'text/html; charset=utf-8' },
  '/peerjs.min.js': { ruta: './node_modules/peerjs/dist/peerjs.min.js', tipo: 'text/javascript; charset=utf-8' },
};

async function atender(req, res) {
  const archivo = archivos[req.url];
  if (req.method !== 'GET' || !archivo) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const contenido = await readFile(new URL(archivo.ruta, import.meta.url));
    // no-store para que el navegador no se quede con una copia vieja de la pagina
    res.writeHead(200, { 'Content-Type': archivo.tipo, 'Cache-Control': 'no-store' });
    res.end(contenido);
  } catch {
    res.writeHead(500);
    res.end(`No se encontro ${archivo.ruta}`);
  }
}

const server = ssl ? https.createServer(ssl, atender) : http.createServer(atender);

// Servidor de la libreria peer to peer, lo usan los navegadores para armar la conexion directa
PeerServer({ port: PEER_PORT, path: '/peerjs', ...(ssl && { ssl }) });

// Servidor de senalizacion: WebSocket montado sobre el mismo servidor y puerto
const wss = new WebSocketServer({ server });
let siguienteId = 1;

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  ws.id = siguienteId++;
  console.log(`Cliente ${ws.id} conectado: ${ip} (total: ${wss.clients.size})`);

  enviar(ws, { tipo: 'bienvenida', id: ws.id, puertoPeer: PEER_PORT });
  enviarLista();

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.tipo === 'trazo') {
      broadcast(msg, ws);
    } else if (msg.tipo === 'limpiar') {
      broadcast({ tipo: 'limpiar', de: ws.id }, ws);
    } else if (msg.tipo === 'listo' || msg.tipo === 'apagado') {
      // Avisos de la videollamada: van a los demas con el id de quien lo manda
      broadcast({ tipo: msg.tipo, de: ws.id }, ws);
    }
  });

  ws.on('close', () => {
    console.log(`Cliente ${ws.id} desconectado: ${ip} (total: ${wss.clients.size})`);
    enviarLista();
  });
});

function enviar(cliente, msg) {
  if (cliente.readyState === WebSocket.OPEN) cliente.send(JSON.stringify(msg));
}

// Reenvia el mensaje a todos menos al que lo mando
function broadcast(msg, origen) {
  for (const cliente of wss.clients) {
    if (cliente !== origen) enviar(cliente, msg);
  }
}

// Le manda a todos la lista de conexiones actualizada
function enviarLista() {
  const conexiones = [...wss.clients].filter((c) => c.readyState === WebSocket.OPEN).map((c) => c.id);
  for (const cliente of wss.clients) enviar(cliente, { tipo: 'lista', conexiones });
}

function ipsLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

server.listen(PORT, HOST, () => {
  const protocolo = ssl ? 'https' : 'http';
  console.log(`Pizarra escuchando en el puerto ${PORT} (peer to peer en el ${PEER_PORT})`);
  console.log(`  En esta maquina: ${protocolo}://localhost:${PORT}`);
  for (const ip of ipsLocales()) {
    console.log(`  En la red:       ${protocolo}://${ip}:${PORT}`);
  }
});
