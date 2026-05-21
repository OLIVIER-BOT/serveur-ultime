// ============================================
// CONFIG — modifie uniquement cette section
// ============================================
const CONFIG = {
  API_URL: "https://patient-cell-api-serveur.gazoj1209.workers.dev",
  BOT_NAME: "OLIVIER-BOT",
  SUPABASE_URL: "https://dfgggnhsneqkemexuqty.supabase.co/rest/v1/",
  SUPABASE_KEY: "sb_publishable_gNvns_dNEZQsJsIdP3ywdg_A_SJxOFp",
};
// ============================================

// Sauvegarder dans Supabase
async function sauvegarder(message, reponse) {
  await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/historique`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": CONFIG.SUPABASE_KEY,
      "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
    },
    body: JSON.stringify({ message, reponse }),
  });
}

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
  await sauvegarder(msg, rep);
}

async function genererTexte() {
  const input = document.getElementById('texteInput').value.trim();
  const output = document.getElementById('texteOutput');
  if (!input) return;
  output.innerHTML = '<span class="loading">⏳ Génération en cours...</span>';
  const rep = await callAI(input);
  output.textContent = rep;
  await sauvegarder(input, rep);
}

async function askAssistant() {
  const input = document.getElementById('assistantInput').value.trim();
  const output = document.getElementById('assistantOutput');
  if (!input) return;
  output.innerHTML = '<span class="loading">⏳ Recherche en cours...</span>';
  const rep = await callAI(input);
  output.textContent = rep;
  await sauvegarder(input, rep);
}

document.getElementById('chatInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') sendChat();
});
