const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
  SUPABASE_URL: "https://dfgggnhsneqkemexuqty.supabase.co",
  SUPABASE_KEY: "sb_publishable_gNvns_dNEZQsJsIdP3ywdg_A_SJxOFp",
};

const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let userName = '';
let userEmail = '';
let currentImages = [];
let chatHistory = [];
let conversations = [];

// AUTH
window.onload = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await loadUser(session.user);
  }
};

function showTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0) === (tab === 'login'));
  });
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('authError').textContent = error.message; return; }
  await loadUser(data.user);
}

async function register() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  if (!name) { document.getElementById('authError').textContent = 'Entre ton prénom'; return; }
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name } }
  });
  if (error) { document.getElementById('authError').textContent = error.message; return; }
  await loadUser(data.user);
}

async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

async function loadUser(user) {
  userName = user.user_metadata?.full_name || user.email.split('@')[0];
  userEmail = user.email;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  document.getElementById('greeting').textContent = `${greeting}, ${userName} 👋`;
  document.getElementById('sidebarName').textContent = userName;
  document.getElementById('sidebarEmail').textContent = userEmail;
  document.getElementById('avatarLetter').textContent = userName.charAt(0).toUpperCase();
  await loadHistory(user.id);
}

async function loadHistory(userId) {
  const { data } = await supabase
    .from('historique')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (data) {
    conversations = data;
    renderHistory();
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = conversations.map(c =>
    `<div class="history-item">💬 ${c.message.substring(0, 30)}</div>`
  ).join('');
}

// SIDEBAR
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// IMAGES
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

// MESSAGE
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
    addMessage(`🎨 Génération en cours...`, 'bot');
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

    // Sauvegarder dans Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('historique').insert({ user_id: session.user.id, message: msg, reponse: reply });
      await loadHistory(session.user.id);
    }
  } catch (e) {
    removeTyping(typingId);
    addMessage("Erreur de connexion.", 'bot');
  }
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
    : text;
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
    return '❌ Impossible de télécharger cette vidéo.';
  } catch (e) { return '❌ Erreur : ' + e.message; }
}

function generateImage(prompt) {
  const clean = prompt.replace(/d'un|d'une|de |du |des |un |une /gi, '').trim();
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div>
    <div class="bot-content">
      <p id="imgStatus" style="color:#888;margin-bottom:8px;">🎨 Génération en cours...</p>
      <img src="${url}" style="max-width:100%;border-radius:12px;display:block;"
        onload="document.getElementById('imgStatus').textContent='✅ Image générée !'"
        onerror="document.getElementById('imgStatus').textContent='❌ Erreur'"/>
      <small style="color:#666;display:block;margin-top:6px;">"${clean}"</small>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,200)+'px'; }
function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
