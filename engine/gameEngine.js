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

function parseNEX(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 5;
}

// ─── Aplica atualizações de estado ───────────────────────────────────────────
function applyUpdates(session, updates, diceResult) {
  if (!updates) return;
  const sh = session.character_sheet;
  if (!sh) return;

  if (updates.pv_current != null) sh.pv_current = clamp(updates.pv_current, 0, sh.pv_max);
  if (updates.pe_current != null) sh.pe_current = clamp(updates.pe_current, 0, sh.pe_max);
  if (updates.san_current != null) sh.san_current = clamp(updates.san_current, 0, sh.san_max);
  if (updates.location)  sh.current_location = updates.location;

  // ─── Gerenciamento de NEX (Nível de Exposição Paranormal) ───────────────────
  const curNex = parseNEX(sh.nex || "5%");
  if (updates.nex_increase != null && typeof updates.nex_increase === "number" && updates.nex_increase > 0) {
    const newNex = clamp(curNex + updates.nex_increase, 5, 99);
    sh.nex = `${newNex}%`;
    session.last_nex_increase = { from: curNex, to: newNex, delta: updates.nex_increase };
  } else if (updates.nex) {
    const parsed = parseNEX(updates.nex);
    sh.nex = `${clamp(parsed, 5, 99)}%`;
  }

  if (Array.isArray(updates.inventory_add)) {
    updates.inventory_add.forEach(i => {
      const name = typeof i === 'string' ? i : i.nome;
      if (!sh.inventory.some(it => (typeof it === 'string' ? it : it.nome) === name)) {
        sh.inventory.push(i);
      }
    });
  }
  if (Array.isArray(updates.inventory_remove)) {
    sh.inventory = sh.inventory.filter(i => !updates.inventory_remove.includes(typeof i === 'string' ? i : i.nome));
  }
  if (!Array.isArray(sh.status_effects)) sh.status_effects = [];
  if (Array.isArray(updates.status_add)) {
    updates.status_add.forEach(s => { if (!sh.status_effects.includes(s)) sh.status_effects.push(s); });
  }
  if (Array.isArray(updates.status_remove)) {
    sh.status_effects = sh.status_effects.filter(s => !updates.status_remove.includes(s));
  }

  // ─── 1. Gerenciamento do Estado MORRENDO (PV == 0, 3 Rounds de Contagem) ───
  if (sh.pv_current <= 0) {
    sh.pv_current = 0;
    sh.dying_rounds = (sh.dying_rounds || 0) + 1;
    sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Morrendo"));
    sh.status_effects.push(`Morrendo (Rodada ${sh.dying_rounds}/3)`);

    if (sh.dying_rounds > 3) {
      session.ended = true;
      session.dead = true;
      sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Morrendo"));
      if (!sh.status_effects.includes("Morto")) sh.status_effects.push("Morto");
    }
  } else {
    sh.dying_rounds = 0;
    sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Morrendo") && s !== "Morto");
    if (sh.pv_current <= Math.floor(sh.pv_max * 0.4)) {
      if (!sh.status_effects.includes("Ferido Gravemente")) sh.status_effects.push("Ferido Gravemente");
    } else {
      sh.status_effects = sh.status_effects.filter(s => s !== "Ferido Gravemente");
    }
  }

  // ─── 2. Gerenciamento do COLAPSO MENTAL (SAN == 0, 3 Rounds de Crise) ───────
  if (sh.san_current <= 0) {
    sh.san_current = 0;
    sh.madness_rounds = (sh.madness_rounds || 0) + 1;
    sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Colapso Mental"));
    sh.status_effects.push(`Colapso Mental (Rodada ${sh.madness_rounds}/3)`);

    if (sh.madness_rounds > 3) {
      session.ended = true;
      session.madness = true;
      sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Colapso Mental"));
      if (!sh.status_effects.includes("Enlouquecido")) sh.status_effects.push("Enlouquecido");
    }
  } else {
    sh.madness_rounds = 0;
    sh.status_effects = sh.status_effects.filter(s => !s.startsWith("Colapso Mental") && s !== "Enlouquecido");
    if (sh.san_current <= Math.floor(sh.san_max * 0.4)) {
      if (!sh.status_effects.includes("Abalado")) sh.status_effects.push("Abalado");
    } else {
      sh.status_effects = sh.status_effects.filter(s => s !== "Abalado");
    }
  }

  // ─── 3. Gerenciamento de EXAUSTÃO (PE == 0, Desvantagem) ───────────────────
  if (sh.pe_current <= 0) {
    sh.pe_current = 0;
    if (!sh.status_effects.includes("Exausto")) sh.status_effects.push("Exausto");
  } else {
    sh.status_effects = sh.status_effects.filter(s => s !== "Exausto");
  }

  if (diceResult) session.last_dice = diceResult;

  // Sincroniza o personagem ativo no array multiplayer se houver
  if (Array.isArray(session.all_characters) && session.all_characters.length > 0) {
    const idx = session.all_characters.findIndex(c => c.name === sh.name);
    if (idx >= 0) {
      session.all_characters[idx] = JSON.parse(JSON.stringify(sh));
    }
  }
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
    world_data: session.world_data || null,
    last_dice: session.last_dice,

    history: (session.history || []).filter(h => h.player && h.ai).map(h => ({
      player: h.player,
      ai: h.ai,
      time: h.time
    }))
  };
}

