const express = require("express");
const path    = require("path");
const fs      = require("fs");
const { createSession, getActiveSession, loadSession, listSessions, setActiveSession, deleteSession } = require("./engine/sessionManager");
const { prepareSession, playerAction, resumeSession, getSuggestions } = require("./engine/gameEngine");

const router = express.Router();

// ─── SSE: progresso em tempo real da preparação ──────────────────────────────
const sseClients = new Map();

router.get("/prepare-progress/:key", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  const key = req.params.key;
  sseClients.set(key, res);
  req.on("close", () => sseClients.delete(key));
});

function sseEmit(key, event, data) {
  const res = sseClients.get(key);
  if (!res) return;
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

// ─── Preparar sessão completa ────────────────────────────────────────────────
router.post("/prepare-session", async (req, res) => {
  try {
    const { character, themeData, gameMode, sseKey } = req.body;
    if (!character) return res.status(400).json({ error: "Dados do personagem ausentes" });

    // Para multiplayer, o character.gameMode ou o gameMode do body define o modo
    const effectiveGameMode = gameMode || character.gameMode || { tipo: "individual" };

    // Criação da sessão — usa o primeiro personagem como base
    const baseChar = character.multi
      ? (character.personagens?.[0] || { name: "", class: "Especialista", auto: true, attributes: {} })
      : character;

    const sessionId = createSession(baseChar, themeData || { masterDecides: true, themes: [] });
    const emit = sseKey ? (ev, d) => sseEmit(sseKey, ev, d) : () => {};
    const result = await prepareSession(sessionId, emit, effectiveGameMode, character);
    res.json({ sessionId, ...result });
  } catch (err) {
    console.error("[Route] prepare-session:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Criar nova sessão (compatibilidade) ────────────────────────────────────
router.post("/new-session", async (req, res) => {
  try {
    const charData  = req.body.character || {};
    const themeData = req.body.themeData  || { masterDecides: true, themes: [] };
    const gameModeData = req.body.gameMode || { tipo: "individual" };
    const sessionId = createSession(charData, themeData);
    const intro     = await prepareSession(sessionId, () => {}, gameModeData, charData);
    res.json({ sessionId, ...intro });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Continuar sessão ativa ──────────────────────────────────────────────────
router.get("/continue-session", (req, res) => {
  try { res.json({ sessionId: getActiveSession() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Listar sessões salvas ───────────────────────────────────────────────────
router.get("/sessions", (req, res) => {
  try { res.json(listSessions()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Carregar sessão + gerar resumo via IA ───────────────────────────────────
router.post("/load-session", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId ausente" });
    setActiveSession(sessionId);
    const result = await resumeSession(sessionId);
    res.json({ sessionId, ...result });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Estado completo da sessão ───────────────────────────────────────────────
router.get("/session-state/:sessionId", (req, res) => {
  try {
    const session = loadSession(req.params.sessionId);
    const history = (session.history || [])
      .filter(h => h.player && h.ai)
      .map(h => ({ player: h.player, ai: h.ai, time: h.time }));
    res.json({
      sheet:             session.character_sheet,
      all_characters:    session.all_characters    || null,
      game_mode:         session.game_mode         || null,
      initiative_order:  session.initiative_order  || null,
      current_turn_index: session.current_turn_index || 0,
      visual_background: session.visual_background || null,
      last_dice:         session.last_dice,
      history
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Ação do jogador ─────────────────────────────────────────────────────────
router.post("/rpg", async (req, res) => {
  try {
    const { action, sessionId, diceResult, is_round_narration, round_actions } = req.body;
    if (!action)    return res.status(400).json({ error: "Ação vazia" });
    if (!sessionId) return res.status(400).json({ error: "SessionId ausente" });

    // Narração coletiva de round: envia contexto completo de todos os jogadores
    if (is_round_narration && round_actions?.length > 0) {
      const roundSummary = round_actions.map(a =>
        `${a.playerName}: ${a.action}${a.diceResult ? ` (resultado: ${a.diceResult.total}, ${a.diceResult.success ? 'sucesso' : 'falha'})` : ''}`
      ).join("\n");

      const roundAction = `[NARRAR ROUND]\nOs jogadores jogaram este round:\n${roundSummary}\n\nNarre o que aconteceu com cada um, como suas ações se entrelaçaram na cena. Seja cinematográfico, conciso (2-4 parágrafos) e integre tudo numa narrativa única.`;

      const result = await playerAction(roundAction, sessionId, null);
      return res.json(result);
    }

    const result = await playerAction(action, sessionId, diceResult || null);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});


// ─── Sugestões contextuais de ação (100% local) ─────────────────────────────
router.post("/suggestions", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.json({ suggestions: [] });
    const suggestions = await getSuggestions(sessionId);
    res.json({ suggestions });
  } catch { res.json({ suggestions: [] }); }
});

// ─── Ações predefinidas para cartas mágicas ──────────────────────────────────
router.get("/actions", (req, res) => {
  res.json({
    exploracao: [
      { texto: "Explorar a área", icon: "🗺", atributo: "intelecto" },
      { texto: "Investigar objeto suspeito", icon: "🔍", atributo: "intelecto" },
      { texto: "Observar a cena", icon: "👁", atributo: "intelecto" },
      { texto: "Procurar pistas", icon: "🕵", atributo: "intelecto" },
      { texto: "Vasculhar o ambiente", icon: "📦", atributo: "intelecto" },
      { texto: "Identificar símbolo/ritual", icon: "🔮", atributo: "ocultismo" },
      { texto: "Fotografar evidências", icon: "📷", atributo: "intelecto" },
      { texto: "Mapear o local", icon: "📍", atributo: "intelecto" }
    ],
    social: [
      { texto: "Falar com o NPC", icon: "💬", atributo: "presenca" },
      { texto: "Ser amigável", icon: "🤝", atributo: "presenca" },
      { texto: "Intimidar", icon: "😠", atributo: "presenca" },
      { texto: "Persuadir", icon: "🗣", atributo: "presenca" },
      { texto: "Enganar", icon: "🎭", atributo: "presenca" },
      { texto: "Confiar no NPC", icon: "❤", atributo: "presenca" },
      { texto: "Ir contra a decisão", icon: "✋", atributo: "presenca" },
      { texto: "Dissertar sobre o caso", icon: "📋", atributo: "intelecto" },
      { texto: "Repudiar a situação", icon: "🚫", atributo: "presenca" }
    ],
    movimento: [
      { texto: "Correr", icon: "💨", atributo: "agilidade" },
      { texto: "Esconder-se", icon: "🌑", atributo: "agilidade" },
      { texto: "Acrobacia", icon: "🤸", atributo: "agilidade" },
      { texto: "Escalar", icon: "🧗", atributo: "agilidade" },
      { texto: "Arrombar porta", icon: "🚪", atributo: "forca" },
      { texto: "Recuar", icon: "⬅", atributo: "agilidade" },
      { texto: "Auxiliar aliado", icon: "🛡", atributo: "presenca" },
      { texto: "Primeiros socorros", icon: "🩺", atributo: "intelecto" },
      { texto: "Ritual/Rezar", icon: "🕯", atributo: "ocultismo" }
    ]
  });
});

// ─── ABILITIES exposto ao frontend ───────────────────────────────────────────
router.get("/abilities", (req, res) => {
  try {
    const abPath = path.join(__dirname, "library_of_rules", "ABILITIES.json");
    const data = JSON.parse(fs.readFileSync(abPath, "utf8"));
    const slim = {};
    for (const [cls, val] of Object.entries(data)) {
      if (cls.startsWith("_")) continue;
      slim[cls.toLowerCase()] = (val.poderes_de_classe || []).map(p => ({
        nome:      p.nome,
        custo:     p.custo,
        acao:      p.acao,
        descricao: p.descricao
      }));
    }
    res.json(slim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Deletar sessão ──────────────────────────────────────────────────────────
router.delete("/session/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    deleteSession(sessionId);
    res.json({ ok: true });
  } catch (err) { 
    console.error("[Session] Erro ao excluir:", err);
    res.status(500).json({ error: err.message }); 
  }
});

router.delete("/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    deleteSession(sessionId);
    res.json({ ok: true });
  } catch (err) { 
    console.error("[Session] Erro ao excluir:", err);
    res.status(500).json({ error: err.message }); 
  }
});

module.exports = router;
