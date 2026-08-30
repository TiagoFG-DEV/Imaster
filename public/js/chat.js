// public/js/chat.js — IMaster RPG v10 (Motor Narrativo, Cartas Mágicas, Arena de Iniciativa com Desempate Suave & Cinemáticas)

// ─── FORMATAÇÃO DE TEXTO DO NARRADOR ───────────────────────────────────────────
function formatNarratorText(txt) {
  if (!txt) return "";
  return String(txt)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="gold-highlight">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic-quote">$1</em>')
    .replace(/"([^"]+)"/g, '<span class="dialogue-quote">“$1”</span>');
}

// ─── RETRATOS HUMANOS EM CONFORMIDADE LGPD (Domínio Público CC0) ───────────────
const PORTRAIT_MEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/men/${i+1}.jpg`);
const PORTRAIT_WOMEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/women/${i+1}.jpg`);
const PORTRAIT_ALL = [...PORTRAIT_MEN, ...PORTRAIT_WOMEN];

function getSafeAvatar(url, name) {
  if (url && typeof url === "string" && url.length > 5 && !url.includes('picsum.photos')) {
    return url;
  }
  if (name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % PORTRAIT_ALL.length;
    return PORTRAIT_ALL[Math.abs(hash)];
  }
  return PORTRAIT_ALL[0];
}

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

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function fmt(v) {
  return v == null ? "0" : (v >= 0 ? "+" + v : String(v));
}

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v ?? mn));
}

function el(id) {
  return document.getElementById(id);
}

function scrollBottom() {
  const c = el("chat");
  if (c) {
    c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }
}

// ─── CANVAS ATMOSFÉRICO ────────────────────────────────────────────────────────
(function initAtmosphereCanvas() {
  const canvas = document.getElementById("atmosphere-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize(); window.addEventListener("resize", resize);

  class Mote {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : H + 10;
      this.size = .5 + Math.random() * 1.5;
      this.speed = .12 + Math.random() * .35;
      this.opacity = 0;
      this.maxOpacity = .08 + Math.random() * .14;
      this.drift = (Math.random() - .5) * .25;
      this.life = 0;
      this.maxLife = 200 + Math.random() * 260;
    }
    step() {
      const st = document.body.getAttribute("data-scene-type") || "investigacao";
      const mult = (st === "combate" || st === "boss" || st === "perseguicao") ? 2.0 : 1.0;
      this.y -= this.speed * mult;
      this.x += this.drift;
      this.life++;
      const t = this.life / this.maxLife;
      this.opacity = t < .15 ? (t / .15) * this.maxOpacity : t > .8 ? ((1 - t) / .2) * this.maxOpacity : this.maxOpacity;
      if (this.life >= this.maxLife || this.y < -10) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      const st = document.body.getAttribute("data-scene-type") || "investigacao";
      if (st === "combate" || st === "boss") {
        ctx.fillStyle = `rgba(240, 60, 30, ${this.opacity * 1.6})`;
      } else if (st === "perseguicao") {
        ctx.fillStyle = `rgba(45, 150, 255, ${this.opacity * 1.5})`;
      } else {
        ctx.fillStyle = `rgba(50, 190, 110, ${this.opacity * 1.3})`;
      }
      ctx.fill();
    }
  }

  for (let i = 0; i < 45; i++) particles.push(new Mote());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.step(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
})();

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
let sessionId          = null;
let currentSheet       = null;
let allCharacters      = [];
let gameMode           = null;
let initiativeOrder    = [];
let currentTurnIdx     = 0;
let isMultiplayer      = false;
let isWaiting          = false;
let pendingAction      = null;
let actionsDB          = null;
let currentActionTab   = "exploracao";
let currentSuggestions = [];
let roundActions       = [];
let roundStartIdx      = 0;
let introDataGlobal    = null;

// ─── INICIALIZAÇÃO DA SESSÃO ──────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  sessionId = localStorage.getItem("sessionId");
  if (!sessionId) { window.location = "index.html"; return; }

  const raw = localStorage.getItem("sessionIntro");
  let intro = null;

  if (raw) {
    try { intro = JSON.parse(raw); } catch (e) { intro = null; }
  }

  if (!intro) {
    // Recupera estado da sessão via API se a página foi recarregada (F5)
    try {
      const [stateRes, loadRes] = await Promise.all([
        fetch(`/api/session-state/${sessionId}`),
        fetch("/api/load-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        })
      ]);
      const stateData = stateRes.ok ? await stateRes.json() : {};
      const loadData  = loadRes.ok  ? await loadRes.json()  : {};

      intro = {
        sheet:          loadData.sheet || stateData.sheet,
        all_characters: stateData.all_characters || (loadData.sheet ? [loadData.sheet] : []),
        game_mode:      stateData.game_mode || { tipo: "individual" },
        initiative_order: stateData.initiative_order || [],
        current_turn_index: stateData.current_turn_index || 0,
        visual_background: stateData.visual_background || null,
        world_data:     stateData.world_data || loadData.world_data || null,
        history:        stateData.history || [],
        narration:      loadData.narration || "A missão continua.",
        isResume:       true
      };
    } catch (err) {
      console.error("[Chat] Falha ao recuperar estado:", err);
    }
  }

  if (!intro || !intro.sheet) {
    window.location = "index.html";
    return;
  }

  introDataGlobal = intro;

  allCharacters   = intro.all_characters || (currentSheet ? [currentSheet] : []);
  allCharacters.forEach((c, i) => {
    c.player_index = i;
  });
  if (currentSheet && currentSheet.player_index === undefined) {
    currentSheet.player_index = 0;
  }
  gameMode        = intro.game_mode || { tipo: "individual" };
  initiativeOrder = intro.initiative_order || [];
  currentTurnIdx  = intro.current_turn_index || 0;
  isMultiplayer   = allCharacters.length > 1;

  if (intro.contextual_suggestions && intro.contextual_suggestions.length > 0) {
    currentSuggestions = intro.contextual_suggestions;
  }

  if (intro.visual_background) applyDynamicBackground(intro.visual_background);

  // Renderiza HUD padrão: ficha do jogador ativo, seletor de fichas e tema de classe
  renderCharacterSwitcher();
  renderSheet(currentSheet);
  document.body.setAttribute("data-player-class", (currentSheet?.class || "comum").toLowerCase());

  if (isMultiplayer && initiativeOrder.length > 1) {
    initTurnUI();
  }

  // Garante que a área de cartas e menus fiquem sempre visíveis e operantes
  const cardsArea = el("action-cards-area");
  if (cardsArea) cardsArea.style.display = "";

  await loadActionsDB();
  initVisualEffects();
  if (typeof AudioManager !== "undefined") {
    AudioManager.init();
    AudioManager.setMood("calmo");
  }

  if (intro.world_data?.tipo_cena_atual) {
    applySceneAtmosphere(intro.world_data.tipo_cena_atual, intro.world_data.cena_atual_obj?.titulo);
  } else {
    applySceneAtmosphere("investigacao", "Chegada e Reconhecimento");
  }

  const initKey = "initiative_done_" + sessionId;
  const isInitiativeDone = !!localStorage.getItem(initKey);

  if (intro.isResume && intro.history?.length) {
    renderHistory(intro.history);
    await addMsg("narrator", intro.narration || "A missão retoma...", "resume");
    const activePlayer = initiativeOrder[currentTurnIdx] || { nome: currentSheet?.name, sheet: currentSheet, tipo: "jogador" };
    if (isMultiplayer) await playTurnTransition(activePlayer);
  } else if (isInitiativeDone) {
    if (intro.history?.length) renderHistory(intro.history);
    if (intro.narration) {
      document.body.classList.add("master-narrating");
      await addMsg("narrator", intro.narration, "intro");
      await new Promise(r => setTimeout(r, 850));
    }
    const activePlayer = initiativeOrder[currentTurnIdx] || { nome: currentSheet?.name, sheet: currentSheet, tipo: "jogador" };
    await playTurnTransition(activePlayer);
  } else {
    // Nova sessão: Abre suavemente a Arena de Iniciativa
    checkAndStartInitiativeSequence(intro);
  }

  scrollBottom();
});

