import { conectarChat } from './transporte.js';
const STORAGE_KEY = 'chatapp:profile';
let profile;
try { profile = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { /* sin perfil */ }
if (!profile?.name || profile.name.trim().length < 2) {
  location.replace('/');
} else {
  startChat(profile);
}

function startChat(profile) {
  const $ = (selector) => document.querySelector(selector);
  const socket = conectarChat();
  const state = {
    selfId: null,
    current: 'global',
    otherId: null,
    users: [],
    global: [],
    private: new Map(),
    unread: new Map(),
    globalUnread: 0,
    joined: false
  };
  const viewport = $('#messageViewport');
  const messagesInner = $('#messagesInner');
  const input = $('#messageInput');
  const search = $('#searchUsers');
  const dialog = $('#profileDialog');
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const create = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function avatar(name, color = 'blue', className = '') {
    return create('span', `avatar avatar-${color} ${className}`, initials(name));
  }
  function timeLabel(time) {
    return new Date(time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  let toastTimeout;
  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { node.hidden = true; }, 3500);
  }
  function setConnection(connected) {
    $('#connectionBanner').hidden = connected;
    $('#sendButton').disabled = !connected;
    input.disabled = !connected;
  }
  function currentUser() { return state.users.find(u => u.id === state.otherId); }
  function setActiveNav() {
    $('#navGlobal').classList.toggle('is-active', state.current === 'global');
    $('#navUsers').classList.toggle('is-active', state.current === 'private');
    $('#globalRoom').classList.toggle('is-selected', state.current === 'global');
  }
  function closeSidebar() {
    $('#chatSidebar').classList.remove('show-mobile');
    $('#sidebarScrim').hidden = true;
  }
  function openSidebar() {
    $('#chatSidebar').classList.add('show-mobile');
    $('#sidebarScrim').hidden = false;
  }
  function openGlobal() {
    state.current = 'global';
    state.otherId = null;
    state.globalUnread = 0;
    $('#globalUnread').hidden = true;
    $('#chatHeaderIcon').replaceWith(makeRoomIcon());
    $('#chatTitle').textContent = 'Chat global';
    $('#otherProfileButton').hidden = true;
    $('#chatSubtitle').textContent = 'Una conversación para todos, en tiempo real.';
    $('#composerHint').textContent = 'Tu mensaje será visible para todas las personas conectadas';
    input.placeholder = 'Escribe algo para todos...';
    setActiveNav();
    renderUsers();
    renderMessages();
    closeSidebar();
    input.focus();
  }
  function makeRoomIcon() {
    const icon = create('span', 'header-icon room-symbol', '#');
    icon.id = 'chatHeaderIcon';
    return icon;
  }
  function openPrivate(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user || userId === state.selfId) return;
    state.current = 'private';
    state.otherId = userId;
    state.unread.delete(userId);
    $('#chatHeaderIcon').replaceWith(makePrivateIcon(user));
    $('#chatTitle').textContent = user.name;
    $('#otherProfileButton').hidden = false;
    $('#chatSubtitle').textContent = user.city ? `${user.city} · Conversación privada` : 'Conversación privada · Solo ustedes dos';
    $('#composerHint').textContent = `Solo ${user.name} y tú pueden ver estos mensajes`;
    input.placeholder = `Mensaje privado para ${user.name}...`;
    setActiveNav();
    renderUsers();
    renderMessages();
    closeSidebar();
    socket.emit('history:private', userId, (response) => {
      if (response?.ok) {
        state.private.set(userId, response.messages);
        if (state.current === 'private' && state.otherId === userId) renderMessages();
      }
    });
    input.focus();
  }
  function makePrivateIcon(user) {
    const icon = avatar(user.name, user.color, 'header-icon');
    icon.id = 'chatHeaderIcon';
    return icon;
  }
  function updateCounts() {
    const n = state.users.length;
    const copy = `${n} ${n === 1 ? 'persona conectada' : 'personas conectadas'}`;
    $('#headerOnlineCount').textContent = `${n} en línea`;
    $('#sidebarOnlineCount').textContent = copy;
    $('#onlineCountSmall').textContent = Math.max(0, n - (state.selfId ? 1 : 0));
  }
  function renderUsers() {
    const container = $('#onlineUsers');
    container.replaceChildren();
    const q = search.value.trim().toLocaleLowerCase('es');
    const others = state.users.filter(u => u.id !== state.selfId && (u.name.toLocaleLowerCase('es').includes(q) || u.city.toLocaleLowerCase('es').includes(q)));
    if (!others.length) {
      container.append(create('p', 'sidebar-placeholder', q ? 'No hay coincidencias.' : 'Aún no hay otras personas en línea.'));
      return;
    }
    for (const user of others) {
      const button = create('button', `person-item ${state.current === 'private' && state.otherId === user.id ? 'is-selected' : ''}`);
      button.type = 'button';
      button.append(avatar(user.name, user.color, 'person-avatar'));
      const copy = create('span', 'person-copy');
      copy.append(create('strong', '', user.name), create('small', '', user.city || 'En línea'));
      const right = create('span', 'person-presence');
      const amount = state.unread.get(user.id) || 0;
      right.append(amount ? create('span', 'unread-count', String(amount)) : create('span', 'green-dot'));
      button.append(copy, right);
      button.title = `Escribir mensaje privado a ${user.name}`;
      button.addEventListener('click', () => openPrivate(user.id));
      container.append(button);
    }
  }
  function emptyState() {
    const wrap = create('div', 'empty-chat');
    const privateMode = state.current === 'private';
    wrap.append(create('div', 'empty-chat-icon', privateMode ? '✉' : '#'));
    wrap.append(create('h2', '', privateMode ? 'Una conversación entre ustedes' : '¡Bienvenido al chat global!'));
    wrap.append(create('p', '', privateMode ? 'Los mensajes de esta conversación solo se muestran a ustedes dos mientras sigan conectados.' : 'Este espacio es para todos. Envía el primer mensaje y comienza la conversación.'));
    return wrap;
  }
  function renderMessages() {
    messagesInner.replaceChildren();
    const list = state.current === 'global' ? state.global : (state.private.get(state.otherId) || []);
    if (!list.length) {
      messagesInner.append(emptyState());
      return;
    }
    const today = new Date().toDateString();
    let lastDay = '';
    for (const msg of list) {
      const date = new Date(msg.time);
      const day = date.toDateString();
      if (day !== lastDay) {
        const separator = create('div', 'day-separator');
        separator.append(create('span', '', day === today ? 'Hoy' : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })));
        messagesInner.append(separator);
        lastDay = day;
      }
      const mine = msg.from === state.selfId;
      const row = create('div', `message-line ${mine ? 'is-mine' : 'is-other'}`);
      if (!mine) row.append(avatar(msg.fromName, msg.fromColor, 'message-avatar'));
      const stack = create('div', 'message-stack');
      stack.append(create('span', 'message-author', mine ? 'Tú' : msg.fromName));
      stack.append(create('div', 'message-bubble', msg.text));
      stack.append(create('span', 'message-time', timeLabel(msg.time)));
      row.append(stack);
      messagesInner.append(row);
    }
    requestAnimationFrame(() => { viewport.scrollTop = viewport.scrollHeight; });
  }
  function setProfile(viewUser = profile) {
    const isMine = viewUser === profile;
    $('#dialogTitle').textContent = isMine ? 'Mi perfil' : 'Perfil del usuario';
    $('#dialogHelp').textContent = isMine
      ? 'Tus datos son visibles para los demás cuando ven tu perfil. Puedes volver a ingresar para cambiarlos.'
      : 'Puedes conversar por privado con esta persona. Su enlace es opcional y lo ha compartido en su perfil.';
    $('#leaveChat').hidden = !isMine;
    const myAvatar = $('#railAvatar');
    myAvatar.className = `avatar avatar-${profile.color || 'blue'}`;
    myAvatar.textContent = initials(profile.name);
    $('#railName').textContent = profile.name;
    const dialogAvatar = $('#dialogAvatar');
    dialogAvatar.className = `avatar avatar-${viewUser.color || 'blue'} profile-avatar`;
    dialogAvatar.textContent = initials(viewUser.name);
    $('#dialogName').textContent = viewUser.name;
    $('#dialogCity').textContent = viewUser.city || 'Sin especificar';
    const websiteSlot = $('#dialogWebsite');
    websiteSlot.replaceChildren();
    if (viewUser.website) {
      try {
        const link = new URL(viewUser.website);
        if (['http:', 'https:'].includes(link.protocol)) {
          const anchor = create('a', 'profile-website', link.hostname);
          anchor.href = link.toString();
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          websiteSlot.append(anchor);
        } else { websiteSlot.textContent = 'Sin enlace'; }
      } catch { websiteSlot.textContent = 'Sin enlace'; }
    } else { websiteSlot.textContent = 'Sin enlace'; }
  }

  socket.on('connect', () => {
    socket.emit('user:join', profile, (reply) => {
      if (!reply?.ok) { toast(reply?.error || 'No se pudo ingresar.'); return; }
      state.joined = true;
      state.selfId = reply.id;
      state.users = reply.users;
      state.global = reply.history;
      state.private.clear();
      state.unread.clear();
      updateCounts();
      setConnection(true);
      setProfile();
      openGlobal();
    });
  });
  socket.on('disconnect', () => {
    state.joined = false;
    setConnection(false);
  });
  socket.on('presence:update', (users) => {
    state.users = users;
    updateCounts();
    renderUsers();
    if (state.current === 'private' && !currentUser()) {
      $('#chatSubtitle').textContent = 'Esta persona ya no está conectada';
      $('#composerHint').textContent = 'Vuelve al chat global para seguir conversando';
      input.disabled = true;
      $('#sendButton').disabled = true;
    } else if (state.current === 'private' && state.joined) {
      input.disabled = false;
      $('#sendButton').disabled = false;
    }
  });
  socket.on('message:global', (message) => {
    if (state.global.some(m => m.id === message.id)) return;
    state.global.push(message);
    if (state.global.length > 100) state.global.shift();
    if (state.current === 'global') renderMessages();
    else {
      state.globalUnread++;
      $('#globalUnread').textContent = String(state.globalUnread);
      $('#globalUnread').hidden = false;
    }
  });
  socket.on('message:private', (message) => {
    const otherId = message.from === state.selfId ? message.to : message.from;
    if (!state.private.has(otherId)) state.private.set(otherId, []);
    const list = state.private.get(otherId);
    if (!list.some(m => m.id === message.id)) list.push(message);
    if (list.length > 100) list.shift();
    if (state.current === 'private' && state.otherId === otherId) renderMessages();
    else {
      state.unread.set(otherId, (state.unread.get(otherId) || 0) + 1);
      renderUsers();
      const sender = state.users.find(u => u.id === otherId);
      if (message.from !== state.selfId) toast(`Nuevo mensaje privado de ${sender?.name || 'un usuario'}`);
    }
  });

  $('#messageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !state.joined || !socket.connected) return;
    if (state.current === 'private' && !currentUser()) { toast('El usuario está desconectado.'); return; }
    const payload = { scope: state.current, to: state.otherId, text };
    $('#sendButton').disabled = true;
    socket.emit('message:send', payload, (reply) => {
      $('#sendButton').disabled = false;
      if (reply?.ok) {
        if (input.value.trim() === text) input.value = '';
        $('#charCounter').textContent = `${input.value.length} / 500`;
        input.focus();
      } else toast(reply?.error || 'No se pudo enviar el mensaje.');
    });
  });
  input.addEventListener('input', () => { $('#charCounter').textContent = `${input.value.length} / 500`; });
  $('#navGlobal').addEventListener('click', openGlobal);
  $('#globalRoom').addEventListener('click', openGlobal);
  $('#navUsers').addEventListener('click', () => { openSidebar(); search.focus(); });
  search.addEventListener('input', renderUsers);
  $('#menuToggle').addEventListener('click', openSidebar);
  $('#sidebarClose').addEventListener('click', closeSidebar);
  $('#sidebarScrim').addEventListener('click', closeSidebar);
  $('#navProfile').addEventListener('click', () => { setProfile(profile); dialog.showModal(); });
  $('#otherProfileButton').addEventListener('click', () => {
    const user = currentUser();
    if (user) { setProfile(user); dialog.showModal(); }
  });
  $('#closeProfile').addEventListener('click', () => dialog.close());
  $('#leaveChat').addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE_KEY);
    socket.disconnect();
    location.replace('/');
  });
  setConnection(false);
  setProfile();
}
