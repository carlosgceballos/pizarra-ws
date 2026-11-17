# Pizarra compartida

Pizarra en tiempo real con videollamada. Una computadora corre el servidor y las demas se conectan con su IP y puerto. Lo que dibuja uno le aparece a todos, usando WebSocket (`ws`). Ademas, dos conectados pueden verse y oirse con WebRTC: el servidor solo los presenta y despues la camara y el microfono viajan directo entre los dos navegadores, usando la libreria peer to peer PeerJS.

No necesita internet ni base de datos.

## Requisitos

- Node.js 24
- pnpm
- Para la pizarra entre varias computadoras: todas en la misma red (mismo Wi-Fi o switch)
- Para la videollamada: camara y microfono. Desde otros equipos hay que arrancar con `HTTPS=true` (ver "Videollamada desde otros equipos")

## Instalacion

```powershell
pnpm install
```

Copiar `.env.example` como `.env` y ajustar los puertos si hace falta:

```powershell
Copy-Item .env.example .env
```

| Variable | Para que es | Por defecto |
|----------|-------------|-------------|
| `PORT` | Pagina y WebSocket (pizarra y senalizacion) | 3000 |
| `PEER_PORT` | Servidor de la libreria peer to peer | 9000 |
| `HTTPS` | `true` para servir con https y un certificado propio | false |

## Ejecucion

En la computadora que hace de servidor:

```powershell
pnpm start
```

Al arrancar muestra las IPs de la red local. Desde las otras computadoras se abre en el navegador `http://<ip-del-servidor>:<puerto>`.

En la pagina, arriba a la izquierda, se escribe la IP y el puerto del servidor y se le da a **Conectar**. Si la pagina se abrio desde el servidor, ya vienen puestos. Mientras esta conectado el boton cambia a **Desconectar**, y el estado de la conexion se ve a la derecha.

La primera vez Windows pregunta si deja pasar a Node por el firewall: hay que permitirlo en redes privadas, si no las otras computadoras no se pueden conectar.

## Pizarra

- **Color:** elige el color del lapiz.
- **Borrador:** al activarlo se borra con una linea mas gruesa en vez de pintar. Se apaga con el mismo boton o al elegir un color. Lo que se borra tambien se borra en los demas.
- **Limpiar pizarra:** borra toda la pizarra de todos los conectados (pide confirmar antes).

## Videollamada

A la derecha sale la lista de **Conectados**, que manda el servidor cada vez que alguien entra o sale.

Todos los que estan conectados estan en la misma llamada, no hay que llamar a nadie. Cada uno decide si comparte con los botones **Prender camara** y **Prender microfono** de arriba, y los apaga con los mismos botones.

1. Al conectarse, el servidor le da un id a cada uno y lo pone en la lista.
2. La primera vez que alguien prende la camara o el microfono, su navegador pide permiso para las dos cosas, se conecta directo con el de cada uno de la lista y les manda el stream. El servidor no interviene en eso. Despues los botones solo prenden o apagan la camara o el microfono dentro de esa misma conexion, por eso con solo el microfono prendido a los demas les sale el recuadro en negro.
3. Si alguien entra despues, avisa que ya esta listo y los que estan compartiendo le mandan lo suyo.
4. Al apagar las dos cosas se avisa a los demas para que quiten el video.

Las conexiones son entre pares: una por cada uno que recibe.

Si el navegador no deja sonar un video porque todavia no se ha tocado nada en la pagina, el video sale sin sonido con un boton **Activar sonido**.

### Videollamada desde otros equipos

El navegador solo deja usar la camara y el microfono si la pagina se abrio en `localhost` o con https. Con http, desde otro equipo (`http://<ip>:<puerto>`) la pizarra funciona y se ve el video de los demas, pero no se puede prender la camara propia.

Para que todos puedan compartir se pone `HTTPS=true` en el `.env` y se vuelve a arrancar. El servidor arma un certificado propio al iniciar (no sale a internet) y las direcciones pasan a ser `https://<ip>:<puerto>`.

Como el certificado no lo firma nadie, la primera vez el navegador avisa que el sitio no es seguro: hay que entrar a opciones avanzadas y continuar. Si la pizarra conecta pero el video no llega, abrir una vez `https://<ip>:<PEER_PORT>/peerjs` en ese equipo, aceptar el aviso y recargar la pizarra.

## Estructura

```
pizarra-ws/
├── server.js          # Servidor HTTP + WebSocket + servidor peer to peer
└── public/
    ├── index.html     # Estructura de la pagina (barra, canvas, conectados y videos)
    ├── estilos.css    # Estilos
    └── pizarra.js     # Logica: conexion, videollamada y pizarra
```

## Mensajes

Los mensajes del WebSocket van en JSON.

| Tipo | Quien lo manda | Descripcion |
|------|----------------|-------------|
| `trazo` | Cliente | Un segmento de linea: `{ "tipo": "trazo", "x1", "y1", "x2", "y2", "color", "borrador" }`. Las coordenadas van de 0 a 1 (proporcion del ancho y alto del canvas) para que se vea igual en pantallas de distinto tamano. Con `borrador: true` el segmento borra en vez de pintar. El servidor lo reenvia a todos los demas |
| `limpiar` | Cliente | Borra toda la pizarra: `{ "tipo": "limpiar" }`. A los demas les llega con `de` |
| `bienvenida` | Servidor | Al conectarse: `{ "tipo": "bienvenida", "id", "puertoPeer" }`. El id que le toco y el puerto del servidor peer to peer |
| `lista` | Servidor | La lista de conexiones: `{ "tipo": "lista", "conexiones": [1, 2] }`. Se manda a todos cuando alguien entra o sale |
| `listo` | Cliente | Avisa que ya puede recibir video: `{ "tipo": "listo" }`. A los demas les llega con `de` (el id de quien lo mando) |
| `apagado` | Cliente | Avisa que apago camara y microfono: `{ "tipo": "apagado" }`. A los demas les llega con `de` |

La camara y el microfono no pasan por el WebSocket: van directo entre los navegadores con WebRTC.