// ─── FICHAS NO PAINEL LATERAL ─────────────────────────────────────────────────
function renderCharacterSwitcher() {
  const switcher = el("character-switcher");
  if (switcher) switcher.style.display = "none";

  const wrap = el("sheet-full-btn-wrap");
  if (!wrap) return;

  if (!isMultiplayer || allCharacters.length <= 1) {
    wrap.innerHTML = "";
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";
  const currentActiveTurnChar = initiativeOrder[currentTurnIdx]?.sheet || currentSheet;
  const charsHtml = allCharacters.map((char, i) => {
    const isTurn = currentActiveTurnChar && currentActiveTurnChar.name === char.name;
    const isInspected = currentSheet && currentSheet.name === char.name;
    const avatarSrc = getSafeAvatar(char.avatar_url, char.name);

    const pvCur = char.pv_current ?? 0;
    const pvMax = char.pv_max || 1;
    const pvPct = Math.min(100, Math.max(0, Math.round((pvCur / pvMax) * 100)));

    const isDying = pvCur <= 0;
    const isMad = (char.san_current ?? 0) <= 0;
    const isWounded = pvCur < Math.floor(pvMax * 0.4);

    let statusBadge = "";
    if (isDying) statusBadge = `<span class="char-mini-status dying" title="Morrendo">☠</span>`;
    else if (isMad) statusBadge = `<span class="char-mini-status mad" title="Colapso Mental">🌀</span>`;
    else if (isWounded) statusBadge = `<span class="char-mini-status wounded" title="Ferido Gravemente">❤</span>`;

    return `<button class="btn-char-sheet${isTurn ? " btn-char-active" : ""}${isInspected ? " btn-char-inspected" : ""}" onclick="inspectCharSheet(${i})" title="Inspecionar Dossiê de ${esc(char.name)}">
      <div class="btn-char-avatar-wrap">
        <img class="btn-char-avatar" src="${avatarSrc}" alt="">
        ${statusBadge}
      </div>
      <div class="btn-char-info">
        <div class="btn-char-header">
          <span class="btn-char-name">${esc(char.name)}</span>
          <span class="btn-char-pv-text" style="color:${isDying ? 'var(--red3)' : (isWounded ? 'var(--orange2)' : 'var(--green3)')}">
            ${pvCur}/${char.pv_max || 0} PV
          </span>
        </div>
        <div class="btn-char-mini-bar-track">
          <div class="btn-char-mini-bar-fill" style="width:${pvPct}%;background:${isDying ? 'var(--red3)' : (isWounded ? 'var(--orange2)' : 'var(--green3)')}"></div>
        </div>
        <span class="btn-char-class">${esc(char.class || 'Comum')} · ${char.nex || '5%'} NEX</span>
      </div>
      ${isTurn ? '<span class="btn-char-turn-badge">TURNO</span>' : ''}
      <span class="btn-char-inspect-icon" title="Examinar Dossiê">◈</span>
    </button>`;
  }).join("");

  wrap.innerHTML = `
    <div class="char-switcher-title">AGENTES DA MISSÃO:</div>
    ${charsHtml}
  `;
}

function inspectCharSheet(index) {
  const targetChar = allCharacters[index];
  if (!targetChar) return;
  currentSheet = targetChar;
  renderSheet(targetChar);
  renderCharacterSwitcher();
}

function openCharSheet(index) {
  const targetChar = allCharacters[index];
  if (!targetChar) return;
  renderFullSheet(targetChar);
  openFullSheet();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ARENA DE INICIATIVA COM DESEMPATE SUAVE (2º DADO) ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
let arenaData = []; // [{char, die: null, isTied: false}]

function checkAndStartInitiativeSequence(intro) {
  introDataGlobal = intro;
  const initKey = "initiative_done_" + sessionId;
  if (localStorage.getItem(initKey)) return;

  arenaData = allCharacters.map(char => ({
    char,
    die: null,
    isTied: false
  }));

  showInitiativeArena();
}

function showInitiativeArena() {
  const arena = el("initiative-arena");
  const grid  = el("initiative-players-grid");
  const banner = el("initiative-tiebreak-banner");
  if (!arena || !grid) return;

  if (banner) {
    banner.classList.remove("active");
    banner.style.display = "none";
  }

  grid.innerHTML = arenaData.map((entry, pi) => {
    const char = entry.char;
    const avatarSrc = getSafeAvatar(char.avatar_url, char.name);
    return `
      <div class="initiative-player-card" id="ipc-${pi}">
        <div class="ipc-avatar-wrap">
          <img class="ipc-avatar" src="${avatarSrc}" alt="${esc(char.name)}">
        </div>
        <div class="ipc-info">
          <div class="ipc-name" title="${esc(char.name)}">${esc(char.name)}</div>
          <div class="ipc-class">${esc(char.class || 'Especialista')}</div>
        </div>
        <div class="ipc-dice">
          <div class="ipc-die" id="ipc-die-${pi}" onclick="arenaRollDie(${pi})" title="Clique para rolar 1d20">
            <div class="ipc-die-val" id="ipc-dv-${pi}">d20</div>
            <div class="ipc-die-label">ROLAR</div>
          </div>
        </div>
        <div class="ipc-score" id="ipc-score-${pi}">
          <span>—</span>
        </div>
        <div class="ipc-rank" id="ipc-rank-${pi}"></div>
      </div>`;
  }).join('');

  const confirmBtn = el("arena-confirm-btn");
  if (confirmBtn) confirmBtn.disabled = true;

  const rollAllBtn = el("arena-roll-all-btn");
  if (rollAllBtn) rollAllBtn.disabled = false;

  const sub = el("arena-subtitle");
  if (sub) sub.textContent = "Role 1d20 por agente. O maior resultado define a ordem. Em empate, os empatados rolam novamente!";

  arena.classList.remove("fading");
  arena.classList.add("active");
}

function arenaRollDie(pi) {
  const entry = arenaData[pi];
  if (!entry || entry.die !== null) return;

  const val = Math.floor(Math.random() * 20) + 1;
  const dieEl = el(`ipc-die-${pi}`);
  const valEl = el(`ipc-dv-${pi}`);
  if (!dieEl || !valEl) return;

  dieEl.classList.add("ipc-rolling", "ipc-die-rolled");
  if (typeof Dice3D !== "undefined" && Dice3D.playDiceSound) Dice3D.playDiceSound();

  const delays = [35, 45, 60, 80, 110, 145, 190, 245, 310];
  let step = 0;

  function nextStep() {
    if (step < delays.length) {
      valEl.textContent = Math.floor(Math.random() * 20) + 1;
      setTimeout(nextStep, delays[step]);
      step++;
    } else {
      entry.die = val;
      valEl.textContent = val;
      dieEl.classList.remove("ipc-rolling");
      if (typeof Dice3D !== "undefined" && Dice3D.playDiceSettleSound) Dice3D.playDiceSettleSound();
      
      const scoreEl = el(`ipc-score-${pi}`);
      if (scoreEl) scoreEl.innerHTML = `<span style="font-size:16px;color:var(--gold);font-weight:700;">${val}</span>`;

      const allRolled = arenaData.every(e => e.die !== null);
      if (allRolled) {
        setTimeout(checkArenaResults, 400);
      }
    }
  }
  nextStep();
}

function arenaRollAll() {
  const btn = el("arena-roll-all-btn");
  if (btn) btn.disabled = true;

  arenaData.forEach((entry, pi) => {
    if (entry.die === null) {
      setTimeout(() => arenaRollDie(pi), pi * 220);
    }
  });
}

// ─── DESEMPATE E REVELAÇÃO SUAVE (SEM VANTAGEM · REROLAGEM EM EMPATE) ─────────
function checkArenaResults() {
  const banner = el("initiative-tiebreak-banner");
  const sub = el("arena-subtitle");

  // Conta frequências dos valores tirados
  const counts = {};
  arenaData.forEach(e => {
    counts[e.die] = (counts[e.die] || 0) + 1;
  });

  const tiedScores = Object.keys(counts).filter(k => counts[k] > 1);

  if (tiedScores.length > 0) {
    // EMPATE DETECTADO: Exibe banner e rerola apenas os empatados
    if (banner) {
      banner.style.display = "inline-flex";
      banner.classList.add("active");
      banner.textContent = `⚔ EMPATE (${tiedScores.join(", ")}) — ROLANDO NOVAMENTE PARA OS EMPATADOS ⚔`;
    }
    if (sub) sub.textContent = `Empate detectado (${tiedScores.join(", ")}). Rerolando os dados dos agentes empatados...`;

    arenaData.forEach((entry, pi) => {
      const card = el(`ipc-${pi}`);
      if (counts[entry.die] > 1) {
        card?.classList.add("tied-player");
      } else {
        card?.classList.remove("tied-player");
      }
    });

    setTimeout(() => {
      // Reseta e rerola somente os que empataram
      arenaData.forEach((entry, pi) => {
        if (counts[entry.die] > 1) {
          entry.die = null;
          const valEl = el(`ipc-dv-${pi}`);
          if (valEl) valEl.textContent = "d20";
          const dieEl = el(`ipc-die-${pi}`);
          if (dieEl) dieEl.classList.remove("ipc-die-rolled", "ipc-rolling");
          const scoreEl = el(`ipc-score-${pi}`);
          if (scoreEl) scoreEl.innerHTML = `<span>—</span>`;
        }
      });

      let delayIdx = 0;
      arenaData.forEach((entry, pi) => {
        if (entry.die === null) {
          setTimeout(() => arenaRollDie(pi), delayIdx * 240);
          delayIdx++;
        }
      });
    }, 1100);

    return;
  }

  // SEM EMPATES: Todos os valores são únicos e distintos
  if (banner) {
    banner.classList.remove("active");
    banner.style.display = "none";
  }

  arenaData.forEach((_, pi) => {
    el(`ipc-${pi}`)?.classList.remove("tied-player");
  });

  const sorted = [...arenaData].sort((a, b) => b.die - a.die);
  const highestScore = sorted[0]?.die;

  sorted.forEach((entry, rankIdx) => {
    const pi = arenaData.indexOf(entry);
    const card = el(`ipc-${pi}`);
    const rankEl = el(`ipc-rank-${pi}`);

    setTimeout(() => {
      if (card && entry.die === highestScore) card.classList.add("best-player");
      if (rankEl) {
        rankEl.textContent = `${rankIdx + 1}º Lugar`;
        rankEl.className = `ipc-rank visible rank-${rankIdx + 1 <= 3 ? rankIdx + 1 : 'other'}`;
      }
    }, rankIdx * 280);
  });

  setTimeout(() => {
    const confirmBtn = el("arena-confirm-btn");
    if (confirmBtn) confirmBtn.disabled = false;
    if (sub) sub.textContent = "Ordem de iniciativa definida! Confirme para iniciar a investigação.";
  }, sorted.length * 280 + 200);
}

async function arenaConfirm() {
  const arena = el("initiative-arena");
  if (arena) {
    arena.classList.add("fading");
    setTimeout(() => {
      arena.classList.remove("active", "fading");
      arena.style.display = "none";
    }, 400);
  }

  const sorted = [...arenaData].sort((a, b) => b.die - a.die);

  const playerResults = sorted.map((e, idx) => ({
    tipo: "jogador",
    nome: e.char.name,
    iniciativa: e.die,
    sheet: e.char,
    player_index: e.char.player_index !== undefined ? e.char.player_index : idx
  }));

  // NPCs também recebem 1d20 puro sem empates com os jogadores
  const usedScores = new Set(playerResults.map(p => p.iniciativa));
  const npcs = (introDataGlobal?.world_data?.npcs_ativos || []).map(n => {
    let d = Math.floor(Math.random() * 20) + 1;
    while (usedScores.has(d)) {
      d = Math.floor(Math.random() * 20) + 1;
    }
    usedScores.add(d);
    return {
      tipo: "npc",
      nome: n.nome || "Ameaça",
      iniciativa: d,
      npc: n
    };
  });

  const fullOrder = [...playerResults, ...npcs].sort((a, b) => b.iniciativa - a.iniciativa);

  initiativeOrder = fullOrder;
  currentTurnIdx  = 0;
  roundStartIdx   = 0;

  localStorage.setItem("initiative_done_" + sessionId, "true");

  const rankingText = fullOrder.map((item, idx) =>
    `${idx + 1}º ${item.nome} (${item.iniciativa})`
  ).join(" ➔ ");

  await addMsg("system", `ORDEM DE INICIATIVA DEFINIDA:\n${rankingText}`);

  // Narração de abertura oficial do Mestre (retrai o menu durante a leitura)
  if (introDataGlobal && introDataGlobal.narration) {
    document.body.classList.add("master-narrating");
    await addMsg("narrator", introDataGlobal.narration, "intro");
    await new Promise(r => setTimeout(r, 850));
  }

  const firstTurn = fullOrder[0] || { nome: currentSheet?.name, sheet: currentSheet, tipo: "jogador" };
  await playTurnTransition(firstTurn);

  initTurnUI();
  renderCharacterSwitcher();
  if (firstTurn?.sheet) {
    renderSheet(firstTurn.sheet);
    document.body.setAttribute("data-player-class", (firstTurn.sheet.class || "comum").toLowerCase());
  }
}

// ─── BACKGROUND DINÂMICO ──────────────────────────────────────────────────────
function applyDynamicBackground(bg) {
  if (!bg) return;
  document.body.setAttribute("data-theme", bg.id);
  const existing = document.querySelector(".dynamic-bg-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "dynamic-bg-overlay";
  overlay.style.cssText = `position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; pointer-events: none !important; z-index: 0 !important; background: ${bg.gradient_css || ""}; opacity: 1; mix-blend-mode: screen;`;
  document.body.appendChild(overlay);
}

// ─── BANCO DE AÇÕES PREDEFINIDAS ──────────────────────────────────────────────
async function loadActionsDB() {
  try {
    const r = await fetch("/api/actions");
    if (r.ok) actionsDB = await r.json();
  } catch { actionsDB = null; }
}

// ─── RENDERIZAÇÃO DA FICHA ────────────────────────────────────────────────────
let prevSheetStats = { pv: null, pe: null, san: null, nex: null, name: null };

function showDelta(stat, delta) {
  if (!delta || delta === 0) return;
  const deltaEl = el(`delta-${stat}`);
  if (!deltaEl) return;

  deltaEl.textContent = delta > 0 ? `+${delta}` : `${delta}`;
  deltaEl.className = `res-delta active ${delta > 0 ? 'heal' : 'damage'}`;

  if (typeof AudioManager !== "undefined") {
    if (delta < 0) {
      if (stat === "pv") AudioManager.playSFX("damage_pv");
      else if (stat === "san") AudioManager.playSFX("damage_san");
    }
  }

  setTimeout(() => {
    deltaEl.classList.remove("active");
  }, 1400);
}

function renderSheet(sh) {
  if (!sh) return;
  currentSheet = sh;

  // ─── WRITE-BACK: sincroniza a ficha atualizada em allCharacters e initiativeOrder ───
  // Garante que dados recebidos da API nunca sejam perdidos por um renderSheet
  // subsequente com snapshot antigo
  const idx = sh.player_index;
  if (idx !== undefined && idx !== null) {
    if (allCharacters[idx]) {
      Object.assign(allCharacters[idx], sh);
    }
    // Atualiza o snapshot em initiativeOrder para que getCurrentSheet leia o dado correto
    initiativeOrder.forEach(entry => {
      if (entry.tipo === 'jogador' && entry.player_index === idx && entry.sheet) {
        Object.assign(entry.sheet, sh);
      }
    });
  }

  // Detecta alterações nos recursos e ativa deltas flutuantes
  if (prevSheetStats.name === sh.name) {
    if (prevSheetStats.pv !== null && prevSheetStats.pv !== sh.pv_current) {
      showDelta("pv", (sh.pv_current ?? 0) - prevSheetStats.pv);
    }
    if (prevSheetStats.pe !== null && prevSheetStats.pe !== sh.pe_current) {
      showDelta("pe", (sh.pe_current ?? 0) - prevSheetStats.pe);
    }
    if (prevSheetStats.san !== null && prevSheetStats.san !== sh.san_current) {
      showDelta("san", (sh.san_current ?? 0) - prevSheetStats.san);
    }
    if (prevSheetStats.nex !== null && prevSheetStats.nex !== sh.nex) {
      const oldN = parseInt(prevSheetStats.nex) || 5;
      const newN = parseInt(sh.nex) || 5;
      if (newN > oldN) {
        addMsg("system", `✦ EXPOSIÇÃO PARANORMAL: ${sh.name || "Agente"} ➔ NEX aumentou para ${sh.nex} (+${newN - oldN}% de contato com o Outro Lado)!`);
        if (typeof AudioManager !== "undefined") AudioManager.playSFX("nex_up");
        const nb = el("nex-bar");
        if (nb) {
          nb.classList.remove("pulse-heal");
          void nb.offsetWidth;
          nb.classList.add("pulse-heal");
        }
      }
    }
  }

  prevSheetStats = {
    pv: sh.pv_current,
    pe: sh.pe_current,
    san: sh.san_current,
    nex: sh.nex || "5%",
    name: sh.name
  };

  const origin = sh.origin || sh.origem || (sh.identity && sh.identity.origem) || "";
  const age = sh.age || sh.idade || (sh.identity && sh.identity.idade) || "";

  if (el("sh-name")) el("sh-name").textContent = sh.name || "—";
  if (el("sh-class")) {
    el("sh-class").textContent = origin ? `${sh.class || '—'} · ${origin}` : (sh.class || "—");
  }
  if (el("sh-nex")) el("sh-nex").textContent = sh.nex || "5%";
  if (el("sh-nex-bar-pct")) el("sh-nex-bar-pct").textContent = sh.nex || "5%";
  if (el("sh-location")) {
    el("sh-location").textContent = sh.current_location || "Localização desconhecida";
  }

  const avatarEl = el("sh-avatar");
  if (avatarEl) avatarEl.src = getSafeAvatar(sh.avatar_url, sh.name);

  // Dot de status no avatar — indica condição crítica visualmente
  const statusDot = el("sp-status-dot");
  if (statusDot) {
    statusDot.className = "sp-avatar-status-dot";
    if (sh.pv_current <= 0) statusDot.classList.add("dying");
    else if (sh.san_current <= 0) statusDot.classList.add("mad");
    else if (sh.pv_current < Math.floor(sh.pv_max * 0.4)) statusDot.classList.add("wounded");
  }

  document.body.setAttribute("data-player-class", (sh.class || "comum").toLowerCase());

  const nexPct = parseInt(sh.nex || "5%") || 5;
  if (el("nex-bar")) el("nex-bar").style.width = nexPct + "%";


  setBar("pv",  sh.pv_current,  sh.pv_max);
  setBar("pe",  sh.pe_current,  sh.pe_max);
  setBar("san", sh.san_current, sh.san_max);

  // Estados Visuais dos Grupos de Recursos
  el("group-pv")?.classList.toggle("is-dying", (sh.pv_current <= 0));
  el("group-san")?.classList.toggle("is-mad", (sh.san_current <= 0));
  el("group-pe")?.classList.toggle("is-exhausted", (sh.pe_current <= 0));

  // ─── ALERTA DINÂMICO DE CRISE (3 Rounds Countdown) ───────────────────────────
  const crisisAlert = el("crisis-alert");
  if (crisisAlert) {
    if ((sh.dying_rounds && sh.dying_rounds > 0) || sh.pv_current <= 0) {
      crisisAlert.style.display = "block";
      crisisAlert.innerHTML = `
        <div class="crisis-box crisis-dying">
          <span class="crisis-icon">☠</span>
          <div>
            <strong>EM MORTE: Rodada ${sh.dying_rounds || 1}/3</strong><br>
            <span style="font-size:10px;opacity:0.95;">Agente inconsciente e sangrando! Use Primeiros Socorros ou cura!</span>
          </div>
        </div>`;
    } else if ((sh.madness_rounds && sh.madness_rounds > 0) || sh.san_current <= 0) {
      crisisAlert.style.display = "block";
      crisisAlert.innerHTML = `
        <div class="crisis-box crisis-madness">
          <span class="crisis-icon">🌀</span>
          <div>
            <strong>COLAPSO MENTAL: Rodada ${sh.madness_rounds || 1}/3</strong><br>
            <span style="font-size:10px;opacity:0.95;">A mente está se rompendo! Restaure a Sanidade com urgência!</span>
          </div>
        </div>`;
    } else if (sh.pe_current <= 0) {
      crisisAlert.style.display = "block";
      crisisAlert.innerHTML = `
        <div class="crisis-box crisis-exhausted">
          <span class="crisis-icon">⚡</span>
          <div>
            <strong>EXAUSTO (0 PE)</strong><br>
            <span style="font-size:10px;opacity:0.95;">Esgotamento total: Habilidades e rituais com custo de PE bloqueados.</span>
          </div>
        </div>`;
    } else {
      crisisAlert.style.display = "none";
      crisisAlert.innerHTML = "";
    }
  }

  const a = sh.attributes || {};
  if (el("at-agi")) el("at-agi").textContent = fmt(a.agilidade);
  if (el("at-for")) el("at-for").textContent = fmt(a.forca);
  if (el("at-int")) el("at-int").textContent = fmt(a.intelecto);
  if (el("at-pre")) el("at-pre").textContent = fmt(a.presenca);
  if (el("at-vig")) el("at-vig").textContent = fmt(a.vigor);

  renderTags("sh-abilities", sh.abilities || [], "ability", sh.pe_current);
  renderTags("sh-skills",    sh.skills    || [], "skill");
  renderTags("sh-inventory", sh.inventory || [], "item");

  const row = el("sh-status-row");
  if (row) {
    row.innerHTML = (sh.status_effects || []).map(s => {
      let tagClass = "status-tag";
      let icon = "◈";
      if (s.includes("Morrendo") || s.includes("Morto")) {
        tagClass += " status-dying"; icon = "☠";
      } else if (s.includes("Colapso") || s.includes("Enlouquecido")) {
        tagClass += " status-madness"; icon = "🌀";
      } else if (s.includes("Exausto")) {
        tagClass += " status-exhausted"; icon = "⚡";
      } else if (s.includes("Ferido")) {
        tagClass += " status-wounded"; icon = "❤";
      } else if (s.includes("Abalado")) {
        tagClass += " status-shaken"; icon = "☽";
      }
      return `<span class="${tagClass}">${icon} ${esc(s)}</span>`;
    }).join("") || "";
  }

  renderFullSheet(sh);
  renderCharacterSwitcher();
}

function setBar(key, cur, max) {
  const pct = max > 0 ? Math.round((cur / max) * 100) : 0;
  const safePct = clamp(pct, 0, 100);

  // Legacy bar (hidden in new layout but kept for compatibility)
  if (el(`sh-${key}`)) el(`sh-${key}`).textContent = `${cur ?? '?'}/${max ?? '?'}`;
  if (el(`bar-${key}`)) el(`bar-${key}`).style.width = safePct + "%";

  // New: separate cur/max number labels
  if (el(`sh-${key}-cur`)) el(`sh-${key}-cur`).textContent = cur ?? '?';
  if (el(`sh-${key}-max`)) el(`sh-${key}-max`).textContent = max ?? '?';

  // New: SVG ring stroke-dashoffset (circumference = 207.3 for r=33)
  const ringEl = el(`ring-${key}`);
  if (ringEl) {
    const circumference = 207.3;
    const offset = circumference * (1 - safePct / 100);
    ringEl.style.strokeDashoffset = offset.toFixed(2);
  }
}

function useSidebarItem(itemName) {
  if (isWaiting) return;
  openTargetModal({ type: 'item', name: itemName });
}

function useSidebarAbility(abilityName, cost) {
  if (isWaiting) return;
  const sh = getCurrentSheet();
  if (sh && cost && cost > (sh.pe_current || 0)) {
    addMsg("system", `✦ Você está sem PE suficiente para usar ${abilityName} (Requer ${cost} PE).`);
    return;
  }
  openTargetModal({ type: 'habilidade', name: abilityName, cost: cost });
}

function renderTags(containerId, items, tagClass, currentPe = 999) {
  const c = el(containerId);
  if (!c) return;
  if (!items.length) { c.innerHTML = `<span class="sp-tag-empty tag-empty">—</span>`; return; }

  c.innerHTML = items.map(item => {
    if (tagClass === "item") {
      const isObj = typeof item === "object";
      const nome = isObj ? (item.nome || "?") : item;
      const acao = isObj ? (item.acao || "utilidade").toLowerCase() : "utilidade";
      const icon = ACTION_ICONS[isObj ? item.acao : "utilidade"] || "📦";
      const desc = isObj ? (item.descricao || "") : "Clique para usar este item.";
      return `<span class="tag tag-item action-${acao}" onclick="useSidebarItem('${esc(nome)}')" title="${esc(desc)} (Clique para Usar)">${icon} ${esc(nome)}</span>`;
    }

    if (tagClass === "ability") {
      const isObj = typeof item === "object";
      const nome = isObj ? (item.nome || "?") : item;
      const cost = isObj ? (item.custo_pe || item.pe || 0) : 0;
      const desc = isObj ? (item.descricao || "") : "Habilidade de classe.";
      const isDisabled = cost > 0 && currentPe < cost;
      const disabledClass = isDisabled ? "disabled-ability" : "";
      const tooltip = isDisabled ? `Sem PE suficiente (${cost} PE necessários)` : (desc ? `${desc} (${cost ? `${cost} PE` : 'Ação Livre'})` : 'Clique para ativar');

      return `<span class="tag tag-ability ${disabledClass}" onclick="useSidebarAbility('${esc(nome)}', ${cost})" title="${esc(tooltip)}">${cost ? `[${cost}PE] ` : ''}${esc(nome)}</span>`;
    }

    const txt = typeof item === "string" ? item : item.nome || "?";
    return `<span class="tag tag-${tagClass}" title="${esc(typeof item === 'object' ? (item.descricao||'') : '')}">${esc(txt)}</span>`;
  }).join("");
}

// ─── MODAL DE FICHA COMPLETA ──────────────────────────────────────────────────
function renderFullSheet(sh) {
  if (!sh) return;
  if (el("sfm-name")) el("sfm-name").textContent = sh.name || "—";
  if (el("sfm-class")) el("sfm-class").textContent = sh.class || "—";
  if (el("sfm-nex")) el("sfm-nex").textContent = sh.nex || "5%";

  const sfmAvatar = el("sfm-avatar");
  if (sfmAvatar) sfmAvatar.src = getSafeAvatar(sh.avatar_url, sh.name);

  const id = sh.identity || {};
  const age = sh.age || sh.idade || id.idade || "28";
  const gender = sh.gender || sh.genero || id.sexo || "Masculino";
  const origin = sh.origin || sh.origem || id.origem || "Policial";
  const appearance = sh.appearance || sh.aparencia || id.aparencia || "";
  const history = sh.history || sh.historico || id.trauma || "";

  const personality = sh.personality || id.personalidade || "";
  const fear = sh.fear || id.medo || "";
  const affinity = sh.affinity || id.afinidade || "Nenhuma";
  const nex = sh.nex || "NEX 5%";

  if (el("sfm-identity")) {
    const idRows = [
      ["Idade", `${age} anos`],
      ["Gênero", gender],
      ["Patente", nex],
      ["Origem", origin],
      ["Classe", `${sh.class || "Agente"} (${sh.trilha || "Padrão"})`],
      ["Afinidade", affinity !== "Nenhuma" ? affinity : "Não Desperta"]
    ];
    
    let html = idRows.map(([l,v]) =>
      `<div class="sfm-identity-row"><span class="sfm-id-label">${l}</span><span class="sfm-id-value">${esc(String(v))}</span></div>`
    ).join("");

    if (personality) {
      html += `<div class="sfm-identity-block"><span class="sfm-id-label">Personalidade / Frase:</span><div class="sfm-id-desc">${esc(personality)}</div></div>`;
    }
    if (fear) {
      html += `<div class="sfm-identity-block"><span class="sfm-id-label" style="color:#e06060;">Medo / Fobia:</span><div class="sfm-id-desc">${esc(fear)}</div></div>`;
    }
    if (appearance) {
      html += `<div class="sfm-identity-block"><span class="sfm-id-label">Aparência & Estilo:</span><div class="sfm-id-desc">${esc(appearance)}</div></div>`;
    }

    el("sfm-identity").innerHTML = html;
  }

  if (el("sfm-resources")) {
    el("sfm-resources").innerHTML = [
      ["❤","PV",  sh.pv_current,  sh.pv_max,  "pv"],
      ["✦","PE",  sh.pe_current,  sh.pe_max,  "pe"],
      ["☽","SAN", sh.san_current, sh.san_max, "san"]
    ].map(([icon,label,cur,max,key]) => {
      const pct = max > 0 ? Math.round((cur/max)*100) : 0;
      return `<div class="sfm-res-row">
        <span class="sfm-res-icon">${icon}</span>
        <span class="sfm-res-label">${label}</span>
        <span class="sfm-res-val">${cur??'?'}/${max??'?'}</span>
        <div class="sfm-res-track"><div class="sfm-res-fill sfm-res-fill-${key}" style="width:${clamp(pct,0,100)}%"></div></div>
      </div>`;
    }).join("");
  }

  const a = sh.attributes || {};
  if (el("sfm-attrs")) {
    el("sfm-attrs").innerHTML = [
      ["AGI", a.agilidade], ["FOR", a.forca], ["INT", a.intelecto],
      ["PRE", a.presenca],  ["VIG", a.vigor]
    ].map(([n,v]) =>
      `<div class="sfm-attr-cell"><div class="sfm-attr-val">${fmt(v)}</div><div class="sfm-attr-name">${n}</div></div>`
    ).join("");
  }

  if (el("sfm-origin")) {
    el("sfm-origin").innerHTML = `
      <div style="font-weight:700;color:var(--gold);margin-bottom:4px">Origem: ${esc(origin)}</div>
      ${history ? `<p style="margin-bottom:8px;line-height:1.5">${esc(history)}</p>` : `<p style="color:var(--text-d);font-style:italic">Histórico confidencial da Ordo Realitas.</p>`}
    `;
  }

  const abils = sh.abilities || [];
  if (el("sfm-abilities")) {
    el("sfm-abilities").innerHTML = abils.length
      ? abils.map(a => {
          const nome = typeof a === "string" ? a : a.nome;
          const desc = typeof a === "string" ? "" : (a.descricao || "");
          const custo = typeof a === "object" ? (a.custo || "") : "";
          return `<div class="sfm-ability-card">
            <div class="sfm-ability-name">${esc(nome)}${custo?`<span class="sfm-ability-cost">${esc(custo)}</span>`:""}</div>
            ${desc?`<div class="sfm-ability-desc">${esc(desc)}</div>`:""}
          </div>`;
        }).join("")
      : `<span class="tag-empty">Nenhuma habilidade especial</span>`;
  }

  if (el("sfm-skills")) {
    el("sfm-skills").innerHTML = (sh.skills || []).map(s =>
      `<span class="tag tag-skill">${esc(s)}</span>`
    ).join("") || `<span class="tag-empty">—</span>`;
  }

  if (el("sfm-inventory")) {
    const items = sh.inventory || [];
    el("sfm-inventory").innerHTML = items.length
      ? items.map(item => {
          const nome = typeof item === "string" ? item : item.nome;
          const acao = typeof item === "object" ? (item.acao || "Utilidade") : "Utilidade";
          const desc = typeof item === "object" ? (item.descricao || "") : "";
          const foto = typeof item === "object" ? (item.foto || "") : "";
          const icon = ACTION_ICONS[acao] || "📦";
          return `
            <div class="sfm-inv-card">
              ${foto && foto.startsWith("http") ? `<img src="${foto}" class="sfm-inv-thumb" alt="">` : `<div class="sfm-inv-icon">${icon}</div>`}
              <div class="sfm-inv-details">
                <div class="sfm-inv-top">
                  <span class="sfm-inv-name">${esc(nome)}</span>
                  <span class="sfm-inv-badge action-${acao.toLowerCase()}">${icon} ${esc(acao)}</span>
                </div>
                ${desc ? `<div class="sfm-inv-desc">${esc(desc)}</div>` : ''}
              </div>
            </div>
          `;
        }).join("")
      : `<span class="tag-empty">Vazio</span>`;
  }
}

function openFullSheet()  { 
  const overlay = el("sheet-overlay");
  if (overlay) {
    overlay.classList.add("active", "open");
    overlay.style.display = "flex";
  }
}

function closeFullSheet() { 
  const overlay = el("sheet-overlay");
  if (overlay) {
    overlay.classList.remove("active", "open");
    overlay.style.display = "none";
  }
}

function closeFullSheetIfOutside(e) { 
  if (e.target === el("sheet-overlay")) closeFullSheet(); 
}

// ─── SISTEMA DE TURNOS ────────────────────────────────────────────────────────
function initTurnUI() {
  const indicator = el("turn-indicator");
  if (indicator) indicator.style.display = "";
  updateTurnUI();
}

function updateTurnUI() {
  if (!initiativeOrder.length) return;
  const current = initiativeOrder[currentTurnIdx];
  if (!current) return;

  if (el("turn-name")) el("turn-name").textContent = current.nome || "—";

  const bar = el("turn-bar");
  if (bar) {
    bar.innerHTML = initiativeOrder.map((t, i) => {
      const cls = [
        "turn-dot",
        t.tipo === "npc" ? "npc" : "",
        i === currentTurnIdx ? "active" : (i < currentTurnIdx ? "done" : "")
      ].filter(Boolean).join(" ");
      return `<div class="${cls}" title="${esc(t.nome)} (ini: ${t.iniciativa})"></div>`;
    }).join("");
  }

  // Usa a ficha VIVA de allCharacters (atualizada pelo backend) e não o
  // snapshot estático que foi guardado no momento da iniciativa
  if (current.tipo === "jogador") {
    const liveSheet = (current.player_index !== undefined && allCharacters[current.player_index])
      ? allCharacters[current.player_index]
      : current.sheet;
    if (liveSheet) renderSheet(liveSheet);
  }
  renderCharacterSwitcher();

  const isNPCTurn = current.tipo === "npc";
  ["card-attack","card-action","card-item","card-skip"].forEach(id => {
    el(id)?.classList.toggle("disabled", isNPCTurn);
  });

  if (isNPCTurn) {
    setTimeout(() => processNPCTurn(current), 1500);
  }
}

function processNPCTurn(npc) {
  addMsg("system", `✦ Vez de ${npc.nome} — a entidade age nas sombras...`);
  setTimeout(() => advanceTurn(true, null), 2000);
}

async function advanceTurn(fromNPC = false, actionRecord = null) {
  if (!initiativeOrder.length) return;

  if (actionRecord && !fromNPC) {
    roundActions.push(actionRecord);
  }

  const totalPlayers = initiativeOrder.filter(t => t.tipo === "jogador").length;
  const nextIdx = (currentTurnIdx + 1) % initiativeOrder.length;
  const roundComplete = nextIdx === roundStartIdx && roundActions.length >= totalPlayers;

  if (roundComplete && roundActions.length > 0) {
    const actionsToNarrate = [...roundActions];
    roundActions = [];
    roundStartIdx = nextIdx;
    await narrateRound(actionsToNarrate);
  }

  currentTurnIdx = nextIdx;
  updateTurnUI();

  if (!fromNPC && isMultiplayer && !roundComplete) {
    const nextPlayer = initiativeOrder[nextIdx];
    if (nextPlayer?.tipo === "jogador") {
      await playTurnTransition(nextPlayer);
    }
  }
}

async function narrateRound(actions) {
  if (!actions || actions.length === 0) return;

  setWaiting(true);
  document.body.classList.add("master-narrating");
  addMsg("system", "O Mestre narra o desfecho da rodada...");

  const summary = actions.map(a =>
    `${a.playerName}: ${a.action}${a.diceResult ? ` (dado: ${a.diceResult.total}, ${a.diceResult.success ? 'sucesso' : 'falha'})` : ''}`
  ).join(" | ");

  try {
    const r = await fetch("/api/rpg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: `[ROUND_NARRATION] ${summary}`,
        sessionId,
        diceResult: null,
        is_round_narration: true,
        round_actions: actions
      })
    });
    const data = await r.json();
    if (data.contextual_suggestions && data.contextual_suggestions.length > 0) {
      currentSuggestions = data.contextual_suggestions;
    }
    if (data.narration) await addMsg("narrator", data.narration);
    if (data.cinematica) playCinematic(data.cinematica);
    if (data.sheet) renderSheet(data.sheet);
    if (data.scene_type) applySceneAtmosphere(data.scene_type, data.scene_title, data.scene_progress);
    if (data.bgm_mood && typeof AudioManager !== "undefined") {
      AudioManager.setMood(data.bgm_mood);
    }
  } catch (e) {
    addMsg("error", "Erro ao narrar o round.");
    document.body.classList.remove("master-narrating");
  } finally {
    setWaiting(false);
    scrollBottom();
  }
}

