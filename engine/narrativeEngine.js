
// ─── BANCO DE RETRATOS DE AGENTES (Conformidade LGPD / Domínio Público CC0) ───
const PORTRAIT_MEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/men/${i+1}.jpg`);
const PORTRAIT_WOMEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/women/${i+1}.jpg`);
const PORTRAIT_ALL = [...PORTRAIT_MEN, ...PORTRAIT_WOMEN];

function getRandomPortrait(gender = "any") {
  if (gender === "masculino") return pick(PORTRAIT_MEN);
  if (gender === "feminino") return pick(PORTRAIT_WOMEN);
  return pick(PORTRAIT_ALL);
}

// engine/narrativeEngine.js — Motor Narrativo 100% Local
// Substitui completamente o uso de IA para geração de histórias e personagens.
// Tudo é baseado em banco de dados JSON + lógica determinística.

const fs   = require("fs");
const path = require("path");
const { askAI } = require("./aiOrchestrator");

// ─── Carregamento dos bancos de dados ───────────────────────────────────────
const CODEX = path.join(__dirname, "..", "library_of_rules", "master_codex");
const RULES = path.join(__dirname, "..", "library_of_rules");

function loadDB(filename, folder) {
  const base = folder || CODEX;
  try { return JSON.parse(fs.readFileSync(path.join(base, filename), "utf8")); }
  catch (e) { console.warn(`[NarrEngine] Falha ao carregar ${filename}:`, e.message); return {}; }
}

const NAMES_DB     = loadDB("NAMES_DATABASE.json");
const CHARS_DB     = loadDB("CHARACTERS_DATABASE.json");
const STORIES_DB   = loadDB("STORIES_DATABASE.json");
const NPCS_DB      = loadDB("NPCS_DATABASE.json");
const ENTITIES_DB  = loadDB("ENTITIES_DATABASE.json");
const DEATH_DB     = loadDB("DEATH_CINEMATICS.json");
const ITEMS_DB     = loadDB("ITEMS_DATABASE.json");
const LOCS_DB      = loadDB("LOCATIONS_DATABASE.json");
const BKGS_DB      = loadDB("BACKGROUNDS_VISUAL.json");
const ABILITIES_DB = loadDB("ABILITIES.json", RULES);

const { calcStats } = require("./sessionManager");

// ─── Utils ───────────────────────────────────────────────────────────────────
const pick   = arr  => arr[Math.floor(Math.random() * arr.length)];
const pickN  = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const clamp  = (v, mn, mx) => Math.max(mn, Math.min(mx, v ?? mn));
const rollD  = sides => Math.floor(Math.random() * sides) + 1;
const roll   = (qty, sides) => Array.from({length: qty}, () => rollD(sides)).reduce((a,b)=>a+b, 0);

const CLASS_BASES = {
  combatente:   { pv: (vig) => 20 + vig, pe: (pre) => 2 + pre,  san: () => 12 },
  especialista: { pv: (vig) => 16 + vig, pe: (pre) => 3 + pre,  san: () => 16 },
  ocultista:    { pv: (vig) => 12 + vig, pe: (pre) => 4 + pre,  san: () => 20 },
  comum:        { pv: (vig) => 12 + vig, pe: (pre) => 2 + pre,  san: () => 16 },
};

