// npcs.js — Configuração de NPCs para modo Custom

let npcList = [];
let npcIdCounter = 0;

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  renderSummary();

  // Restaura NPCs se o usuário voltou
  try {
    const gm = JSON.parse(sessionStorage.getItem("gameMode") || "{}");
    if (Array.isArray(gm.npcs_fixos) && gm.npcs_fixos.length > 0) {
      gm.npcs_fixos.forEach(n => addNPC(n));
    }
  } catch {}
});

// ─── RESUMO DOS PERSONAGENS ───────────────────────────────────────────────────
function renderSummary() {
  const container = document.getElementById("summary-players");
  if (!container) return;
  try {
    const gm = JSON.parse(sessionStorage.getItem("gameMode") || "{}");
    const players = gm.personagens || [];
    if (players.length === 0) {
      container.innerHTML = '<span style="font-size:13px;color:var(--text-m)">Nenhum personagem definido.</span>';
      return;
    }
    container.innerHTML = players.map((p, i) => {
      const name  = p.name || `Jogador ${i+1}`;
      const cls   = p.class || "Auto";
      const auto  = p.auto  ? " · IA decide" : "";
      return `<div class="npcs-player-chip">
        <span>${esc(name)}</span>
        <span class="npcs-player-chip-class">${esc(cls)}${auto}</span>
      </div>`;
    }).join("");
  } catch {}
}

// ─── ADICIONAR NPC ─────────────────────────────────────────────────────────────
function addNPC(data) {
  const id   = ++npcIdCounter;
  const nome = data?.name || data?.nome || "";
  const desc = data?.descricao || data?.description || "";
  const role = data?.papel || "neutro";

  npcList.push({ id, nome, descricao: desc, papel: role });

  const list = document.getElementById("npc-list");
  const card = document.createElement("div");
  card.className = "npc-card";
  card.id = "npc-" + id;

  card.innerHTML = `
    <div class="npc-card-header">
      <div class="npc-num">${id}</div>
      <input class="npc-name-input" type="text" maxlength="50"
             placeholder="Nome e sobrenome do NPC"
             value="${esc(nome)}"
             oninput="updateNPC(${id}, 'nome', this.value)">
      <button class="npc-remove" onclick="removeNPC(${id})" title="Remover">✕</button>
    </div>

    <div class="npc-role-row">
      <button class="npc-role-btn ${role==='aliado'?'active-aliado':''}"
              onclick="setRole(${id},'aliado',this)">● Aliado</button>
      <button class="npc-role-btn ${role==='neutro'?'active-neutro':''}"
              onclick="setRole(${id},'neutro',this)">◆ Neutro</button>
      <button class="npc-role-btn ${role==='antagonista'?'active-antagonista':''}"
              onclick="setRole(${id},'antagonista',this)">✕ Antagonista</button>
    </div>

    <textarea class="npc-desc-input"
              placeholder="Descreva quem é este NPC — personalidade, aparência, relação com o grupo, papel na história. O Mestre usará isso para criá-lo."
              oninput="updateNPC(${id}, 'descricao', this.value)"
              rows="3">${esc(desc)}</textarea>
    <div class="npc-desc-hint">💡 Quanto mais detalhes, mais fiel o Mestre criará este personagem.</div>`;

  list.appendChild(card);
}

// ─── ATUALIZAR NPC ────────────────────────────────────────────────────────────
function updateNPC(id, field, value) {
  const entry = npcList.find(n => n.id === id);
  if (entry) entry[field] = value;
}

function setRole(id, role, btn) {
  const entry = npcList.find(n => n.id === id);
  if (!entry) return;
  entry.papel = role;

  // Atualiza visual dos botões do card
  const card = document.getElementById("npc-" + id);
  if (!card) return;
  card.querySelectorAll(".npc-role-btn").forEach(b => {
    b.className = b.className.replace(/active-\w+/g, "").trim();
  });
  const roleClasses = { aliado:"active-aliado", neutro:"active-neutro", antagonista:"active-antagonista" };
  btn.classList.add(roleClasses[role] || "");
}

// ─── REMOVER NPC ──────────────────────────────────────────────────────────────
function removeNPC(id) {
  npcList = npcList.filter(n => n.id !== id);
  const card = document.getElementById("npc-" + id);
  if (card) {
    card.style.animation = "fadeOut .18s ease forwards";
    setTimeout(() => card.remove(), 200);
  }
}

// ─── AVANÇAR ──────────────────────────────────────────────────────────────────
function advance() {
  saveAndProceed();
}

function skip() {
  // Salva sem NPCs e avança
  const gm = safeGetGameMode();
  gm.npcs_fixos = [];
  sessionStorage.setItem("gameMode", JSON.stringify(gm));
  window.location = "theme.html";
}

function saveAndProceed() {
  const gm = safeGetGameMode();

  // Valida NPCs — remove os sem nome
  gm.npcs_fixos = npcList
    .filter(n => n.nome && n.nome.trim().length > 0)
    .map(n => ({
      nome:      n.nome.trim(),
      descricao: n.descricao.trim(),
      papel:     n.papel || "neutro"
    }));

  sessionStorage.setItem("gameMode", JSON.stringify(gm));
  window.location = "theme.html";
}

function safeGetGameMode() {
  try { return JSON.parse(sessionStorage.getItem("gameMode") || "{}"); }
  catch { return {}; }
}

function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
