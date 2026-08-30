// create.js — Criação de ficha de personagem (suporta Individual, Multiplayer e Custom)

const attrs = { agilidade:0, forca:0, intelecto:0, presenca:0, vigor:0 };
let totalPoints   = 4;
let selectedClass = "Combatente";
let selectedOrigin = "Policial";
let aiDecides     = false;
let agentInventory = [];

const DEFAULT_CLASS_KITS = {
  Combatente: [
    { nome: "Pistola 9mm", acao: "Ataque", descricao: "Arma de fogo padrão com pente de 15 tiros. Dano balístico confiável.", foto: "" },
    { nome: "Faca Tática", acao: "Ataque", descricao: "Lâmina de combate corpo a corpo afiada para momentos críticos.", foto: "" },
    { nome: "Colete Balístico", acao: "Defesa", descricao: "Proteção de kevlar que amortece impactos e disparos.", foto: "" },
    { nome: "Bandagem Médica", acao: "Cura", descricao: "Compressas estéreis para estancar hemorragias e estabilizar ferimentos.", foto: "" }
  ],
  Especialista: [
    { nome: "Kit de Ferramentas / Gazua", acao: "Investigação", descricao: "Conjunto de pinos e alicates para arrombamento técnico e perícia.", foto: "" },
    { nome: "Lanterna Tática UV", acao: "Investigação", descricao: "Emite luz ultravioleta que revela fluidos e rastros ocultos.", foto: "" },
    { nome: "Spray de Pimenta", acao: "Defesa", descricao: "Agente químico incapacitante de curto alcance.", foto: "" },
    { nome: "Pistola Oculta .38", acao: "Ataque", descricao: "Revólver compacto de porte discreto para emergências.", foto: "" }
  ],
  Ocultista: [
    { nome: "Componentes de Ritual", acao: "Ocultismo", descricao: "Cinzas, velas negras e giz ritualístico para canalizar o Outro Lado.", foto: "" },
    { nome: "Amuleto Protetor", acao: "Defesa", descricao: "Relíquia com inscrições arcanas que absorve energias paranormais.", foto: "" },
    { nome: "Grimório de Anotações", acao: "Ocultismo", descricao: "Caderno com diagramas e teorias ocultistas sobre anomalias.", foto: "" },
    { nome: "Frasco de Éter Revigorante", acao: "Cura", descricao: "Elixir alquímico que clareia a mente e restaura energia.", foto: "" }
  ],
  Comum: [
    { nome: "Smartphone com Câmera HD", acao: "Investigação", descricao: "Permite gravar evidências, tirar fotos e iluminar ambientes.", foto: "" },
    { nome: "Barra de Ferro", acao: "Ataque", descricao: "Arma improvisada pesada e contundente.", foto: "" },
    { nome: "Canivete Suíço", acao: "Utilidade", descricao: "Ferramenta multiuso com lâminas e abridores diversos.", foto: "" },
    { nome: "Kit de Primeiros Socorros", acao: "Cura", descricao: "Antisséptico, esparadrapo e analgésicos básicos.", foto: "" }
  ]
};

const ACTION_ICONS = {
  Ataque: "⚔",
  Defesa: "🛡",
  Cura: "✚",
  Investigação: "◈",
  Ocultismo: "⸸",
  Veneno: "☠",
  Utilidade: "⚙",
  Fuga: "►",
  Suporte: "✦"
};

// ─── CONTEXTO DE MODO ─────────────────────────────────────────────────────────
const gameMode   = (() => { try { return JSON.parse(sessionStorage.getItem("gameMode") || "{}"); } catch { return {}; } })();
const mpQueue    = (() => { try { return JSON.parse(sessionStorage.getItem("mp_queue")  || "[]"); } catch { return []; } })();
const mpIdx      = parseInt(sessionStorage.getItem("mp_queue_idx") || "0", 10);
const mpTotal    = parseInt(sessionStorage.getItem("mp_total")     || "1", 10);

// Dado do jogador atual (pode ter nome e classe pré-definidos)
const currentPlayer = mpQueue[mpIdx] || { auto: false };

// ─── STATS ────────────────────────────────────────────────────────────────────
const themeData = (() => {
  try { return JSON.parse(sessionStorage.getItem("themeChoice") || "{}"); }
  catch { return {}; }
})();

if (!sessionStorage.getItem("themeChoice")) {
  sessionStorage.setItem("themeChoice", JSON.stringify({ masterDecides: true, themes: [] }));
}

const CLASS_STATS = {
  Combatente:   { pv:(v,p)=>20+v, pe:(v,p)=>2+p,  san:()=>12 },
  Especialista: { pv:(v,p)=>16+v, pe:(v,p)=>3+p,  san:()=>16 },
  Ocultista:    { pv:(v,p)=>12+v, pe:(v,p)=>4+p,  san:()=>20 },
  Comum:        { pv:(v,p)=>12+v, pe:(v,p)=>2+p,  san:()=>16 },
};

// ─── UI SETUP ─────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  agentInventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[selectedClass] || []));
  renderInventoryList();
  updatePreview();
  toggleAI(false);
  showThemeBadge();
  setupPlayerContext();
});