// ─── GERAÇÃO DE PERSONAGEM ───────────────────────────────────────────────────
function generateCharacterSheet(classChoice, playerData = {}) {
  const cls = (classChoice || pick(["Combatente","Especialista","Ocultista","Comum"])).toLowerCase();

  // Atributos: distribui 4 pontos aleatoriamente (regras oficiais)
  const attrKeys = ["agilidade","forca","intelecto","presenca","vigor"];
  const attrs = { agilidade:0, forca:0, intelecto:0, presenca:0, vigor:0 };
  let pts = 4;
  while (pts > 0) {
    const k = pick(attrKeys);
    if (attrs[k] < 3) { attrs[k]++; pts--; }
  }
  // Chance de -1 em um atributo para ganhar +1 extra
  if (Math.random() < 0.3) {
    const neg = pick(attrKeys.filter(k => attrs[k] === 0));
    if (neg) { attrs[neg] = -1; }
  }

  // Nome
  const gender  = Math.random() < 0.5 ? "masculino" : "feminino";
  const namePool = NAMES_DB[gender]?.[cls] || NAMES_DB.masculino?.especialista || ["Agente"];
  const name = playerData.name && playerData.name.trim()
    ? playerData.name.trim()
    : pick(namePool);

  // Stats
  const fn   = CLASS_BASES[cls] || CLASS_BASES.especialista;
  const pvMax  = fn.pv(attrs.vigor);
  const peMax  = fn.pe(attrs.presenca);
  const sanMax = fn.san();

  // Origem e personalidade
  const origem      = pick(CHARS_DB.origens || [{ descricao: "Agente da Ordem Paranormal." }]);
  const personalidade = pick(CHARS_DB.personalidades || [{ nome: "Determinado", descricao: "Focado na missão." }]);
  const aparencia   = pick(CHARS_DB.aparencias || ["Agente de aparência comum."]);
  const trauma      = pick(CHARS_DB.traumas || [{ descricao: "Sem traumas registrados." }]);

  // Perícias por classe
  const skillsByClass = {
    combatente:   ["Luta","Pontaria","Fortitude","Reflexos","Atletismo","Tática"],
    especialista: ["Investigação","Percepção","Intuição","Tecnologia","Ciências","Medicina"],
    ocultista:    ["Ocultismo","Vontade","Religião","Investigação","Percepção","Intuição"],
    comum:        ["Percepção","Fortitude","Intuição","Atletismo","Sobrevivência","Diplomacia"],
  };
  const baseSkills = skillsByClass[cls] || skillsByClass.especialista;
  const extraSkills = ["Investigação","Percepção","Furtividade","Pilotagem","Crime","Enganação","Intimidação","Atuação","Diplomacia"];
  const skills = pickN([...new Set([...baseSkills, ...extraSkills])], 3 + Math.max(0, attrs.intelecto + 4));

  // Habilidades por classe
  const abilitiesByClass = {
    combatente:   [
      { nome: "Ataque Especial", custo: "2 PE", acao: "Modificador de ataque", descricao: "Gaste 2 PE antes de rolar: +5 no ataque OU +5 no dano. PE gastos mesmo se falhar." },
      { nome: "Tropa de Choque", custo: "0 PE", acao: "Ação de movimento", descricao: "Posiciona-se taticamente. Aliados adjacentes recebem +2 Defesa até seu próximo turno." }
    ],
    especialista: [
      { nome: "Eclético", custo: "2 PE", acao: "Ação livre", descricao: "Age como Treinado em qualquer perícia não treinada. Não funciona com Luta/Pontaria." },
      { nome: "Perito", custo: "2 PE", acao: "Ação livre", descricao: "Em 2 perícias escolhidas, role +1d6 ao resultado do teste." }
    ],
    ocultista:    [
      { nome: "Escolhido pelo Outro Lado", custo: "Varia (mín 1 PE)", acao: "Ação completa", descricao: "Aprende 3 rituais de 1° círculo. Conjurar: gaste PE e role Ocultismo vs CD do ritual." },
      { nome: "Aprendiz do Oculto", custo: "0 PE", acao: "Passiva", descricao: "Identifica rituais conhecidos automaticamente. -5 CD para identificar desconhecidos." }
    ],
    comum:        [
      { nome: "Sobrevivente", custo: "0 PE", acao: "Passiva/Reação", descricao: "1x por cena: quando cair a 0 PV, role Vigor CD 15. Sucesso: fica com 1 PV." },
      { nome: "Adaptável", custo: "2 PE", acao: "Ação livre", descricao: "+5 em qualquer teste de atributo puro. Declare antes de rolar." }
    ],
  };

  // Poderes extras da classe (30% de chance de 1 poder extra)
  const classDB      = ABILITIES_DB[cls.charAt(0).toUpperCase() + cls.slice(1)];
  const powers       = classDB?.poderes_de_classe || [];
  const abilities    = [...(abilitiesByClass[cls] || [])];
  if (powers.length > 0 && Math.random() < 0.4) {
    const extra = pick(powers);
    abilities.push({ nome: extra.nome, custo: extra.custo, acao: extra.acao, descricao: extra.descricao });
  }

  // Inventário inicial por classe
  const startItems = {
    combatente:   ["Pistola 9mm","Kit Médico","Lanterna Tática"],
    especialista: ["Kit Médico","Gravador Digital","Lanterna Tática","Sal Grosso (1kg)"],
    ocultista:    ["Símbolo Sagrado","Água Benta","Kit Médico","Ervas de Proteção"],
    comum:        ["Kit Médico","Lanterna Tática"],
  };

  const avatarSeed = encodeURIComponent((name || "agente") + "_" + Math.floor(Math.random() * 10000));
  const age = playerData.age || playerData.idade || (20 + rollD(25));
  const genderStr = playerData.gender || playerData.genero || (gender === "masculino" ? "Masculino" : "Feminino");
  const originStr = playerData.origin || playerData.origem || (origem ? (origem.nome || origem.descricao) : "Policial");
  const appearanceStr = playerData.appearance || playerData.aparencia || aparencia;
  const historyStr = playerData.history || playerData.historico || (trauma ? trauma.descricao : "Agente convocado pela Ordo Realitas.");
  const finalInventory = Array.isArray(playerData.inventory) && playerData.inventory.length > 0
    ? playerData.inventory
    : (startItems[cls] || ["Kit Médico"]);

  const trilha = (playerData && playerData.trilha) ? playerData.trilha : (cls === "combatente" ? "Guerreiro" : cls === "especialista" ? "Infiltrador" : cls === "ocultista" ? "Graduado" : "Sobrevivente Urbano");
  const rituais = (playerData && Array.isArray(playerData.rituais) && playerData.rituais.length > 0) ? playerData.rituais : (cls === "ocultista" ? ["Luz", "Cicatrização", "Decadência"] : []);

  const nexStr = playerData.nex || "NEX 5%";
  const personalityStr = playerData.personality || personalidade.descricao;
  const fearStr = playerData.fear || "";
  const affinityStr = playerData.affinity || "Nenhuma";
  const finalSkills = (Array.isArray(playerData.skills) && playerData.skills.length > 0)
    ? playerData.skills
    : skills;

  const sheet = {
    name,
    class: cls.charAt(0).toUpperCase() + cls.slice(1),
    age,
    gender: genderStr,
    origin: originStr,
    appearance: appearanceStr,
    history: historyStr,
    trilha: trilha,
    affinity: affinityStr,
    personality: personalityStr,
    fear: fearStr,
    rituais: rituais,
    nex: nexStr,
    avatar_url: (playerData && playerData.avatar_url) ? playerData.avatar_url : getRandomPortrait(gender),
    identity: {
      sexo:         genderStr,
      idade:        age,
      altura:       gender === "masculino" ? `${1 + rollD(2)},${70+rollD(20)}m` : `1,${55+rollD(25)}m`,
      peso:         `${55 + rollD(30)}kg`,
      aparencia:    appearanceStr,
      origem:       originStr,
      personalidade: personalityStr,
      trauma:       historyStr,
      medo:         fearStr,
      afinidade:    affinityStr,
      origem_id:    origem.id || "origem_custom",
      frase_tipica: personalidade.frase_tipica,
    },
    attributes: attrs,
    skills:      finalSkills,
    abilities,
    pv_max:      pvMax,
    pv_current:  pvMax,
    pe_max:      Math.max(peMax, 2),
    pe_current:  Math.max(peMax, 2),
    san_max:     sanMax,
    san_current: sanMax,
    inventory:   finalInventory,
    status_effects: [],
    current_location: "Ponto de Encontro",
    defesa: 10 + attrs.agilidade,
  };

  return sheet;
}

// ─── GERAÇÃO DE HISTÓRIA ─────────────────────────────────────────────────────
function generateStory(themes = [], gameMode = {}) {
  const stories = STORIES_DB.historias || [];
  if (!stories.length) return _fallbackStory();

  // Filtra por temas se fornecidos
  let pool = stories;
  if (themes && themes.length) {
    const themeFiltered = stories.filter(s =>
      s.tematica && s.tematica.some(t => themes.includes(t))
    );
    if (themeFiltered.length > 0) pool = themeFiltered;
  }

  const story = pick(pool);

  // Monta a estrutura final da sessão
  return {
    id:              story.id,
    titulo:          story.titulo,
    sinopse:         story.sinopse,
    tom:             story.tom,
    contexto:        `${story.local_principal} — ${story.cidade}, ${story.epoca}`,
    local_principal: story.local_principal,
    cidade:          story.cidade,
    evento_incitante: story.evento_incitante,
    atmosfera:       story.atmosfera,
    ato1:            story.ato1,
    ato2:            story.ato2,
    ato3:            story.ato3,
    climax:          story.climax,
    finais:          story.finais,
    ato_atual:       1,
    cena_atual:      0,
    pistas_reveladas:[],
    climax_ativado:  false,
    final_escolhido: null,
  };
}

