const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
  SUPABASE_URL: "https://dfgggnhsneqkemexuqty.supabase.co",
  SUPABASE_KEY: "sb_publishable_gNvns_dNEZQsJsIdP3ywdg_A_SJxOFp",
};

let userName = '';
let userEmail = '';
let currentImages = [];
let chatHistory = [];

// AUTH SIMPLE SANS SUPABASE (localStorage)
window.onload = () => {
  const saved = localStorage.getItem('pana_user');
  if (saved) {
    const user = JSON.parse(saved);
    startApp(user.name, user.email);
  }
};

function showTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) {
    document.getElementById('authError').textContent = 'Remplis tous les champs';
    return;
  }
  const users = JSON.parse(localStorage.getItem('pana_users') || '{}');
  if (!users[email] || users[email].password !== password) {
    document.getElementById('authError').textContent = 'Email ou mot de passe incorrect';
    return;
  }
  const user = users[email];
  localStorage.setItem('pana_user', JSON.stringify(user));
  startApp(user.name, email);
}

function register() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  if (!name || !email || !password) {
    document.getElementById('authError').textContent = 'Remplis tous les champs';
    return;
  }
  if (password.length < 6) {
    document.getElementById('authError').textContent = 'Mot de passe minimum 6 caractères';
    return;
  }
  const users = JSON.parse(localStorage.getItem('pana_users') || '{}');
  if (users[email]) {
    document.getElementById('authError').textContent = 'Email déjà utilisé';
    return;
  }
  users[email] = { name, email, password };
  localStorage.setItem('pana_users', JSON.stringify(users));
  localStorage.setItem('pana_user', JSON.stringify({ name, email }));
  startApp(name, email);
}

function logout() {
  localStorage.removeItem('pana_user');
  location.reload();
}

function startApp(name, email) {
  userName = name;
  userEmail = email;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  document.getElementById('greeting').textContent = `${greeting}, ${userName} 👋`;
  document.getElementById('sidebarName').textContent = userName;
  document.getElementById('sidebarEmail').textContent = userEmail;
  document.getElementById('avatarLetter').textContent = userName.charAt(0).toUpperCase();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function handleImages(event) {
  Array.from(event.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { currentImages.push(e.target.result); renderImagePreviews(); };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderImagePreviews() {
  const box = document.getElementById('imgsPreviewBox');
  if (!currentImages.length) { box.innerHTML = ''; return; }
  box.innerHTML = currentImages.map((img, i) => `
    <div class="img-thumb">
      <img src="${img}" onclick="zoomImage('${img}')"/>
      <button onclick="removeImage(${i})">✕</button>
    </div>`).join('');
}

function removeImage(i) { currentImages.splice(i, 1); renderImagePreviews(); }

function zoomImage(src) {
  document.getElementById('previewModal').style.display = 'flex';
  document.getElementById('previewFrame').srcdoc = `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh"/></body></html>`;
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg && !currentImages.length) return;
  input.value = '';
  autoResize(input);
  document.getElementById('welcome')?.remove();

  const videoRegex = /(https?:\/\/(www\.)?(youtube|youtu\.be|tiktok|instagram|twitter|x\.com)[\S]+)/i;
  const videoMatch = msg.match(videoRegex);
  if (videoMatch) {
    addUserMessage(msg, []);
    const typingId = addTyping();
    const result = await downloadVideo(videoMatch[0]);
    removeTyping(typingId);
    addMessage(result, 'bot');
    return;
  }

  const imageKeywords = ['génère une image', 'crée une image', 'dessine', 'image de', "image d'un", "image d'une"];
  if (imageKeywords.some(k => msg.toLowerCase().includes(k))) {
    addUserMessage(msg, []);
    const prompt = msg.replace(/génère une image|crée une image|dessine/gi, '').trim();
    generateImage(prompt);
    return;
  }

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
      body: JSON.stringify({ prompt: msg, images: imagesToSend, name: userName, history: chatHistory.slice(0, -1) })
    });
    const reply = await res.text();
    removeTyping(typingId);
    typeMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    updateHistory(msg);
  } catch (e) {
    removeTyping(typingId);
    addMessage("Erreur de connexion.", 'bot');
  }
}

