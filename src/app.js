// ============================================
// CONFIG — modifie uniquement cette section
// ============================================
const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
  BOT_NAME: "OLIVIER-BOT",
};
// ============================================

async function callAI(prompt) {
  const res = await fetch(`${CONFIG.API_URL}?prompt=${encodeURIComponent(prompt)}`);
  return await res.text();
}

function showTab(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  btn.classList.add('active');
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const box = document.getElementById('chatBox');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  box.innerHTML += `<div class="msg user"><span>${msg}</span></div>`;
  box.innerHTML += `<div class="msg bot" id="typing"><span class="loading">⏳ En train de répondre...</span></div>`;
  box.scrollTop = box.scrollHeight;
  const rep = await callAI(msg);
  document.getElementById('typing').innerHTML = `<span>${rep}</span>`;
  document.getElementById('typing').removeAttribute('id');
  box.scrollTop = box.scrollHeight;
}

async function genererTexte() {
  const input = document.getElementById('texteInput').value.trim();
  const output = document.getElementById('texteOutput');
  if (!input) return;
  output.innerHTML = '<span class="loading">⏳ Génération en cours...</span>';
  output.textContent = await callAI(input);
}

async function askAssistant() {
  const input = document.getElementById('assistantInput').value.trim();
  const output = document.getElementById('assistantOutput');
  if (!input) return;
  output.innerHTML = '<span class="loading">⏳ Recherche en cours...</span>';
  output.textContent = await callAI(input);
}

document.getElementById('chatInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') sendChat();
});