async function playTurnTransition(player) {
  if (!player) return;
  if (typeof AudioManager !== "undefined") AudioManager.playSFX("turn_change");
  return new Promise(resolve => {
    const tt = el("turn-transition");
    if (!tt) { resolve(); return; }

    const isNPC = player.tipo === "npc";
    const nome = player.nome || player.name || player.sheet?.name || (isNPC ? "Ameaça" : "Agente");
    const classe = isNPC ? (player.npc?.tipo || "Ameaça Paranormal") : (player.sheet?.class || player.class || "Especialista");
    const label = isNPC ? "VEZ DA AMEAÇA" : "VEZ DO AGENTE";

    if (el("tt-name")) el("tt-name").textContent = nome;
    if (el("tt-class")) el("tt-class").textContent = classe;
    if (el("tt-label")) el("tt-label").textContent = label;

    if (initiativeOrder && initiativeOrder.length > 0) {
      const order = initiativeOrder.map(t =>
        `<span style="color:${t.tipo==='npc'?'#e06060':'#c9a84c'}">${esc(t.nome || t.name)} (${t.iniciativa || 0})</span>`
      ).join(" → ");
      if (el("tt-order")) el("tt-order").innerHTML = order;
    } else if (el("tt-order")) {
      el("tt-order").innerHTML = `<span style="color:var(--gold)">${esc(nome)} · ${esc(classe)}</span>`;
    }

    if (typeof Dice3D !== "undefined" && Dice3D.playDiceSound) Dice3D.playDiceSound();

    tt.style.display = "flex";
    tt.classList.remove("exit");
    void tt.offsetWidth; // force reflow for smooth transition
    tt.classList.add("active");

    setTimeout(() => {
      tt.classList.add("exit");
      setTimeout(() => {
        tt.classList.remove("active", "exit");
        tt.style.display = "none";
        resolve();
      }, 450);
    }, 1400);
  });
}

