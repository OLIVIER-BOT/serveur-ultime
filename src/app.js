const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
};

let chatHistory = [];

async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  autoResize(input);

  // Cacher le welcome
  const welcome = document.querySelector('.welcome');
  if (welcome) welcome.remove();

  addMessage(msg, 'user');
  addHistory(msg);

  const typingId = addTyping();
  const reply = await callAI(msg);
  removeTyping(typingId);
  addMessage(reply, 'bot');
  await sauvegarder(msg, reply);
}

function addMessage(text, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'bot') {
    div.innerHTML = `<div class="bot-name">✳️ PANA</div><div class="bot-content">${formatText(text)}</div>`;
  } else {
    div.textContent = text;
  }
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function addTyping() {
  const area = document.getElementById('chatArea');
  const id = 'typing_' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = id;
  div.innerHTML = '<div class="bot-name">✳️ PANA</div><div class="typing">En train de réfléchir...</div>';
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function addHistory(msg) {
  const history = document.getElementById('history');
  const div = document.createElement('div');
  div.className = 'history-item';
  div.textContent = msg.substring(0, 40);
  history.prepend(div);
}

async function callAI(prompt) {
  try {
    const res = await fetch(`${CONFIG.API_URL}?prompt=${encodeURIComponent(prompt)}`);
    return await res.text();
  } catch (e) {
    return "Erreur de connexion. Réessaie.";
  }
}

async function sauvegarder(message, reponse) {
  // Sauvegarde Supabase si configuré
}

function newChat() {
  const area = document.getElementById('chatArea');
  area.innerHTML = '<div class="welcome"><div class="logo">✳️</div><h1>Bonsoir, <span id="username">Moi</span></h1></div>';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
