// engine/gameEngine.js — v5 SEM IA (100% Local)
// Toda geração é feita pelo narrativeEngine.js + bancos de dados JSON.
// Sem chamadas a Groq, OpenAI, Ollama ou qualquer API externa.

const {
  prepareSessionLocal,
  resumeSessionLocal,
  processPlayerAction,
  generateCharacterSheet,
  generateInitiativeOrder,
} = require("./narrativeEngine");

const { loadSession, saveSession, calcStats } = require("./sessionManager");

const HISTORY_LIMIT = 40;
const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v ?? mn));

// ─── CLASS_BASES exportado (compatibilidade com routes.js) ─────────────────────
const CLASS_BASES = {
  Combatente:   { pe: 2 },
  Especialista: { pe: 2 },
  Ocultista:    { pe: 3 },
  Comum:        { pe: 2 },
};

// ─── Aplica atualizações de estado ───────────────────────────────────────────
function applyUpdates(session, updates, diceResult) {
  if (!updates) return;
  const sh = session.character_sheet;

  if (updates.pv_current != null) sh.pv_current = clamp(updates.pv_current, 0, sh.pv_max);
  if (updates.pe_current != null) sh.pe_current = clamp(updates.pe_current, 0, sh.pe_max);
  if (updates.san_current != null) sh.san_current = clamp(updates.san_current, 0, sh.san_max);
  if (updates.location)  sh.current_location = updates.location;
  if (updates.nex)       sh.nex = updates.nex;

  if (Array.isArray(updates.inventory_add))
    updates.inventory_add.forEach(i => { if (!sh.inventory.includes(i)) sh.inventory.push(i); });
  if (Array.isArray(updates.inventory_remove))
    sh.inventory = sh.inventory.filter(i => !updates.inventory_remove.includes(i));
  if (Array.isArray(updates.status_add))
    updates.status_add.forEach(s => { if (!sh.status_effects.includes(s)) sh.status_effects.push(s); });
  if (Array.isArray(updates.status_remove))
    sh.status_effects = sh.status_effects.filter(s => !updates.status_remove.includes(s));

  if (diceResult) session.last_dice = diceResult;
  if (sh.pv_current <= 0) session.ended = true;
}

// ─── Push de histórico ────────────────────────────────────────────────────────
function pushHistory(session, entry) {
  session.history.push(entry);
  if (session.history.length > HISTORY_LIMIT)
    session.history.splice(0, session.history.length - HISTORY_LIMIT);
}

// ─── Corrige stats matematicamente ───────────────────────────────────────────
function hardCorrectStats(sh) {
  if (!sh) return sh;
  const correct = calcStats(sh.class, sh.attributes || {});
  sh.pv_max = correct.pv;
  sh.pv_current = sh.pv_current == null ? correct.pv : clamp(sh.pv_current, 0, correct.pv);
  sh.pe_max = Math.max(correct.pe, 2);
  sh.pe_current = sh.pe_current == null ? sh.pe_max : clamp(sh.pe_current, 0, sh.pe_max);
  sh.san_max = correct.san;
  sh.san_current = sh.san_current == null ? correct.san : clamp(sh.san_current, 0, correct.san);
  sh.nex = sh.nex || "5%";
  if (!sh.identity) sh.identity = {};
  const id = sh.identity;
  if (!id.sexo) id.sexo = "Masculino";
  if (!id.idade) id.idade = 28;
  if (!id.altura) id.altura = "1,75m";
  if (!id.peso) id.peso = "70kg";
  if (!id.aparencia) id.aparencia = "Agente de aparência comum e olhar determinado.";
  if (!id.origem) id.origem = "Agente recrutado pela Ordem após encontrar o inexplicável.";
  if (!id.personalidade) id.personalidade = "Determinado e cauteloso, age com lógica mesmo sob pressão.";
  if (!sh.skills) sh.skills = [];
  if (!sh.abilities) sh.abilities = [];
  if (!sh.inventory) sh.inventory = [];
  if (!sh.status_effects) sh.status_effects = [];
  sh.abilities = sh.abilities.map(a =>
    typeof a === "string" ? { nome: a, descricao: "(consulte o manual)" } : a
  );
  return sh;
}

// ─── Valida ficha ─────────────────────────────────────────────────────────────
function validateSheet(sh) {
  const errors = [];
  if (!sh) { errors.push("Ficha nula"); return errors; }
  if (!sh.name || sh.name.length < 2) errors.push("Nome ausente");
  if (!sh.skills || sh.skills.length < 3) errors.push(`Poucas perícias: ${(sh.skills || []).length}`);
  if (!sh.abilities || sh.abilities.length < 1) errors.push("Sem habilidades");
  if (!sh.pv_max || sh.pv_max < 1) errors.push("PV inválido");
  return errors;
}

// ─── PRÉ-GERAÇÃO COMPLETA (100% Local) ───────────────────────────────────────
async function prepareSession(sessionId, emit, gameMode, characterData) {
  return prepareSessionLocal(sessionId, emit, gameMode, characterData);
}