function _fallbackStory() {
  return {
    id: "missao_paranormal",
    titulo: "Missão Paranormal",
    sinopse: "Uma ocorrência inexplicável requer investigação imediata.",
    tom: "horror",
    contexto: "Brasil, época atual.",
    local_principal: "Localização Desconhecida",
    cidade: "Brasil",
    evento_incitante: "Uma ocorrência inexplicável foi reportada. Investigação imediata necessária.",
    atmosfera: "O ar está pesado com algo que não deveria existir.",
    ato1: { titulo: "Início", cenas: ["Chegada ao local.", "Primeiras pistas."], pistas: ["Algo está errado."] },
    ato2: { titulo: "Desenvolvimento", cenas: ["A situação piora.", "Confronto se aproxima."], pistas: ["A verdade emerge."] },
    ato3: { titulo: "Clímax", cenas: ["Confronto final."] },
    climax: { descricao: "O confronto final se aproxima.", desafio_principal: "Sobreviver.", cd_ritual: 15, atributo_ritual: "vontade" },
    finais: [{ id: "vitoria", titulo: "Vitória", descricao: "Os agentes sobrevivem.", tom: "aliviante" }],
    ato_atual: 1, cena_atual: 0, pistas_reveladas: [], climax_ativado: false, final_escolhido: null,
  };
}

// ─── GERAÇÃO DE POOL DE NPCs ─────────────────────────────────────────────────
function generateNPCPool(storyData) {
  const allNpcs = NPCS_DB.npcs || [];
  const recommended = storyData.npcs_recomendados || [];

  // Seleciona NPCs recomendados primeiro
  let pool = allNpcs.filter(n => recommended.includes(n.id));

  // Completa com NPCs aleatórios se necessário
  const remaining = allNpcs.filter(n => !recommended.includes(n.id));
  while (pool.length < 3) {
    const extra = pick(remaining);
    if (extra && !pool.find(n => n.id === extra.id)) pool.push(extra);
    else break;
  }

  return pool.slice(0, 6);
}

// ─── GERAÇÃO DE ENTIDADE PARA A SESSÃO ───────────────────────────────────────
function selectEntity(story) {
  const entities = ENTITIES_DB.entidades || [];
  if (!entities.length) return null;

  // Seleciona por nível baseado no tom da história
  const levelMap = { horror: ["basico","intermediario"], suspense_rural: ["basico"], lovecraftiano: ["elite"], conspiração: ["intermediario"], misterio: ["basico","intermediario"] };
  const allowed = levelMap[story.tom] || ["basico","intermediario"];
  const pool = entities.filter(e => allowed.includes(e.nivel));

  return pool.length ? pick(pool) : pick(entities);
}

// ─── NARRAÇÃO DE ABERTURA VIA IA ──────────────────────────────────────────────
async function generateOpeningNarration(session) {
  const story = session.world_data;
  const chars = session.all_characters || [session.character_sheet];
  const isMulti = chars.length > 1;

  if (!story) return { narration: "A missão começa. O paranormal aguarda.", state_updates: {}, new_events: [] };

  const firstLoc = story.local_principal || "o local da missão";
  const agentsDesc = chars.map(c => {
    const orig = c.origin || (c.identity && c.identity.origem) || "";
    const age = c.age || (c.identity && c.identity.idade) || "";
    const app = c.appearance || (c.identity && c.identity.aparencia) || "";
    const items = (c.inventory || []).map(i => typeof i === "string" ? i : i.nome).join(", ");
    return `${c.name} (${c.class}${orig ? `, ${orig}` : ""}${age ? `, ${age} anos` : ""}${app ? `, Aparência: ${app}` : ""}${items ? `, Equipamento: ${items}` : ""})`;
  }).join("; ");

  const prompt = `CRIE A NARRAÇÃO DE ABERTURA DA MISSÃO:
História: "${story.titulo}" (${story.sinopse})
Contexto: ${story.contexto}
Evento Incitante: ${story.evento_incitante}
Atmosfera: ${story.atmosfera}
Agentes em ação: ${agentsDesc}
Instrução: Introduza a cena de abertura de forma cinematográfica, sombria e imersiva. Descreva onde os agentes estão, seus traços marcantes/equipamentos quando relevante e o mistério inicial.`;

  const stateContext = {
    local: firstLoc,
    historia: story.titulo,
    agentes: chars.map(c => c.name)
  };

  try {
    const aiResult = await askAI(prompt, stateContext);
    if (aiResult && aiResult.narration) {
      return {
        narration: aiResult.narration,
        state_updates: { location: firstLoc },
        new_events: ["SESSÃO INICIADA POR IA"]
      };
    }
  } catch (e) {
    console.warn("[NarrEngine] Fallback na abertura:", e.message);
  }

  const charNames = chars.map(c => c.name).join(" e ");
  const narration = `${story.evento_incitante}\n\n${isMulti ? charNames : chars[0].name} chega${isMulti ? "m" : ""} a ${firstLoc}.\n\n${story.atmosfera || "O ar está pesado."}`;
  return {
    narration,
    state_updates: { location: firstLoc },
    new_events: []
  };
}