function updateHistory(msg) {
  const list = document.getElementById('historyList');
  const div = document.createElement('div');
  div.className = 'history-item';
  div.textContent = '💬 ' + msg.substring(0, 30);
  list.prepend(div);
}

function addUserMessage(text, images) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg user';
  let html = images.length ? `<div class="user-imgs">${images.map(img => `<img src="${img}" onclick="zoomImage('${img}')"/>`).join('')}</div>` : '';
  if (text) html += `<div>${text}</div>`;
  div.innerHTML = html;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function typeMessage(text) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const id = 'sc_' + Date.now();
  div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div><div class="bot-content" id="${id}"></div>`;
  area.appendChild(div);
  const el = document.getElementById(id);
  const words = text.split(' ');
  let i = 0, current = '';
  const interval = setInterval(() => {
    if (i >= words.length) { clearInterval(interval); el.innerHTML = formatText(text); return; }
    current += (i > 0 ? ' ' : '') + words[i];
    el.innerHTML = formatText(current) + '<span class="cursor">▌</span>';
    area.scrollTop = area.scrollHeight;
    i++;
  }, 25);
}

function addMessage(text, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = role === 'bot'
    ? `<div class="bot-header"><span class="star-logo">✦</span> PANA</div><div class="bot-content">${formatText(text)}</div>`
    : `<div>${text}</div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function formatText(text) {
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const id = 'c_' + Date.now() + Math.random().toString(36).substr(2,4);
    const escaped = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isWeb = ['html','css','javascript','js'].includes((lang||'').toLowerCase());
    const prev = isWeb ? `<button onclick="previewCode('${id}')">👁️ Aperçu</button>` : '';
    return `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><div style="display:flex;gap:6px">${prev}<button onclick="copyCode('${id}')">📋 Copier</button></div></div><pre><code id="${id}">${escaped}</code></pre></div>`;
  });
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function copyCode(id) { navigator.clipboard.writeText(document.getElementById(id).innerText); }
function previewCode(id) { document.getElementById('previewModal').style.display='flex'; document.getElementById('previewFrame').srcdoc=document.getElementById(id).innerText; }
function closePreview() { document.getElementById('previewModal').style.display='none'; }

function addTyping() {
  const area = document.getElementById('chatArea');
  const id = 'typing_' + Date.now();
  const div = document.createElement('div');
  div.className = 'msg bot'; div.id = id;
  div.innerHTML = `<div class="bot-header"><span class="star-logo thinking">✦</span> PANA</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }

function newChat() {
  chatHistory = [];
  currentImages = [];
  renderImagePreviews();
  closeSidebar();
  document.getElementById('chatArea').innerHTML = `<div class="welcome" id="welcome"><div class="star-welcome">✦</div><h1 id="greeting">Bonsoir, ${userName} 👋</h1></div>`;
}

async function downloadVideo(url) {
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url, vCodec: 'h264', vQuality: '720' })
    });
    const data = await res.json();
    if (data.url) {
      const a = document.createElement('a');
      a.href = data.url; a.download = 'video.mp4'; a.click();
      return '✅ Téléchargement démarré !';
    }
    return '❌ Impossible de télécharger.';
  } catch (e) { return '❌ Erreur : ' + e.message; }
}

function generateImage(prompt) {
  const clean = prompt.replace(/d'un|d'une|de |du |des |un |une /gi, '').trim();
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const statusId = 'img_' + Date.now();
  div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div>
    <div class="bot-content">
      <p id="${statusId}" style="color:#888;margin-bottom:8px;">🎨 Génération en cours...</p>
      <img src="${url}" style="max-width:100%;border-radius:12px;display:block;"
        onload="document.getElementById('${statusId}').textContent='✅ Image générée !'"
        onerror="document.getElementById('${statusId}').textContent='❌ Erreur de génération'"/>
      <small style="color:#666;display:block;margin-top:6px;">"${clean}"</small>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,200)+'px'; }
function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
