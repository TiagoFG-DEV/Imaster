const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const sessionsRoot       = path.join(__dirname, "..", "sessions");
const activeSessionsFile = path.join(sessionsRoot, "activeSessions.json");

function safeRead(p) { try { return JSON.parse(fs.readFileSync(p,"utf8")); } catch { return null; } }

function ensureDir() {
  if (!fs.existsSync(sessionsRoot)) fs.mkdirSync(sessionsRoot, { recursive:true });
  if (!fs.existsSync(activeSessionsFile))
    fs.writeFileSync(activeSessionsFile, JSON.stringify({active:null,sessions:[]}));
}

// ─── Stats CORRETOS de Ordem Paranormal Oficial ───────────────────────────────
// Atributos COMEÇAM em 0, recebem +4 pontos distribuídos (sistema oficial do livro)
// Fórmula dados: 1 + valor_atributo (atrib 0 = 1d20, atrib 2 = 3d20)
// PV = base + Vigor  |  PE = base + Presença  |  SAN = fixo da classe em NEX 5%
const CLASS_BASES = {
  combatente:   { pv: 20, pe: 2,  san: 12 },
  especialista: { pv: 16, pe: 3,  san: 16 },
  ocultista:    { pv: 12, pe: 4,  san: 20 },
  comum:        { pv: 12, pe: 2,  san: 16 },
};

// Atributos padrão com base 0 (conforme regras oficiais do livro)
const DEFAULT_ATTRS = { agilidade:0, forca:0, intelecto:0, presenca:0, vigor:0 };

function calcStats(className, attrs) {
  const key  = (className || "especialista").toLowerCase();
  const base = CLASS_BASES[key] || CLASS_BASES.especialista;
  const vig  = attrs?.vigor    ?? 1;
  const pre  = attrs?.presenca ?? 1;
  return {
    pv:  base.pv  + vig,
    pe:  base.pe  + pre,
    san: base.san   // SAN é fixo em NEX 5%
  };
}

function createSession(characterData, themeData) {
  ensureDir();
  let id, folder;
  do { id = "session_" + crypto.randomBytes(8).toString("hex"); folder = path.join(sessionsRoot, id); }
  while (fs.existsSync(folder));
  fs.mkdirSync(folder, { recursive:true });

  // Atributos: se não fornecidos, começa com base 1 em tudo (regra oficial)
  const attrs = characterData.attributes || { ...DEFAULT_ATTRS };
  const stats = calcStats(characterData.class || "Especialista", attrs);

  const avatarUrl = characterData.avatar_url || characterData.avatar || null;

  const state = {
    sessionId:  id,
    createdAt:  new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    history:    [],
    master_internal_flags: {
      session_started:   false,
      character_created: false,
      world_created:     false,
      story_created:     false,
      validated:         false,
    },
    last_dice:     null,
    session_title: characterData.name ? `Agente ${characterData.name}` : "Nova Sessão",
    theme_data:    themeData || { masterDecides: true, themes: [] },
    tematica_escolhida: null,
    world_data:    null,
    game_mode:     null,   // preenchido pelo engine após criação
    character_sheet: {
      name:       characterData.name || "",
      class:      characterData.class || "Especialista",
      age:        characterData.age || characterData.idade || 28,
      gender:     characterData.gender || characterData.genero || "Masculino",
      origin:     characterData.origin || characterData.origem || "Policial",
      appearance: characterData.appearance || characterData.aparencia || "",
      history:    characterData.history || characterData.historico || "",
      avatar_url: avatarUrl,
      nex:        "5%",
      attributes: attrs,
      skills:     characterData.skills    || [],
      abilities:  characterData.abilities || [],
      pv_max:     stats.pv,  pv_current:  stats.pv,
      pe_max:     stats.pe,  pe_current:  stats.pe,
      san_max:    stats.san, san_current: stats.san,
      identity:   null,
      inventory:  characterData.inventory || [],
      status_effects: [], current_location: ""
    }
  };

  fs.writeFileSync(path.join(folder,"state.json"), JSON.stringify(state,null,2));

  let idx = safeRead(activeSessionsFile) || {active:null,sessions:[]};
  if (!Array.isArray(idx.sessions)) idx.sessions = [];
  if (!idx.sessions.includes(id)) idx.sessions.push(id);
  idx.active = id;
  fs.writeFileSync(activeSessionsFile, JSON.stringify(idx,null,2));
  console.log("[Session] Criada:", id);
  return id;
}

function getActiveSession() { ensureDir(); return (safeRead(activeSessionsFile)||{}).active || null; }