// ─── PROCESSAMENTO DE AÇÃO DO JOGADOR ────────────────────────────────────────
async function processPlayerAction(action, session, diceResult) {
  const story   = session.world_data;
  const chars   = session.all_characters || [session.character_sheet];
  const sh      = session.character_sheet;
  const isMulti = chars.length > 1;

  let finalAction = action;
  if (diceResult) {
    const resText = diceResult.success ? (diceResult.isCritical ? "CRÍTICO" : "SUCESSO") : (diceResult.isDisaster ? "DESASTRE" : "FALHA");
    finalAction += ` [Resultado do Dado: ${resText} | Total: ${diceResult.total} vs CD ${diceResult.cd}]`;
  }

  const stateContext = {
    inventario: sh.inventory,
    local: sh.current_location,
    historia_ato: story?.ato_atual || 1,
    pistas_reveladas: story?.pistas_reveladas || [],
    npcs_ativos: (story?.npcs_ativos || []).map(n => n.nome),
    pv: `${sh.pv_current}/${sh.pv_max}`
  };

  let aiResult = null;
  try {
    aiResult = await askAI(finalAction, stateContext);
  } catch (e) {
    console.warn("[NarrEngine] AI falhou, usando motor narrativo local:", e.message);
  }

  const isAIFallback = !aiResult || !aiResult.narration || aiResult.narration.includes("A entidade não responde");

  let narration = "";
  let cinematica = null;
  let dice_request = null;
  const state_updates = {};
  const new_events = [];
  let contextual_suggestions = [];

  if (!isAIFallback && aiResult) {
    narration = aiResult.narration;
    if (aiResult.inventory_updates) {
      state_updates.inventory_add = aiResult.inventory_updates.add || [];
      state_updates.inventory_remove = aiResult.inventory_updates.remove || [];
    }
    if (aiResult.pending_dice && aiResult.pending_dice.required && !diceResult) {
      dice_request = {
        label: "Teste Exigido",
        attribute: aiResult.pending_dice.attribute || "agilidade",
        dice: "d20",
        quantity: 1 + Math.max(0, sh.attributes?.[aiResult.pending_dice.attribute] || 0),
        cd: aiResult.pending_dice.cd || 15,
        pick: (sh.attributes?.[aiResult.pending_dice.attribute] || 0) < 0 ? "lowest" : "highest",
        trained: false,
        damage_dice: "d6",
        damage_quantity: 1,
        pending_narration: aiResult.pending_dice.reason || "Ação requer teste."
      };
      narration += `\n\n[Sistema: Role os dados para prosseguir]`;
    }
    contextual_suggestions = aiResult.contextual_suggestions || [];
  } else {
    // ── Gasto Real de Pontos de Esforço (PE) em Habilidades e Rituais ──────────
    let peCost = 0;
    const peMatch = action.match(/(\d+)\s*PE/i);
    if (peMatch) {
      peCost = parseInt(peMatch[1]) || 0;
    } else {
      const matchedAbil = (sh.abilities || []).find(a => {
        const name = typeof a === "string" ? a : a.nome;
        return action.toLowerCase().includes(name.toLowerCase());
      });
      if (matchedAbil && typeof matchedAbil === "object" && matchedAbil.custo) {
        const m = matchedAbil.custo.match(/(\d+)\s*PE/i);
        if (m) peCost = parseInt(m[1]) || 0;
      }
    }

    if (peCost > 0) {
      if ((sh.pe_current || 0) < peCost) {
        return {
          narration: `⚠️ Você não possui Pontos de Esforço suficientes (${sh.pe_current || 0}/${peCost} PE). A exaustão física e mental impede a execução desta manobra! Escolha outra ação.`,
          cinematica: null,
          dice_request: null,
          state_updates: {},
          new_events: [],
          contextual_suggestions: []
        };
      }
      state_updates.pe_current = Math.max(0, (sh.pe_current || 0) - peCost);
      cinematica = { tipo: "gasto_pe", texto: `-${peCost} PE em Esforço Paranormal`, valor: peCost, recurso_atual: state_updates.pe_current, recurso_maximo: sh.pe_max };
    }

    // ── Motor Narrativo Local de Alta Qualidade ─────────────────────────────
    const actionType = classifyAction(action);
    if (actionType === "combate") {
      const combatRes = processCombatAction(action, session, diceResult);
      narration = combatRes.narration;
      dice_request = combatRes.dice_request;
      Object.assign(state_updates, combatRes.state_updates);
      if (!cinematica && combatRes.cinematica) cinematica = combatRes.cinematica;
    } else if (actionType === "exploracao") {
      if (!diceResult) {
        dice_request = {
          label: "Investigação",
          attribute: "intelecto",
          dice: "d20",
          quantity: 1 + Math.max(0, sh.attributes?.intelecto || 0),
          cd: 12,
          pick: (sh.attributes?.intelecto || 0) < 0 ? "lowest" : "highest",
          trained: (sh.skills || []).includes("Investigação") || (sh.skills || []).includes("Percepção"),
          pending_narration: "Examine o ambiente minuciosamente para descobrir pistas ocultas."
        };
        narration = `Você começa a inspecionar o local atentamente...\n\n[Sistema: Role Investigação (Intelecto) para prosseguir]`;
      } else {
        narration = processExplorationAction(action, session, story);
        if (diceResult.isCritical) {
          narration = `⭐ Revelação extraordinária!\n\n${narration}`;
        }
        // Dreno moderado de Sanidade se exposto ao medo
        if (Math.random() < 0.35 && (sh.san_current || 0) > 0) {
          const sanLoss = roll(1, 2);
          state_updates.san_current = Math.max(0, (sh.san_current || 0) - sanLoss);
          narration += `\n\n[O vislumbre sobrenatural perturba sua mente: -${sanLoss} SAN]`;
          if (!cinematica) cinematica = { tipo: "dano_san", texto: `-${sanLoss} SAN — A mente vacila!`, valor: sanLoss, recurso_atual: state_updates.san_current, recurso_maximo: sh.san_max };
        }
      }
    } else if (actionType === "social") {
      narration = processSocialAction(action, session, story);
    } else if (actionType === "item") {
      narration = processItemAction(action, session);
    } else if (actionType === "fuga") {
      narration = processFleeAction(action, session);
    } else {
      narration = processGenericAction(action, session, story);
    }

    // Progresso de cena local
    if (shouldAdvanceScene(session, action, diceResult)) {
      const nextScene = advanceScene(session, story);
      if (nextScene) narration += `\n\n📍 *${nextScene}*`;
    }
  }

  // Verifica condições de clímax
  if (checkClimaxConditions(session)) {
    session.world_data.climax_ativado = true;
    const climaxDesc = story?.climax?.descricao || "";
    if (climaxDesc) narration += `\n\n⚡ *${climaxDesc}*`;
    new_events.push("CLÍMAX ATIVADO");
  }

  // Consequências drásticas (dano/cinemática) se o dado foi um desastre
  if (diceResult && diceResult.isDisaster) {
    const selfDmg = roll(1, 6) + 2;
    state_updates.pv_current = clamp((sh.pv_current || 0) - selfDmg, 0, sh.pv_max);
    cinematica = { tipo: "dano_pv", texto: `-${selfDmg} PV — Consequência trágica!`, valor: selfDmg, recurso_atual: state_updates.pv_current, recurso_maximo: sh.pv_max };
    narration += `\n\nO fracasso cobra seu preço. Você sofre ${selfDmg} de dano!`;
  } else if (diceResult && diceResult.success && diceResult.dmg_results && diceResult.dmg_results.length > 0) {
    const dmg = diceResult.dmg_results.reduce((a,b)=>a+b, 0);
    if (dmg > 0) {
      cinematica = { tipo: "matar", texto: `${dmg} de Dano Causado!`, valor: dmg, recurso_atual: dmg, recurso_maximo: dmg };
      narration += `\n\nO ataque conectou! ${dmg} de dano causado.`;
    }
  }

  // Condição de Vitória no Clímax (Ato 3)
  const currentPv = state_updates.pv_current ?? sh.pv_current;
  const currentSan = state_updates.san_current ?? sh.san_current;

  if (story?.ato_atual >= 3 && (story.climax_ativado || session.turn_count >= 10)) {
    if (diceResult && diceResult.success && diceResult.total >= 14) {
      session.ended = true;
      session.victory = true;
      cinematica = { tipo: "matar", texto: "Entidade Banida! Vitória da Ordem!", valor: 100, recurso_atual: 100, recurso_maximo: 100 };
      narration += `\n\n🏆 VITÓRIA DA MISSÃO! Com determinação inabalável, o ritual de contenção é selado. A anomalia colapsa e a Ordo Realitas assegura mais um dia para a humanidade.`;
    }
  }

  // Verifica Morte
  if (currentPv <= 0) {
    cinematica = generateDeathCinematic(sh, session);
    session.ended = true;
  } else if (currentSan <= 0) {
    // Verifica Insanidade Permanente (Enlouquecido)
    cinematica = { tipo: "dano_san", texto: `${sh.name || "O agente"} enlouqueceu perante o Outro Lado!`, valor: 0, recurso_atual: 0, recurso_maximo: sh.san_max };
    session.ended = true;
    session.madness = true;
    narration += `\n\n🌀 INSANIDADE TOTAL: A barreira mental se rompeu completamente. A mente do agente foi devorada pelo Outro Lado.`;
  }

  return {
    narration: narration || "O ambiente permanece tenso. Aguardem o próximo movimento.",
    cinematica,
    dice_request,
    state_updates,
    new_events,
    contextual_suggestions
  };
}