// ─── Ação do jogador (100% Local com Rastreamento Independente & Mundo Vivo) ─
async function playerAction(action, sessionId, diceResult, playerIndex) {
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
  if (!session.world_data) session.world_data = {};
  if (!Array.isArray(session.world_data.pontos_explorados)) session.world_data.pontos_explorados = [];
  if (!Array.isArray(session.all_characters) || session.all_characters.length === 0) {
    session.all_characters = [session.character_sheet];
  }

  const actingIdx = (playerIndex !== undefined && playerIndex !== null) ? playerIndex : (session.current_player_index || 0);
  const activeChar = session.all_characters[actingIdx] || session.character_sheet;
  session.character_sheet = activeChar;

  // 1. Processa Movimentação do Agente e Validação Lógica de Chaves
  let targetRoomObj = null;
  let keyUnlockNarration = "";
  let immediateAmbushNarration = "";

function matchesKey(itemName, requiredKey) {
  if (!itemName || !requiredKey) return false;
  const n1 = itemName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ");
  const n2 = requiredKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ");
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const words2 = n2.split(/\s+/).filter(w => w.length >= 4);
  return words2.length > 0 && words2.every(w => n1.includes(w));
}

  if (action && (action.startsWith("Mover e explorar:") || action.startsWith("Mover para:") || action.startsWith("Destrancar e adentrar:"))) {
    const targetRoomName = action.replace(/^(Mover e explorar:|Mover para:|Destrancar e adentrar:)\s*/i, "").trim();
    if (session.world_data?.mapa_locais) {
      targetRoomObj = session.world_data.mapa_locais.find(r => r.nome.toLowerCase() === targetRoomName.toLowerCase() || r.id === targetRoomName);
    }

    if (targetRoomObj) {
      // Verifica se a sala está trancada e se o grupo tem a chave
      if (targetRoomObj.trancado) {
        const requiredKey = targetRoomObj.chave_necessaria || "Chave";
        const hasKey = (activeChar.inventory || []).some(it => {
          const n = typeof it === 'string' ? it : it.nome;
          return matchesKey(n, requiredKey);
        }) || session.all_characters.some(c => (c.inventory || []).some(it => {
          const n = typeof it === 'string' ? it : it.nome;
          return matchesKey(n, requiredKey);
        }));

        if (hasKey) {
          targetRoomObj.trancado = false;
          // Destranca todas as portas correspondentes no grafo
          session.world_data.mapa_locais.forEach(rm => {
            (rm.portas || []).forEach(p => {
              if (p.alvo_id === targetRoomObj.id) p.trancada = false;
            });
          });
          keyUnlockNarration = `🔑 [CHAVE UTILIZADA] Você utiliza ${requiredKey} e ouve o mecanismo girar suavemente. A porta de ${targetRoomObj.nome} foi destrancada!\n\n`;
        } else {
          return {
            narration: `🔒 A porta para "${targetRoomObj.nome}" está firmemente trancada. Requer: [${requiredKey}]. Vasculhe os pontos de busca dos cômodos anteriores para encontrá-la!`,
            bgm_mood: "calmo",
            dice_request: null,
            sheet: activeChar,
            all_characters: session.all_characters,
            world_data: session.world_data
          };
        }
      }

      // Move APENAS o agente ativo de forma independente
      activeChar.current_location = targetRoomObj.nome;
      activeChar.current_location_id = targetRoomObj.id;
      session.character_sheet.current_location = targetRoomObj.nome;
      session.character_sheet.current_location_id = targetRoomObj.id;

      session.world_data.local_nome = targetRoomObj.nome;
      session.world_data.local_id = targetRoomObj.id;

      // ── ATIVAÇÃO IMEDIATA DE CENA / ATAQUE AUTOMÁTICO DE CRIATURAS AO ENTRAR ──
      if (targetRoomObj.gatilho && targetRoomObj.gatilho !== "investigacao") {
        session.world_data.tipo_cena_atual = targetRoomObj.gatilho;
        if (targetRoomObj.gatilho === "boss_climax") {
          session.world_data.climax_ativado = true;
          immediateAmbushNarration = `🚨 [CLÍMAX - BOSS FINAL] O ar ao redor se distorce em um vórtice de insanidade. A Entidade Abissal se ergue diante da equipe exigindo o confronto decisivo!`;
        } else if (targetRoomObj.gatilho === "combate_comum" || targetRoomObj.gatilho === "combate_importante") {
          immediateAmbushNarration = `⚔ [AMEAÇA IMEDIATA] Ao cruzar o limiar de ${targetRoomObj.nome}, uma aberração oculta nos cantos escuros detecta sua presença e avança com fúria violenta sem dar tempo para hesitação!`;
        } else if (targetRoomObj.gatilho === "perseguicao") {
          immediateAmbushNarration = `🏃 [PERSEGUIÇÃO ATIVADA] O assoalho cede e garras espectrais emergem das paredes iniciando uma fuga desesperada pelos corredores!`;
        }
      } else {
        session.world_data.tipo_cena_atual = "investigacao";
      }
    }
  }

  // 2. Intercepta e processa Teste de Investigação em Ponto de Busca
  let investigationResult = null;
  const isInvestigateAction = action && (action.includes("Examinar e investigar") || action.includes("Investigar Ponto de Busca"));

  if (isInvestigateAction) {
    let pontoObj = null;
    const allRooms = session.world_data?.mapa_locais || [];

    for (const room of allRooms) {
      for (const pi of (room.pontos_investigacao || [])) {
        if (action.toLowerCase().includes(pi.nome.toLowerCase()) || action.includes(pi.id)) {
          pontoObj = pi;
          break;
        }
      }
      if (pontoObj) break;
    }

    if (pontoObj) {
      if (session.world_data.pontos_explorados.includes(pontoObj.id)) {
        return {
          narration: `Este ponto (${pontoObj.nome}) já foi completamente vasculhado e examinado anteriormente. Não há novos vestígios ou itens a serem encontrados aqui.`,
          bgm_mood: "calmo",
          dice_request: null,
          sheet: activeChar,
          all_characters: session.all_characters,
          world_data: session.world_data,
          investigation_result: {
            point_name: pontoObj.nome,
            icon: pontoObj.icone || "🔍",
            success: false,
            already_explored: true,
            description: "Este ponto já foi totalmente investigado pela equipe."
          }
        };
      }

      if (!diceResult) {
        return {
          narration: `Você se aproxima para examinar detalhadamente: ${pontoObj.nome}. Role Intelecto/Investigação para desvendar os segredos deste ponto.`,
          dice_request: {
            label: `INVESTIGAÇÃO: ${pontoObj.nome.toUpperCase()}`,
            pending_narration: `Investigando ${pontoObj.nome} (CD ${pontoObj.cd || 12}). Role seu teste de Investigação.`,
            dice: "d20",
            quantity: 1,
            cd: pontoObj.cd || 12,
            attribute: pontoObj.atributo || "intelecto",
            allow_crits: false
          },
          sheet: activeChar,
          all_characters: session.all_characters,
          world_data: session.world_data
        };
      } else {
        const success = (diceResult.total >= (pontoObj.cd || 12));
        session.world_data.pontos_explorados.push(pontoObj.id);

        if (success) {
          const itemFound = pontoObj.sucesso;
          if (!Array.isArray(activeChar.inventory)) activeChar.inventory = [];
          if (!activeChar.inventory.some(i => (typeof i === 'string' ? i : i.nome) === itemFound)) {
            activeChar.inventory.push(itemFound);
          }

          investigationResult = {
            point_name: pontoObj.nome,
            icon: pontoObj.icone || "🔍",
            success: true,
            roll_total: diceResult.total,
            cd: pontoObj.cd || 12,
            reward: itemFound,
            description: pontoObj.sucesso
          };
        } else {
          investigationResult = {
            point_name: pontoObj.nome,
            icon: pontoObj.icone || "🔍",
            success: false,
            roll_total: diceResult.total,
            cd: pontoObj.cd || 12,
            description: pontoObj.falha || "Nenhum documento ou mecanismo útil foi encontrado após a busca."
          };
        }
      }
    }
  }

  // 3. Processamento de Auxílio Direto (Físico ou Psicológico) entre Agentes
  if (action && (action.includes("Prestar Auxílio Físico") || action.includes("Prestar Auxílio Psicológico"))) {
    const isPsico = action.includes("Auxílio Psicológico");
    const targetMatch = action.match(/para\s+([^:]+):/i);
    const targetName = targetMatch ? targetMatch[1].trim() : null;
    const targetChar = session.all_characters.find(c => c.name.toLowerCase() === (targetName || "").toLowerCase());

    if (targetChar) {
      if (isPsico) {
        targetChar.san_current = clamp((targetChar.san_current || 0) + 4, 1, targetChar.san_max || 16);
        targetChar.madness_rounds = 0;
        targetChar.status_effects = (targetChar.status_effects || []).filter(s => !s.startsWith("Colapso Mental") && !s.startsWith("Insano"));
      } else {
        targetChar.pv_current = clamp((targetChar.pv_current || 0) + 4, 1, targetChar.pv_max || 16);
        targetChar.dying_rounds = 0;
        targetChar.status_effects = (targetChar.status_effects || []).filter(s => !s.startsWith("Morrendo"));
      }
    }
  }

  // 4. Processamento Narrativo com IA / Motor Local
  const result = await processPlayerAction(action, session, diceResult);
  applyUpdates(session, result.state_updates || {}, diceResult);

  // 5. Simulação de Patrulha / Criaturas se Movendo "Por Debaixo dos Panos"
  let patrolAmbushText = "";
  if (session.world_data?.mapa_locais && session.world_data.mapa_locais.length > 3) {
    if (!Array.isArray(session.world_data.criaturas_patrulha)) {
      session.world_data.criaturas_patrulha = [
        { id: "patrulha_1", nome: "Vulto de Sangue Errante", sala_id: "loc_uti" }
      ];
    }

    session.world_data.criaturas_patrulha.forEach(patrol => {
      const curRoom = session.world_data.mapa_locais.find(r => r.id === patrol.sala_id);
      if (curRoom && curRoom.conexoes?.length > 0 && Math.random() < 0.35) {
        const nextRoomId = curRoom.conexoes[Math.floor(Math.random() * curRoom.conexoes.length)];
        patrol.sala_id = nextRoomId;

        // Se a criatura entrou na sala onde há algum player:
        const playerInRoom = session.all_characters.find(c => c.current_location_id === nextRoomId || c.current_location === curRoom.nome);
        if (playerInRoom) {
          patrolAmbushText = `\n\n🚨 [ALERTA DE PATRULHA] Passos pesados ecoam na escuridão! ${patrol.nome} entrou de repente na sala onde ${playerInRoom.name} está e parte para o ataque!`;
          session.world_data.tipo_cena_atual = "combate_comum";
        }
      }
    });
  }

  // 6. Atualização de Turnos
  if (session.initiative_order?.length > 1) {
    session.current_turn_index = ((session.current_turn_index || 0) + 1) % session.initiative_order.length;
  }
  session.turn_count = (session.turn_count || 0) + 1;

  let finalNarration = (keyUnlockNarration + immediateAmbushNarration + (result.narration || "") + patrolAmbushText).trim();
  pushHistory(session, { player: action, ai: finalNarration, time: new Date().toISOString() });

  if (Array.isArray(result.new_events)) {
    result.new_events.forEach(ev => pushHistory(session, { system_event: ev, time: new Date().toISOString() }));
  }

  if (result.contextual_suggestions) {
    session.contextual_suggestions = result.contextual_suggestions;
  }

  saveSession(sessionId, session);

  const effectiveSceneType = session.world_data?.tipo_cena_atual || result.scene_type || "investigacao";
  const effectiveBgmMood = (effectiveSceneType === "boss_climax" || effectiveSceneType === "combate_comum" || effectiveSceneType === "combate_importante") ? "batalha" : (effectiveSceneType === "perseguicao" ? "perseguicao" : (result.bgm_mood || "calmo"));

  return {
    narration:       finalNarration || "O Mestre observa em silêncio.",
    bgm_mood:        effectiveBgmMood,
    scene_type:      effectiveSceneType,
    scene_title:     result.scene_title || session.world_data?.cena_atual_obj?.titulo || "Investigação",
    scene_progress:  result.scene_progress || null,
    cinematica:      result.cinematica || null,
    investigation_result: investigationResult || result.investigation_result || null,
    dice_request:    result.dice_request || null,
    contextual_suggestions: session.contextual_suggestions || [],
    sheet:           activeChar,
    all_characters:  session.all_characters,
    world_data:      session.world_data,
    game_mode:       session.game_mode || null,
    initiative_order: session.initiative_order || null,
    current_turn_index: session.current_turn_index || 0,
    last_dice:       session.last_dice,
    victory:         session.ended && session.victory,
    madness:         session.ended && session.madness,
    dead:            session.ended && session.dead
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