# Chat Global - proyecto original de motores de plantillas

Este proyecto **es el `clase_motor_plantillas` original**, ampliado con un chat de texto. No hay subproyectos, ni otro `package.json` ni un segundo servidor.

## Ejecutarlo

En VS Code, abre **esta carpeta** (`clase_motor_plantillas`) y ejecuta:

```bash
npm install
npm start
```

Abre **http://localhost:3000**. Primero ingresa tu nombre; después entras automáticamente al chat global. Para probar con dos personas, abre otra ventana de incógnito y entra con otro nombre. Desde el panel de usuarios conectados se puede abrir un privado, si quieres.

## Estructura

- `src/index.js`: **servidor Express original ampliado**, rutas de páginas y registro de la API.
- `src/util.js`: original sin cambios.
- `src/views/layouts/main.handlebars`: layout de Handlebars original, con la hoja de estilos global.
- `src/views/index.handlebars`: formulario inicial para ingresar al chat.
- `src/views/chat.handlebars`: sala global y privados opcionales.
- `src/views/contact.handlebars`: original sin cambios, en `/contact`.
- `src/views/ejemplo.handlebars`: contenido exacto de la antigua vista `index.handlebars`, en `/ejemplo`.
- `src/chat/realtime.js`: eventos en tiempo real, usuarios conectados, mensajes y API.
- `src/public/css/chat.css`: diseño plano sin degradados.
- `src/public/js/ingresar.js`, `chat.js`, `transporte.js`: interfaz y comunicación con el servidor.
- `package.json` y `package-lock.json`: **originales sin cambios**; no se requieren dependencias extra.

## Características

- Perfil antes de entrar: nombre obligatorio; ciudad, enlace y color de avatar opcionales.
- Chat global predeterminado, mensajes con nombre y hora, lista de conectados.
- Privados opcionales entre usuarios conectados.
- Solo texto: no hay videollamadas, llamadas, ni archivos.
- Actualización en tiempo real mediante **Server-Sent Events (SSE)** + `fetch`, sin Socket.IO ni paquetes adicionales.
- Conserva los últimos 100 mensajes globales **en memoria del servidor**. Los mensajes privados se guardan solo mientras ambos usuarios estén conectados. Al reiniciar el servidor, se elimina el historial.
- No hay registro de cuentas ni base de datos: es una demostración educativa, no una plataforma pública con autenticación.

## Puertos

Una sola aplicación: **http://localhost:3000**. Para usar otro puerto, define `PORT` en el entorno.