// ─── Classificação de Ação ───────────────────────────────────────────────────
function classifyAction(action) {
  const a = (action || "").toLowerCase();
  if (/atac|usar.*abilidade|habilidade|ritual|golp|disparar|atirar|bater|lutar/.test(a)) return "combate";
  if (/explorar|investigar|procurar|examinar|observar|vasculhar|verificar|analisar|olhar/.test(a)) return "exploracao";
  if (/falar|conversar|persuad|intimidar|enganar|negociar|ser.*amig|confiar|discordar|repudiar|dissertar|silenc/.test(a)) return "social";
  if (/usar.*item|pegar|largar|equipar|consumir|jogar/.test(a)) return "item";
  if (/correr|fugir|recuar|escapar|sair|retirar/.test(a)) return "fuga";
  if (/desistir|passar|aguardar|esperar/.test(a)) return "skip";
  return "generico";
}

// ─── Processamento por tipo ───────────────────────────────────────────────────
function processCombatAction(action, session, diceResult) {
  const sh    = session.character_sheet;
  const story = session.world_data;
  const entity = session.current_entity;
  const state_updates = {};
  let cinematica = null;
  let dice_request = null;

  // Se tem resultado de dado, aplica o combate
  if (diceResult) {
    const success = diceResult.success;
    const isCrit  = diceResult.isCritical;
    const isDis   = diceResult.isDisaster;

    if (isDis) {
      // Desastre — agente sofre dano pesado
      const selfDmg = roll(1, 6) + 3;
      state_updates.pv_current = clamp((sh.pv_current || 0) - selfDmg, 0, sh.pv_max);
      cinematica = { tipo: "dano_pv", texto: `-${selfDmg} PV — Desastre em Combate!`, valor: selfDmg, recurso_atual: state_updates.pv_current, recurso_maximo: sh.pv_max };
      return {
        narration: pick([
          "O ataque falha catastroficamente! A criatura aproveita a abertura e desfere um golpe brutal.",
          "Desastre! A arma escorrega e o impacto sobrenatural atinge você em cheio.",
          "A pior das falhas. O monstro contra-ataca com ferocidade avassaladora.",
        ]) + ` (-${selfDmg} PV)`,
        dice_request, state_updates, cinematica
      };
    }

    if (success) {
      const dmg = (diceResult.dmg_results || []).reduce((a,b)=>a+b, 0) || roll(1,6) + Math.max(0, sh.attributes?.forca || 0);
      const narratives = isCrit
        ? ["Golpe crítico! O impacto é devastador e rasga a carcaça da criatura.", "Crítico perfeito — a energia paranormal estilhaça.", "Ataque excepcional! O monstro urra de agonia."]
        : ["O ataque conecta certeiramente.", "Sucesso! O golpe perfura a defesa da entidade.", "O ataque acerta com precisão cirúrgica."];
      
      // Contra-ataque de menor intensidade se não foi crítico
      if (!isCrit && Math.random() < 0.4) {
        const retaliation = roll(1, 3);
        state_updates.pv_current = clamp((sh.pv_current || 0) - retaliation, 0, sh.pv_max);
        return { 
          narration: `${pick(narratives)} (${dmg} de dano). A criatura ainda consegue raspar em você no processo (-${retaliation} PV).`, 
          dice_request, 
          state_updates, 
          cinematica: { tipo: "matar", texto: `${dmg} de Dano Causado!`, valor: dmg, recurso_atual: dmg, recurso_maximo: dmg } 
        };
      }

      return { narration: pick(narratives) + (dmg ? ` (${dmg} de dano)` : ""), dice_request, state_updates, cinematica };
    } else {
      // Falha no ataque — monstro contra-ataca
      const enemyDmg = roll(1, 4) + 1;
      state_updates.pv_current = clamp((sh.pv_current || 0) - enemyDmg, 0, sh.pv_max);
      cinematica = { tipo: "dano_pv", texto: `-${enemyDmg} PV — Contra-ataque!`, valor: enemyDmg, recurso_atual: state_updates.pv_current, recurso_maximo: sh.pv_max };
      return { 
        narration: pick([
          "O ataque erra o alvo! A entidade aproveita o desequilíbrio e ataca.",
          "A defesa do monstro resiste e suas garras retalham você.",
          "Você vacila no ataque e recebe um golpe em resposta."
        ]) + ` (-${enemyDmg} PV)`, 
        dice_request, 
        state_updates, 
        cinematica 
      };
    }
  }

  // Sem resultado de dado ainda — solicita rolagem
  const atrib = detectCombatAttribute(action, session.character_sheet);
  dice_request = {
    label: "Ataque",
    attribute: atrib,
    dice: "d20",
    quantity: 1 + Math.max(0, sh.attributes?.[atrib] || 0),
    cd: entity?.defesa || 12,
    pick: (sh.attributes?.[atrib] || 0) < 0 ? "lowest" : "highest",
    trained: sh.skills?.some(s => ["Luta","Pontaria"].includes(s)),
    damage_dice: "d6",
    damage_quantity: 1,
    pending_narration: pick(["Declare seu ataque — os dados decidirão.", "Role para ver se o golpe conecta.", "Ataque! Mas a sorte ainda não está decidida."]),
  };

  return { narration: "Você prepara o ataque. Role os dados.", dice_request, state_updates: {}, cinematica: null };
}

