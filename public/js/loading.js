// loading.js v3 — Suporta Individual, Multiplayer Local e Custom

const STEPS = [
  { id:"identity",   label:"Identidade do Agente",   detail:"Criando nome, aparência e origem" },
  { id:"attributes", label:"Atributos & Stats",       detail:"Calculando PV, PE, SAN" },
  { id:"skills",     label:"Perícias & Habilidades",  detail:"Atribuindo poderes de NEX 5%" },
  { id:"validate1",  label:"Verificação da Ficha",    detail:"Mestre confere coerência" },
  { id:"world",      label:"Mundo & Cenário",         detail:"Gerando mapa e locais" },
  { id:"story",      label:"História & Trama",        detail:"Construindo eventos e NPCs" },
  { id:"validate2",  label:"Verificação 1/4",         detail:"Stats corretos?" },
  { id:"validate3",  label:"Verificação 2/4",         detail:"História coerente?" },
  { id:"validate4",  label:"Verificação 3/4",         detail:"NPCs definidos?" },
  { id:"validate5",  label:"Verificação 4/4",         detail:"Tudo pronto?" },
  { id:"opening",    label:"Cena de Abertura",        detail:"Escrevendo narração inicial" },
];

function renderChecklist() {
  const el = document.getElementById("checklist");
  if (!el) return;
  el.innerHTML = STEPS.map(s => `
    <div class="check-item" id="step-${s.id}">
      <div class="check-icon" id="icon-${s.id}">○</div>
      <div class="check-text">
        <div class="check-label">${s.label}</div>
        <div class="check-detail" id="detail-${s.id}">${s.detail}</div>
      </div>
    </div>`).join('');
}