// ─── Retomada ─────────────────────────────────────────────────────────────────
async function resumeSession(sessionId) {
  const session = loadSession(sessionId);

  if (!session.history || session.history.length === 0) {
    return {
      narration: "Esta sessão não possui histórico. Inicie uma nova sessão.",
      dice_request: null,
      sheet: session.character_sheet,
      all_characters: session.all_characters || null,
      last_dice: session.last_dice,
      history: []
    };
  }

  const resumed = resumeSessionLocal(session);

  return {
    narration: resumed.narration,
    dice_request: null,
    sheet: session.character_sheet,
    all_characters: session.all_characters || null,
    game_mode: session.game_mode || null,
    initiative_order: session.initiative_order || null,
    current_turn_index: session.current_turn_index || 0,
    visual_background: session.visual_background || null,
    last_dice: session.last_dice,
    history: (session.history || []).filter(h => h.player && h.ai).map(h => ({
      player: h.player,
      ai: h.ai,
      time: h.time
    }))
  };
}

// ─── Ação do jogador (100% Local) ────────────────────────────────────────────
async function playerAction(action, sessionId, diceResult) {
  if (!sessionId) throw new Error("Sem sessão ativa");
  const session = loadSession(sessionId);

  if (session.ended) {
    return {
      narration: "A história chegou ao fim. Inicie uma nova sessão para continuar sua jornada.",
      dice_request: null,
      sheet: session.character_sheet,
      all_characters: session.all_characters || null,
      last_dice: session.last_dice
    };
  }

  session.master_internal_flags.session_started = true;

  // Processamento com IA Min+
  const result = await processPlayerAction(action, session, diceResult);

  applyUpdates(session, result.state_updates || {}, diceResult);

  // Atualiza turn em multiplayer
  if (session.initiative_order?.length > 1) {
    session.current_turn_index = ((session.current_turn_index || 0) + 1) % session.initiative_order.length;
  }
  session.turn_count = (session.turn_count || 0) + 1;

  pushHistory(session, { player: action, ai: result.narration, time: new Date().toISOString() });

  if (Array.isArray(result.new_events)) {
    result.new_events.forEach(ev => pushHistory(session, { system_event: ev, time: new Date().toISOString() }));
  }

  // Salva sugestões na sessão
  if (result.contextual_suggestions) {
    session.contextual_suggestions = result.contextual_suggestions;
  }

  saveSession(sessionId, session);

  return {
    narration:       result.narration || "O Mestre observa em silêncio.",
    cinematica:      result.cinematica || null,
    dice_request:    result.dice_request || null,
    contextual_suggestions: session.contextual_suggestions || [],
    sheet:           session.character_sheet,
    all_characters:  session.all_characters || null,
    game_mode:       session.game_mode || null,
    initiative_order: session.initiative_order || null,
    current_turn_index: session.current_turn_index || 0,
    last_dice:       session.last_dice
  };
}

// ─── Sugestões — agora locais, sem IA ────────────────────────────────────────
// Retorna 4 sugestões de ação baseadas no estado atual da sessão
async function getSuggestions(sessionId) {
  try {
    const session = loadSession(sessionId);
    if (!session.master_internal_flags?.session_started) return [];

    const story   = session.world_data;
    const ato     = story?.ato_atual || 1;
    const atoData = story?.[`ato${ato}`];
    const cenas   = atoData?.cenas || [];
    const climax  = story?.climax_ativado || false;

    // Sugestões baseadas no estado da história
    const baseSuggestions = [
      { texto: "Investigar o local", tipo: "investigacao_observacao", icon: "🔍", requer_teste: true, atributo: "intelecto" },
      { texto: "Falar com o NPC mais próximo", tipo: "social_interpretacao", icon: "💬", requer_teste: false, atributo: null },
      { texto: "Examinar objetos suspeitos", tipo: "investigacao_observacao", icon: "👁", requer_teste: true, atributo: "percepção" },
      { texto: "Procurar saída alternativa", tipo: "criativo_livre", icon: "🚪", requer_teste: true, atributo: "agilidade" },
      { texto: "Aguardar e observar", tipo: "livre", icon: "⏳", requer_teste: false, atributo: null },
      { texto: "Usar uma habilidade especial", tipo: "criativo_livre", icon: "✨", requer_teste: true, atributo: "presenca" },
    ];

    const combatSuggestions = [
      { texto: "Atacar a entidade", tipo: "combate_tensao", icon: "⚔", requer_teste: true, atributo: "forca" },
      { texto: "Tentar banir com ritual", tipo: "combate_tensao", icon: "🔮", requer_teste: true, atributo: "ocultismo" },
      { texto: "Criar distância e atirar", tipo: "combate_tensao", icon: "🎯", requer_teste: true, atributo: "agilidade" },
      { texto: "Proteger um aliado", tipo: "social_interpretacao", icon: "🛡", requer_teste: true, atributo: "vigor" },
    ];

    const suggestions = climax ? combatSuggestions : baseSuggestions;
    return suggestions.slice(0, 4);
  } catch (e) {
    console.warn("[Engine] getSuggestions:", e.message);
    return [];
  }
}

module.exports = {
  prepareSession,
  resumeSession,
  playerAction,
  getSuggestions,
  hardCorrectStats,
  validateSheet,
  CLASS_BASES,
};