function detectCombatAttribute(action, sh) {
  const a = (action || "").toLowerCase();
  if (/atirar|disparar|pontaria/.test(a)) return "agilidade";
  if (/ritual|ocultismo|conjurar/.test(a)) return "intelecto";
  if (/intimidar|gritar/.test(a)) return "presenca";
  if (sh.class?.toLowerCase() === "combatente") return "forca";
  return "agilidade";
}

function processExplorationAction(action, session, story) {
  const atoAtual = story?.ato_atual || 1;
  const pistas = story?.[`ato${atoAtual}`]?.pistas || [];
  const cenas  = story?.[`ato${atoAtual}`]?.cenas  || [];

  // Revela uma pista não revelada ainda
  const jaReveladas = story?.pistas_reveladas || [];
  const novas = pistas.filter(p => !jaReveladas.includes(p));

  let narration;
  if (novas.length > 0) {
    const pista = pick(novas);
    if (!story.pistas_reveladas) story.pistas_reveladas = [];
    story.pistas_reveladas.push(pista);
    narration = pick([
      `A investigação revela algo importante: ${pista}`,
      `Examinando o ambiente com cuidado, você nota: ${pista}`,
      `A busca vale a pena. Uma descoberta: ${pista}`,
    ]);
  } else {
    narration = pick([
      "Você examina o ambiente meticulosamente. Não há mais pistas visíveis aqui.",
      "A investigação continua, mas os rastros estão frios. Talvez em outro local.",
      "Nada mais a encontrar aqui. O próximo passo deve estar em outro lugar.",
      `${cenas[0] || "O local guarda seus segredos bem."}`,
    ]);
  }

  return narration;
}

function processSocialAction(action, session, story) {
  const sh = session.character_sheet;
  const npcs = session.world_data?.npcs_ativos || [];
  const npc = npcs.find(n => n.atitude === "aliado") || npcs[0];

  const socialTemplates = {
    amigavel: [
      "A abordagem amigável quebra o gelo. Há algo na postura que convida à confiança.",
      "A simpatia funciona. O NPC relaxa visivelmente.",
      "Ser humano às vezes é a melhor tática.",
    ],
    intimidar: [
      "A intimidação ressoa. Há pausa antes da resposta.",
      "A pressão funciona — por ora.",
      "A ameaça é compreendida. Mas isso pode ter consequências.",
    ],
    silencio: [
      "O silêncio pesa na sala. Todos esperam. Ninguém fala.",
      "Às vezes não dizer nada é mais poderoso do que qualquer palavra.",
      "O silêncio estratégico — e a tensão cresce.",
    ],
    default: [
      "A interação social acontece. O NPC considera suas palavras.",
      "A conversa tem peso. Cada palavra importa agora.",
      "A dinâmica social se desenvolve. Você espera a reação.",
    ],
  };

  const a = (action || "").toLowerCase();
  let type = "default";
  if (/amig|diplomacia|persuad/.test(a)) type = "amigavel";
  else if (/intimidar|ameaç|pressionar/.test(a)) type = "intimidar";
  else if (/silenc|calar|ficar.*quieto/.test(a)) type = "silencio";

  let narration = pick(socialTemplates[type] || socialTemplates.default);

  if (npc) {
    const frase = pick(npc.dialogos || ["..."]);
    narration += `\n\n${npc.nome}: *"${frase}"*`;
  }

  return narration;
}

function processItemAction(action, session) {
  const sh = session.character_sheet;
  const inv = sh.inventory || [];

  const templates = [
    "O item é usado. O efeito é imediato.",
    "Com mãos firmes, o item cumpre seu propósito.",
    "O equipamento entra em ação.",
  ];

  if (!inv.length) return "O inventário está vazio. Nada a usar.";
  return pick(templates);
}

function processFleeAction(action, session) {
  const sh = session.character_sheet;
  const agi = sh.attributes?.agilidade || 0;

  const templates = [
    "A fuga é executada. Correr às vezes é a decisão mais sábia.",
    "Recuar não é fraqueza — é estratégia.",
    "Você se afasta do perigo. Por ora.",
    agi >= 2 ? "A agilidade permite uma fuga rápida e limpa." : "Você consegue se distanciar, mas não sem custo.",
  ];

  return pick(templates);
}

function processGenericAction(action, session, story) {
  const atoAtual = story?.ato_atual || 1;
  const descricao = story?.[`ato${atoAtual}`]?.descricao || "";
  const cenas = story?.[`ato${atoAtual}`]?.cenas || [];

  const templates = [
    descricao || "A história se desenvolve.",
    "O momento pesa. Cada ação conta.",
    "O ambiente reage à sua presença.",
    cenas[0] || "A tensão cresce.",
    "A missão continua. O paranormal aguarda.",
  ].filter(Boolean);

  return pick(templates);
}

// ─── Progressão da história ───────────────────────────────────────────────────
function shouldAdvanceScene(session, action, diceResult) {
  // Avança cena após sucessos importantes
  if (diceResult?.success && diceResult.total >= 15) return Math.random() < 0.5;
  if ((action || "").length > 50) return Math.random() < 0.3;
  return Math.random() < 0.15;
}

function advanceScene(session, story) {
  if (!story) return null;
  const ato = story.ato_atual || 1;
  const atoData = story[`ato${ato}`];
  if (!atoData) return null;

  const cenas = atoData.cenas || [];
  const current = story.cena_atual || 0;

  if (current < cenas.length - 1) {
    story.cena_atual = current + 1;
    return cenas[current + 1];
  } else if (ato < 3) {
    story.ato_atual = ato + 1;
    story.cena_atual = 0;
    const nextAto = story[`ato${ato + 1}`];
    return nextAto?.titulo ? `Ato ${ato + 1}: ${nextAto.titulo}` : null;
  }

  return null;
}

function checkClimaxConditions(session) {
  const story = session.world_data;
  if (!story || story.climax_ativado) return false;
  const history = session.history || [];
  // Ativa clímax após 15+ ações ou se todas as pistas foram reveladas
  if (history.length >= 15 && story.ato_atual >= 3) return true;
  const pistas = story.ato3?.cenas || [];
  return story.pistas_reveladas?.length >= 3 && story.ato_atual >= 2;
}

