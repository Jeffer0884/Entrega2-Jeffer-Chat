const STORAGE_KEY = 'chatapp:profile';
const form = document.querySelector('#joinForm');
const error = document.querySelector('#joinError');
const saved = sessionStorage.getItem(STORAGE_KEY);
if (saved) {
  try {
    const profile = JSON.parse(saved);
    form.elements.name.value = profile.name || '';
    form.elements.city.value = profile.city || '';
    form.elements.website.value = profile.website || '';
    const colorChoice = form.querySelector(`input[name="color"][value="${profile.color}"]`);
    if (colorChoice) colorChoice.checked = true;
  } catch { sessionStorage.removeItem(STORAGE_KEY); }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = form.elements.name.value.replace(/\s+/g, ' ').trim();
  const city = form.elements.city.value.replace(/\s+/g, ' ').trim();
  const website = form.elements.website.value.trim();
  error.hidden = true;
  if (name.length < 2) {
    error.textContent = 'Escribe tu nombre (al menos 2 caracteres).';
    error.hidden = false;
    form.elements.name.focus();
    return;
  }
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('URL no válida');
    } catch {
      error.textContent = 'Tu enlace debe comenzar con https:// o http://';
      error.hidden = false;
      form.elements.website.focus();
      return;
    }
  }
  const profile = { name: name.slice(0, 32), city: city.slice(0, 36), website, color: form.elements.color.value || 'blue' };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.location.assign('/chat');
});