// Mostra contexto do modo (qual jogador está criando agora)
function setupPlayerContext() {
  const badge = document.getElementById("player-context-badge");
  if (!badge) return;

  if (mpTotal > 1) {
    const playerName = currentPlayer.name
      ? `Jogador ${mpIdx+1}: ${currentPlayer.name}`
      : `Jogador ${mpIdx+1} de ${mpTotal}`;
    badge.textContent = `👤 ${playerName}`;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }

  // Pré-preenche nome se definido na tela de modo
  if (currentPlayer.name) {
    const nameInput = document.getElementById("inp-name");
    if (nameInput) nameInput.value = currentPlayer.name;
  }

  // Pré-seleciona classe se definida
  if (currentPlayer.class && currentPlayer.class !== "Auto") {
    const cards = document.querySelectorAll(".class-card");
    cards.forEach(c => {
      c.classList.remove("selected");
      if (c.dataset.class === currentPlayer.class) c.classList.add("selected");
    });
    selectedClass = currentPlayer.class;
    agentInventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[selectedClass] || []));
    renderInventoryList();
    updatePreview();
  }

  // Se é Auto, marca o toggle automaticamente
  if (currentPlayer.auto) {
    const chk = document.getElementById("chk-ai");
    if (chk) { chk.checked = true; toggleAI(true); }
  }

  // Atualiza back button
  updateBackLink();
}

function updateBackLink() {
  const back = document.getElementById("back-link");
  if (!back) return;
  if (mpIdx > 0) {
    back.textContent = "⟵ Jogador anterior";
    back.onclick = (e) => { e.preventDefault(); goToPrev(); };
  } else {
    back.href = "theme.html";
    back.textContent = "⟵ Voltar";
    back.onclick = null;
  }
}

// ─── FORMULÁRIO ───────────────────────────────────────────────────────────────
function toggleAI(checked) {
  aiDecides = checked;
  const form = document.getElementById("form-manual");
  if (form) {
    form.style.display       = checked ? "none" : "flex";
    form.style.flexDirection = "column";
    form.style.gap           = "28px";
  }
}

function selectClass(el) {
  document.querySelectorAll(".class-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  selectedClass = el.dataset.class;
  agentInventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[selectedClass] || []));
  renderInventoryList();
  updatePreview();
}

function selectOrigin(btn) {
  document.querySelectorAll(".origin-chip").forEach(c => c.classList.remove("selected"));
  btn.classList.add("selected");
  selectedOrigin = btn.dataset.origin;
}

function changeAttr(attr, delta) {
  const cur  = attrs[attr];
  const next = cur + delta;
  if (next < -1 || next > 3) return;
  const newTotal = totalPoints - delta;
  if (newTotal < 0 && delta > 0) return;
  if (newTotal > 5) return;
  attrs[attr]  = next;
  totalPoints  = newTotal;
  document.getElementById("val-" + attr).textContent = next >= 0 ? "+"+next : next;
  document.getElementById("pts-left").textContent    = totalPoints;
  updatePreview();
}

function updatePreview() {
  const vig = attrs.vigor;
  const pre = attrs.presenca;
  const fn  = CLASS_STATS[selectedClass] || CLASS_STATS.Comum;
  document.getElementById("prev-pv").textContent  = fn.pv(vig,pre);
  document.getElementById("prev-pe").textContent  = fn.pe(vig,pre);
  document.getElementById("prev-san").textContent = fn.san(vig,pre);
}

function showThemeBadge() {
  const badge = document.getElementById("theme-badge");
  if (!badge) return;
  if (!themeData || (!themeData.themes?.length && !themeData.masterDecides)) {
    badge.style.display = "none"; return;
  }
  badge.style.display = "inline-flex";
  badge.textContent = themeData.masterDecides
    ? "🎲 Mestre escolhe os temas"
    : "🎭 " + themeData.themes.join(" · ");
}

// ─── GERENCIADOR DE INVENTÁRIO & ITENS CUSTOMIZADOS ───────────────────────────
function renderInventoryList() {
  const listEl = document.getElementById("inventory-list");
  if (!listEl) return;

  if (!agentInventory.length) {
    listEl.innerHTML = `<div class="empty-inv-msg">Nenhum item carregado no momento. Adicione itens personalizados abaixo.</div>`;
    return;
  }

  listEl.innerHTML = agentInventory.map((item, idx) => {
    const icon = ACTION_ICONS[item.acao] || "📦";
    const hasPhoto = item.foto && item.foto.startsWith("http");
    return `
      <div class="inv-creator-card">
        ${hasPhoto ? `<img src="${item.foto}" class="inv-card-thumb" alt="">` : `<div class="inv-card-icon">${icon}</div>`}
        <div class="inv-card-info">
          <div class="inv-card-title-row">
            <span class="inv-card-name">${escapeHtml(item.nome)}</span>
            <span class="inv-card-action-badge action-${(item.acao||'utilidade').toLowerCase()}">${icon} ${escapeHtml(item.acao || 'Geral')}</span>
          </div>
          <div class="inv-card-desc">${escapeHtml(item.descricao || 'Sem descrição')}</div>
        </div>
        <button type="button" class="inv-card-delete" onclick="removeInventoryItem(${idx})" title="Remover item">✕</button>
      </div>
    `;
  }).join("");
}