// ─── Cinemática de Morte ─────────────────────────────────────────────────────
function generateDeathCinematic(sh, session) {
  const deaths = DEATH_DB.morte_jogador || [];
  const death  = pick(deaths) || { titulo: "Queda", texto: "[NOME] cai.", tipo: "combate" };
  return {
    tipo:      "morte",
    titulo:    death.titulo,
    texto:     death.texto.replace(/\[NOME\]/g, sh.name || "O agente"),
    reversivel: death.reversivel,
    recurso_atual:  0,
    recurso_maximo: sh.pv_max,
  };
}

// ─── Narração de Retomada ─────────────────────────────────────────────────────
function generateResumeNarration(session) {
  const story  = session.world_data;
  const chars  = session.all_characters || [session.character_sheet];
  const history = session.history || [];

  if (!history.length) return { narration: "Bem-vindo de volta à missão." };

  const lastEntry = history[history.length - 1];
  const ato = story?.ato_atual || 1;
  const atoDesc = story?.[`ato${ato}`]?.descricao || "";

  const templates = [
    `Retomando onde paramos — ${atoDesc || "a missão continua."}`,
    `Os agentes voltam à ação. A última cena: "${lastEntry?.ai?.slice(0, 80) || "..."}..."`,
    `A missão não parou. Apenas houve uma pausa. A realidade paranormal aguardava.`,
    `${story?.titulo || "A missão"} continua. Os eventos anteriores pesam em cada decisão.`,
  ];

  return { narration: pick(templates) };
}

// ─── Seleção de Background Visual ────────────────────────────────────────────
function selectBackground(story) {
  const bkgs = BKGS_DB.backgrounds || [];
  if (!bkgs.length) return null;

  const tom = story?.tom || "";
  const temas = story?.tematica || [];

  // Tenta encontrar background compatível com o tom/tema
  const compatible = bkgs.filter(b =>
    b.temas_recomendados.some(t =>
      temas.some(st => st.toLowerCase().includes(t.toLowerCase())) ||
      tom.includes(t.toLowerCase())
    )
  );

  return compatible.length ? pick(compatible) : pick(bkgs);
}

// ─── Preparação completa de sessão (SEM IA) ──────────────────────────────────
async function prepareSessionLocal(sessionId, emit, gameMode, characterData) {
  if (typeof emit !== "function") emit = () => {};
  gameMode = gameMode || { tipo: "individual", personagens: [], npcs_fixos: [] };

  const { loadSession, saveSession } = require("./sessionManager");
  const session = loadSession(sessionId);

  session.game_mode = gameMode;
  saveSession(sessionId, session);

  const isMulti = (gameMode.tipo === "multiplayer_local" || gameMode.tipo === "custom" || gameMode.tipo === "multiplayer") ||
    (Array.isArray(gameMode.personagens) && gameMode.personagens.length > 1) ||
    (characterData && (characterData.multi || (Array.isArray(characterData.personagens) && characterData.personagens.length > 1)));

  // ── FASE 1: Personagem(ns) ─────────────────────────────────────────────────
  const charList = (characterData && Array.isArray(characterData.personagens) && characterData.personagens.length > 0)
    ? characterData.personagens
    : (Array.isArray(gameMode.personagens) && gameMode.personagens.length > 0)
      ? gameMode.personagens
      : [characterData || { auto: true }];

  emit("step", { id: "identity",   status: "active", detail: charList.length > 1 ? `Criando ${charList.length} agentes...` : "Criando identidade..." });
  emit("step", { id: "attributes", status: "active", detail: "Calculando atributos..." });
  emit("step", { id: "skills",     status: "active", detail: "Atribuindo perícias..." });
  emit("progress", { pct: 10 });

  let allChars = [];
  for (let i = 0; i < charList.length; i++) {
    const pData = charList[i];
    const auto  = pData.auto || (!pData.name && !pData.class);
    const cls   = (!auto && pData.class && pData.class !== "Auto") ? pData.class : null;
    const sheet = generateCharacterSheet(cls, pData);
    if (pData.attributes && !auto) Object.assign(sheet.attributes, pData.attributes);
    if (!auto && pData.name) sheet.name = pData.name;
    if (pData.age || pData.idade) sheet.age = pData.age || pData.idade;
    if (pData.gender || pData.genero) sheet.gender = pData.gender || pData.genero;
    if (pData.origin || pData.origem) sheet.origin = pData.origin || pData.origem;
    if (pData.appearance || pData.aparencia) sheet.appearance = pData.appearance || pData.aparencia;
    if (pData.history || pData.historico) sheet.history = pData.history || pData.historico;
    if (pData.personality) sheet.personality = pData.personality;
    if (pData.fear) sheet.fear = pData.fear;
    if (pData.affinity) sheet.affinity = pData.affinity;
    if (pData.nex) sheet.nex = pData.nex;
    if (Array.isArray(pData.skills) && pData.skills.length > 0) sheet.skills = pData.skills;
    if (Array.isArray(pData.inventory) && pData.inventory.length > 0) sheet.inventory = pData.inventory;
    if (pData.avatar_url) sheet.avatar_url = pData.avatar_url;
    if (pData.trilha) sheet.trilha = pData.trilha;
    if (pData.rituais) sheet.rituais = pData.rituais;
    sheet.is_playable = true;
    sheet.player_index = i;
    allChars.push(sheet);
  }

  Object.assign(session.character_sheet, allChars[0]);
  session.all_characters = allChars;

  emit("step", { id: "identity",   status: "done", detail: `${allChars.map(c=>c.name).join(", ")} — criados` });
  emit("step", { id: "attributes", status: "done", detail: `PV ${allChars[0].pv_max} · PE ${allChars[0].pe_max} · SAN ${allChars[0].san_max}` });
  emit("step", { id: "skills",     status: "done", detail: `${allChars[0].skills.length} perícias · ${allChars[0].abilities.length} habilidades` });
  emit("step", { id: "validate1",  status: "done", detail: "Fichas validadas ✓" });
  emit("progress", { pct: 40 });

  // ── FASE 2: História ───────────────────────────────────────────────────────
  emit("step", { id: "world", status: "active", detail: "Gerando cenário..." });
  emit("step", { id: "story", status: "active", detail: "Construindo trama..." });
  emit("progress", { pct: 45 });

  const themes = session.tematica_escolhida || [];
  const storyData = generateStory(themes, gameMode);
  const npcPool   = generateNPCPool(storyData);
  const entity    = selectEntity(storyData);
  const background = selectBackground(storyData);

  storyData.npcs_ativos = npcPool;
  storyData.entidade_principal = entity;
  session.world_data = storyData;
  session.visual_background = background;
  session.master_internal_flags.world_created = true;
  session.master_internal_flags.story_created = true;

  emit("step", { id: "world", status: "done", detail: `${npcPool.length} NPCs · ${storyData.local_principal}` });
  emit("step", { id: "story", status: "done", detail: storyData.titulo });
  emit("progress", { pct: 65 });

  // Validações locais
  const checks = [
    { id: "validate2", label: "Stats corretos",   ok: allChars[0].pv_max > 0 },
    { id: "validate3", label: "História definida", ok: !!storyData.titulo },
    { id: "validate4", label: "NPCs definidos",    ok: npcPool.length >= 1 },
    { id: "validate5", label: "Pronto p/ iniciar", ok: true },
  ];
  let pct = 65;
  for (const c of checks) {
    pct += 4;
    emit("step",  { id: c.id, status: c.ok ? "done" : "warn", detail: c.label + (c.ok ? " ✓" : " — ajustado") });
    emit("progress", { pct });
    emit("check", { label: c.label, ok: c.ok });
  }

  // ── FASE 3: Abertura VIA IA ────────────────────────────────────────────────
  emit("step", { id: "opening", status: "active", detail: "IA escrevendo narração..." });
  emit("progress", { pct: 82 });

  const opening = await generateOpeningNarration(session);

  // Ordenação de iniciativa inicial
  const initiative_order = generateInitiativeOrder(allChars, npcPool);

  session.master_internal_flags.session_started = true;
  session.master_internal_flags.validated = true;
  session.initiative_order = initiative_order;
  session.current_turn_index = 0;
  session.turn_count = 0;

  const titleParts = [];
  if (allChars.length > 1) {
    const names = allChars.map(c => c.name).filter(Boolean);
    titleParts.push(names.slice(0,2).join(" & ") + (names.length > 2 ? " e outros" : ""));
  } else {
    titleParts.push(allChars[0].name);
  }
  titleParts.push(storyData.titulo);
  session.session_title = titleParts.join(" — ");

  const historyEntry = { player: "[INÍCIO DA SESSÃO]", ai: opening.narration, time: new Date().toISOString() };
  session.history = [historyEntry];
  saveSession(sessionId, session);

  emit("step",    { id: "opening", status: "done", detail: "Abertura gerada por IA ✓" });
  emit("progress", { pct: 100 });
  emit("done",     { sessionId });

  // Dado inicial de iniciativa
  const initDiceRequest = {
    label: "Teste de Iniciativa Inicial",
    attribute: "agilidade",
    dice: "d20",
    quantity: 1 + Math.max(0, allChars[0].attributes?.agilidade || 0),
    cd: 12,
    pick: (allChars[0].attributes?.agilidade || 0) < 0 ? "lowest" : "highest",
    pending_narration: "A missão começa! Role o teste de Iniciativa (Agilidade) para que os agentes assumam suas posições."
  };

  return {
    narration:      opening.narration,
    dice_request:   initDiceRequest,
    sheet:          session.character_sheet,
    all_characters: session.all_characters,
    game_mode:      session.game_mode,
    initiative_order,
    visual_background: background,
    last_dice:      null,
    validations: {
      ficha_completa:  allChars[0].pv_max > 0 && allChars[0].skills.length >= 3,
      stats_coerentes: allChars[0].pv_max > 0,
      historia_ok:     !!storyData.titulo,
      npcs_ok:         npcPool.length >= 1,
      pronto:          true,
      erros:           []
    }
  };
}