// ─── SISTEMA DE CARTAS — MENUS ────────────────────────────────────────────────
function openAttackMenu() {
  if (isWaiting) return;
  const list = el("attack-list");
  const sh = getCurrentSheet();
  const abils = sh?.abilities || [];
  const pe = sh?.pe_current || 0;

  if (!list) return;

  let html = "";
  if (!abils.length) {
    html += `<span style="color:var(--text-d);font-size:14px;padding:8px">Nenhuma habilidade especial disponível.</span>`;
  } else {
    html += abils.map((a, i) => {
      const nome  = typeof a === "string" ? a : a.nome;
      const custo = typeof a === "object" ? (a.custo || "") : "";
      const custoNum = parseInt(custo) || 0;
      const disabled = custoNum > pe;
      return `<button class="menu-action-btn${disabled ? " disabled-item" : ""}" id="attack-btn-${i}"
        onclick="selectAttack('${esc(nome)}', '${esc(custo)}')">
        <span class="menu-action-icon">⚔</span>
        <span>${esc(nome)}</span>
        ${custo ? `<span class="menu-action-cost">${esc(custo)}</span>` : ""}
      </button>`;
    }).join("");
  }

  html += `<button class="menu-action-btn" id="attack-btn-basic" onclick="selectAttack('Ataque básico corporal', '0 PE')">
    <span class="menu-action-icon">🗡</span>
    <span>Ataque Básico</span>
    <span class="menu-action-cost">0 PE</span>
  </button>`;

  list.innerHTML = html;
  openMenu("attack-menu");
}

function selectAttack(nome, custo) {
  closeMenu("attack-menu");
  openTargetModal({ type: 'ataque', name: nome, cost: custo });
}

function openActionMenu() {
  if (isWaiting) return;
  showActionTab(currentActionTab || "locais");
  openMenu("action-menu");
}

function getContextualSuggestionsList() {
  if (currentSuggestions && Array.isArray(currentSuggestions) && currentSuggestions.length > 0) {
    return currentSuggestions.map(s => typeof s === "string" ? s : (s.texto || s.text || "Investigar com cautela"));
  }
  const sh = getCurrentSheet();
  const cl = sh?.class || "Especialista";
  return [
    `Investigar pistas e anomalias na cena`,
    `Adotar postura defensiva em cobertura`,
    `Interagir com o ambiente para obter vantagem tática`,
    `Comunicar estratégia aos outros agentes`
  ];
}

function showActionTab(tab) {
  currentActionTab = tab;
  document.querySelectorAll(".card-tab").forEach(t => t.classList.remove("active"));
  el(`tab-${tab}`)?.classList.add("active");

  let html = "";

  if (tab === "locais") {
    const sh = getCurrentSheet();
    const mapData = introDataGlobal?.world_data?.mapa_locais || getFallbackMap();
    const currentRoom = mapData.find(r => r.nome === sh?.current_location || r.id === sh?.current_location_id) || mapData[0];
    const connections = currentRoom ? (currentRoom.conexoes || []) : [];

    html += `<div style="width:100%;font-size:10px;color:var(--gold);font-family:var(--font-t);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:2px 0 8px;">
      📍 LOCAL ATUAL: <span style="color:#fff;">${esc(currentRoom?.nome || "Desconhecido")}</span>
    </div>`;

    if (connections.length === 0) {
      html += `<div style="color:var(--text-d);font-size:13px;padding:8px;">Nenhum caminho diretamente acessível a partir daqui.</div>`;
    } else {
      html += connections.map((targetId, i) => {
        const targetRoom = mapData.find(r => r.id === targetId);
        if (!targetRoom) return "";
        const isLocked = targetRoom.trancado;
        const icon = isLocked ? "🔒" : "🚪";
        const lockNote = isLocked ? `<span class="menu-action-cost" style="color:var(--red3);border-color:var(--red3)">Trancada</span>` : `<span class="menu-action-cost" style="color:var(--green3);border-color:var(--green3)">Acesso Livre</span>`;

        return `<button class="menu-action-btn" id="action-move-btn-${i}" onclick="selectMoveRoom('${esc(targetRoom.id)}', '${esc(targetRoom.nome)}')">
          <span class="menu-action-icon">${icon}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;flex:1;">
            <strong style="font-size:13px;color:var(--text);">${esc(targetRoom.nome)}</strong>
            <span style="font-size:10px;color:var(--text-d);">${esc(targetRoom.descricao || "Caminho conectado")}</span>
          </div>
          ${lockNote}
        </button>`;
      }).join("");
    }
  } else if (tab === "investigar") {
    const sh = getCurrentSheet();
    const mapData = introDataGlobal?.world_data?.mapa_locais || getFallbackMap();
    const currentRoom = mapData.find(r => r.nome === sh?.current_location || r.id === sh?.current_location_id) || mapData[0];
    const pInvestigacao = currentRoom?.pontos_investigacao || [];

    html += `<div style="width:100%;font-size:10px;color:var(--gold);font-family:var(--font-t);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:2px 0 8px;">
      🔍 PONTOS DE BUSCA EM: <span style="color:#fff;">${esc(currentRoom?.nome || "Local Atual")}</span>
    </div>`;

    if (pInvestigacao.length === 0) {
      html += `<div style="color:var(--text-d);font-size:13px;padding:8px;">Nenhum ponto específico registrado nesta sala. Você pode fazer uma busca geral na aba 'Exploração'.</div>`;
    } else {
      html += pInvestigacao.map((pi, i) => {
        return `<button class="menu-action-btn" id="action-investigate-btn-${i}" onclick="selectInvestigatePoint('${esc(pi.nome)}', ${pi.cd || 12})">
          <span class="menu-action-icon" style="font-size:18px;">${pi.icone || "🔍"}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;flex:1;">
            <strong style="font-size:13px;color:var(--text);">${esc(pi.nome)}</strong>
            <span style="font-size:10px;color:var(--gold-d);">Teste de Investigação (CD ${pi.cd || 12})</span>
          </div>
          <span class="menu-action-cost" style="color:var(--gold);border-color:rgba(201,168,76,0.5)">Examinar ➔</span>
        </button>`;
      }).join("");
    }
  } else {
    const actions = actionsDB?.[tab] || getDefaultActions(tab);
    const sugs = getContextualSuggestionsList();
    if (sugs.length > 0) {
      html += `<div style="width:100%;font-size:10px;color:var(--gold);font-family:var(--font-t);font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:2px 0 6px;">✦ Sugestões do Mestre</div>`;
      html += sugs.map((sug, i) =>
        `<button class="menu-action-btn" style="border-color:rgba(201,168,76,0.6);background:linear-gradient(135deg,rgba(26,20,38,0.92),rgba(12,10,18,0.98));margin-bottom:6px;" id="action-sug-btn-${i}" onclick="selectAction('${esc(sug)}')">
          <span class="menu-action-icon" style="color:var(--gold);">✦</span>
          <span>${esc(sug)}</span>
        </button>`
      ).join("");
      html += `<div style="width:100%;height:1px;background:var(--border2);margin:6px 0 8px;"></div>`;
    }

    html += actions.map((a, i) =>
      `<button class="menu-action-btn" id="action-tab-btn-${tab}-${i}" onclick="selectAction('${esc(a.texto)}')">
        <span class="menu-action-icon">${a.icon || "•"}</span>
        <span>${esc(a.texto)}</span>
      </button>`
    ).join("");
  }

  if (el("action-list")) el("action-list").innerHTML = html;
}

function selectMoveRoom(roomId, roomName) {
  closeMenu("action-menu");
  const mapData = introDataGlobal?.world_data?.mapa_locais || [];
  const target = mapData.find(r => r.id === roomId || r.nome === roomName);
  if (target && target.trancado && target.minigame === "chaves") {
    openMinigameKeys(target);
    return;
  }
  if (typeof AudioManager !== "undefined") AudioManager.playSFX("turn_change");
  enviarAction(`Mover para: ${roomName}`);
}

function selectInvestigatePoint(pontoNome, cd) {
  closeMenu("action-menu");
  if (typeof AudioManager !== "undefined") AudioManager.playSFX("item");
  enviarAction(`Examinar e investigar minuciosamente: ${pontoNome}`);
}

function getDefaultActions(tab) {
  const defaults = {
    exploracao: [
      { texto: "Explorar a área minuciosamente", icon: "◈" },
      { texto: "Investigar objeto suspeito",      icon: "◈" },
      { texto: "Procurar pistas ocultas",         icon: "✦" },
      { texto: "Observar a cena e arredores",     icon: "👁" },
      { texto: "Identificar símbolo ou ritual",   icon: "⸸" },
    ],
    social: [
      { texto: "Falar com o NPC / Aliado",        icon: "✦" },
      { texto: "Abordagem amigável e empática",   icon: "✧" },
      { texto: "Intimidar com firmeza",           icon: "⚔" },
      { texto: "Persuadir com lógica",            icon: "◈" },
      { texto: "Enganar ou blefar",               icon: "❖" },
    ],
    movimento: [
      { texto: "Correr para posição vantajosa",   icon: "►" },
      { texto: "Esconder-se nas sombras",         icon: "☽" },
      { texto: "Escalar ou ultrapassar obstáculo",icon: "▲" },
      { texto: "Auxiliar aliado em perigo",       icon: "🛡" },
      { texto: "Prestar primeiros socorros",      icon: "✚" },
    ],
  };
  return defaults[tab] || [];
}

function selectAction(texto) {
  closeMenu("action-menu");
  const lower = (texto || "").toLowerCase();
  if (lower.includes("auxil") || lower.includes("socorro") || lower.includes("proteger") || lower.includes("psicol")) {
    openTargetModal({ type: 'auxilio', name: texto });
  } else {
    enviarAction(texto);
  }
}

function openItemMenu() {
  if (isWaiting) return;
  const sh = getCurrentSheet();
  const inv = sh?.inventory || [];
  const list = el("item-list");
  if (!list) return;

  if (!inv.length) {
    list.innerHTML = `<span style="color:var(--text-d);font-size:14px;padding:8px">Inventário vazio.</span>`;
  } else {
    list.innerHTML = `
      <div class="inv-split-layout">
        <div class="inv-list-side">
          ${inv.map((item, idx) => {
            const nome = typeof item === "string" ? item : item.nome;
            const acao = typeof item === "object" ? (item.acao || "Utilidade") : "Utilidade";
            const icon = ACTION_ICONS[acao] || "🎒";
            return `
              <button class="menu-action-btn" onclick="previewItem(${idx})">
                <span class="menu-action-icon">${icon}</span>
                <span>${esc(nome)}</span>
                <span class="menu-action-badge action-${acao.toLowerCase()}">${esc(acao)}</span>
              </button>
            `;
          }).join("")}
        </div>
        <div class="inv-desc-side" id="inv-desc-side">
          <div class="inv-desc-text" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-d);">
            Selecione um item para ver detalhes
          </div>
        </div>
      </div>
    `;
    if (inv.length > 0) previewItem(0);
  }

  openMenu("item-menu");
}

function previewItem(idx) {
  const sh = getCurrentSheet();
  const inv = sh?.inventory || [];
  const item = inv[idx];
  const descSide = el("inv-desc-side");
  if (!descSide || !item) return;

  const nome = typeof item === "string" ? item : item.nome;
  const acao = typeof item === "object" ? (item.acao || "Utilidade") : "Utilidade";
  const desc = typeof item === "object" ? (item.descricao || "Item pronto para uso imediato.") : "Item pronto para uso imediato.";
  const foto = typeof item === "object" ? (item.foto || "") : "";
  const icon = ACTION_ICONS[acao] || "🎒";

  descSide.innerHTML = `
    <div class="inv-preview-header" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      ${foto && foto.startsWith("http") ? `<img src="${foto}" class="inv-card-thumb" alt="">` : `<div class="inv-card-icon" style="font-size:22px;">${icon}</div>`}
      <div>
        <div class="inv-desc-title" style="font-family:var(--font-d);font-size:15px;color:var(--gold);margin:0;">${esc(nome)}</div>
        <span class="inv-card-action-badge action-${acao.toLowerCase()}" style="margin-top:4px;">${icon} Ação: ${esc(acao)}</span>
      </div>
    </div>
    <div class="inv-desc-text" style="font-size:13px;line-height:1.5;color:var(--text2);margin-bottom:14px;">${esc(desc)}</div>
    <button class="inv-use-btn" onclick="selectItem('${esc(nome)}', '${esc(acao)}')">
      <span>${icon}</span> Usar ${esc(nome)}
    </button>
  `;
}

function selectItem(nome, acao) {
  closeMenu("item-menu");
  openTargetModal({ type: 'item', name: nome, cost: acao });
}

function skipTurn() {
  if (isWaiting) return;
  enviarAction("Aguardar e observar em silêncio.");
}

function openMenu(id) {
  el(id)?.classList.add("open");
}
function closeMenu(id) {
  el(id)?.classList.remove("open");
}
function closeMenuIfOutside(e, id) {
  if (e.target === el(id)) closeMenu(id);
}

// ─── MOTOR DE SELEÇÃO DE DESTINATÁRIO / ALVO (TARGET MODAL) ────────────────────
let pendingTargetAction = null;