function setStep(id, status, detail) {
  const item = document.getElementById(`step-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  const det  = document.getElementById(`detail-${id}`);
  if (!item) return;
  item.className = `check-item ${status}`;
  icon.textContent = status==="done"?"✓":status==="warn"?"!":status==="error"?"✕":"⟳";
  if (detail) det.textContent = detail;
}

function setProgress(pct) {
  const fill = document.getElementById("progress-fill");
  const lbl  = document.getElementById("progress-pct");
  if (fill) fill.style.width = Math.min(100, pct) + "%";
  if (lbl)  lbl.textContent  = Math.min(100, pct) + "%";
}

function addValidationPass(label, ok) {
  const wrap = document.getElementById("validation-wrap");
  const cont = document.getElementById("validation-passes");
  if (!wrap || !cont) return;
  wrap.style.display = "block";
  const el = document.createElement("div");
  el.className = `v-pass ${ok ? 'ok' : 'fail'}`;
  el.textContent = (ok ? "✓ " : "! ") + label;
  cont.appendChild(el);
}

function showError(msg) {
  const el  = document.getElementById("loading-error");
  const btn = document.getElementById("retry-btn");
  if (el) { el.textContent = msg; el.classList.add("visible"); }
  if (btn) btn.style.display = "inline-flex";
}

function updateSubtitle(text) {
  const el = document.querySelector(".loading-subtitle");
  if (el) el.textContent = text;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function genKey()  { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function run() {
  renderChecklist();

  const charRaw   = sessionStorage.getItem("pendingCharacter");
  const themeRaw  = sessionStorage.getItem("themeChoice");
  const gameModeRaw = sessionStorage.getItem("gameMode");

  if (!charRaw) { showError("Dados do personagem não encontrados. Volte e tente novamente."); return; }

  const pendingChar = JSON.parse(charRaw);
  const themeData   = themeRaw ? JSON.parse(themeRaw) : { masterDecides:true, themes:[] };
  const gameMode    = gameModeRaw ? JSON.parse(gameModeRaw) : { tipo:"individual" };
  const sseKey      = genKey();

  // Adapta subtitle para o modo
  const isMulti = pendingChar.multi === true || (gameMode.tipo !== "individual");
  if (isMulti) {
    const count = (pendingChar.personagens || gameMode.personagens || []).length;
    updateSubtitle(`O Mestre prepara uma história para ${count} agente${count>1?"s":""} — aguarde enquanto tudo é gerado.`);
  }

  // ─── SSE ──────────────────────────────────────────────────────────────────
  let sseOk = false, sse;
  try {
    sse = new EventSource(`/api/prepare-progress/${sseKey}`);
    sse.addEventListener("step",     e => { const d=JSON.parse(e.data); setStep(d.id, d.status, d.detail); sseOk=true; });
    sse.addEventListener("progress", e => { const d=JSON.parse(e.data); setProgress(d.pct); });
    sse.addEventListener("check",    e => { const d=JSON.parse(e.data); addValidationPass(d.label, d.ok); });
    sse.addEventListener("done",     () => sse.close());
    sse.onerror = () => console.warn("[Loading] SSE desconectado");
  } catch(e) { console.warn("[Loading] SSE não disponível:", e); }

  await delay(300);
  if (!sseOk) {
    setStep("identity","active"); setStep("attributes","active");
    setStep("skills","active"); setProgress(10);
    await delay(400);
    setStep("world","active"); setStep("story","active"); setProgress(20);
  }

  // ─── Monta payload ────────────────────────────────────────────────────────
  let character;
  if (pendingChar.multi) {
    // Multiplayer: passa todos os personagens + gameMode
    character = {
      multi:       true,
      personagens: pendingChar.personagens,
      gameMode:    pendingChar.gameMode || gameMode
    };
  } else {
    // Individual
    character = pendingChar;
  }

  // ─── POST ──────────────────────────────────────────────────────────────────
  let data;
  try {
    const res = await fetch("/api/prepare-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character, themeData, gameMode, sseKey })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    data = await res.json();
  } catch (err) {
    if (sse) sse.close();
    STEPS.forEach(s => setStep(s.id, "error", "Falha na conexão"));
    showError(err.message);
    return;
  }

  if (sse) sse.close();

  // ─── Fallback visual se SSE não conectou ─────────────────────────────────
  if (!sseOk) {
    const sheet = data.sheet || {};
    const v     = data.validations || {};
    setStep("identity",   "done", `${sheet.name||"—"} — criado`);
    setStep("attributes", "done", `PV ${sheet.pv_max} · PE ${sheet.pe_max} · SAN ${sheet.san_max}`);
    setStep("skills",     "done", `${(sheet.skills||[]).length} perícias`);
    setStep("validate1",  v.ficha_completa  ? "done":"warn", "Ficha validada");
    setStep("world",      "done", "Cenário gerado");
    setStep("story",      "done", "História criada");
    setStep("validate2",  v.stats_coerentes ? "done":"warn", "Stats");
    setStep("validate3",  v.historia_ok     ? "done":"warn", "História");
    setStep("validate4",  v.npcs_ok         ? "done":"warn", "NPCs");
    setStep("validate5",  v.pronto          ? "done":"warn", "Pronto");
    setStep("opening",    "done", "Abertura escrita");
    [
      { label:"Ficha completa", ok:v.ficha_completa  },
      { label:"Stats corretos", ok:v.stats_coerentes },
      { label:"História ok",    ok:v.historia_ok     },
      { label:"NPCs ok",        ok:v.npcs_ok         },
    ].forEach(c => addValidationPass(c.label, c.ok !== false));
    setProgress(100);
  }

  await delay(500);

  // ─── Salva e redireciona ──────────────────────────────────────────────────
  localStorage.setItem("sessionId",    data.sessionId);
  localStorage.setItem("sessionIntro", JSON.stringify({
    narration:        data.narration,
    sheet:            data.sheet,
    all_characters:   data.all_characters   || null,
    game_mode:        data.game_mode        || null,
    initiative_order: data.initiative_order || null,
    visual_background: data.visual_background || null,
    last_dice:        data.last_dice,
    dice_request:     data.dice_request,
    history:          data.history          || []
  }));

  // Limpa sessionStorage de criação
  sessionStorage.removeItem("pendingCharacter");
  sessionStorage.removeItem("themeChoice");
  sessionStorage.removeItem("mp_queue");
  sessionStorage.removeItem("mp_queue_idx");
  sessionStorage.removeItem("mp_total");
  sessionStorage.removeItem("mp_created");
  // NÃO remove gameMode — pode ser útil para retomada

  await delay(400);
  window.location = "chat.html";
}

document.addEventListener("DOMContentLoaded", run);
