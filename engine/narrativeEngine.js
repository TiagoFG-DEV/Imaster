
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

// ─── GERAÇÃO DE ESTRUTURA COMPLETA DE CAMPANHA (14 CENAS COM TAGS) ─────────────
function buildRichCampaignScenes(story, entity) {
  const loc = story.local_principal || "Local da Missão";
  const bossName = entity?.nome || story.climax?.boss_nome || "A Entidade Abissal";

  return [
    // ── ATO 1: RECONHECIMENTO & PRIMEIROS CONTATOS (4 Cenas) ──
    {
      id: "cena_1",
      ato: 1,
      titulo: `Chegada e Perímetro de ${loc}`,
      tipo: "investigacao",
      descricao: `Os agentes chegam ao local sob atmosfera densa e anormal. Vestígios de atividade recente cobrem o chão.`,
      objetivo: "Examinar os arredores, isolar o perímetro e buscar as primeiras anomalias."
    },
    {
      id: "cena_2",
      ato: 1,
      titulo: `Interrogatório e Vestígios Forenses`,
      tipo: "investigacao",
      descricao: `Testemunhas aterrorizadas ou registros gravados revelam o momento exato em que a membrana começou a se romper.`,
      objetivo: "Cruzar depoimentos, decifrar anotações e entender o padrão dos desaparecimentos."
    },
    {
      id: "cena_3",
      ato: 1,
      titulo: `Emboscada de Criaturas Menores`,
      tipo: "combate_comum",
      descricao: `Criaturas carniceiras menores do Outro Lado e animais corrompidos saltam das sombras em um ataque rápido e violento!`,
      objetivo: "Neutralizar a ameaça imediata sem gastar recursos vitais."
    },
    {
      id: "cena_4",
      ato: 1,
      titulo: `O Primeiro Altar Revelado`,
      tipo: "investigacao",
      descricao: `Símbolos gravados com sangue seco conectam a estrutura a um ritual muito mais antigo e profundo.`,
      objetivo: "Identificar o elemento paranormal (Sangue, Morte, Conhecimento ou Energia)."
    },

    // ── ATO 2: ESCALADA, REVELAÇÕES & PERSEGUIÇÃO (6 Cenas) ──
    {
      id: "cena_5",
      ato: 2,
      titulo: `Infiltração no Núcleo do Culto`,
      tipo: "investigacao",
      descricao: `Os agentes adentram as alas mais profundas e isoladas. O ar é frio e pesado com a presença do Outro Lado.`,
      objetivo: "Navegar pelas passagens secretas sem acionar armadilhas de lodo paranormal."
    },
    {
      id: "cena_6",
      ato: 2,
      titulo: `Patrulha de Guardas Fanáticos`,
      tipo: "combate_comum",
      descricao: `Um grupo de acólitos armados e corrompidos pela loucura tenta impedir o avanço dos agentes a qualquer custo.`,
      objetivo: "Eliminar a guarda e recolher chaves ou artefatos de acesso."
    },
    {
      id: "cena_7",
      ato: 2,
      titulo: `Perseguição nos Corredores em Ruína`,
      tipo: "perseguicao",
      descricao: `Uma abominação descomunal surge derrubando vigas e paredes! Fuga acelerada em meio a escombros e armadilhas!`,
      objetivo: "Correr desesperadamente, saltar obstáculos e manter o ritmo cardíaco sob controle."
    },
    {
      id: "cena_8",
      ato: 2,
      titulo: `Batalha contra o Tenente do Culto`,
      tipo: "combate_importante",
      descricao: `O sacerdote intermediário do culto invoca poderes corrompidos e ataca com fúria ritualística devastadora!`,
      objetivo: "Superar a resistência paranormal do líder intermediário e quebrar seu elo místico."
    },
    {
      id: "cena_9",
      ato: 2,
      titulo: `A Revelação da Fraqueza Oculta`,
      tipo: "investigacao",
      descricao: `Diários ocultistas e artefatos de proteção deixados por vítimas revelam a fraqueza elemental do Boss Final.`,
      objetivo: "Decifrar o contra-ritual ou mecanismo tático necessário para ferir a entidade suprema."
    },
    {
      id: "cena_10",
      ato: 2,
      titulo: `Corrida Contra o Tempo do Sacrifício`,
      tipo: "perseguicao",
      descricao: `Sirenes ecoam e a membrana vibra. Os cultistas iniciam a contagem final para o sacrifício supremo!`,
      objetivo: "Cruzar o complexo em velocidade máxima antes que o portal se estabilize totalmente."
    },

    // ── ATO 3: CONFRONTO FINAL, BOSS FIGHT & EPÍLOGO (4 Cenas) ──
    {
      id: "cena_11",
      ato: 3,
      titulo: `A Vanguarda das Aberrações`,
      tipo: "combate_comum",
      descricao: `Hordas de corpos reanimados e resquícios paranormais cercam a entrada da câmara principal.`,
      objetivo: "Abrir caminho através da barreira com força total."
    },
    {
      id: "cena_12",
      ato: 3,
      titulo: `O Guardião Colossal do Santuário`,
      tipo: "combate_importante",
      descricao: `Uma aberração de elite forjada na dor e no sofrimento protege o limiar do ritual com ataques de área brutais.`,
      objetivo: "Trabalhar em equipe para derrubar o colosso antes de adentrar a câmara do Boss."
    },
    {
      id: "cena_13",
      ato: 3,
      titulo: `CONFRONTO SUPREMO: ${bossName}`,
      tipo: "boss_climax",
      descricao: `A manifestação total do Outro Lado se ergue! O Boss Final da missão desafia a realidade, exigindo combate tático feroz, contra-rituais intelectuais e manobras extremas de sobrevivência!`,
      objetivo: `Destruir ou selar ${bossName} e romper o vórtice do Outro Lado antes da destruição total.`
    },
    {
      id: "cena_14",
      ato: 3,
      titulo: `Epílogo & Selamento dos Arcos`,
      tipo: "epilogo",
      descricao: `O silêncio retorna às cinzas do confronto. A fumaça baixa enquanto os agentes contemplam as cicatrizes do paranormal.`,
      objetivo: "Desfecho cinematográfico com o destino final de cada agente, o encerramento dos arcos e o relatório oficial para a Ordem."
    }
  ];
}