function openTargetModal(actionConfig) {
  pendingTargetAction = {
    type: actionConfig.type || 'habilidade',
    name: actionConfig.name || 'Ação',
    cost: actionConfig.cost || null,
    auxilioType: 'fisico',
    target: null
  };

  const modal = el("target-menu");
  if (!modal) {
    // Fallback se o modal não existir
    enviarAction(actionConfig.name);
    return;
  }

  const iconEl = el("target-action-icon");
  const titleEl = el("target-action-title");
  const subEl = el("target-action-sub");
  const auxWrap = el("target-auxilio-type-wrap");
  const confirmBtn = el("btn-confirm-target");

  if (iconEl) iconEl.textContent = actionConfig.type === 'ataque' ? '⚔' : actionConfig.type === 'item' ? '🎒' : actionConfig.type === 'auxilio' ? '🛡' : '✨';
  if (titleEl) titleEl.textContent = `DIRECIONAR: ${actionConfig.name.toUpperCase()}`;
  if (subEl) subEl.textContent = `Selecione em quem você deseja aplicar esta ação.`;

  const isAux = actionConfig.type === 'auxilio' || actionConfig.name.toLowerCase().includes('auxil') || actionConfig.name.toLowerCase().includes('socorro') || actionConfig.name.toLowerCase().includes('proteger');
  if (auxWrap) {
    auxWrap.style.display = isAux ? 'block' : 'none';
  }

  if (confirmBtn) confirmBtn.disabled = true;

  // 1. Popula Inimigos na Cena
  const enemiesList = el("target-list-enemies");
  const story = introDataGlobal?.world_data;
  const currentEntity = story?.climax?.boss_nome || "Entidade Principal da Cena";
  const enemyOptions = [
    { name: currentEntity, desc: "Ameaça central / Boss da missão", icon: "👹" },
    { name: "Cultistas / Acólitos", desc: "Fanáticos armados em combate", icon: "🩸" },
    { name: "Criatura / Aberração Menor", desc: "Monstro corrompido pelas sombras", icon: "🕷" },
  ];

  if (enemiesList) {
    enemiesList.innerHTML = enemyOptions.map((e, idx) =>
      `<button class="target-card-btn" id="target-enemy-${idx}" onclick="selectTargetOption('enemy', '${esc(e.name)}')">
        <div class="target-card-icon">${e.icon}</div>
        <div class="target-card-info">
          <span class="target-card-name">${esc(e.name)}</span>
          <span class="target-card-sub">${esc(e.desc)}</span>
        </div>
        <span class="target-card-check">✓</span>
      </button>`
    ).join("");
  }

  // 2. Popula Aliados & Você Mesmo
  const alliesList = el("target-list-allies");
  if (alliesList) {
    alliesList.innerHTML = allCharacters.map((char, idx) => {
      const isSelf = currentSheet && currentSheet.name === char.name;
      const avatarSrc = getSafeAvatar(char.avatar_url, char.name);
      return `<button class="target-card-btn" id="target-ally-${idx}" onclick="selectTargetOption('ally', '${esc(char.name)}')">
        <img class="target-card-avatar" src="${avatarSrc}" alt="">
        <div class="target-card-info">
          <span class="target-card-name">${esc(char.name)}${isSelf ? ' (Você)' : ''}</span>
          <span class="target-card-sub">${esc(char.class || 'Agente')} · ${char.pv_current ?? 0}/${char.pv_max ?? 0} PV</span>
        </div>
        <span class="target-card-check">✓</span>
      </button>`;
    }).join("");
  }

  // 3. Popula Ambiente / Objeto
  const envList = el("target-list-env");
  const envOptions = [
    { name: "Ambiente / Barricada", desc: "Estrutura tática ou cobertura sólida", icon: "🧱" },
    { name: "Altar / Símbolo Ritual", desc: "Ponto focal de contenção mística", icon: "⸸" },
    { name: "Mecanismo / Fechadura", desc: "Painel ou passagem de fuga", icon: "⚙" },
  ];
  if (envList) {
    envList.innerHTML = envOptions.map((env, idx) =>
      `<button class="target-card-btn" id="target-env-${idx}" onclick="selectTargetOption('env', '${esc(env.name)}')">
        <div class="target-card-icon">${env.icon}</div>
        <div class="target-card-info">
          <span class="target-card-name">${esc(env.name)}</span>
          <span class="target-card-sub">${esc(env.desc)}</span>
        </div>
        <span class="target-card-check">✓</span>
      </button>`
    ).join("");
  }

  openMenu("target-menu");
}

function selectTargetOption(group, targetName) {
  if (!pendingTargetAction) return;
  pendingTargetAction.target = targetName;

  document.querySelectorAll(".target-card-btn").forEach(btn => btn.classList.remove("selected"));
  event.currentTarget?.classList.add("selected");

  const confirmBtn = el("btn-confirm-target");
  if (confirmBtn) confirmBtn.disabled = false;
}

function selectAuxilioType(type) {
  if (!pendingTargetAction) return;
  pendingTargetAction.auxilioType = type;

  el("btn-aux-fisico")?.classList.toggle("active", type === "fisico");
  el("btn-aux-psicologico")?.classList.toggle("active", type === "psicologico");
}

function confirmTargetAndExecute() {
  if (!pendingTargetAction || !pendingTargetAction.target) return;
  closeMenu("target-menu");

  const { type, name, cost, auxilioType, target } = pendingTargetAction;
  let formatted = "";

  if (type === "ataque") {
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("attack");
    formatted = `Atacar ${target} com: ${name}`;
  } else if (type === "item") {
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("item");
    formatted = `Usar item [${name}] em: ${target}`;
  } else if (type === "auxilio" || name.toLowerCase().includes('auxil') || name.toLowerCase().includes('socorro') || name.toLowerCase().includes('proteger')) {
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("item");
    const modalidade = auxilioType === "psicologico" ? "Auxílio Psicológico (suporte mental contra colapso)" : "Auxílio Físico (cobertura tática/primeiros socorros/defesa)";
    formatted = `Prestar ${modalidade} para ${target}: ${name}`;
  } else {
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("attack");
    formatted = `Usar habilidade [${name}] direcionada a: ${target}${cost ? ` (${cost})` : ''}`;
  }

  pendingTargetAction = null;
  enviarAction(formatted);
}

// ─── ATMOSFERA VISUAL DINÂMICA POR TIPO DE CENA ───────────────────────────────
function applySceneAtmosphere(sceneType, sceneTitle, sceneProgress) {
  const normType = (sceneType || "investigacao").toLowerCase();
  let theme = "investigacao";
  let bgmMood = "calmo";

  if (normType.includes("boss") || normType.includes("climax")) {
    theme = "boss";
    bgmMood = "batalha";
  } else if (normType.includes("combate") || normType.includes("batalha")) {
    theme = "combate";
    bgmMood = "batalha";
  } else if (normType.includes("perseguicao") || normType.includes("fuga")) {
    theme = "perseguicao";
    bgmMood = "perseguicao";
  } else if (normType.includes("epilogo") || normType.includes("vitoria")) {
    theme = "investigacao";
    bgmMood = "vitoria";
  }

  document.body.setAttribute("data-scene-type", theme);
  document.body.className = document.body.className.replace(/theme-\w+/g, '').trim() + ` theme-${theme}`;

  if (typeof AudioManager !== "undefined") {
    AudioManager.setMood(bgmMood);
  }
}

// ─── ENVIO DE AÇÃO PARA O MOTOR DO JOGO ───────────────────────────────────────
// Helper: busca a ficha mais recente do servidor quando o endpoint não a retorna diretamente
async function fetchSessionSheet() {
  if (!sessionId) return null;
  try {
    const r = await fetch(`/api/session-state/${sessionId}`);
    if (!r.ok) return null;
    const d = await r.json();

    // Merge nos objetos existentes em vez de substituir o array inteiro
    // Preserva as referências que initiativeOrder e getCurrentSheet usam
    if (d.all_characters && Array.isArray(d.all_characters)) {
      d.all_characters.forEach((incoming, i) => {
        if (allCharacters[i]) {
          Object.assign(allCharacters[i], incoming);
        } else {
          allCharacters[i] = incoming;
        }
        // Propaga para initiativeOrder também
        initiativeOrder.forEach(entry => {
          if (entry.tipo === 'jogador' && entry.player_index === i && entry.sheet) {
            Object.assign(entry.sheet, incoming);
          }
        });
      });
    }

    return d.sheet || (allCharacters[0] || null);
  } catch { return null; }
}

async function enviarAction(action) {
  if (!action || !sessionId || isWaiting) return;

  setWaiting(true);
  const sh = getCurrentSheet();
  const prevSheet = sh ? { ...sh } : null;
  addMsg("player", action);

  try {
    const r = await fetch("/api/rpg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sessionId, diceResult: null })
    });
    const data = await r.json();

    if (data.error) {
      addMsg("error", data.error);
      document.body.classList.remove("master-narrating");
      return;
    }
    if (data.contextual_suggestions) currentSuggestions = data.contextual_suggestions;
    if (data.scene_type) applySceneAtmosphere(data.scene_type, data.scene_title, data.scene_progress);
    if (data.bgm_mood && typeof AudioManager !== "undefined") {
      AudioManager.setMood(data.bgm_mood);
    }

    // Sempre obter a ficha mais atual — preferir a retornada pela API
    const latestSheet = data.sheet || (await fetchSessionSheet()) || sh;
    if (prevSheet && latestSheet) checkAndTriggerStatCinematics(prevSheet, latestSheet);

    if (data.dice_request) {
      pendingAction = action;
      if (latestSheet) renderSheet(latestSheet);
      showDiceModal(data.dice_request, action);
    } else {
      if (isMultiplayer) {
        const actionRec = { playerName: sh?.name || "Agente", action, diceResult: null };
        if (latestSheet) renderSheet(latestSheet);
        await advanceTurn(false, actionRec);
      } else {
        document.body.classList.add("master-narrating");
        if (data.narration) await addMsg("narrator", data.narration);
        if (data.cinematica) playCinematic(data.cinematica);
        if (latestSheet) renderSheet(latestSheet);
        scrollBottom();

        if (data.victory || (data.narration && data.narration.includes("VITÓRIA DA MISSÃO"))) {
          setTimeout(() => openVictoryModal(data.narration), 2200);
        } else if (data.madness || (data.narration && data.narration.includes("INSANIDADE TOTAL"))) {
          setTimeout(() => openMadnessModal(data.narration), 2200);
        }
      }
    }
  } catch (e) {
    await addMsg("error", "Erro de conexão com o Mestre. Tente novamente.");
    document.body.classList.remove("master-narrating");
  } finally {
    setWaiting(false);
  }
}

// ─── MODAL DE DADOS INTERATIVO COM THREE.JS 3D ────────────────────────────────
let rollResult             = null;
let pendingDiceReq         = null;
let diceValues             = [];
let dmgValues              = [];
let diceQtyTotal           = 0;
let allRolled              = false;
let activeDice3DInstances  = [];

function showDiceModal(diceReq, action) {
  const overlay = el("dice-overlay");
  const stage   = el("dice-stage");
  const confirm = el("dice-confirm");
  if (!overlay || !stage) return;

  activeDice3DInstances.forEach(inst => inst?.destroy?.());
  activeDice3DInstances = [];

  if (el("modal-label")) el("modal-label").textContent = diceReq.label || "Teste Exigido";
  if (el("modal-sub")) el("modal-sub").textContent = diceReq.pending_narration || "Role os dados para determinar o destino de sua ação.";
  if (el("dice-total")) el("dice-total").textContent = "—";
  if (el("dice-outcome")) {
    el("dice-outcome").textContent = "";
    el("dice-outcome").className = "dice-result-outcome";
  }
  if (confirm) confirm.disabled = true;

  rollResult = null;
  const qty   = Math.max(1, diceReq.quantity || 1);
  const sides = parseInt((diceReq.dice || "d20").replace("d","")) || 20;
  const cd    = diceReq.cd || 0;
  const pick  = diceReq.pick || "highest";

  diceValues   = Array(qty).fill(null);
  diceQtyTotal = qty;
  dmgValues    = [];
  allRolled    = false;
  pendingDiceReq = diceReq;

  const rollAllBtn = `<button class="roll-all-btn" id="dice-roll-all" onclick="rollAllDice(${sides},${qty},${cd},'${pick}','${esc(action)}')">✦ Rolar Todos os Dados</button>`;

  const diceHTML = Array.from({length: qty}, (_, i) =>
    `<div class="die" id="die-${i}" onclick="rollDie(${i},${sides},${qty},${cd},'${pick}','${esc(action)}')" title="Clique para rolar o dado 3D">
      <div class="die-canvas-3d" id="die-canvas-${i}"></div>
      <div class="die-val" id="die-val-${i}">d${sides}</div>
      <div class="die-type">ROLAR</div>
    </div>`
  ).join("");

  stage.innerHTML = diceHTML;

  const existingWrap = document.getElementById('dice-roll-all-wrap');
  if (existingWrap) existingWrap.remove();
  const wrap = document.createElement('div');
  wrap.id = 'dice-roll-all-wrap';
  wrap.style.cssText = 'width:100%;display:flex;justify-content:center;margin-bottom:12px;';
  wrap.innerHTML = rollAllBtn;
  stage.before(wrap);

  // Show overlay FIRST so DOM layout/dimensions are fully computed!
  overlay.style.display = "flex";
  overlay.classList.add("active", "open");

  // Instantiate 3D on every die container with slight timeout for full DOM layout stability
  const diceType = diceReq.dice || `d${sides}`;
  setTimeout(() => {
    for (let i = 0; i < qty; i++) {
      const canvasContainer = el(`die-canvas-${i}`);
      if (typeof Dice3D !== "undefined" && Dice3D.renderDie3D && canvasContainer) {
        activeDice3DInstances[i] = Dice3D.renderDie3D(canvasContainer, diceType);
      }
    }
  }, 25);
}

function rollAllDice(sides, qty, cd, pickMode, action) {
  const btn = document.getElementById('dice-roll-all');
  if (btn) btn.disabled = true;

  for (let i = 0; i < qty; i++) {
    if (diceValues[i] === null) {
      setTimeout(() => rollDie(i, sides, qty, cd, pickMode, action), i * 220);
    }
  }
}

function rollDie(idx, sides, qty, cd, pickMode, action) {
  if (diceValues[idx] !== null) return;

  const val = Math.floor(Math.random() * sides) + 1;
  const dieEl = el(`die-${idx}`);
  const valEl = el(`die-val-${idx}`);
  if (!dieEl || !valEl) return;

  dieEl.classList.add("rolling", "die-rolled");
  
  if (activeDice3DInstances[idx]?.roll) {
    activeDice3DInstances[idx].roll(1100);
  }
  if (typeof AudioManager !== "undefined") AudioManager.playSFX("dice_roll");
  else if (typeof Dice3D !== "undefined" && Dice3D.playDiceSound) Dice3D.playDiceSound();

  const delays = [35, 45, 60, 80, 110, 145, 190, 245, 310];
  let step = 0;

  function nextStep() {
    if (step < delays.length) {
      valEl.textContent = Math.floor(Math.random() * sides) + 1;
      setTimeout(nextStep, delays[step]);
      step++;
    } else {
      diceValues[idx] = val;
      valEl.textContent = val;
      dieEl.classList.remove("rolling");
      dieEl.classList.add("rolled-in");
      if (typeof Dice3D !== "undefined" && Dice3D.playDiceSettleSound) Dice3D.playDiceSettleSound();
      setTimeout(() => dieEl.classList.remove("rolled-in"), 350);

      const allRolledNow = diceValues.every(v => v !== null);
      if (allRolledNow && !allRolled) {
        allRolled = true;
        setTimeout(() => showResult(diceValues, qty, cd, pickMode, sides), 400);
      }
    }
  }
  nextStep();
}

