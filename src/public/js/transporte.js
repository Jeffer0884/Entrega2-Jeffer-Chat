// Transporte nativo para el chat: EventSource (mensajes entrantes) + fetch (salientes).
// Proporciona la misma interfaz pequeña que utiliza chat.js: on, emit, disconnect.
export function conectarChat() {
  const listeners = new Map();
  let token = null;
  let stream = null;
  let stopped = false;
  let retryTimer = null;
  let starting = false;
  const transport = {
    connected: false,
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    emit(event, payload, callback) {
      if (event === 'user:join') {
        join(payload, callback);
      } else if (event === 'message:send') {
        post('/api/message', { token, ...payload }).then(callback).catch(() => callback?.({ ok: false, error: 'Error de conexión.' }));
      } else if (event === 'history:private') {
        post('/api/private-history', { token, otherId: payload }).then(callback).catch(() => callback?.({ ok: false, messages: [] }));
      }
    },
    disconnect() {
      stopped = true;
      clearTimeout(retryTimer);
      stream?.close();
      transport.connected = false;
      if (token) post('/api/leave', { token }).catch(() => {});
    }
  };

  function notify(name, data) { for (const fn of listeners.get(name) || []) fn(data); }

  async function post(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const result = await response.json();
    return result;
  }

  async function join(profile, callback) {
    if (stopped || starting) return;
    starting = true;
    try {
      const response = await post('/api/join', profile);
      if (!response.ok) { callback?.(response); starting = false; return; }
      token = response.token;
      // Solo se da por conectada cuando el canal SSE esté abierto.
      stream = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
      for (const name of ['presence:update', 'message:global', 'message:private', 'user:activity']) {
        stream.addEventListener(name, (event) => {
          try { notify(name, JSON.parse(event.data)); } catch { /* ignorar datos incompletos */ }
        });
      }
      stream.onopen = () => {
        transport.connected = true;
        starting = false;
        callback?.(response);
        callback = null;
      };
      stream.onerror = () => {
        if (stopped) return;
        transport.connected = false;
        stream?.close();
        notify('disconnect');
        if (token) post('/api/leave', { token }).catch(() => {});
        starting = false;
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => notify('connect'), 2000);
      };
    } catch {
      starting = false;
      callback?.({ ok: false, error: 'No se pudo conectar con el servidor.' });
      notify('disconnect');
      retryTimer = setTimeout(() => notify('connect'), 2000);
    }
  }

  // Los handlers del archivo chat.js se registran antes de avisar connect.
  queueMicrotask(() => notify('connect'));
  return transport;
}