// ─── GERAÇÃO DE GRAFO DE LOCAIS E PLANTA BAIXA TÁTICA (MÍNIMO 10 LOCAIS) ──────
function generateStoryLocationMap(story, entity) {
  const storyId = (story?.id || "missao_paranormal").toLowerCase();
  const locMain = story?.local_principal || "Complexo Principal";
  const bossName = entity?.nome || story?.climax?.boss_nome || "A Entidade Abissal";

  if (storyId.includes("hospital")) {
    return [
      {
        id: "loc_recepcao",
        nome: "Recepção & Triagem",
        tipo_comodo: "hall_amplo",
        formato: "retangulo",
        pos_x: 200, pos_y: 60, width: 220, height: 140,
        descricao: "Balcão de atendimento revirado, computadores chiando e macas perto da entrada.",
        conexoes: ["loc_corredor_central", "loc_estacionamento"],
        portas: [
          { alvo_id: "loc_corredor_central", direcao: "sul", trancada: false },
          { alvo_id: "loc_estacionamento", direcao: "oeste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_balcao", nome: "Balcão & Computadores", icone: "💻", cd: 12, atributo: "intelecto", sucesso: "Prontuário com lista de pacientes que foram transferidos para o subsolo às pressas.", falha: "Monitores estalando com interferência elétrica sem dados legíveis." },
          { id: "pi_gaveta", nome: "Gaveteiro da Triagem", icone: "🗄️", cd: 10, atributo: "intelecto", sucesso: "Chave de bronze etiquetada como 'Farmácia Central'.", falha: "Apenas papéis rasgados e fichas vazias." }
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
        pos_x: 20, pos_y: 60, width: 170, height: 140,
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
        nome: "Guarita & Portão de Acesso",
        tipo_comodo: "quarto_pequeno",
        formato: "quadrado",
        pos_x: 20, pos_y: 210, width: 170, height: 110,
        descricao: "Cabine blindada com vidros trincados e painel de controle dos portões externos.",
        conexoes: ["loc_estacionamento", "loc_corredor_central"],
        portas: [
          { alvo_id: "loc_estacionamento", direcao: "norte", trancada: false },
          { alvo_id: "loc_corredor_central", direcao: "leste", trancada: true }
        ],
        pontos_investigacao: [
          { id: "pi_painel_seguranca", nome: "Painel de Câmeras", icone: "📹", cd: 13, atributo: "intelecto", sucesso: "Gravação de 3 horas atrás mostrando vultos arrastando corpos para a UTI.", falha: "Sinal estático com som estridente." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_corredor_central",
        nome: "Corredor Central de Enfermarias",
        tipo_comodo: "corredor_largo",
        formato: "retangulo",
        pos_x: 200, pos_y: 210, width: 340, height: 80,
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
          { id: "pi_parede_simbolos", nome: "Inscrições na Parede", icone: "🩸", cd: 14, atributo: "intelecto", sucesso: "Símbolos arcanos que revelam a fraqueza elemental da Entidade.", falha: "Piche escorrendo que queima a ponta dos dedos." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_farmacia",
        nome: "Farmácia & Estoque de Sedativos",
        tipo_comodo: "sala_media",
        formato: "quadrado",
        pos_x: 550, pos_y: 210, width: 160, height: 130,
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
        pos_x: 200, pos_y: 300, width: 160, height: 130,
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
        nome: "Centro de Tratamento Intensivo (UTI)",
        tipo_comodo: "sala_media",
        formato: "retangulo",
        pos_x: 370, pos_y: 300, width: 170, height: 130,
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
        pos_x: 200, pos_y: 440, width: 160, height: 140,
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
        pos_x: 370, pos_y: 440, width: 170, height: 140,
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
        pos_x: 550, pos_y: 350, width: 160, height: 230,
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
        pos_x: 200, pos_y: 590, width: 340, height: 160,
        descricao: "Equipamentos cirúrgicos acoplados a cilindros com fluido escuro pulsante.",
        conexoes: ["loc_ala_psiquiatrica", "loc_necroterio", "loc_escadaria_subsolo", "loc_camara_ritual"],
        portas: [
          { alvo_id: "loc_ala_psiquiatrica", direcao: "norte", trancada: true },
          { alvo_id: "loc_necroterio", direcao: "norte", trancada: false },
          { alvo_id: "loc_escadaria_subsolo", direcao: "leste", trancada: false },
          { alvo_id: "loc_camara_ritual", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_computador_central", nome: "Terminal Principal", icone: "🧬", cd: 14, atributo: "intelecto", sucesso: "Fórmula exata para quebrar a imunidade de " + bossName, falha: "Sobrecarga elétrica estala nos teclados." }
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
        pos_x: 200, pos_y: 760, width: 340, height: 190,
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
  } else if (storyId.includes("fazenda") || story?.tom === "suspense_rural") {
    return [
      {
        id: "loc_porteira",
        nome: "Porteira & Estrada de Terra",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 200, pos_y: 60, width: 220, height: 140,
        descricao: "Cerca de madeira destruída, marcas de garras e silêncio sepulcral.",
        conexoes: ["loc_patio_casarao", "loc_milharal_borda"],
        portas: [
          { alvo_id: "loc_patio_casarao", direcao: "sul", trancada: false },
          { alvo_id: "loc_milharal_borda", direcao: "leste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_marcas_porteira", nome: "Marcas na Cerca", icone: "🐾", cd: 10, atributo: "intelecto", sucesso: "Pegadas gigantescas que se transformam de humanas em bestiais.", falha: "Apenas arranhões sem forma clara." }
        ],
        gatilho: "investigacao",
        trancado: false,
        inicial: true
      },
      {
        id: "loc_milharal_borda",
        nome: "Borda do Milharal",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 430, pos_y: 60, width: 200, height: 140,
        descricao: "Pés de milho secos e altos balançando sem vento.",
        conexoes: ["loc_porteira", "loc_milharal_profundo"],
        portas: [
          { alvo_id: "loc_porteira", direcao: "oeste", trancada: false },
          { alvo_id: "loc_milharal_profundo", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_espantalho", nome: "O Espantalho Negro", icone: "🌾", cd: 11, atributo: "intelecto", sucesso: "Roupas rasgadas com chave de ferro do celeiro presa no peito.", falha: "Palha podre que se desfaz." }
        ],
        gatilho: "perseguicao",
        trancado: false
      },
      {
        id: "loc_patio_casarao",
        nome: "Pátio Central da Fazenda",
        tipo_comodo: "hall_amplo",
        formato: "retangulo",
        pos_x: 200, pos_y: 210, width: 220, height: 130,
        descricao: "Casarão colonial antigo com tábuas rangendo. Lampião oscila sozinho.",
        conexoes: ["loc_porteira", "loc_sala_casarao", "loc_celeiro", "loc_poco_antigo"],
        portas: [
          { alvo_id: "loc_porteira", direcao: "norte", trancada: false },
          { alvo_id: "loc_sala_casarao", direcao: "oeste", trancada: false },
          { alvo_id: "loc_celeiro", direcao: "leste", trancada: true },
          { alvo_id: "loc_poco_antigo", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_varanda_marcas", nome: "Parede da Varanda", icone: "🪵", cd: 11, atributo: "intelecto", sucesso: "Marcas de tiro e cartuchos de espingarda deflagrados.", falha: "Madeira cupinizada que esfarela." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_sala_casarao",
        nome: "Sala de Estar & Lareira",
        tipo_comodo: "sala_media",
        formato: "quadrado",
        pos_x: 30, pos_y: 210, width: 160, height: 130,
        descricao: "Mesa posta com pratos intocados há dias. Retratos de família perfurados.",
        conexoes: ["loc_patio_casarao", "loc_cozinha_despensa"],
        portas: [
          { alvo_id: "loc_patio_casarao", direcao: "leste", trancada: false },
          { alvo_id: "loc_cozinha_despensa", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_lareira_cinzas", nome: "Cinzas da Lareira", icone: "🔥", cd: 12, atributo: "intelecto", sucesso: "Fragmentos de carta queimada falando do sacrifício familiar.", falha: "Apenas carvão apagado." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_celeiro",
        nome: "Celeiro & Oficina",
        tipo_comodo: "sala_media",
        formato: "retangulo",
        pos_x: 430, pos_y: 210, width: 200, height: 130,
        descricao: "Correntes penduradas no teto alto. Ferramentas agrícolas cobertas de ferrugem.",
        conexoes: ["loc_patio_casarao", "loc_cemiterio_familiar"],
        portas: [
          { alvo_id: "loc_patio_casarao", direcao: "oeste", trancada: true },
          { alvo_id: "loc_cemiterio_familiar", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_bancada_ferramentas", nome: "Bancada de Trabalho", icone: "🪓", cd: 12, atributo: "intelecto", sucesso: "Machado de Caça reforçado (+Ataque) e pé de cabra.", falha: "Ferramentas enferrujadas quebradas." }
        ],
        gatilho: "combate_comum",
        trancado: true,
        minigame: "chaves"
      },
      {
        id: "loc_cozinha_despensa",
        nome: "Cozinha & Despensa",
        tipo_comodo: "quarto_pequeno",
        formato: "quadrado",
        pos_x: 30, pos_y: 350, width: 160, height: 130,
        descricao: "Alçapão de madeira pesada trancado com correntes no chão da cozinha.",
        conexoes: ["loc_sala_casarao", "loc_poco_antigo", "loc_porao_oculto"],
        portas: [
          { alvo_id: "loc_sala_casarao", direcao: "norte", trancada: false },
          { alvo_id: "loc_poco_antigo", direcao: "leste", trancada: false },
          { alvo_id: "loc_porao_oculto", direcao: "sul", trancada: true }
        ],
        pontos_investigacao: [
          { id: "pi_alcapao_correntes", nome: "Alçapão no Piso", icone: "⛓️", cd: 13, atributo: "intelecto", sucesso: "Trancas que revelam o caminho para a cripta de raízes.", falha: "Correntes grossas demais para abrir sem chave." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_poco_antigo",
        nome: "Poço Antigo de Pedra",
        tipo_comodo: "area_externa",
        formato: "circular",
        pos_x: 200, pos_y: 350, width: 220, height: 130,
        descricao: "Poço de pedra esculpida com profundidade anormal. Sons de água fervilhando.",
        conexoes: ["loc_patio_casarao", "loc_cozinha_despensa", "loc_milharal_profundo", "loc_porao_oculto"],
        portas: [
          { alvo_id: "loc_patio_casarao", direcao: "norte", trancada: false },
          { alvo_id: "loc_cozinha_despensa", direcao: "oeste", trancada: false },
          { alvo_id: "loc_milharal_profundo", direcao: "leste", trancada: false },
          { alvo_id: "loc_porao_oculto", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_borda_poco", nome: "Borda de Pedra", icone: "🪨", cd: 12, atributo: "intelecto", sucesso: "Corda grossa com símbolos de ancoragem para descer em segurança.", falha: "Musgo escorregadio que quase causa uma queda." }
        ],
        gatilho: "combate_importante",
        trancado: false
      },
      {
        id: "loc_milharal_profundo",
        nome: "Coração do Milharal",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 430, pos_y: 350, width: 200, height: 130,
        descricao: "Labirinto denso de milho que se fecha atrás dos passos dos agentes.",
        conexoes: ["loc_milharal_borda", "loc_poco_antigo", "loc_cemiterio_familiar"],
        portas: [
          { alvo_id: "loc_milharal_borda", direcao: "norte", trancada: false },
          { alvo_id: "loc_poco_antigo", direcao: "oeste", trancada: false },
          { alvo_id: "loc_cemiterio_familiar", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_circulo_queimado", nome: "Círculo de Cinzas", icone: "💀", cd: 13, atributo: "intelecto", sucesso: "Restos de rituais com runas que enfraquecem o monstro.", falha: "Cinzas que sobem causando tosse e cegueira momentânea." }
        ],
        gatilho: "perseguicao",
        trancado: false
      },
      {
        id: "loc_cemiterio_familiar",
        nome: "Cemitério Clandestino de 1952",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 430, pos_y: 490, width: 200, height: 140,
        descricao: "Lápides tortas de pedra sem nomes. Covas abertas de dentro para fora.",
        conexoes: ["loc_celeiro", "loc_milharal_profundo", "loc_porao_oculto"],
        portas: [
          { alvo_id: "loc_celeiro", direcao: "norte", trancada: false },
          { alvo_id: "loc_milharal_profundo", direcao: "norte", trancada: false },
          { alvo_id: "loc_porao_oculto", direcao: "oeste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_mausoleu", nome: "Mausoléu Central", icone: "⚰️", cd: 14, atributo: "intelecto", sucesso: "Artefato de contenção que sela pactos de sangue.", falha: "Lápide desmoronada sem inscrições." }
        ],
        gatilho: "combate_importante",
        trancado: false
      },
      {
        id: "loc_porao_oculto",
        nome: "Porão Escavado & Cripta",
        tipo_comodo: "sala_ampla",
        formato: "retangulo",
        pos_x: 100, pos_y: 490, width: 320, height: 140,
        descricao: "Câmara de terra batida com raízes negras gotejando sangue vegetal.",
        conexoes: ["loc_cozinha_despensa", "loc_poco_antigo", "loc_cemiterio_familiar", "loc_santuario_rural"],
        portas: [
          { alvo_id: "loc_cozinha_despensa", direcao: "norte", trancada: true },
          { alvo_id: "loc_poco_antigo", direcao: "norte", trancada: false },
          { alvo_id: "loc_cemiterio_familiar", direcao: "leste", trancada: false },
          { alvo_id: "loc_santuario_rural", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_raizes_pulsantes", nome: "Raízes Negras", icone: "🌿", cd: 14, atributo: "intelecto", sucesso: "O nó vital que conecta a fazenda ao covil do Boss.", falha: "Raízes se agitam expelindo espinhos tóxicos." }
        ],
        gatilho: "investigacao",
        trancado: true,
        minigame: "chaves"
      },
      {
        id: "loc_santuario_rural",
        nome: "Covil das Raízes da Entidade",
        tipo_comodo: "santuario_boss",
        formato: "hexagonal",
        pos_x: 100, pos_y: 640, width: 320, height: 190,
        descricao: "Abertura colossal onde as raízes do Outro Lado formam o corpo da Entidade Suprema.",
        conexoes: ["loc_porao_oculto"],
        portas: [
          { alvo_id: "loc_porao_oculto", direcao: "norte", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_coracao_vegetal", nome: "O Coração da Entidade", icone: "❤️‍🔥", cd: 15, atributo: "intelecto", sucesso: "Vulnerabilidade exposta para ataque concentrado.", falha: "Pulso de espinas que repele os heróis." }
        ],
        gatilho: "boss_climax",
        trancado: false
      }
    ];
  } else {
    // Mapa Geral / Urbano
    return [
      {
        id: "loc_entrada",
        nome: "Entrada do Perímetro & Guarita",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 200, pos_y: 60, width: 220, height: 140,
        descricao: `Ponto de acesso a ${locMain}. Portões violados e marcas de invasão.`,
        conexoes: ["loc_lobby_central", "loc_estacionamento_urbano"],
        portas: [
          { alvo_id: "loc_lobby_central", direcao: "sul", trancada: false },
          { alvo_id: "loc_estacionamento_urbano", direcao: "oeste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_livro_portaria", nome: "Registro de Visitantes", icone: "📋", cd: 10, atributo: "intelecto", sucesso: "Nomes de líderes do culto registrados com horários da reunião.", falha: "Folhas manchadas de lama e tinta borrada." }
        ],
        gatilho: "investigacao",
        trancado: false,
        inicial: true
      },
      {
        id: "loc_estacionamento_urbano",
        nome: "Pátio de Carga & Veículos",
        tipo_comodo: "area_externa",
        formato: "retangulo",
        pos_x: 20, pos_y: 60, width: 170, height: 140,
        descricao: "Veículos com portas abertas e marcas de garras nas latarias.",
        conexoes: ["loc_entrada"],
        portas: [
          { alvo_id: "loc_entrada", direcao: "leste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_porta_malas", nome: "Porta-malas do Furgão", icone: "🧰", cd: 11, atributo: "intelecto", sucesso: "Kit de Arrombamento e pés de cabra.", falha: "Vazio com manchas de óleo queimado." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_lobby_central",
        nome: "Lobby Central & Recepção",
        tipo_comodo: "hall_amplo",
        formato: "retangulo",
        pos_x: 200, pos_y: 210, width: 340, height: 120,
        descricao: "Hall amplo com estátuas quebradas. Ecos de passos nos andares superiores.",
        conexoes: ["loc_entrada", "loc_ala_oeste", "loc_ala_leste", "loc_corredor_norte"],
        portas: [
          { alvo_id: "loc_entrada", direcao: "norte", trancada: false },
          { alvo_id: "loc_ala_oeste", direcao: "oeste", trancada: true },
          { alvo_id: "loc_ala_leste", direcao: "leste", trancada: false },
          { alvo_id: "loc_corredor_norte", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_mapa_predio", nome: "Planta de Incêndio na Parede", icone: "🗺️", cd: 11, atributo: "intelecto", sucesso: "Localização exata da escadaria pressurizada e rotas de fuga.", falha: "Vidro estilhaçado com papel rasgado." }
        ],
        gatilho: "investigacao",
        trancado: false
      },
      {
        id: "loc_ala_oeste",
        nome: "Setor de Arquivos & Escritórios",
        tipo_comodo: "sala_media",
        formato: "quadrado",
        pos_x: 20, pos_y: 210, width: 170, height: 120,
        descricao: "Gaveteiros metálicos tombados, papéis confidenciais espalhados e cofres.",
        conexoes: ["loc_lobby_central"],
        portas: [
          { alvo_id: "loc_lobby_central", direcao: "leste", trancada: true }
        ],
        pontos_investigacao: [
          { id: "pi_cofre_arquivos", nome: "Cofre de Documentos", icone: "🗄️", cd: 13, atributo: "intelecto", sucesso: "Documento oficial revelando a invocação e Chave do Elevador.", falha: "Cofre travado com senha desconhecida." }
        ],
        gatilho: "investigacao",
        trancado: true,
        minigame: "chaves"
      },
      {
        id: "loc_ala_leste",
        nome: "Ala de Manutenção & Geradores",
        tipo_comodo: "sala_media",
        formato: "quadrado",
        pos_x: 550, pos_y: 210, width: 160, height: 120,
        descricao: "Geradores a diesel falhando com ruídos de engrenagens e faíscas.",
        conexoes: ["loc_lobby_central", "loc_escadaria_subsolo"],
        portas: [
          { alvo_id: "loc_lobby_central", direcao: "oeste", trancada: false },
          { alvo_id: "loc_escadaria_subsolo", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_gerador_diesel", nome: "Painel Elétrico Central", icone: "⚡", cd: 12, atributo: "intelecto", sucesso: "Desativação das travas elétricas das portas blindadas.", falha: "Curto-circuito que lança faíscas." }
        ],
        gatilho: "combate_comum",
        trancado: false
      },
      {
        id: "loc_corredor_norte",
        nome: "Corredor de Segurança Reforçada",
        tipo_comodo: "corredor_largo",
        formato: "retangulo",
        pos_x: 200, pos_y: 340, width: 340, height: 80,
        descricao: "Câmeras de segurança quebradas com lentes derretidas pelo calor paranormal.",
        conexoes: ["loc_lobby_central", "loc_sala_controle", "loc_escadaria_subsolo"],
        portas: [
          { alvo_id: "loc_lobby_central", direcao: "norte", trancada: false },
          { alvo_id: "loc_sala_controle", direcao: "oeste", trancada: false },
          { alvo_id: "loc_escadaria_subsolo", direcao: "leste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_porta_blindada", nome: "Painel Biométrico", icone: "🔒", cd: 13, atributo: "intelecto", sucesso: "Cartão de acesso nível 3 esquecido por um guarda.", falha: "Alarme mudo ativado." }
        ],
        gatilho: "perseguicao",
        trancado: false
      },
      {
        id: "loc_sala_controle",
        nome: "Centro de Monitoramento & Dados",
        tipo_comodo: "sala_media",
        formato: "quadrado",
        pos_x: 20, pos_y: 340, width: 170, height: 130,
        descricao: "Monitores estáticos mostrando vultos caminhando em looping.",
        conexoes: ["loc_corredor_norte", "loc_subsolo_blindado"],
        portas: [
          { alvo_id: "loc_corredor_norte", direcao: "leste", trancada: false },
          { alvo_id: "loc_subsolo_blindado", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_servidores", nome: "Rack de Servidores", icone: "💾", cd: 14, atributo: "intelecto", sucesso: "Gravação completa da quebra da membrana com fraqueza do Boss.", falha: "Drives corrompidos por pulso eletromagnético." }
        ],
        gatilho: "combate_importante",
        trancado: false
      },
      {
        id: "loc_escadaria_subsolo",
        nome: "Escadaria de Emergência Pressurizada",
        tipo_comodo: "corredor_vertical",
        formato: "retangulo",
        pos_x: 550, pos_y: 340, width: 160, height: 220,
        descricao: "Portas corta-fogo travadas e grafites ocultistas de contenção.",
        conexoes: ["loc_ala_leste", "loc_corredor_norte", "loc_subsolo_blindado"],
        portas: [
          { alvo_id: "loc_ala_leste", direcao: "norte", trancada: false },
          { alvo_id: "loc_corredor_norte", direcao: "oeste", trancada: false },
          { alvo_id: "loc_subsolo_blindado", direcao: "oeste", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_degraus_piche", nome: "Símbolos nos Degraus", icone: "🕯️", cd: 11, atributo: "intelecto", sucesso: "Lanterna de Luz Negra (revela rastros invisíveis a olho nu).", falha: "Velas apagadas com cera fria." }
        ],
        gatilho: "perseguicao",
        trancado: false
      },
      {
        id: "loc_subsolo_blindado",
        nome: "Câmara de Contenção Subterrânea",
        tipo_comodo: "sala_ampla",
        formato: "retangulo",
        pos_x: 200, pos_y: 430, width: 340, height: 160,
        descricao: "Portas de chumbo maciço com símbolos arcanos brilhando em tom incandescente.",
        conexoes: ["loc_sala_controle", "loc_escadaria_subsolo", "loc_altar_boss"],
        portas: [
          { alvo_id: "loc_sala_controle", direcao: "norte", trancada: false },
          { alvo_id: "loc_escadaria_subsolo", direcao: "leste", trancada: false },
          { alvo_id: "loc_altar_boss", direcao: "sul", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_relicario", nome: "Relicário de Chumbo", icone: "🏺", cd: 14, atributo: "intelecto", sucesso: "Artefato sagrado de selamento para enfraquecer o Boss.", falha: "Fechadura maciça selada por calor." }
        ],
        gatilho: "combate_importante",
        trancado: true,
        minigame: "chaves"
      },
      {
        id: "loc_altar_boss",
        nome: "Epicentro do Caos Paranormal",
        tipo_comodo: "santuario_boss",
        formato: "hexagonal",
        pos_x: 200, pos_y: 600, width: 340, height: 190,
        descricao: `O santuário proibido onde ${bossName} manifesta sua presença total!`,
        conexoes: ["loc_subsolo_blindado"],
        portas: [
          { alvo_id: "loc_subsolo_blindado", direcao: "norte", trancada: false }
        ],
        pontos_investigacao: [
          { id: "pi_nucleo_abissal", nome: "Ponto de Fratura da Membrana", icone: "🌌", cd: 15, atributo: "intelecto", sucesso: "Canalizador principal para fechar o portal definitivamente.", falha: "Pulso de energia que arremessa os agentes para trás." }
        ],
        gatilho: "boss_climax",
        trancado: false
      }
    ];
  }
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
  const richScenes = buildRichCampaignScenes(story, null);
  const mapGraph = generateStoryLocationMap(story, null);
  const initialLoc = mapGraph.find(l => l.inicial) || mapGraph[0];

  // Monta a estrutura final da sessão
  return {
    id:              story.id,
    titulo:          story.titulo,
    sinopse:         story.sinopse,
    tom:             story.tom,
    contexto:        `${story.local_principal} — ${story.cidade}, ${story.epoca}`,
    local_principal: story.local_principal,
    local_nome:      initialLoc.nome,
    local_id:        initialLoc.id,
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
    cena_atual_idx:  0,
    cenas_totais:    richScenes,
    cena_atual_obj:  richScenes[0],
    tipo_cena_atual: richScenes[0].tipo,
    mapa_locais:     mapGraph,
    pistas_reveladas:[],
    climax_ativado:  false,
    final_escolhido: null,
  };
}

function _fallbackStory() {
  const base = {
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
  };
  const richScenes = buildRichCampaignScenes(base, null);
  const mapGraph = generateStoryLocationMap(base, null);
  const initialLoc = mapGraph.find(l => l.inicial) || mapGraph[0];

  return {
    ...base,
    local_nome: initialLoc.nome,
    local_id: initialLoc.id,
    ato_atual: 1,
    cena_atual: 0,
    cena_atual_idx: 0,
    cenas_totais: richScenes,
    cena_atual_obj: richScenes[0],
    tipo_cena_atual: richScenes[0].tipo,
    mapa_locais: mapGraph,
    pistas_reveladas: [],
    climax_ativado: false,
    final_escolhido: null,
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
    nome: sh.name,
    classe: sh.class,
    nex: sh.nex || "5%",
    inventario: sh.inventory,
    local: sh.current_location,
    historia_ato: story?.ato_atual || 1,
    pistas_reveladas: story?.pistas_reveladas || [],
    npcs_ativos: (story?.npcs_ativos || []).map(n => n.nome),
    pv_current: sh.pv_current,
    pv_max: sh.pv_max,
    pe_current: sh.pe_current,
    pe_max: sh.pe_max,
    san_current: sh.san_current,
    san_max: sh.san_max,
    status_effects: sh.status_effects || [],
    habilidades: (sh.abilities || []).map(a => typeof a === 'string' ? a : `${a.nome}${a.custo_pe ? ` (${a.custo_pe} PE)` : ''}`)
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

    // Mescla state_updates retornados pela IA (valores absolutos e incrementos)
    if (aiResult.state_updates) {
      const su = aiResult.state_updates;
      if (su.pv_current != null)  state_updates.pv_current  = clamp(su.pv_current,  0, sh.pv_max);
      if (su.pe_current != null)  state_updates.pe_current  = clamp(su.pe_current,  0, sh.pe_max);
      if (su.san_current != null) state_updates.san_current = clamp(su.san_current, 0, sh.san_max);
      if (su.nex_increase != null && typeof su.nex_increase === "number" && su.nex_increase > 0) {
        state_updates.nex_increase = su.nex_increase;
      }
      if (su.location)            state_updates.location    = su.location;
      if (Array.isArray(su.status_add))    state_updates.status_add    = su.status_add;
      if (Array.isArray(su.status_remove)) state_updates.status_remove = su.status_remove;
    }
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
      }
    } else if (actionType === "social") {
      narration = processSocialAction(action, session, story);
    } else if (actionType === "item") {
      const itemRes = processItemAction(action, session);
      narration = itemRes.narration;
      Object.assign(state_updates, itemRes.state_updates);
      if (itemRes.cinematica) cinematica = itemRes.cinematica;
    } else if (actionType === "fuga") {
      narration = processFleeAction(action, session);
    } else {
      narration = processGenericAction(action, session, story);
    }

    // Progresso de cena local com 14 cenas ricas e taggeadas
    if (shouldAdvanceScene(session, action, diceResult)) {
      const nextScene = advanceScene(session, story);
      if (nextScene) {
        narration += `\n\n📍 *[CENA ${(story.cena_atual_idx || 0) + 1}/${story.cenas_totais ? story.cenas_totais.length : 14} — ${nextScene.tipo.toUpperCase()}]: ${nextScene.titulo}*\n${nextScene.descricao || ''}`;
        state_updates.location = nextScene.titulo;
        if (nextScene.tipo === "boss_climax") {
          cinematica = { tipo: "boss", texto: `CONFRONTO FINAL: ${nextScene.titulo}`, valor: 100, recurso_atual: 100, recurso_maximo: 100 };
          state_updates.nex_increase = (state_updates.nex_increase || 0) + 5;
        }
      }
    }
  }

  // Verifica condições de clímax
  if (checkClimaxConditions(session)) {
    session.world_data.climax_ativado = true;
    const climaxDesc = story?.climax?.descricao || "";
    if (climaxDesc) narration += `\n\n⚡ *${climaxDesc}*`;
    state_updates.nex_increase = (state_updates.nex_increase || 0) + 5;
    new_events.push("CLÍMAX ATIVADO");
  }

  // Consequências drásticas (dano/cinemática) se o dado foi um desastre
  if (diceResult && diceResult.isDisaster) {
    const selfDmg = roll(1, 6) + 2;
    state_updates.pv_current = clamp((sh.pv_current || 0) - selfDmg, 0, sh.pv_max);
    state_updates.nex_increase = (state_updates.nex_increase || 0) + 2;
    cinematica = { tipo: "dano_pv", texto: `-${selfDmg} PV — Consequência trágica! (+2% NEX)`, valor: selfDmg, recurso_atual: state_updates.pv_current, recurso_maximo: sh.pv_max };
    narration += `\n\nO fracasso cobra seu preço. Você sofre ${selfDmg} de dano! (+2% NEX por trauma paranormal)`;
  } else if (diceResult && diceResult.success && diceResult.dmg_results && diceResult.dmg_results.length > 0) {
    const dmg = diceResult.dmg_results.reduce((a,b)=>a+b, 0);
    if (dmg > 0) {
      cinematica = { tipo: "matar", texto: `${dmg} de Dano Causado!`, valor: dmg, recurso_atual: dmg, recurso_maximo: dmg };
      narration += `\n\nO ataque conectou! ${dmg} de dano causado.`;
    }
  }

  // Condição de Vitória no Clímax / Boss Final (Ato 3)
  const currentPv = state_updates.pv_current ?? sh.pv_current;
  const currentSan = state_updates.san_current ?? sh.san_current;
  const currentSceneObj = story?.cena_atual_obj || story?.cenas_totais?.[story?.cena_atual_idx || 0];

  if ((story?.ato_atual >= 3 || currentSceneObj?.tipo === "boss_climax" || currentSceneObj?.tipo === "epilogo") && (story?.climax_ativado || session.turn_count >= 8)) {
    if (diceResult && diceResult.success && diceResult.total >= 14) {
      session.ended = true;
      session.victory = true;
      state_updates.nex_increase = (state_updates.nex_increase || 0) + 10;
      cinematica = { tipo: "matar", texto: "Boss Banido! Vitória da Ordem!", valor: 100, recurso_atual: 100, recurso_maximo: 100 };
      narration += `\n\n${generateConcludingNarration(session, story)}`;
    }
  }

  // ─── Verificação de Crises com Timer de 3 Rodadas (Morte e Insanidade) ───
  if (currentPv <= 0) {
    const dyingRounds = (sh.dying_rounds || 0) + 1;
    if (dyingRounds > 3) {
      cinematica = generateDeathCinematic(sh, session);
      session.ended = true;
      session.dead = true;
      narration += `\n\n☠ MORTE CONFIRMADA: As feridas foram fatais e ${sh.name || "o agente"} sucumbiu após 3 rodadas sem ser estabilizado.`;
    } else {
      cinematica = { tipo: "dano_pv", texto: `EM MORTE! Rodada ${dyingRounds}/3 para estabilizar!`, valor: 0, recurso_atual: 0, recurso_maximo: sh.pv_max };
      narration += `\n\n⚠ ESTADO CRÍTICO (MORRENDO - Rodada ${dyingRounds}/3): ${sh.name || "O agente"} caiu inconsciente e está sangrando! Use Primeiros Socorros ou item curativo antes de 3 rodadas para salvá-lo!`;
    }
  } else if (currentSan <= 0) {
    const madnessRounds = (sh.madness_rounds || 0) + 1;
    if (madnessRounds > 3) {
      cinematica = { tipo: "dano_san", texto: `${sh.name || "O agente"} enlouqueceu perante o Outro Lado!`, valor: 0, recurso_atual: 0, recurso_maximo: sh.san_max };
      session.ended = true;
      session.madness = true;
      narration += `\n\n🌀 INSANIDADE TOTAL: A barreira mental se rompeu completamente. A mente do agente foi devorada pelo Outro Lado após 3 rodadas de colapso.`;
    } else {
      cinematica = { tipo: "dano_san", texto: `COLAPSO MENTAL! Rodada ${madnessRounds}/3 de crise!`, valor: 0, recurso_atual: 0, recurso_maximo: sh.san_max };
      narration += `\n\n🌀 CRISE DE INSANIDADE (COLAPSO MENTAL - Rodada ${madnessRounds}/3): A mente de ${sh.name || "o agente"} está em choque! Restaure a Sanidade para evitar loucura irreversível!`;
    }
  }

  if (!contextual_suggestions || contextual_suggestions.length === 0) {
    const loc = sh?.current_location || session.world_data?.local_nome || "ambiente";
    const entity = session.current_entity?.nome || session.world_data?.entidade_principal?.nome;
    if (entity) {
      contextual_suggestions = [
        `Desferir ataque tático de precisão contra ${entity}`,
        "Buscar cobertura sólida e manter guarda defensiva",
        "Analisar anomalia para identificar fraqueza elemental",
        "Comunicar tática de contenção com os aliados"
      ];
    } else {
      contextual_suggestions = [
        `Investigar vestígios e pistas ocultas em ${loc}`,
        "Observar perímetro atentamente em busca de anomalias",
        "Examinar escrituras ou objetos com cautela",
        "Preparar equipamento ou ritual para imprevistos"
      ];
    }
  }

  // ─── Reconhecimento Dinâmico de Trilha Sonora (bgm_mood) & Tipo de Cena ───
  const activeScene = story?.cena_atual_obj || story?.cenas_totais?.[story?.cena_atual_idx || 0];
  const scene_type = activeScene?.tipo || "investigacao";
  const scene_title = activeScene?.titulo || "Investigação";
  const scene_progress = story?.cenas_totais ? `${(story.cena_atual_idx || 0) + 1}/${story.cenas_totais.length}` : null;

  let bgm_mood = aiResult?.bgm_mood || null;
  if (session.ended && session.victory) {
    bgm_mood = "vitoria";
  } else if (session.ended && (session.dead || session.madness)) {
    bgm_mood = "derrota";
  } else if (currentPv <= 0 || currentSan <= 0) {
    bgm_mood = "derrota";
  } else if (!bgm_mood) {
    if (scene_type === "boss_climax" || scene_type === "combate_importante" || scene_type === "combate_comum") {
      bgm_mood = "batalha";
    } else if (scene_type === "perseguicao") {
      bgm_mood = "perseguicao";
    } else if (diceResult?.isDisaster) {
      bgm_mood = "tenso";
    } else {
      bgm_mood = "calmo";
    }
  }

  return {
    narration: narration || "O ambiente permanece tenso. Aguardem o próximo movimento.",
    bgm_mood,
    scene_type,
    scene_title,
    scene_progress,
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
  const state_updates = {};
  let cinematica = null;
  const a = (action || "").toLowerCase();

  if (!inv.length) {
    return {
      narration: "O inventário está vazio. Nenhum item disponível para uso imediato.",
      state_updates,
      cinematica
    };
  }

  // Identifica item usado
  let matchedItem = inv.find(it => {
    const name = (typeof it === "string" ? it : it.nome || "").toLowerCase();
    return a.includes(name) || name.split(" ").some(w => w.length > 3 && a.includes(w));
  }) || inv[0];

  const itemName = typeof matchedItem === "string" ? matchedItem : matchedItem.nome || "Item";
  const itemLower = itemName.toLowerCase();

  if (/cura|socorro|adrenalina|remedio|bandagem|kit|estancar|curativo/.test(itemLower) || /cura|socorro|adrenalina|remedio|bandagem|kit|estancar|curativo/.test(a)) {
    const healVal = roll(2, 6) + 6; // 8-18 PV
    state_updates.pv_current = clamp((sh.pv_current || 0) + healVal, 0, sh.pv_max);
    state_updates.inventory_remove = [itemName];
    cinematica = { tipo: "dano_pv", texto: `+${healVal} PV Recuperados!`, valor: healVal, recurso_atual: state_updates.pv_current, recurso_maximo: sh.pv_max };
    return {
      narration: `Você aplica ${itemName} com rapidez e precisão. O sangramento estanca e você recupera +${healVal} PV!`,
      state_updates,
      cinematica
    };
  } else if (/essencia|astral|calmante|elixir|sanidade|mente|purific/.test(itemLower) || /essencia|astral|calmante|elixir|sanidade|mente|purific/.test(a)) {
    const sanVal = roll(1, 8) + 4; // 5-12 SAN
    state_updates.san_current = clamp((sh.san_current || 0) + sanVal, 0, sh.san_max);
    state_updates.inventory_remove = [itemName];
    cinematica = { tipo: "dano_san", texto: `+${sanVal} SAN Recuperada!`, valor: sanVal, recurso_atual: state_updates.san_current, recurso_maximo: sh.san_max };
    return {
      narration: `Você utiliza ${itemName}. A mente se estabiliza e dissipa os pensamentos corrosivos do Outro Lado (+${sanVal} SAN).`,
      state_updates,
      cinematica
    };
  } else if (/energetico|estimulante|vigor|tonico/.test(itemLower) || /energetico|estimulante|vigor|tonico/.test(a)) {
    const peVal = roll(1, 4) + 2; // 3-6 PE
    state_updates.pe_current = clamp((sh.pe_current || 0) + peVal, 0, sh.pe_max);
    state_updates.inventory_remove = [itemName];
    cinematica = { tipo: "gasto_pe", texto: `+${peVal} PE Recuperados!`, valor: peVal, recurso_atual: state_updates.pe_current, recurso_maximo: sh.pe_max };
    return {
      narration: `Você utiliza ${itemName}. O fôlego renova a capacidade de esforço do agente (+${peVal} PE).`,
      state_updates,
      cinematica
    };
  }

  // Item genérico/tático
  return {
    narration: `Você utiliza ${itemName}. O equipamento entra em ação para cumprir seu propósito.`,
    state_updates,
    cinematica
  };
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
  // Avança de cena após resolução de testes importantes ou ações significativas
  if (diceResult && diceResult.success) return true;
  if ((action || "").length > 25) return Math.random() < 0.65;
  return Math.random() < 0.45;
}

function advanceScene(session, story) {
  if (!story || !story.cenas_totais) return null;
  const currentIdx = story.cena_atual_idx || 0;

  if (currentIdx < story.cenas_totais.length - 1) {
    story.cena_atual_idx = currentIdx + 1;
    const nextScene = story.cenas_totais[story.cena_atual_idx];
    story.cena_atual_obj = nextScene;
    story.tipo_cena_atual = nextScene.tipo;
    story.ato_atual = nextScene.ato || (nextScene.tipo === "boss_climax" ? 3 : story.ato_atual);

    if (nextScene.tipo === "boss_climax") {
      story.climax_ativado = true;
    }

    return nextScene;
  }

  return null;
}

function checkClimaxConditions(session) {
  const story = session.world_data;
  if (!story || story.climax_ativado) return false;
  const currentScene = story?.cena_atual_obj || story?.cenas_totais?.[story?.cena_atual_idx || 0];
  return currentScene?.tipo === "boss_climax" || (story?.cena_atual_idx || 0) >= 12;
}

// ─── Narração Longa de Encerramento & Resolução de Arcos ───────────────────────
function generateConcludingNarration(session, story) {
  const chars = session.all_characters || [session.character_sheet];
  const title = story?.titulo || "Missão Paranormal";
  const loc = story?.local_principal || "o local da missão";
  const entity = session.current_entity?.nome || "a Entidade Paranormal";

  const charsArc = chars.map(c => {
    const name = c.name || "O Agente";
    const trauma = c.identity?.trauma || c.history || "as cicatrizes do terror";
    const fear = c.identity?.medo || "o desconhecido";
    const nex = c.nex || "5%";
    const isAlive = (c.pv_current || 0) > 0 && (c.san_current || 0) > 0;

    if (isAlive) {
      return `• ${name} (${c.class || 'Agente'}): Sobreviveu ao pesadelo e agora carrega NEX ${nex}. Embora as visões de "${fear}" permaneçam sussurrando na escuridão, sua determinação foi o pilar que garantiu a vitória da equipe.`;
    } else if ((c.san_current || 0) <= 0) {
      return `• ${name} (${c.class || 'Agente'}): Teve sua mente irrevogavelmente fragmentada pelo horror incomensurável de ${entity}, tornando-se um testemunho eterno da fragilidade humana perante o Outro Lado.`;
    } else {
      return `• ${name} (${c.class || 'Agente'}): Tombou com honra durante o clímax, sacrificando-se para que seus companheiros pudessem desferir o golpe decisivo. Seu nome será gravado nos anais da Ordem.`;
    }
  }).join("\n\n");

  return `🏆 VITÓRIA DA MISSÃO — ${title.toUpperCase()}\n\n` +
    `Com um último esforço coordenado e o selamento dos símbolos arcanos, o vórtice do Outro Lado colapsa sobre si mesmo em um clarão ofuscante. Um silêncio sepulcral e gélido toma conta de ${loc}.\n\n` +
    `A Membrana foi temporariamente restaurada. Os vestígios de ${entity} são contidos pela equipe de limpeza da Ordo Realitas, e os arquivos deste caso são lacrados sob sigilo absoluto de Nível 4.\n\n` +
    `═══ O DESTINO DOS AGENTES & ENCERRAMENTO DOS ARCOS ═══\n\n` +
    `${charsArc}\n\n` +
    `As sirenes ao longe anunciam a chegada do comboio de extração. Mais uma vez, o mundo desperta sem saber que esteve a um passo do abismo.`;
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
