// Chat en tiempo real usando Server-Sent Events (SSE) y peticiones HTTP.
// No requiere paquetes adicionales: funciona con Express y el navegador.
import { randomBytes, randomUUID } from 'node:crypto';

const sessions = new Map(); // token -> { id, profile, stream, ... }
const globalHistory = [];
const privateHistory = new Map();
const MAX_MESSAGES = 100;
const allowedColors = new Set(['blue', 'mint', 'peach', 'lavender', 'yellow', 'slate']);

function compact(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = compact(raw.name, 32);
  if (name.length < 2) return null;
  const city = compact(raw.city, 36);
  const color = allowedColors.has(raw.color) ? raw.color : 'blue';
  let website = '';
  if (typeof raw.website === 'string' && raw.website.trim()) {
    try {
      const parsed = new URL(raw.website.trim());
      if (['http:', 'https:'].includes(parsed.protocol) && parsed.hostname && parsed.toString().length <= 240) {
        website = parsed.toString();
      }
    } catch { /* Enlace no válido: no se publica. */ }
  }
  return { name, city, color, website };
}

const online = () => Array.from(sessions.values())
  .filter((entry) => entry.stream && !entry.stream.destroyed)
  .map(({ id, profile }) => ({ id, ...profile }));

function send(entry, name, value) {
  if (!entry.stream || entry.stream.destroyed) return;
  try {
    entry.stream.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
  } catch { /* Un cliente desconectado se limpia en el cierre de la conexión. */ }
}

function broadcast(name, payload) {
  for (const entry of sessions.values()) send(entry, name, payload);
}

function broadcastPresence() { broadcast('presence:update', online()); }
function remember(list, item) {
  list.push(item);
  if (list.length > MAX_MESSAGES) list.shift();
}
function privateKey(a, b) { return [a, b].sort().join('::'); }
function findById(id) {
  return Array.from(sessions.values()).find((u) => u.id === id && u.stream && !u.stream.destroyed);
}
function getSession(req) {
  const token = req.body?.token || req.query?.token;
  return typeof token === 'string' ? sessions.get(token) : null;
}

function disconnect(entry) {
  if (!entry || !sessions.has(entry.token)) return;
  sessions.delete(entry.token);
  clearTimeout(entry.joinTimer);
  clearInterval(entry.heartbeat);
  if (entry.stream && !entry.stream.destroyed) entry.stream.end();
  for (const key of privateHistory.keys()) {
    if (key.split('::').includes(entry.id)) privateHistory.delete(key);
  }
  if (entry.wasOnline) {
    broadcastPresence();
    broadcast('user:activity', { name: entry.profile.name, action: 'left', time: Date.now() });
  }
}

export function registrarChat(app) {
  // El navegador envía su perfil antes de abrir la conexión de eventos.
  app.post('/api/join', (req, res) => {
    const profile = normalizeProfile(req.body);
    if (!profile) return res.status(400).json({ ok: false, error: 'Escribe un nombre de al menos 2 caracteres.' });
    const token = randomBytes(32).toString('hex');
    const entry = {
      token, id: randomUUID(), profile, stream: null,
      wasOnline: false, lastMessageAt: 0, heartbeat: null, joinTimer: null
    };
    // Evita sesiones huérfanas si se cierra la pestaña antes de conectar SSE.
    entry.joinTimer = setTimeout(() => { if (!entry.stream) disconnect(entry); }, 15000);
    entry.joinTimer.unref?.();
    sessions.set(token, entry);
    res.json({ ok: true, id: entry.id, token, profile, users: [...online(), { id: entry.id, ...profile }], history: globalHistory });
  });

  app.get('/api/events', (req, res) => {
    const entry = getSession(req);
    if (!entry) return res.status(401).end();
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write(': conexión establecida\nretry: 1500\n\n');
    if (entry.stream && entry.stream !== res && !entry.stream.destroyed) entry.stream.end();
    entry.stream = res;
    clearTimeout(entry.joinTimer);
    clearInterval(entry.heartbeat);
    entry.wasOnline = true;
    entry.heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(': ping\n\n');
    }, 15000);
    entry.heartbeat.unref?.();
    send(entry, 'presence:update', online());
    broadcastPresence();
    broadcast('user:activity', { name: entry.profile.name, action: 'joined', time: Date.now() });
    res.on('close', () => { if (entry.stream === res) disconnect(entry); });
  });

  app.post('/api/message', (req, res) => {
    const entry = getSession(req);
    if (!entry || !entry.stream || entry.stream.destroyed) {
      return res.status(401).json({ ok: false, error: 'Primero debes entrar al chat.' });
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 500) {
      return res.status(400).json({ ok: false, error: 'El mensaje debe tener entre 1 y 500 caracteres.' });
    }
    if (Date.now() - entry.lastMessageAt < 350) {
      return res.status(429).json({ ok: false, error: 'Envía los mensajes un poco más despacio.' });
    }
    const scope = req.body?.scope === 'private' ? 'private' : 'global';
    const to = typeof req.body?.to === 'string' ? req.body.to : '';
    const recipient = scope === 'private' ? findById(to) : null;
    if (scope === 'private' && (!recipient || recipient.id === entry.id)) {
      return res.status(400).json({ ok: false, error: 'Ese usuario ya no está conectado.' });
    }
    entry.lastMessageAt = Date.now();
    const message = {
      id: randomUUID(), scope, from: entry.id, fromName: entry.profile.name,
      fromColor: entry.profile.color, to: scope === 'private' ? to : null,
      text, time: Date.now()
    };
    if (scope === 'global') {
      remember(globalHistory, message);
      broadcast('message:global', message);
    } else {
      const key = privateKey(entry.id, to);
      if (!privateHistory.has(key)) privateHistory.set(key, []);
      remember(privateHistory.get(key), message);
      send(entry, 'message:private', message);
      send(recipient, 'message:private', message);
    }
    res.json({ ok: true });
  });

  app.post('/api/private-history', (req, res) => {
    const entry = getSession(req);
    const recipient = findById(req.body?.otherId);
    if (!entry?.stream || !recipient || recipient.id === entry.id) {
      return res.status(401).json({ ok: false, messages: [] });
    }
    res.json({ ok: true, messages: privateHistory.get(privateKey(entry.id, recipient.id)) || [] });
  });

  app.post('/api/leave', (req, res) => {
    disconnect(getSession(req));
    res.json({ ok: true });
  });
}