function setActiveSession(id) {
  ensureDir();
  let idx = safeRead(activeSessionsFile) || {active:null,sessions:[]};
  if (!Array.isArray(idx.sessions)) idx.sessions = [];
  if (!idx.sessions.includes(id)) idx.sessions.push(id);
  idx.active = id;
  fs.writeFileSync(activeSessionsFile, JSON.stringify(idx,null,2));
}

function loadSession(id) {
  const f = path.join(sessionsRoot, id, "state.json");
  if (!fs.existsSync(f)) throw new Error("Sessão não encontrada: " + id);
  const s = safeRead(f);
  if (!s) throw new Error("state.json corrompido");
  if (!s.history)         s.history = [];
  if (!s.character_sheet) s.character_sheet = {
    name:"—", class:"Especialista", avatar_url:null, nex:"5%",
    attributes:{ ...DEFAULT_ATTRS },
    skills:[], abilities:[],
    pv_max:19, pv_current:19, pe_max:4, pe_current:4, san_max:16, san_current:16,
    identity:null, inventory:[], status_effects:[], current_location:""
  };
  if (!s.master_internal_flags) s.master_internal_flags = {
    session_started:false, character_created:false, world_created:false,
    story_created:false, validated:false
  };
  if (s.last_dice === undefined) s.last_dice = null;
  return s;
}

function saveSession(id, state) {
  state.lastUpdate = new Date().toISOString();
  fs.writeFileSync(path.join(sessionsRoot, id, "state.json"), JSON.stringify(state,null,2));
}

function listSessions() {
  ensureDir();
  const idx = safeRead(activeSessionsFile) || { sessions:[] };
  const list = [];
  for (const sid of (idx.sessions || [])) {
    const sf = path.join(sessionsRoot, sid, "state.json");
    if (!fs.existsSync(sf)) continue;
    const s = safeRead(sf);
    if (!s) continue;
    const sh = s.character_sheet || {};
    const lastEntries = (s.history||[]).filter(h=>h.ai).slice(-2);
    const summary = lastEntries.length
      ? lastEntries[lastEntries.length-1].ai.slice(0,150) + "..."
      : "História não iniciada.";
    const gm        = s.game_mode || { tipo:"individual" };
    const isMulti    = gm.tipo === "multiplayer_local" || gm.tipo === "custom" || gm.tipo === "multiplayer";
    const allChars   = Array.isArray(s.all_characters) && s.all_characters.length > 0
      ? s.all_characters
      : (Array.isArray(gm.personagens) && gm.personagens.length > 0 ? gm.personagens : [sh]);
    const playerCount = isMulti ? allChars.length : 1;
    const charList = (allChars || []).filter(Boolean).map(c => ({
      name: c?.name || "Agente",
      class: c?.class || "Especialista",
      avatar_url: c?.avatar_url || c?.avatar || null
    }));

    list.push({
      sessionId:   sid,
      title:       s.session_title || `Sessão ${sid.slice(-6)}`,
      character:   sh.name || "—",
      class:       sh.class || "—",
      avatar:      sh.avatar_url || (charList[0]?.avatar_url) || null,
      characters:  charList,
      nex:         sh.nex || "5%",
      mode:        gm.tipo || "individual",
      playerCount,
      pv_current:  sh.pv_current ?? "?",
      pv_max:      sh.pv_max ?? "?",
      san_current: sh.san_current ?? "?",
      san_max:     sh.san_max ?? "?",
      location:    sh.current_location || "desconhecido",
      status:      (sh.pv_current !== undefined && sh.pv_current <= 0) ? "morto" : "vivo",
      lastUpdate:  s.lastUpdate || s.createdAt || "",
      summary,
      turnCount:   (s.history||[]).filter(h=>h.player && h.ai).length
    });
  }
  return list.reverse();
}

function deleteSession(id) {
  ensureDir();
  const folder = path.join(sessionsRoot, id);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  let idx = safeRead(activeSessionsFile) || { active: null, sessions: [] };
  idx.sessions = (idx.sessions || []).filter(s => s !== id);
  if (idx.active === id) idx.active = idx.sessions[0] || null;
  fs.writeFileSync(activeSessionsFile, JSON.stringify(idx, null, 2));
  console.log("[Session] Excluída com sucesso:", id);
  return true;
}

module.exports = { createSession, getActiveSession, setActiveSession, loadSession, saveSession, listSessions, deleteSession, calcStats, CLASS_BASES, DEFAULT_ATTRS };