function showResult(values, qty, cd, pickMode, sides) {
  const best    = pickMode === "lowest" ? Math.min(...values) : Math.max(...values);
  const trained = pendingDiceReq?.trained || false;
  const bonus   = trained ? 5 : 0;
  const finalTotal = best + bonus;

  const allowCrits = pendingDiceReq?.allow_crits !== false;
  const isCrit     = allowCrits && (best === sides);
  const isDisaster = allowCrits && (best === 1);
  const hasDT      = (cd > 0);
  const success    = hasDT ? (finalTotal >= cd) : true;

  if (el("dice-total")) el("dice-total").textContent = finalTotal + (bonus ? ` (+${bonus})` : "");

  let outcomeClass, outcomeText;
  if (!hasDT) {
    outcomeClass = "neutral"; outcomeText = `Resultado: ${finalTotal}`;
  } else if (isCrit) {
    outcomeClass = "critical"; outcomeText = "CRÍTICO!";
  } else if (isDisaster) {
    outcomeClass = "disaster"; outcomeText = "DESASTRE!";
  } else if (success) {
    outcomeClass = "success"; outcomeText = "SUCESSO";
  } else {
    outcomeClass = "failure"; outcomeText = "FALHA";
  }

  const outcomeEl = el("dice-outcome");
  if (outcomeEl) {
    outcomeEl.textContent = outcomeText;
    outcomeEl.className = `dice-result-outcome ${outcomeClass}`;
  }

  values.forEach((v, i) => {
    const dieEl = el(`die-${i}`);
    if (!dieEl) return;
    if (v === best && !isDisaster) dieEl.classList.add("pick-best");
    else if (v !== best)           dieEl.classList.add("pick-worst");
    if (isCrit)    dieEl.classList.add("crit-success");
    if (isDisaster) dieEl.classList.add("crit-fail");
  });

  if (isCrit) {
    triggerGoldenRain();
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("crit");
  }
  if (isDisaster) {
    triggerScreenShake();
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("disaster");
  }

  rollResult = {
    values, best, total: finalTotal, cd,
    success, isCritical: isCrit, isDisaster,
    dmg_results: dmgValues || [],
    dice: pendingDiceReq?.dice || "d20",
    attribute: pendingDiceReq?.attribute || "",
  };

  if (el("dice-confirm")) el("dice-confirm").disabled = false;
  document.getElementById('dice-roll-all-wrap')?.remove();
}

async function confirmRoll() {
  if (!rollResult) return;
  const overlay = el("dice-overlay");
  if (overlay) {
    overlay.classList.remove("active", "open");
    overlay.style.display = "none";
  }

  activeDice3DInstances.forEach(inst => inst?.destroy?.());
  activeDice3DInstances = [];

  if (pendingDiceReq?.isFreeRoll) {
    const sh = getCurrentSheet();
    const charName = sh?.name || "Agente";
    const natVal = rollResult.best;
    let badge = "";
    if (rollResult.isCritical) badge = " 🌟 CRÍTICO!";
    else if (rollResult.isDisaster) badge = " 💀 DESASTRE!";
    addMsg("action", `🎲 [${charName}] Rolou um D20 livre: <strong>${rollResult.total}</strong> (Dado natural: ${natVal})${badge}`);
    return;
  }

  const action = pendingAction || "Ação";
  const sh = getCurrentSheet();
  const prevSheet = sh ? { ...sh } : null;
  setWaiting(true);

  try {
    const r = await fetch("/api/rpg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sessionId, diceResult: rollResult })
    });
    const data = await r.json();

    if (data.contextual_suggestions && data.contextual_suggestions.length > 0) {
      currentSuggestions = data.contextual_suggestions;
    }
    if (data.scene_type) applySceneAtmosphere(data.scene_type, data.scene_title, data.scene_progress);
    if (data.bgm_mood && typeof AudioManager !== "undefined") {
      AudioManager.setMood(data.bgm_mood);
    }

    // Sempre obter a ficha mais atual — preferir a retornada pela API
    const latestSheet2 = data.sheet || (await fetchSessionSheet()) || sh;
    if (prevSheet && latestSheet2) checkAndTriggerStatCinematics(prevSheet, latestSheet2);

    if (isMultiplayer) {
      const actionRec = { playerName: sh?.name || "Agente", action, diceResult: rollResult };
      const testOutcome = rollResult.isCritical ? "CRÍTICO!" : (rollResult.isDisaster ? "DESASTRE!" : (rollResult.success ? "Sucesso" : "Falha"));
      await addMsg("system", `✦ ${sh?.name || "Agente"} obteve ${rollResult.total} (${testOutcome})`);
      if (latestSheet2) renderSheet(latestSheet2);
      await advanceTurn(false, actionRec);
    } else {
      document.body.classList.add("master-narrating");
      if (data.narration) await addMsg("narrator", data.narration);
      if (data.cinematica) playCinematic(data.cinematica);
      if (latestSheet2) renderSheet(latestSheet2);
      scrollBottom();

      if (data.victory || (data.narration && data.narration.includes("VITÓRIA DA MISSÃO"))) {
        setTimeout(() => openVictoryModal(data.narration), 2200);
      } else if (data.madness || (data.narration && data.narration.includes("INSANIDADE TOTAL"))) {
        setTimeout(() => openMadnessModal(data.narration), 2200);
      }
    }
  } catch (e) {
    await addMsg("error", "Erro ao confirmar resultado.");
    document.body.classList.remove("master-narrating");
  } finally {
    setWaiting(false);
    rollResult = null;
    pendingAction = null;
    diceValues = [];
    dmgValues = [];
    pendingDiceReq = null;
    allRolled = false;
  }
}

function openVictoryModal(text) {
  const v = el("victory-overlay");
  if (!v) return;
  if (typeof AudioManager !== "undefined") {
    AudioManager.setMood("vitoria");
    AudioManager.playSFX("crit");
  }
  if (text && el("victory-desc")) {
    el("victory-desc").textContent = text.replace(/🏆 VITÓRIA DA MISSÃO!/g, '').trim() || el("victory-desc").textContent;
  }
  v.classList.add("active");
}

function openMadnessModal(text) {
  const m = el("madness-overlay");
  if (!m) return;
  if (typeof AudioManager !== "undefined") {
    AudioManager.setMood("derrota");
    AudioManager.playSFX("disaster");
  }
  if (text && el("madness-desc")) {
    el("madness-desc").textContent = text.replace(/🌀 INSANIDADE TOTAL:/g, '').trim() || el("madness-desc").textContent;
  }
  m.classList.add("active");
}

// ─── SISTEMA DE CINEMÁTICAS DRAMÁTICAS (V9 ENHANCED) ──────────────────────────
let cinematicQueue = [];
let cinematicPlaying = false;

function checkAndTriggerStatCinematics(prev, next) {
  const pvDiff  = (next.pv_current  ?? 0) - (prev.pv_current  ?? 0);
  const peDiff  = (next.pe_current  ?? 0) - (prev.pe_current  ?? 0);
  const sanDiff = (next.san_current ?? 0) - (prev.san_current ?? 0);

  if (pvDiff < 0) {
    el("bar-pv")?.classList.add("pulse-damage");
    el("sh-pv")?.classList.add("pulse-damage");
    setTimeout(() => {
      el("bar-pv")?.classList.remove("pulse-damage");
      el("sh-pv")?.classList.remove("pulse-damage");
    }, 800);
  } else if (pvDiff > 0) {
    el("bar-pv")?.classList.add("pulse-heal");
    setTimeout(() => el("bar-pv")?.classList.remove("pulse-heal"), 800);
  }

  if (peDiff < 0) {
    el("bar-pe")?.classList.add("pulse-damage");
    el("sh-pe")?.classList.add("pulse-damage");
    setTimeout(() => {
      el("bar-pe")?.classList.remove("pulse-damage");
      el("sh-pe")?.classList.remove("pulse-damage");
    }, 800);
  }

  if (sanDiff < 0) {
    el("bar-san")?.classList.add("pulse-damage");
    el("sh-san")?.classList.add("pulse-damage");
    setTimeout(() => {
      el("bar-san")?.classList.remove("pulse-damage");
      el("sh-san")?.classList.remove("pulse-damage");
    }, 800);
  }

  if (next.pv_current !== undefined && next.pv_current <= 0) {
    playCinematic({
      tipo: 'morte',
      texto: `${next.name || 'O agente'} cai perante o inexplicável...`,
      recurso_atual: 0,
      recurso_maximo: next.pv_max || 20
    });
    triggerScreenShake();
    return;
  }

  if (pvDiff < 0) {
    playCinematic({
      tipo: 'dano_pv',
      texto: `Perda de ${Math.abs(pvDiff)} PV!`,
      stat: `${next.pv_current}/${next.pv_max}`,
      recurso_atual: next.pv_current,
      recurso_maximo: next.pv_max
    });
    triggerScreenShake();
  }

  if (sanDiff < 0) {
    playCinematic({
      tipo: 'dano_san',
      texto: `A mente vacila (-${Math.abs(sanDiff)} SAN)`,
      stat: `${next.san_current}/${next.san_max}`,
      recurso_atual: next.san_current,
      recurso_maximo: next.san_max
    });
  }

  if (peDiff < 0) {
    playCinematic({
      tipo: 'gasto_pe',
      texto: `Esforço Paranormal (-${Math.abs(peDiff)} PE)`,
      stat: `${next.pe_current}/${next.pe_max}`,
      recurso_atual: next.pe_current,
      recurso_maximo: next.pe_max
    });
  }
}

function playCinematic(cine) {
  if (!cine) return;
  cinematicQueue.push(cine);
  if (!cinematicPlaying) nextCinematic();
}

function nextCinematic() {
  if (cinematicQueue.length === 0) {
    cinematicPlaying = false;
    document.body.classList.remove("cinema-active");
    return;
  }
  cinematicPlaying = true;
  const cine = cinematicQueue.shift();

  const overlay = el("cine-overlay");
  const panel   = el("cine-panel");
  if (!overlay || !panel) {
    cinematicPlaying = false;
    return;
  }

  document.body.classList.add("cinema-active");

  overlay.className = "cine-overlay";
  if (cine.tipo) overlay.classList.add(`cine-${cine.tipo}`);

  if (el("cine-label")) el("cine-label").textContent = cine.tipo?.toUpperCase().replace("_"," ") || "CINEMÁTICA";
  if (el("cine-text"))  el("cine-text").textContent  = cine.texto || "";
  if (el("cine-stat"))  el("cine-stat").textContent  = cine.stat || "";

  const icons = { dano_pv: "✦", dano_san: "☽", gasto_pe: "✧", morte: "☠", matar: "⚔" };
  if (el("cine-icon")) el("cine-icon").textContent = icons[cine.tipo] || "⸸";

  const barWrap = el("cine-bar-wrap");
  const bar     = el("cine-bar");
  if (cine.recurso_maximo > 0 && barWrap && bar) {
    barWrap.style.display = "";
    const pct = Math.max(0, Math.round((cine.recurso_atual / cine.recurso_maximo) * 100));
    const colors = { dano_pv: "#e04040", dano_san: "#8b5cf6", gasto_pe: "#38bdf8", matar: "#eab308" };
    bar.style.width = "0%";
    setTimeout(() => {
      bar.style.width = pct + "%";
      bar.style.background = colors[cine.tipo] || "#c9a84c";
    }, 50);
  } else if (barWrap) {
    barWrap.style.display = "none";
  }

  overlay.classList.remove("cine-exit");
  overlay.classList.add("cine-visible");

  setTimeout(() => {
    overlay.classList.add("cine-exit");
    setTimeout(() => {
      overlay.className = "cine-overlay";
      nextCinematic();
    }, 450);
  }, 2800);
}

// ─── MENSAGENS NO CHAT ────────────────────────────────────────────────────────
function addMsg(type, text, extra) {
  return new Promise((resolve) => {
    const chat = el("chat");
    if (!chat) { resolve(null); return; }
    const div = document.createElement("div");

    if (type === "narrator") {
      div.className = `msg msg-narrator${extra ? " " + extra : ""}`;
      if (extra && (extra.includes("history") || extra === "resume")) {
        div.innerHTML = formatNarratorText(text);
        chat.appendChild(div);
        scrollBottom();
        resolve(div);
      } else {
        chat.appendChild(div);
        scrollBottom();
        typewriterEffect(div, text, 14).then(() => resolve(div));
      }
    } else {
      if (type === "player") {
        div.className = "msg msg-player";
        div.innerHTML = `<span class="player-prompt">❯</span> <span>${esc(text)}</span>`;
      } else if (type === "system") {
        div.className = "msg msg-system";
        div.textContent = text;
      } else if (type === "error") {
        div.className = "msg msg-error";
        div.textContent = text;
      }
      chat.appendChild(div);
      scrollBottom();
      resolve(div);
    }
  });
}

function typewriterEffect(element, text, speed = 14) {
  return new Promise((resolve) => {
    element.textContent = "";
    let i = 0;
    let finished = false;
    const cursor = document.createElement("span");
    cursor.className = "typewriter-cursor";
    cursor.textContent = "█";
    element.appendChild(cursor);

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      element.removeEventListener("click", finish);
      cursor.remove();
      element.innerHTML = formatNarratorText(text);
      scrollBottom();

      // Delay dramático estratégico antes de deslizar os menus de volta
      setTimeout(() => {
        const isDiceOpen = el("dice-overlay")?.classList.contains("active");
        if (!isDiceOpen) {
          document.body.classList.remove("master-narrating");
        }
      }, 750);

      resolve();
    }

    element.style.cursor = "pointer";
    element.title = "Clique para exibir o texto completo imediatamente";
    element.addEventListener("click", finish);

    const interval = setInterval(() => {
      if (i < text.length && !finished) {
        element.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        const chat = el("chat");
        if (chat && i % 4 === 0) chat.scrollTop = chat.scrollHeight;
      } else {
        finish();
      }
    }, speed);
  });
}

function triggerScreenShake() {
  document.body.classList.add("screen-shake");
  setTimeout(() => document.body.classList.remove("screen-shake"), 600);
}