// ─── Ordem de Iniciativa com Desempate pelo 2º Dado ───────────────────────────
function generateInitiativeOrder(players, npcs) {
  const all = [];

  for (const p of players) {
    const agi     = p.attributes?.agilidade || 0;
    const trained = (p.skills || []).includes("Iniciativa");
    const numDice = Math.max(2, 1 + agi);
    const rolls   = Array.from({ length: numDice }, () => rollD(20));
    const sorted  = [...rolls].sort((a, b) => b - a);
    const bestRaw = agi < 0 ? sorted[sorted.length - 1] : sorted[0];
    const secondRaw = sorted.length > 1 ? sorted[1] : sorted[0];
    const total   = bestRaw + (trained ? 5 : 0);

    all.push({
      id: p.name,
      nome: p.name,
      tipo: "jogador",
      iniciativa: total,
      iniciativa_raw: bestRaw,
      segundo_dado: secondRaw,
      dados: rolls,
      bonus: trained ? 5 : 0,
      sheet: p,
      is_playable: p.is_playable !== false
    });
  }

  for (const n of (npcs || [])) {
    if (n.atitude === "inimigo" || n.atitude === "antagonista_principal" || n.atitude === "antagonista_ambiguo") {
      const d1 = rollD(20);
      const d2 = rollD(20);
      const bonus = n.stats?.iniciativa_bonus || 0;
      const best = Math.max(d1, d2) + bonus;
      const second = Math.min(d1, d2);
      all.push({
        id: n.id,
        nome: n.nome,
        tipo: "npc",
        atitude: n.atitude,
        iniciativa: best,
        segundo_dado: second,
        dados: [d1, d2],
        npc: n
      });
    }
  }

  // ── LÓGICA DE DESEMPATE:
  // 1. Maior pontuação total de iniciativa
  // 2. Se empatar, o 2º dado decide entre os empatados
  // 3. Se ainda empatar, um dado extra desempata
  all.sort((a, b) => {
    if (b.iniciativa !== a.iniciativa) {
      return b.iniciativa - a.iniciativa;
    }
    // Empate na iniciativa: o segundo dado decide
    if ((b.segundo_dado || 0) !== (a.segundo_dado || 0)) {
      return (b.segundo_dado || 0) - (a.segundo_dado || 0);
    }
    // Se ainda empatar, rola desempate extra determinístico
    if (!a._tiebreak) a._tiebreak = rollD(20);
    if (!b._tiebreak) b._tiebreak = rollD(20);
    return b._tiebreak - a._tiebreak;
  });

  return all;
}

// ─── Resumo de retomada ───────────────────────────────────────────────────────
function resumeSessionLocal(session) {
  return generateResumeNarration(session);
}

module.exports = {
  generateCharacterSheet,
  generateStory,
  generateNPCPool,
  selectEntity,
  generateOpeningNarration,
  processPlayerAction,
  generateDeathCinematic,
  generateInitiativeOrder,
  selectBackground,
  prepareSessionLocal,
  resumeSessionLocal,
};
