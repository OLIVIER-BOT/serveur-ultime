const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
  SUPABASE_URL: "TON_URL_SUPABASE",
  SUPABASE_KEY: "TA_CLÉ_SUPABASE",
};

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let userName = '';
let userEmail = '';
let userId = '';
let currentImages = [];
let chatHistory = [];
let currentConvId = null;

window.onload = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  const user = session.user;
  userId = user.id;
  userName = user.user_metadata?.name || user.email.split('@')[0];
  userEmail = user.email;
  await sb.from('profiles').upsert({ id: userId, email: userEmail, name: userName });
  startApp();
  loadConversations();
};

function startApp() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  document.getElementById('greeting').textContent = `${g}, ${userName} 👋`;
  document.getElementById('sidebarName').textContent = userName;
  document.getElementById('sidebarEmail').textContent = userEmail;
  document.getElementById('avatarLetter').textContent = userName.charAt(0).toUpperCase();
}

async function loadConversations() {
  const { data } = await sb.from('conversations')
    .select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(30);
  const list = document.getElementById('historyList');
  if (!data || !data.length) {
    list.innerHTML = '<p style="color:#555;font-size:0.8em;padding:8px">Aucune conversation</p>';
    return;
  }
  list.innerHTML = data.map(c =>
    `<div class="history-item" onclick="loadConversation(${c.id})">💬 ${c.title}</div>`
  ).join('');
}

async function loadConversation(convId) {
  currentConvId = convId;
  chatHistory = [];
  const area = document.getElementById('chatArea');
  area.innerHTML = '<div style="text-align:center;color:#555;padding:20px">Chargement...</div>';
  const { data } = await sb.from('messages')
    .select('*').eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  area.innerHTML = '';
  if (!data) return;
  data.forEach(msg => {
    chatHistory.push({ role: msg.role, content: msg.content });
    if (msg.role === 'user') addUserMessage(msg.content, []);
    else addMessage(msg.content, 'bot');
  });
  closeSidebar();
}

async function createConversation(firstMsg) {
  const { data } = await sb.from('conversations')
    .insert({ user_id: userId, title: firstMsg.substring(0, 40) })
    .select().single();
  if (data) { currentConvId = data.id; loadConversations(); }
}

async function saveMessage(role, content) {
  if (!currentConvId) return;
  await sb.from('messages').insert({ conversation_id: currentConvId, role, content });
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
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
  box.innerHTML = currentImages.map((img, i) =>
    `<div class="img-thumb"><img src="${img}" onclick="zoomImage('${img}')"/><button onclick="removeImage(${i})">✕</button></div>`
  ).join('');
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

  if (!currentConvId && msg) await createConversation(msg);

  const videoRegex = /(https?:\/\/(www\.)?(youtube|youtu\.be|tiktok|instagram|twitter|x\.com)[\S]+)/i;
  const videoMatch = msg.match(videoRegex);
  if (videoMatch) {
    addUserMessage(msg, []);
    await saveMessage('user', msg);
    const typingId = addTyping();
    const result = await downloadVideo(videoMatch[0]);
    removeTyping(typingId);
    addMessage(result, 'bot');
    await saveMessage('assistant', result);
    return;
  }

  const imageKeywords = ['génère une image','crée une image','dessine',"image d'un","image d'une",'image de'];
  if (imageKeywords.some(k => msg.toLowerCase().includes(k))) {
    addUserMessage(msg, []);
    await saveMessage('user', msg);
    const prompt = msg.replace(/génère une image|crée une image|dessine/gi, '').trim();
    generateImage(prompt);
    return;
  }

  addUserMessage(msg, currentImages);
  await saveMessage('user', msg);
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
    await saveMessage('assistant', reply);
  } catch (e) {
    removeTyping(typingId);
    addMessage('Erreur de connexion. Réessaie.', 'bot');
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
  currentConvId = null;
  renderImagePreviews();
  closeSidebar();
  document.getElementById('chatArea').innerHTML = `<div class="welcome" id="welcome"><div class="star-welcome">✦</div><h1>Bonsoir, ${userName} 👋</h1></div>`;
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
  const sid = 'img_' + Date.now();
  div.innerHTML = `<div class="bot-header"><span class="star-logo">✦</span> PANA</div>
    <div class="bot-content">
      <p id="${sid}" style="color:#888;margin-bottom:8px;">🎨 Génération en cours...</p>
      <img src="${url}" style="max-width:100%;border-radius:12px;display:block;"
        onload="document.getElementById('${sid}').textContent='✅ Image générée !'"
        onerror="document.getElementById('${sid}').textContent='❌ Erreur'"/>
      <small style="color:#666;margin-top:6px;display:block;">"${clean}"</small>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,200)+'px'; }
function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