function triggerGoldenRain() {
  const overlay = el("dice-overlay") || document.body;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.className = "golden-particle";
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 60}%;
      animation-delay: ${Math.random() * .4}s;
      font-size: ${14 + Math.random() * 18}px;
    `;
    p.textContent = ["✦","★","◆","⬡","✧","⸸"][Math.floor(Math.random() * 6)];
    overlay.appendChild(p);
    setTimeout(() => p.remove(), 1800);
  }
}

// ─── SUSSURROS PARANORMAIS ────────────────────────────────────────────────────
const WHISPERS = [
  "...você ouviu isso?...",
  "...não confie nas sombras...",
  "...o ritual não foi encerrado...",
  "...os mortos sussurram seu nome...",
  "...você não devia estar aqui...",
  "...algo observa das frestas...",
  "...é tarde demais para voltar...",
];
let whisperInterval = null;

function startParanormalWhispers() {
  if (whisperInterval) return;
  whisperInterval = setInterval(() => {
    const chat = el("chat");
    if (!chat) return;
    const w = document.createElement("div");
    w.className = "paranormal-whisper";
    w.textContent = WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
    w.style.cssText = `left: ${10 + Math.random() * 65}%; top: ${20 + Math.random() * 60}%;`;
    chat.appendChild(w);
    setTimeout(() => w.remove(), 4000);
  }, 16000);
}

function setupCardTilt() {
  document.querySelectorAll(".magic-card").forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = -((y - cy) / cy) * 14;
      const rotY = ((x - cx) / cx) * 14;
      const px = Math.round((x / rect.width) * 100);
      const py = Math.round((y / rect.height) * 100);

      card.style.setProperty("--mx", px + "%");
      card.style.setProperty("--my", py + "%");
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-10px) scale(1.05)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
      card.style.removeProperty("--mx");
      card.style.removeProperty("--my");
    });
  });
}

function initVisualEffects() {
  setupCardTilt();
  startParanormalWhispers();
}

// ─── UPLOAD & LIGHTBOX DE IMAGEM ──────────────────────────────────────────────
function handleChatImageUpload(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const sheet = getCurrentSheet();
    const name = sheet?.name || "Agente";
    addChatImageMsg(dataUrl, name, "player");
    event.target.value = "";
  };
  reader.readAsDataURL(file);
}

function addChatImageMsg(src, senderName, role) {
  const box = el("chat");
  if (!box) return;

  const msgEl = document.createElement("div");
  msgEl.className = `msg msg-${role} msg-image-wrap`;
  msgEl.innerHTML = `
    <div class="chat-image-msg">
      <img class="chat-image-preview" src="${esc(src)}" alt="Imagem enviada" onclick="openLightbox('${esc(src)}')" loading="lazy">
      <div class="chat-image-caption">📷 ${esc(senderName)}</div>
    </div>`;
  box.appendChild(msgEl);
  scrollBottom();
}

function openLightbox(src) {
  const overlay = el("img-lightbox");
  const img = el("img-lightbox-img");
  if (!overlay || !img) return;
  img.src = src;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const overlay = el("img-lightbox");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
    closeFullSheet();
    closeMenu("attack-menu");
    closeMenu("action-menu");
    closeMenu("item-menu");
    closeMenu("target-menu");
    closeMapModal();
    closeMinigameKeys();
  }
});


function renderHistory(history) {
  const chat = el("chat");
  if (!chat || !history || !history.length) return;

  history.forEach(h => {
    if (h.player && h.player !== "[INÍCIO DA SESSÃO]") {
      const p = document.createElement("div");
      p.className = "msg msg-player";
      p.innerHTML = `<span class="player-prompt">❯</span> <span>${esc(h.player)}</span>`;
      chat.appendChild(p);
    }
    if (h.ai) {
      const a = document.createElement("div");
      a.className = "msg msg-narrator msg-history";
      a.innerHTML = formatNarratorText(h.ai);
      chat.appendChild(a);
    }
  });
}

function setWaiting(v) {
  isWaiting = v;
  const cards = ["card-attack","card-action","card-item","card-skip"];
  cards.forEach(id => {
    const el_ = el(id);
    if (el_) {
      el_.style.opacity = v ? ".5" : "1";
      el_.style.pointerEvents = v ? "none" : "auto";
    }
  });
}

function getCurrentSheet() {
  if (isMultiplayer && initiativeOrder.length > 0) {
    const cur = initiativeOrder[currentTurnIdx];
    if (cur?.tipo === "jogador") {
      // Preferir ficha viva de allCharacters em vez do snapshot de iniciativa
      if (cur.player_index !== undefined && allCharacters[cur.player_index]) {
        return allCharacters[cur.player_index];
      }
      return cur.sheet || currentSheet;
    }
    return currentSheet;
  }
  return currentSheet;
}

function toggleSheet() {
  const panel = el("sheet-panel");
  const toggle = el("sheet-toggle-btn");
  if (!panel) return;
  const isCollapsed = panel.classList.toggle("collapsed");
  if (toggle) toggle.textContent = isCollapsed ? "▶" : "◀";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MOTOR DE MAPA TÁTICO INTERATIVO (PAN, ZOOM, GRAFO & LOCALIZAÇÃO) ─────────
// ═══════════════════════════════════════════════════════════════════════════════
let mapScale = 1;
let mapPanX = 0;
let mapPanY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let mapInitialized = false;

function getFallbackMap() {
  return [
    {
      id: "loc_recepcao",
      nome: "Recepção & Triagem",
      tipo_comodo: "hall_amplo",
      formato: "retangulo",
      pos_x: 220, pos_y: 60, width: 240, height: 140,
      descricao: "Balcão de atendimento revirado, computadores chiando e macas perto da entrada.",
      conexoes: ["loc_corredor_central", "loc_estacionamento"],
      portas: [
        { alvo_id: "loc_corredor_central", direcao: "sul", trancada: false },
        { alvo_id: "loc_estacionamento", direcao: "oeste", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_balcao", nome: "Balcão & Computadores", icone: "💻", cd: 12, atributo: "intelecto", sucesso: "Prontuários com lista de transferências para o subsolo.", falha: "Monitores estalando com interferência." },
        { id: "pi_gaveta", nome: "Gaveteiro da Triagem", icone: "🗄️", cd: 10, atributo: "intelecto", sucesso: "Chave de bronze da Farmácia Central.", falha: "Apenas papéis rasgados." }
      ],
      gatilho: "investigacao",
      trancado: false,
      inicial: true
    },
    {
      id: "loc_estacionamento",
      nome: "Pátio & Ambulatório",
      tipo_comodo: "area_externa",
      formato: "retangulo",
      pos_x: 30, pos_y: 60, width: 180, height: 140,
      descricao: "Ambulâncias abandonadas com luzes piscando e poças escuras no asfalto.",
      conexoes: ["loc_recepcao", "loc_guarita"],
      portas: [
        { alvo_id: "loc_recepcao", direcao: "leste", trancada: false },
        { alvo_id: "loc_guarita", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_ambulancia", nome: "Ambulância nº 03", icone: "🚑", cd: 11, atributo: "intelecto", sucesso: "Kit de Primeiros Socorros (+PV) e lanterna tática UV.", falha: "Portas traseiras travadas por impacto." }
      ],
      gatilho: "investigacao",
      trancado: false
    },
    {
      id: "loc_guarita",
      nome: "Guarita de Acesso",
      tipo_comodo: "quarto_pequeno",
      formato: "quadrado",
      pos_x: 30, pos_y: 210, width: 180, height: 120,
      descricao: "Cabine blindada com vidros trincados e painel de controle dos portões.",
      conexoes: ["loc_estacionamento", "loc_corredor_central"],
      portas: [
        { alvo_id: "loc_estacionamento", direcao: "norte", trancada: false },
        { alvo_id: "loc_corredor_central", direcao: "leste", trancada: true }
      ],
      pontos_investigacao: [
        { id: "pi_painel_seguranca", nome: "Painel de Câmeras", icone: "📹", cd: 13, atributo: "intelecto", sucesso: "Gravação mostrando vultos arrastando corpos para a UTI.", falha: "Sinal estático." }
      ],
      gatilho: "investigacao",
      trancado: false
    },
    {
      id: "loc_corredor_central",
      nome: "Corredor Central de Enfermarias",
      tipo_comodo: "corredor_largo",
      formato: "retangulo",
      pos_x: 220, pos_y: 210, width: 360, height: 80,
      descricao: "Corredor extenso com portas entreabertas. Luzes fluorescentes piscam emitindo zumbido.",
      conexoes: ["loc_recepcao", "loc_guarita", "loc_enfermaria_oeste", "loc_farmacia", "loc_uti"],
      portas: [
        { alvo_id: "loc_recepcao", direcao: "norte", trancada: false },
        { alvo_id: "loc_guarita", direcao: "oeste", trancada: true },
        { alvo_id: "loc_enfermaria_oeste", direcao: "sul", trancada: false },
        { alvo_id: "loc_farmacia", direcao: "leste", trancada: true },
        { alvo_id: "loc_uti", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_parede_simbolos", nome: "Inscrições na Parede", icone: "🩸", cd: 14, atributo: "intelecto", sucesso: "Símbolos arcanos que revelam a fraqueza elemental da Entidade.", falha: "Piche escorrendo que queima os dedos." }
      ],
      gatilho: "investigacao",
      trancado: false
    },
    {
      id: "loc_farmacia",
      nome: "Farmácia & Sedativos",
      tipo_comodo: "sala_media",
      formato: "quadrado",
      pos_x: 590, pos_y: 210, width: 170, height: 130,
      descricao: "Frascos de vidro quebrados e substâncias que evaporam em névoa arroxeada.",
      conexoes: ["loc_corredor_central", "loc_escadaria_subsolo"],
      portas: [
        { alvo_id: "loc_corredor_central", direcao: "oeste", trancada: true },
        { alvo_id: "loc_escadaria_subsolo", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_armario_remedios", nome: "Armário de Narcóticos", icone: "💊", cd: 12, atributo: "intelecto", sucesso: "Elixir Estabilizador (+SAN) e sedativo concentrado.", falha: "Frascos quebrados com líquido contaminado." }
      ],
      gatilho: "investigacao",
      trancado: true,
      minigame: "chaves"
    },
    {
      id: "loc_enfermaria_oeste",
      nome: "Enfermaria de Isolamento",
      tipo_comodo: "quarto_pequeno",
      formato: "retangulo",
      pos_x: 220, pos_y: 300, width: 175, height: 130,
      descricao: "Leitos vazios cobertos por lençóis encardidos. Manchas escuras nas janelas vedadas.",
      conexoes: ["loc_corredor_central", "loc_ala_psiquiatrica"],
      portas: [
        { alvo_id: "loc_corredor_central", direcao: "norte", trancada: false },
        { alvo_id: "loc_ala_psiquiatrica", direcao: "sul", trancada: true }
      ],
      pontos_investigacao: [
        { id: "pi_diario_paciente", nome: "Diário Sob a Cama", icone: "📖", cd: 11, atributo: "intelecto", sucesso: "Páginas detalhando os cânticos ouvidos durante a madrugada.", falha: "Anotações ilegíveis cobertas de bolor." }
      ],
      gatilho: "combate_comum",
      trancado: false
    },
    {
      id: "loc_uti",
      nome: "Centro de Terapia Intensiva (UTI)",
      tipo_comodo: "sala_media",
      formato: "retangulo",
      pos_x: 405, pos_y: 300, width: 175, height: 130,
      descricao: "Monitores cardíacos apitando em falso. Respiradores automáticos funcionam sozinhos.",
      conexoes: ["loc_corredor_central", "loc_necroterio"],
      portas: [
        { alvo_id: "loc_corredor_central", direcao: "norte", trancada: false },
        { alvo_id: "loc_necroterio", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_monitor_uti", nome: "Terminal da UTI", icone: "🫀", cd: 13, atributo: "intelecto", sucesso: "Fórmulas de infusão com sangue paranormal conectadas aos cilindros.", falha: "Queda brusca de tensão queima os circuitos." }
      ],
      gatilho: "combate_comum",
      trancado: false
    },
    {
      id: "loc_ala_psiquiatrica",
      nome: "Ala Psiquiátrica Trancada",
      tipo_comodo: "quarto_pequeno",
      formato: "quadrado",
      pos_x: 220, pos_y: 440, width: 175, height: 140,
      descricao: "Porta de ferro maciço reforçada com três travas. Paredes acolchoadas em código.",
      conexoes: ["loc_enfermaria_oeste", "loc_laboratorio_secreto"],
      portas: [
        { alvo_id: "loc_enfermaria_oeste", direcao: "norte", trancada: true },
        { alvo_id: "loc_laboratorio_secreto", direcao: "leste", trancada: true }
      ],
      pontos_investigacao: [
        { id: "pi_celda_08", nome: "Inscrições na Cela 08", icone: "🗝️", cd: 12, atributo: "intelecto", sucesso: "Chave Mestra do Subsolo oculta no forro acolchoado.", falha: "Paredes rasgadas sem nenhum objeto útil." }
      ],
      gatilho: "perseguicao",
      trancado: true,
      minigame: "chaves"
    },
    {
      id: "loc_necroterio",
      nome: "Necrotério & Frigorífico",
      tipo_comodo: "sala_media",
      formato: "retangulo",
      pos_x: 405, pos_y: 440, width: 175, height: 140,
      descricao: "Frio congelante que condensa a respiração. Gavetas de aço entreabertas.",
      conexoes: ["loc_uti", "loc_laboratorio_secreto"],
      portas: [
        { alvo_id: "loc_uti", direcao: "norte", trancada: false },
        { alvo_id: "loc_laboratorio_secreto", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_gaveta_legista", nome: "Mesa de Autópsia", icone: "🧊", cd: 13, atributo: "intelecto", sucesso: "Talismã de proteção contra o Outro Lado retirado de um corpo.", falha: "Instrumentos cirúrgicos enferrujados inutilizáveis." }
      ],
      gatilho: "combate_importante",
      trancado: false
    },
    {
      id: "loc_escadaria_subsolo",
      nome: "Escadaria de Acesso ao Subsolo",
      tipo_comodo: "corredor_vertical",
      formato: "retangulo",
      pos_x: 590, pos_y: 350, width: 170, height: 230,
      descricao: "Degraus de concreto úmido descendo para a escuridão. O ar fica quente e sulfuroso.",
      conexoes: ["loc_farmacia", "loc_laboratorio_secreto"],
      portas: [
        { alvo_id: "loc_farmacia", direcao: "norte", trancada: false },
        { alvo_id: "loc_laboratorio_secreto", direcao: "oeste", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_corrimao_escada", nome: "Caixa de Chaves do Corrimão", icone: "🔦", cd: 10, atributo: "intelecto", sucesso: "Chave da Câmara do Altar e bateria reserva.", falha: "Teias grossas e degraus escorregadios." }
      ],
      gatilho: "perseguicao",
      trancado: false
    },
    {
      id: "loc_laboratorio_secreto",
      nome: "Laboratório Secreto de Consciência",
      tipo_comodo: "sala_ampla",
      formato: "retangulo",
      pos_x: 220, pos_y: 590, width: 360, height: 160,
      descricao: "Equipamentos cirúrgicos acoplados a cilindros com fluido escuro pulsante.",
      conexoes: ["loc_ala_psiquiatrica", "loc_necroterio", "loc_escadaria_subsolo", "loc_camara_ritual"],
      portas: [
        { alvo_id: "loc_ala_psiquiatrica", direcao: "norte", trancada: true },
        { alvo_id: "loc_necroterio", direcao: "norte", trancada: false },
        { alvo_id: "loc_escadaria_subsolo", direcao: "leste", trancada: false },
        { alvo_id: "loc_camara_ritual", direcao: "sul", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_computador_central", nome: "Terminal Principal", icone: "🧬", cd: 14, atributo: "intelecto", sucesso: "Fórmula exata para quebrar a imunidade da Entidade Suprema.", falha: "Sobrecarga elétrica estala nos teclados." }
      ],
      gatilho: "combate_importante",
      trancado: true,
      minigame: "chaves"
    },
    {
      id: "loc_camara_ritual",
      nome: "Câmara do Ritual Abissal",
      tipo_comodo: "santuario_boss",
      formato: "hexagonal",
      pos_x: 220, pos_y: 760, width: 360, height: 190,
      descricao: "O epicentro da quebra da membrana. Vórtice sobrenatural sobre um altar colossal.",
      conexoes: ["loc_laboratorio_secreto"],
      portas: [
        { alvo_id: "loc_laboratorio_secreto", direcao: "norte", trancada: false }
      ],
      pontos_investigacao: [
        { id: "pi_altar_selamento", nome: "O Altar do Outro Lado", icone: "⸸", cd: 15, atributo: "intelecto", sucesso: "Ponto de ancoragem para o ritual de banimento final.", falha: "Pulso de choque que repele os agentes." }
      ],
      gatilho: "boss_climax",
      trancado: false
    }
  ];
}

function openMapModal() {
  const overlay = el("map-overlay");
  if (!overlay) return;
  overlay.classList.add("active");
  overlay.style.display = "flex";

  const rawMap = introDataGlobal?.world_data?.mapa_locais;
  const isValidMap = rawMap && Array.isArray(rawMap) && rawMap.length >= 8 && !rawMap.some(r => r.id === "loc_1" || r.id === "loc_2");
  const mapData = isValidMap ? rawMap : getFallbackMap();

  if (!introDataGlobal) introDataGlobal = {};
  if (!introDataGlobal.world_data) introDataGlobal.world_data = {};
  introDataGlobal.world_data.mapa_locais = mapData;
  try { localStorage.setItem("sessionIntro", JSON.stringify(introDataGlobal)); } catch(e) {}

  renderTacticalMap(mapData);
  initMapInteractions();
}

function closeMapModal() {
  const overlay = el("map-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.display = "none";
  }
}

function closeMapModalIfOutside(e) {
  if (e.target === el("map-overlay")) closeMapModal();
}

function rollFreeD20() {
  if (isWaiting) return;
  const sh = getCurrentSheet();
  const charName = sh?.name || "Agente";

  const freeReq = {
    label: "ROLAGEM LIVRE DE D20",
    pending_narration: `Teste livre de D20 para ${charName}.`,
    dice: "d20",
    quantity: 1,
    cd: 0,
    pick: "highest",
    allow_crits: true,
    isFreeRoll: true
  };
  pendingAction = `[Rolagem Livre de D20]`;
  showDiceModal(freeReq, pendingAction);
}

function renderTacticalMap(rooms) {
  const world = el("map-canvas-world");
  const nodesContainer = el("map-nodes-container");
  const svgLinks = el("map-links-svg");
  if (!world || !nodesContainer || !svgLinks) return;

  nodesContainer.innerHTML = "";
  svgLinks.innerHTML = "";

  const sh = getCurrentSheet();

  // Localiza estritamente 1 ÚNICA sala atual para o jogador ativo
  let activeRoom = null;
  if (sh?.current_location_id) {
    activeRoom = rooms.find(r => r.id === sh.current_location_id);
  }
  if (!activeRoom && sh?.current_location) {
    activeRoom = rooms.find(r => r.nome.toLowerCase() === sh.current_location.toLowerCase());
  }
  if (!activeRoom) {
    activeRoom = rooms.find(r => r.inicial) || rooms[0];
  }
  const activeRoomId = activeRoom ? activeRoom.id : rooms[0]?.id;

  const roomMap = {};
  rooms.forEach((room, idx) => {
    const x = room.pos_x !== undefined ? room.pos_x : 80 + (idx % 3) * 250;
    const y = room.pos_y !== undefined ? room.pos_y : 60 + Math.floor(idx / 3) * 170;
    const w = room.width || 180;
    const h = room.height || 120;
    roomMap[room.id] = { x, y, w, h, room };
  });

  // 1. Linhas de Conexão SVG
  const drawnEdges = new Set();
  let linksHtml = "";

  rooms.forEach(room => {
    const fromPos = roomMap[room.id];
    if (!fromPos) return;

    (room.conexoes || []).forEach(targetId => {
      const toPos = roomMap[targetId];
      if (!toPos) return;

      const edgeKey = [room.id, targetId].sort().join("<->");
      if (drawnEdges.has(edgeKey)) return;
      drawnEdges.add(edgeKey);

      const fromCenterX = fromPos.x + fromPos.w / 2;
      const fromCenterY = fromPos.y + fromPos.h / 2;
      const toCenterX = toPos.x + toPos.w / 2;
      const toCenterY = toPos.y + toPos.h / 2;

      const isCurrentRoute = (room.id === activeRoomId) || (toPos.room.id === activeRoomId);
      linksHtml += `<line class="map-corridor-line${isCurrentRoute ? ' active' : ''}" x1="${fromCenterX}" y1="${fromCenterY}" x2="${toCenterX}" y2="${toCenterY}" />`;
    });
  });
  svgLinks.innerHTML = linksHtml;

  const agentColors = ["#22c55e", "#38bdf8", "#c084fc", "#eab308", "#f43f5e"];

  // 2. Renderiza as Salas Contíguas (Planta Baixa Sem Spoilers e Sem Duplicações)
  rooms.forEach(room => {
    const pos = roomMap[room.id];
    if (!pos) return;

    const isCurrent = (room.id === activeRoomId);
    const isLocked = room.trancado;

    // Agentes presentes nesta sala (cada agente em rigorosamente 1 sala)
    const agentsHere = allCharacters.filter(c => {
      const targetRoomId = c.current_location_id || (rooms.find(r => r.nome.toLowerCase() === (c.current_location || "").toLowerCase())?.id) || rooms.find(r => r.inicial)?.id || rooms[0]?.id;
      return targetRoomId === room.id;
    });

    const nodeEl = document.createElement("div");
    nodeEl.className = `map-node format-${room.formato || 'retangulo'}${isCurrent ? ' is-current' : ''}${isLocked ? ' is-locked' : ''}`;
    nodeEl.style.left = `${pos.x}px`;
    nodeEl.style.top = `${pos.y}px`;
    nodeEl.style.width = `${pos.w}px`;
    nodeEl.style.height = `${pos.h}px`;
    nodeEl.style.transform = "none";

    // Pontos de investigação dentro da sala
    const pointsHtml = (room.pontos_investigacao || []).map(pi =>
      `<span class="map-point-chip" title="${esc(pi.nome)}">${pi.icone || '🔍'} ${esc(pi.nome)}</span>`
    ).join("");

    // Portas visíveis
    const doorsHtml = (room.portas || []).map(p =>
      `<span class="map-door-tag door-${p.direcao || 'sul'}">${p.trancada ? '🔒' : '🚪'}</span>`
    ).join("");

    // Chips dos agentes
    const agentsHtml = agentsHere.map((ag, idx) => {
      const firstName = (ag.name || "Agente").split(" ")[0];
      const color = agentColors[idx % agentColors.length];
      return `<div class="map-agent-chip" style="border-color:${color};box-shadow:0 0 6px ${color}">
        <span class="map-agent-dot" style="background:${color}"></span>
        <span>${esc(firstName)}</span>
      </div>`;
    }).join("");

    nodeEl.innerHTML = `
      <div class="map-node-header">
        <span class="map-node-title">${esc(room.nome)}</span>
        ${isCurrent ? '<span class="map-current-badge">📍 VOCÊ</span>' : ''}
      </div>
      ${pointsHtml ? `<div class="map-node-points">${pointsHtml}</div>` : ''}
      ${agentsHtml ? `<div class="map-node-agents">${agentsHtml}</div>` : ''}
      ${doorsHtml ? `<div class="map-doors-container">${doorsHtml}</div>` : ''}
    `;

    nodesContainer.appendChild(nodeEl);
  });

  centerOnCurrentRoom(roomMap, activeRoomId);
}

function centerOnCurrentRoom(roomMap, activeRoomId) {
  const currentRoomEntry = roomMap[activeRoomId] || Object.values(roomMap)[0];
  if (!currentRoomEntry) return;

  const viewport = el("map-viewport");
  if (!viewport) return;

  const vw = viewport.clientWidth || 800;
  const vh = viewport.clientHeight || 500;

  const centerX = currentRoomEntry.x + (currentRoomEntry.w / 2);
  const centerY = currentRoomEntry.y + (currentRoomEntry.h / 2);

  mapPanX = (vw / 2) - (centerX * mapScale);
  mapPanY = (vh / 2) - (centerY * mapScale);
  applyMapTransform();
}


function onMapNodeClick(room, isCurrent) {
  if (isCurrent) {
    addMsg("system", `✦ Você já está em: ${room.nome}.`);
    return;
  }

  const sh = getCurrentSheet();
  const mapData = introDataGlobal?.world_data?.mapa_locais || [];
  const currentRoom = mapData.find(r => r.nome === sh?.current_location || r.id === sh?.current_location_id);

  const isConnected = !currentRoom || (currentRoom.conexoes || []).includes(room.id);

  if (!isConnected) {
    addMsg("system", `⚠️ Caminho inacessível diretamente: Você não pode ir direto para "${room.nome}". Avance pelas salas conectadas adjacentes primeiro.`);
    return;
  }

  if (room.trancado && room.minigame === "chaves") {
    closeMapModal();
    openMinigameKeys(room);
    return;
  }

  closeMapModal();
  if (typeof AudioManager !== "undefined") AudioManager.playSFX("turn_change");
  enviarAction(`Mover e explorar: ${room.nome}`);
}

function initMapInteractions() {
  if (mapInitialized) return;
  const viewport = el("map-viewport");
  if (!viewport) return;
  mapInitialized = true;

  viewport.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX - mapPanX;
    panStartY = e.clientY - mapPanY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    mapPanX = e.clientX - panStartX;
    mapPanY = e.clientY - panStartY;
    applyMapTransform();
  });

  window.addEventListener("mouseup", () => {
    isPanning = false;
  });

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    zoomMap(zoomFactor);
  }, { passive: false });
}

function zoomMap(delta) {
  mapScale = Math.min(2.5, Math.max(0.5, mapScale + delta));
  applyMapTransform();
}

function resetMapPosition() {
  mapScale = 1;
  const mapData = introDataGlobal?.world_data?.mapa_locais || getFallbackMap();
  renderTacticalMap(mapData);
}

function applyMapTransform() {
  const world = el("map-canvas-world");
  if (world) {
    world.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapScale})`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MINIGAME INTERATIVO: O BOLO DE CHAVES (LOCK & KEY PUZZLE) ─────────────────
