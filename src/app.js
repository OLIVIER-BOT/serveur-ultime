const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

document.getElementById('greeting').textContent = getGreeting() + ", Moi";

async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  autoResize(input);

  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  addMessage(msg, 'user');
  const typingId = addTyping();
  const reply = await callAI(msg);
  removeTyping(typingId);
  addMessage(reply, 'bot');
}

function addMessage(text, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'bot') {
    div.innerHTML = `
      <div class="bot-header">✳️ PANA</div>
      <div class="bot-content">${formatText(text)}</div>`;
  } else {
    div.textContent = text;
  }
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
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
  div.innerHTML = '<div class="bot-header">✳️ PANA</div><div class="typing">En train de réfléchir...</div>';
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function callAI(prompt) {
  try {
    const res = await fetch(`${CONFIG.API_URL}?prompt=${encodeURIComponent(prompt)}`);
    return await res.text();
  } catch (e) {
    return "Erreur de connexion. Réessaie.";
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
