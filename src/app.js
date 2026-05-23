const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
};

let userName = localStorage.getItem('pana_name') || '';
let currentImages = [];
let chatHistory = [];

window.onload = () => {
  if (userName) {
    startApp();
  } else {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('nameInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') saveName();
    });
  }
};

function saveName() {
  const input = document.getElementById('nameInput').value.trim();
  if (!input) return;
  userName = input;
  localStorage.setItem('pana_name', userName);
  startApp();
}

function startApp() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  document.getElementById('greeting').textContent = `${greeting}, ${userName} 👋`;
}

function handleImages(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      currentImages.push(e.target.result);
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderImagePreviews() {
  const box = document.getElementById('imgsPreviewBox');
  if (currentImages.length === 0) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = currentImages.map((img, i) => `
    <div class="img-thumb">
      <img src="${img}" onclick="zoomImage('${img}')"/>
      <button onclick="removeImage(${i})">✕</button>
    </div>
  `).join('');
}

function removeImage(index) {
  currentImages.splice(index, 1);
  renderImagePreviews();
}

function zoomImage(src) {
  const modal = document.getElementById('previewModal');
  const frame = document.getElementById('previewFrame');
  modal.style.display = 'flex';
  frame.srcdoc = `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh"/></body></html>`;
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg && currentImages.length === 0) return;
  input.value = '';
  autoResize(input);

  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  // Afficher message user avec images
  addUserMessage(msg, currentImages);
  chatHistory.push({ role: 'user', content: msg || 'Analyse ces images' });

  const imagesToSend = [...currentImages];
  currentImages = [];
  renderImagePreviews();

  const typingId = addTyping();

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: msg,
        images: imagesToSend,
        name: userName,
        history: chatHistory.slice(0, -1)
      })
    });

    const reply = await res.text();
    removeTyping(typingId);
    typeMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  } catch (e) {
    removeTyping(typingId);
    addMessage("Erreur de connexion. Réessaie.", 'bot');
  }
}

function addUserMessage(text, images) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg user';
  let html = '';
  if (images.length > 0) {
    html += `<div class="user-imgs">${images.map(img => `<img src="${img}" onclick="zoomImage('${img}')"/>`).join('')}</div>`;
  }
  if (text) html += `<div>${text}</div>`;
  div.innerHTML = html;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function typeMessage(text) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const contentId = 'sc_' + Date.now();
  div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div><div class="bot-content" id="${contentId}"></div>`;
  area.appendChild(div);

  const contentEl = document.getElementById(contentId);
  const words = text.split(' ');
  let i = 0;
  let current = '';

  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);
      contentEl.innerHTML = formatText(text);
      return;
    }
    current += (i > 0 ? ' ' : '') + words[i];
    contentEl.innerHTML = formatText(current) + '<span class="cursor">▌</span>';
    area.scrollTop = area.scrollHeight;
    i++;
  }, 25);
}

function addMessage(text, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'bot') {
    div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div><div class="bot-content">${formatText(text)}</div>`;
  } else {
    div.textContent = text;
  }
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function formatText(text) {
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
    const id = 'code_' + Date.now() + Math.random().toString(36).substr(2,5);
    const escaped = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isWeb = ['html','css','javascript','js'].includes((lang||'').toLowerCase());
    const previewBtn = isWeb ? `<button onclick="previewCode('${id}')">👁️ Aperçu</button>` : '';
    return `<div class="code-block">
      <div class="code-header">
        <span>${lang||'code'}</span>
        <div style="display:flex;gap:6px">
          ${previewBtn}
          <button onclick="copyCode('${id}')">📋 Copier</button>
        </div>
      </div>
      <pre><code id="${id}">${escaped}</code></pre>
    </div>`;
  });
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function copyCode(id) {
  navigator.clipboard.writeText(document.getElementById(id).innerText);
}

function previewCode(id) {
  document.getElementById('previewModal').style.display = 'flex';
  document.getElementById('previewFrame').srcdoc = document.getElementById(id).innerText;
}

function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
}

function addTyping() {
  const area = document.getElementById('chatArea');
  const id = 'typing_' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = id;
  div.innerHTML = `<div class="bot-header"><span class="star-logo thinking">✦</span> PANA</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function newChat() {
  chatHistory = [];
  currentImages = [];
  renderImagePreviews();
  const area = document.getElementById('chatArea');
  area.innerHTML = `<div class="welcome" id="welcome"><div class="star-welcome">✦</div><h1>Bonsoir, ${userName} 👋</h1></div>`;
}

function toggleSidebar() {}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