// ═══════════════════════════════════════════════════════════════════════════════
let minigameState = {
  activeRoom: null,
  correctKeyIndex: null,
  attemptsRemaining: 3,
  keys: []
};

function openMinigameKeys(room) {
  const overlay = el("minigame-keys-overlay");
  const grid = el("keys-selection-grid");
  const lockVisual = el("lock-visual");
  const attemptsEl = el("minigame-attempts-count");
  const feedback = el("minigame-feedback");
  if (!overlay || !grid) return;

  const totalKeys = 8;
  const correctIdx = Math.floor(Math.random() * totalKeys);

  minigameState = {
    activeRoom: room,
    correctKeyIndex: correctIdx,
    attemptsRemaining: 3,
    keys: Array.from({ length: totalKeys }, (_, i) => ({
      id: i,
      label: `Chave #${i + 1}`,
      icon: ["🗝", "🔑", "🗝", "🗝", "🔑", "🗝", "🗝", "🔑"][i],
      isBroken: false
    }))
  };

  if (lockVisual) {
    lockVisual.textContent = "🔒";
    lockVisual.className = "lock-visual";
  }
  if (attemptsEl) attemptsEl.textContent = "3";
  if (feedback) {
    feedback.textContent = `Selecione uma chave para tentar destrancar: ${room.nome}`;
    feedback.style.color = "var(--text)";
  }

  renderMinigameKeysGrid();

  overlay.classList.add("active");
  overlay.style.display = "flex";
}

function renderMinigameKeysGrid() {
  const grid = el("keys-selection-grid");
  if (!grid) return;

  grid.innerHTML = minigameState.keys.map((k, i) =>
    `<button class="key-item-btn${k.isBroken ? ' broken' : ''}" id="key-btn-${i}" onclick="chooseKey(${i})" ${k.isBroken || minigameState.attemptsRemaining <= 0 ? 'disabled' : ''}>
      <span class="key-item-icon">${k.icon}</span>
      <span class="key-item-label">${k.label}</span>
    </button>`
  ).join("");
}

function chooseKey(idx) {
  if (minigameState.attemptsRemaining <= 0) return;
  const key = minigameState.keys[idx];
  if (!key || key.isBroken) return;

  const lockVisual = el("lock-visual");
  const feedback = el("minigame-feedback");
  const attemptsEl = el("minigame-attempts-count");

  if (idx === minigameState.correctKeyIndex) {
    // Acertou a chave!
    if (typeof AudioManager !== "undefined") AudioManager.playSFX("crit");
    if (lockVisual) {
      lockVisual.textContent = "🔓";
      lockVisual.classList.add("unlocked");
    }
    if (feedback) {
      feedback.textContent = `✦ SUCESSO! A chave #${idx + 1} girou com precisão e destrancou o acesso a ${minigameState.activeRoom.nome}!`;
      feedback.style.color = "var(--green3)";
    }

    if (minigameState.activeRoom) {
      minigameState.activeRoom.trancado = false;
    }

    setTimeout(() => {
      closeMinigameKeys();
      enviarAction(`Destrancar e adentrar: ${minigameState.activeRoom.nome}`);
    }, 1600);
  } else {
    // Chave errada: quebra a chave e gasta tentativa
    key.isBroken = true;
    minigameState.attemptsRemaining--;

    if (typeof AudioManager !== "undefined") AudioManager.playSFX("damage_pv");
    if (lockVisual) {
      lockVisual.classList.remove("shake");
      void lockVisual.offsetWidth;
      lockVisual.classList.add("shake");
    }
    if (attemptsEl) attemptsEl.textContent = minigameState.attemptsRemaining;

    renderMinigameKeysGrid();

    if (minigameState.attemptsRemaining <= 0) {
      if (typeof AudioManager !== "undefined") AudioManager.playSFX("disaster");
      if (feedback) {
        feedback.textContent = `❌ CADEADO EMPERRADO: Todas as tentativas falharam e as chaves quebraram. É necessário outro agente ou um teste de Força/Arrombamento!`;
        feedback.style.color = "var(--red3)";
      }
      setTimeout(() => {
        closeMinigameKeys();
        enviarAction(`Falha ao destrancar o cadeado em ${minigameState.activeRoom?.nome}. A fechadura emperrou!`);
      }, 2000);
    } else {
      if (feedback) {
        feedback.textContent = `⚡ A chave #${idx + 1} entortou e quebrou no tambor! Restam ${minigameState.attemptsRemaining} tentativa(s).`;
        feedback.style.color = "var(--orange2)";
      }
    }
  }
}

function closeMinigameKeys() {
  const overlay = el("minigame-keys-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.display = "none";
  }
}