function removeInventoryItem(idx) {
  agentInventory.splice(idx, 1);
  renderInventoryList();
}

function toggleCustomItemForm(show) {
  const form = document.getElementById("custom-item-form");
  if (!form) return;
  if (show === undefined) {
    form.style.display = form.style.display === "none" ? "block" : "none";
  } else {
    form.style.display = show ? "block" : "none";
  }
  if (form.style.display === "block") {
    document.getElementById("cif-name")?.focus();
  }
}

function addCustomItem() {
  const nameEl  = document.getElementById("cif-name");
  const actEl   = document.getElementById("cif-action");
  const descEl  = document.getElementById("cif-desc");
  const photoEl = document.getElementById("cif-photo");

  const nome      = nameEl?.value.trim() || "";
  const acao      = actEl?.value || "Utilidade";
  const descricao = descEl?.value.trim() || "";
  const foto      = photoEl?.value.trim() || "";

  if (!nome) {
    alert("Por favor, digite o nome do item.");
    nameEl?.focus();
    return;
  }
  if (!descricao) {
    alert("Por favor, digite uma descrição para o item.");
    descEl?.focus();
    return;
  }

  agentInventory.push({ nome, acao, descricao, foto });
  renderInventoryList();

  // Limpa formulário
  if (nameEl) nameEl.value = "";
  if (descEl) descEl.value = "";
  if (photoEl) photoEl.value = "";
  toggleCustomItemForm(false);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

// ─── NAVEGAÇÃO: PRÓXIMO JOGADOR & START GAME ─────────────────────────────────
function goToPrev() {
  if (mpIdx <= 0) { window.location = "theme.html"; return; }

  const created = JSON.parse(sessionStorage.getItem("mp_created") || "[]");
  created.splice(mpIdx);
  sessionStorage.setItem("mp_created", JSON.stringify(created));
  sessionStorage.setItem("mp_queue_idx", String(mpIdx - 1));
  window.location = "create.html";
}

async function startGame() {
  const btn = document.getElementById("btn-start");
  btn.disabled = true;
  btn.innerHTML = "<span>⟳</span> Salvando Dossiê...";

  const name = document.getElementById("inp-name")?.value.trim() || "";
  const age  = parseInt(document.getElementById("inp-age")?.value, 10) || 28;
  const gender = document.getElementById("sel-gender")?.value || "Masculino";
  const customOrigin = document.getElementById("inp-origin-custom")?.value.trim();
  const origin = customOrigin || selectedOrigin || "Policial";
  const appearance = document.getElementById("inp-appearance")?.value.trim() || "";
  const history = document.getElementById("inp-history")?.value.trim() || "";

  const avatar_url = currentPlayer.avatar_url || currentPlayer.avatar || null;

  const character = aiDecides
    ? { auto: true, avatar_url }
    : {
        name,
        class: selectedClass,
        age,
        gender,
        origin,
        appearance,
        history,
        inventory: agentInventory,
        attributes: { ...attrs },
        avatar_url
      };

  // Salva ficha deste jogador
  const created = JSON.parse(sessionStorage.getItem("mp_created") || "[]");
  created[mpIdx] = character;
  sessionStorage.setItem("mp_created", JSON.stringify(created));

  const nextIdx = mpIdx + 1;

  if (nextIdx < mpTotal) {
    sessionStorage.setItem("mp_queue_idx", String(nextIdx));
    window.location = "create.html";
  } else {
    const allChars     = created;
    const gameModeData = JSON.parse(sessionStorage.getItem("gameMode") || "{}");

    if (gameModeData.tipo === "individual" || mpTotal === 1) {
      sessionStorage.setItem("pendingCharacter", JSON.stringify(allChars[0] || character));
      sessionStorage.setItem("gameMode", JSON.stringify({
        ...gameModeData,
        personagens: allChars
      }));
    } else {
      sessionStorage.setItem("pendingCharacter", JSON.stringify({
        multi: true,
        personagens: allChars,
        gameMode: gameModeData
      }));
      sessionStorage.setItem("gameMode", JSON.stringify({
        ...gameModeData,
        personagens: allChars
      }));
    }

    window.location = "loading.html";
  }
}

// ─── TÍTULO DA PÁGINA CONTEXTUAL ─────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const titleEl = document.getElementById("create-title");
  if (titleEl && mpTotal > 1) {
    titleEl.textContent = `⸸ Agente ${mpIdx + 1} de ${mpTotal}`;
  }
  const subEl = document.getElementById("create-sub");
  if (subEl && mpTotal > 1) {
    const name = currentPlayer.name || `Jogador ${mpIdx+1}`;
    subEl.textContent = `Crie a ficha de ${name} ou deixe o Mestre decidir`;
  }
});
