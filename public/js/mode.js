// mode.js v6 — Hub Unificado de Criação de Jogo com 100% de Customização de Personagens

const CLASS_OPTIONS = ["Combatente", "Especialista", "Ocultista", "Comum"];

const TRILHAS_BY_CLASS = {
  Combatente: [
    { nome: "Guerreiro", desc: "Críticos brutais e contra-ataques devastadores corpo a corpo" },
    { nome: "Aniquilador", desc: "Afinidade letal com uma arma favorita de alto calibre/dano" },
    { nome: "Operações Especiais", desc: "Ações adicionais por turno e máxima agilidade tática" },
    { nome: "Tropa de Choque", desc: "Alta absorção de impacto, escudo balístico e proteção de aliados" },
    { nome: "Comandante de Campo", desc: "Ordens táticas e liderança que potencializam os aliados" }
  ],
  Especialista: [
    { nome: "Atirador de Elite", desc: "Precisão mortal com armas de fogo e disparos à longa distância" },
    { nome: "Infiltrador", desc: "Furtividade quase invisível e Ataque Furtivo de surpresa" },
    { nome: "Médico de Campo", desc: "Cura avançada de PV, suporte vital e estabilização de trauma" },
    { nome: "Negociador", desc: "Persuasão irresistível e manipulação psicológica de NPCs" },
    { nome: "Técnico", desc: "Engenhocas, drones, gadgets e capacidade de carga expandida" }
  ],
  Ocultista: [
    { nome: "Graduado", desc: "Grimório com rituais adicionais e maior facilidade em conjurar" },
    { nome: "Conduíte", desc: "Amplia alcance dos feitiços e conjura rituais como ação rápida" },
    { nome: "Flagelador", desc: "Usa o próprio sangue/PV como sacrifício de esforço arcano" },
    { nome: "Intuitivo", desc: "Altíssima resistência mental e percepção espiritual aguçada" },
    { nome: "Lâmina Paranormal", desc: "Combate marcial canalizando poder ritualístico na arma" }
  ],
  Comum: [
    { nome: "Sobrevivente Urbano", desc: "Instinto de sobrevivência pura e improvisação com sucata" },
    { nome: "Trabalhador Calejado", desc: "Resistência extrema ao cansaço, venenos e esforço físico" },
    { nome: "Investigador Autônomo", desc: "Dedução empírica, faro para pistas e contatos nas ruas" }
  ]
};

const ALL_ORIGINS = [
  { nome: "Investigador", desc: "Detetive analítico e perspicaz. +5 em Investigação e Percepção." },
  { nome: "Policial", desc: "Treinamento tático e de armas da lei. +5 em Pontaria e Tática." },
  { nome: "Médico", desc: "Conhecimento de anatomia e cirurgia. +5 em Medicina e Primeiros Socorros." },
  { nome: "Acadêmico", desc: "Pesquisador dedicado e bibliófilo. +5 em Ciências e Investigação." },
  { nome: "Atleta", desc: "Condicionamento físico de ponta. +5 em Atletismo e Acrobacia." },
  { nome: "Militar", desc: "Disciplina militar e tiro de combate. +5 em Pontaria e Iniciativa." },
  { nome: "Técnico de TI", desc: "Hacker e perito em sistemas digitais. +5 em Tecnologia e Tática." },
  { nome: "Cultista Arrependido", desc: "Fugitivo de seitas ocultas. +5 em Ocultismo e Religião." },
  { nome: "Sobrevivente", desc: "Resistente a horrores e isolamento. +5 em Sobrevivência e Vontade." },
  { nome: "Criminoso", desc: "Manha das ruas e conexões ilícitas. +5 em Crime e Furtividade." },
  { nome: "Amnésico", desc: "Passado apagado pelo paranormal. +5 em Intuição e Vontade." },
  { nome: "Artista", desc: "Sensibilidade estética e empatia. +5 em Artes e Diplomacia." },
  { nome: "Chef de Cozinha", desc: "Sentidos apurados e preparo de tônicos. +5 em Profissão e Fortitude." },
  { nome: "Executivo", desc: "Liderança corporativa e influência. +5 em Diplomacia e Enganação." },
  { nome: "Lutador Marcial", desc: "Mestre em artes marciais e reflexos. +5 em Luta e Reflexos." },
  { nome: "Mercenário", desc: "Soldado de aluguel calejado sob fogo. +5 em Pontaria e Iniciativa." },
  { nome: "Operário", desc: "Trabalhador braçal com grande vigor. +5 em Fortitude e Atletismo." },
  { nome: "Religioso", desc: "Fé inabalável contra as trevas. +5 em Religião e Vontade." },
  { nome: "Servidor Público", desc: "Burocracia, leis e contatos oficiais. +5 em Atualidades e Diplomacia." },
  { nome: "Teórico da Conspiração", desc: "Paranoico investigativo e desconfiado. +5 em Investigação e Ocultismo." },
  { nome: "Vítima do Sobrenatural", desc: "Marcado pelo encontro com o Outro Lado. +5 em Vontade e Reflexos." },
  { nome: "Personalizada", desc: "Defina sua própria origem e história sob medida." }
];

const ALL_SKILLS = [
  "Acrobacia", "Adestramento", "Artes", "Atletismo", "Atualidades",
  "Ciências", "Crime", "Diplomacia", "Enganação", "Fortitude",
  "Furtividade", "Iniciativa", "Intimidação", "Intuição", "Investigação",
  "Luta", "Medicina", "Ocultismo", "Percepção", "Pilotagem",
  "Pontaria", "Profissão", "Reflexos", "Religião", "Sobrevivência",
  "Tática", "Tecnologia", "Vontade"
];

const CLASS_BASES = {
  combatente:  { pv: 20, pe: 2, san: 12, skills_default: ["Luta", "Pontaria", "Fortitude", "Reflexos", "Iniciativa"] },
  especialista:{ pv: 16, pe: 3, san: 16, skills_default: ["Investigação", "Percepção", "Furtividade", "Tecnologia", "Intuição", "Pontaria"] },
  ocultista:   { pv: 12, pe: 4, san: 20, skills_default: ["Ocultismo", "Religião", "Vontade", "Investigação", "Intuição"] },
  comum:       { pv: 12, pe: 2, san: 16, skills_default: ["Percepção", "Iniciativa", "Vontade"] }
};

const RITUAIS_1_CIRCULO = [
  { nome: "Luz", elem: "Energia", desc: "Ilumina o ambiente e dissipa trevas paranormais." },
  { nome: "Cicatrização", elem: "Sangue", desc: "Cura 3d8+3 PV de um aliado ferido." },
  { nome: "Decadência", elem: "Morte", desc: "Dano necrótico corrosivo por toque." },
  { nome: "Amaldiçoar Arma", elem: "Energia", desc: "Imbui a arma com dano elemental adicional." },
  { nome: "Compreensão Paranormal", elem: "Conhecimento", desc: "Lê escrituras, símbolos e mentes." },
  { nome: "Definhar", elem: "Morte", desc: "Enfraquece a musculatura e reflexos do alvo." },
  { nome: "Ódio Incontrolável", elem: "Sangue", desc: "Aumenta o dano corpo a corpo em frenesi." },
  { nome: "Esconder dos Olhos", elem: "Conhecimento", desc: "Torna o agente indetectável à visão." },
  { nome: "Perturbação", elem: "Conhecimento", desc: "Desorienta e atordoa a mente do alvo." },
  { nome: "Chama do Caos", elem: "Energia", desc: "Dispara uma labareda de plasma caótico." },
  { nome: "Arma de Sangue", elem: "Sangue", desc: "Gera garras ou lâminas biológicas orgânicas." },
  { nome: "Presença Perturbadora", elem: "Medo", desc: "Emite aura assustadora paralisando inimigos." }
];

const DEFAULT_CLASS_KITS = {
  Combatente: [
    { nome: "Arma 9mm Tática", acao: "Ataque", descricao: "Pistola semiautomática militar com mira holográfica.", foto: "" },
    { nome: "Colete Balístico Reforçado", acao: "Defesa", descricao: "Blindagem de kevlar capaz de conter projéteis e garras.", foto: "" },
    { nome: "Seringa de Adrenalina", acao: "Cura", descricao: "Injetor tático que restaura o fôlego e estabiliza ferimentos.", foto: "" }
  ],
  Especialista: [
    { nome: "Kit de Ferramentas & Gazua", acao: "Investigação", descricao: "Acessórios de precisão para abrir fechaduras eletrônicas e cofres.", foto: "" },
    { nome: "Notebook Criptográfico", acao: "Utilidade", descricao: "Terminal portátil com softwares forenses e bypass de firewalls.", foto: "" },
    { nome: "Pistola com Silenciador", acao: "Ataque", descricao: "Arma leve modificada para disparos furtivos e discretos.", foto: "" }
  ],
  Ocultista: [
    { nome: "Grimório com Símbolos de Sangue", acao: "Ocultismo", descricao: "Tomo encadernado em couro com sigilos para canalização ritualística.", foto: "" },
    { nome: "Adaga Rúnica de Prata", acao: "Ataque", descricao: "Lâmina ritual com runas gravadas que ferem entidades intangíveis.", foto: "" },
    { nome: "Frasco de Essência Astral", acao: "Cura", descricao: "Elixir purificado que recupera sanidade e estabilidade mental.", foto: "" }
  ],
  Comum: [
    { nome: "Lanterna Tática de Alta Potência", acao: "Investigação", descricao: "Feixe de luz concentrado capaz de iluminar as trevas mais densas.", foto: "" },
    { nome: "Spray de Pimenta / Defesa", acao: "Defesa", descricao: "Defesa rápida para atordoar agressores e abrir tempo de fuga.", foto: "" },
    { nome: "Kit de Primeiros Socorros Básico", acao: "Cura", descricao: "Bandagens, gaze e antisséptico para tratar ferimentos emergenciais.", foto: "" }
  ]
};

const ACTION_ICONS = {
  "Ataque": "⚔ Ataque",
  "Defesa": "🛡 Defesa",
  "Cura": "✚ Cura",
  "Investigação": "◈ Investigação",
  "Ocultismo": "⸸ Ocultismo",
  "Veneno": "☠ Veneno",
  "Utilidade": "⚙ Utilidade",
  "Fuga": "► Fuga",
  "Suporte": "✦ Suporte"
};

const RANDOM_NAMES = [
  "Gabriel Santos", "Beatriz Lima", "Arthur Pendelton", "Clarice Moraes",
  "Rodrigo Vance", "Helena Duarte", "Lucas Fagundes", "Valentina Rios",
  "Thiago Brandão", "Juliana Silveira", "Rafael Dorneles", "Camila Ferraz",
  "Eduardo Bastos", "Larissa Fonseca", "Marcos Vinícius", "Sofia Albuquerque",
  "Dante Cervero", "Júlia Veríssimo", "Fernando Albuquerque", "Carla Zanin"
];

const RANDOM_FEARS = [
  "Claustrofobia extrema", "Medo visceral de afogamento", "Pavor de insetos e parasitas",
  "Nictofobia (pavor do escuro total)", "Medo de perder a sanidade", "Trauma de fogo e chamas",
  "Medo de espelhos e reflexos", "Pavor de silêncio absoluto"
];

const RANDOM_PERSONALITIES = [
  "Metódico, calmo e perfeccionista sob extrema pressão.",
  "Impulsivo e protetor, sempre se coloca na frente dos aliados.",
  "Cético e analítico, busca explicação lógica para o horror.",
  "Sarcástico e reservado, esconde seus medos atrás do humor ácido.",
  "Dedicado e observador, não deixa nenhum detalhe passar despercebido."
];

// ─── RETRATOS HUMANOS EM CONFORMIDADE LGPD ───────────────────────────────────
const PORTRAIT_MEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/men/${i+1}.jpg`);
const PORTRAIT_WOMEN = Array.from({length: 99}, (_, i) => `https://randomuser.me/api/portraits/women/${i+1}.jpg`);
const PORTRAIT_ALL = [...PORTRAIT_MEN, ...PORTRAIT_WOMEN];

function getRandomHumanPortrait() {
  return PORTRAIT_ALL[Math.floor(Math.random() * PORTRAIT_ALL.length)];
}

let state = {
  playerCount: 2,
  characters: [],
  themeRandom: true,
  selectedTheme: "Mansão Assombrada",
  customTheme: ""
};

// ─── CONTROLE DE JOGADORES ───────────────────────────────────────────────────
function setCount(n) {
  state.playerCount = Math.max(1, Math.min(10, n));
  updatePlayerCountUI();
  renderCharacters();
  updateLaunchSummary();
}

function changePlayerCount(delta) {
  setCount(state.playerCount + delta);
}

function updatePlayerCountUI() {
  document.getElementById("player-count-display").textContent = state.playerCount;
  document.getElementById("player-count-text").textContent =
    state.playerCount === 1 ? "1 agente solo" : `${state.playerCount} agentes na equipe`;

  for (let i = 1; i <= 5; i++) {
    const pill = document.getElementById("pill-" + i);
    if (!pill) continue;
    if (i === 5 && state.playerCount >= 5) pill.classList.add("active");
    else if (i === state.playerCount) pill.classList.add("active");
    else pill.classList.remove("active");
  }
}

// ─── RENDERIZAÇÃO DAS FICHAS DOS AGENTES ─────────────────────────────────────
function renderCharacters() {
  const container = document.getElementById("characters-list");
  if (!container) return;

  while (state.characters.length < state.playerCount) {
    const idx = state.characters.length;
    state.characters.push(createDefaultChar(idx));
  }

  container.innerHTML = state.characters.slice(0, state.playerCount).map((char, i) => {
    const classKey = (char.class || "combatente").toLowerCase();
    const trilhas = TRILHAS_BY_CLASS[char.class] || TRILHAS_BY_CLASS.Combatente;
    const isOcultista = char.class === "Ocultista";
    const inventory = char.inventory || [];
    const activeTab = char.activeTab || "identidade";

    // Cálculo de Stats Derivados em tempo real
    const base = CLASS_BASES[classKey] || CLASS_BASES.combatente;
    const vig = char.attrs.vigor || 1;
    const pre = char.attrs.presenca || 1;
    const agi = char.attrs.agilidade || 1;
    const pvMax = base.pv + vig;
    const peMax = base.pe + pre;
    const sanMax = base.san;
    const defPassiva = 10 + agi;

    return `
      <div class="char-setup-card class-${classKey}" id="char-card-${i}">
        <!-- HEADER DO CARD -->
        <div class="char-card-header">
          <div class="char-header-left">
            <div class="char-header-avatar-wrap">
              <img class="char-header-avatar" id="char-avatar-img-${i}" src="${char.avatar}" alt="Avatar">
            </div>
            <div class="char-header-info">
              <div class="char-header-num">Agente #${i + 1} · <span style="color:var(--text-d);">${char.nex}</span></div>
              <div class="char-header-name" id="char-preview-name-${i}">
                ${esc(char.name || `Agente ${i+1}`)} · <span style="color:var(--gold);font-size:12px;letter-spacing:1px;">${char.class} (${char.trilha})</span>
              </div>
            </div>
          </div>
          <div class="char-header-right">
            <button class="global-random-btn" style="padding:6px 12px;font-size:10px;" onclick="randomizeCharacter(${i})">🎲 Sortear Tudo</button>
            <label class="toggle-wrap" title="Quando ativo, o Mestre balanceia e completa a ficha automaticamente">
              <input type="checkbox" class="toggle-input" id="char-toggle-${i}" ${char.auto ? "checked" : ""} onchange="toggleCharAuto(${i}, this.checked)">
              <div class="toggle-switch"></div>
              <span class="toggle-label">Auto</span>
            </label>
          </div>
        </div>

        <!-- MODO MINIMIZADO (RANDOMIZER ATIVO) -->
        <div class="char-minimized-box" id="char-minimized-${i}" style="${char.auto ? 'display:flex;' : 'display:none;'}">
          <div class="char-minimized-badge">
            <span>⚡</span>
            <span>Arquétipo equilibrado gerado automaticamente pela Ordem (${char.class} · ${char.trilha}).</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:10px;color:var(--text-d);letter-spacing:1px;text-transform:uppercase;">Classe:</span>
            <select class="char-class-select-mini" onchange="updateCharClassPref(${i}, this.value)">
              <option value="Aleatório" ${char.class === "Aleatório" ? "selected" : ""}>🎲 Aleatória</option>
              <option value="Combatente" ${char.class === "Combatente" ? "selected" : ""}>⚔ Combatente</option>
              <option value="Especialista" ${char.class === "Especialista" ? "selected" : ""}>🔍 Especialista</option>
              <option value="Ocultista" ${char.class === "Ocultista" ? "selected" : ""}>🔮 Ocultista</option>
              <option value="Comum" ${char.class === "Comum" ? "selected" : ""}>🛡 Comum</option>
            </select>
          </div>
        </div>

        <!-- MODO MANUAL EXPANDIDO COM ABAS COMPLETAS -->
        <div class="char-manual-form ${!char.auto ? 'active' : ''}" id="char-form-${i}">
          <!-- NAVEGAÇÃO DE SUB-ABAS -->
          <div class="char-tabs-nav">
            <button type="button" class="char-tab-btn ${activeTab === 'identidade' ? 'active' : ''}" onclick="switchCharTab(${i}, 'identidade')">📇 Identidade & Dossiê</button>
            <button type="button" class="char-tab-btn ${activeTab === 'classe' ? 'active' : ''}" onclick="switchCharTab(${i}, 'classe')">⚔ Classe & Poderes</button>
            <button type="button" class="char-tab-btn ${activeTab === 'atributos' ? 'active' : ''}" onclick="switchCharTab(${i}, 'atributos')">📊 Atributos & Perícias</button>
            <button type="button" class="char-tab-btn ${activeTab === 'inventario' ? 'active' : ''}" onclick="switchCharTab(${i}, 'inventario')">🎒 Inventário & Itens (${inventory.length})</button>
          </div>

          <!-- ─── ABA 1: IDENTIDADE & DOSSIÊ ─── -->
          <div class="char-tab-content ${activeTab === 'identidade' ? 'active' : ''}" id="tab-identidade-${i}">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">
                  <span>Nome do Agente</span>
                  <a href="#" style="color:var(--gold);text-decoration:none;" onclick="event.preventDefault();rollName(${i})">🎲 Sortear</a>
                </label>
                <input type="text" class="form-input" id="char-input-name-${i}" value="${esc(char.name)}" placeholder="Ex: Dante Cervero" oninput="updateCharName(${i}, this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Patente & NEX</label>
                <select class="form-input" onchange="updateCharNex(${i}, this.value)">
                  <option value="NEX 5% (Recruta)" ${char.nex === "NEX 5% (Recruta)" ? "selected" : ""}>NEX 5% — Recruta (Iniciante)</option>
                  <option value="NEX 10% (Operador)" ${char.nex === "NEX 10% (Operador)" ? "selected" : ""}>NEX 10% — Operador</option>
                  <option value="NEX 15% (Agente Especial)" ${char.nex === "NEX 15% (Agente Especial)" ? "selected" : ""}>NEX 15% — Agente Especial</option>
                  <option value="NEX 20% (Oficial de Operações)" ${char.nex === "NEX 20% (Oficial de Operações)" ? "selected" : ""}>NEX 20% — Oficial de Operações</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Idade do Agente</label>
                <input type="number" min="16" max="90" class="form-input" value="${char.age || 28}" placeholder="Ex: 28" oninput="updateCharAge(${i}, this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Gênero / Pronomes</label>
                <select class="form-input" onchange="updateCharGender(${i}, this.value)">
                  <option value="Masculino" ${char.gender === "Masculino" ? "selected" : ""}>Masculino (Ele/Dele)</option>
                  <option value="Feminino" ${char.gender === "Feminino" ? "selected" : ""}>Feminino (Ela/Dela)</option>
                  <option value="Não-binário" ${char.gender === "Não-binário" ? "selected" : ""}>Não-binário (Elu/Delu)</option>
                  <option value="Outro" ${char.gender === "Outro" ? "selected" : ""}>Outro / Neutro</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <span>Origem / Antecedentes</span>
                <span style="color:var(--gold);font-size:10px;">Bônus e Perícias Oficiais</span>
              </label>
              <select class="form-input" onchange="updateCharOrigin(${i}, this.value)">
                ${ALL_ORIGINS.map(o => `<option value="${o.nome}" ${char.origin === o.nome ? "selected" : ""}>${o.nome} — ${o.desc}</option>`).join('')}
              </select>
              ${char.origin === "Personalizada" ? `
                <input type="text" class="form-input" style="margin-top:6px;" value="${esc(char.originCustom || '')}" placeholder="Digite sua origem personalizada (ex: Ex-piloto de fuga)..." oninput="updateCharOriginCustom(${i}, this.value)">
              ` : ''}
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Traço de Personalidade & Frase</label>
                <input type="text" class="form-input" value="${esc(char.personality || '')}" placeholder="Ex: Frio sob pressão. 'A dor é passageira.'" oninput="updateCharPersonality(${i}, this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Medo / Fobia Principal</label>
                <input type="text" class="form-input" value="${esc(char.fear || '')}" placeholder="Ex: Claustrofobia severa, medo de afogamento..." oninput="updateCharFear(${i}, this.value)">
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Aparência Física & Estilo</label>
                <textarea class="form-input" rows="2" placeholder="Cicatrizes, corte de cabelo, porte físico, sobretudo tático..." oninput="updateCharAppearance(${i}, this.value)">${esc(char.appearance || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Histórico & Trauma com o Paranormal</label>
                <textarea class="form-input" rows="2" placeholder="Como conheceu o paranormal e motivos de entrar na Ordem..." oninput="updateCharHistory(${i}, this.value)">${esc(char.history || '')}</textarea>
              </div>
            </div>

            <!-- FOTO / AVATAR -->
            <div class="avatar-setup-box">
              <div class="avatar-setup-header">
                <label class="form-label" style="margin:0;">Foto / Retrato do Agente</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <label class="file-upload-btn">
                    <span>📁 Enviar Foto Local</span>
                    <input type="file" accept="image/*" class="file-input-hidden" onchange="handleAvatarFileUpload(${i}, this)">
                  </label>
                  <button class="global-random-btn" style="padding:6px 12px;font-size:10px;" onclick="rollAvatar(${i})">🎲 Gerar Pessoa (LGPD)</button>
                </div>
              </div>
              <input type="text" class="form-input" value="${esc(char.avatar.startsWith('data:') ? '[Foto carregada do dispositivo]' : char.avatar)}" placeholder="Ou cole a URL direta de uma imagem..." oninput="updateCharAvatarUrl(${i}, this.value)">
              <div class="lgpd-badge">
                <span class="icon">🛡️</span>
                <span>Conformidade LGPD: Os retratos aleatórios utilizam fotos humanas de domínio público sem dados reais.</span>
              </div>
            </div>
          </div>

          <!-- ─── ABA 2: CLASSE, TRILHA & PODERES ─── -->
          <div class="char-tab-content ${activeTab === 'classe' ? 'active' : ''}" id="tab-classe-${i}">
            <div class="form-group">
              <label class="form-label">Classe do Agente</label>
              <div class="class-radio-group">
                ${CLASS_OPTIONS.map(c => `
                  <div class="class-radio-btn ${char.class === c ? 'selected' : ''}" onclick="setCharClass(${i}, '${c}')">
                    ${c === 'Combatente' ? '⚔ ' : c === 'Especialista' ? '🔍 ' : c === 'Ocultista' ? '🔮 ' : '🛡 '}${c}
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="specialization-box">
              <label class="form-label">
                <span>Trilha de Especialidade (${char.class})</span>
                <span style="color:var(--gold);font-size:10px;">Habilidades Únicas</span>
              </label>
              <div class="trilhas-grid">
                ${trilhas.map(t => `
                  <div class="trilha-card ${char.trilha === t.nome ? 'selected' : ''}" onclick="setCharTrilha(${i}, '${t.nome}')">
                    <div class="trilha-title">${t.nome}</div>
                    <div class="trilha-desc">${t.desc}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Afinidade Elemental (Opcional)</label>
              <select class="form-input" onchange="updateCharAffinity(${i}, this.value)">
                <option value="Nenhuma" ${char.affinity === "Nenhuma" ? "selected" : ""}>Nenhuma / Despertar Futuro</option>
                <option value="Sangue" ${char.affinity === "Sangue" ? "selected" : ""}>🩸 Sangue — Emoção, dor, ferocidade física</option>
                <option value="Morte" ${char.affinity === "Morte" ? "selected" : ""}>💀 Morte — Tempo, entropia, silêncio</option>
                <option value="Conhecimento" ${char.affinity === "Conhecimento" ? "selected" : ""}>👁️ Conhecimento — Razão, sigilos, onisciência</option>
                <option value="Energia" ${char.affinity === "Energia" ? "selected" : ""}>⚡ Energia — Caos, tecnologia, mutação</option>
                <option value="Medo" ${char.affinity === "Medo" ? "selected" : ""}>🌀 Medo — O Elemento Primordial e o Outro Lado</option>
              </select>
            </div>

            ${isOcultista ? `
              <div class="rituals-box">
                <label class="form-label" style="color:#d8b4fe;">
                  <span>🔮 Rituais de 1º Círculo Aprendidos</span>
                  <span>(Selecione até 3)</span>
                </label>
                <div class="rituals-chips-wrap">
                  ${RITUAIS_1_CIRCULO.map(r => {
                    const sel = (char.rituais || []).includes(r.nome);
                    return `
                      <div class="ritual-chip ${sel ? 'selected' : ''}" onclick="toggleCharRitual(${i}, '${r.nome}')" title="${r.desc}">
                        <span>${sel ? '✓' : '+'}</span>
                        <span>${r.nome}</span>
                        <small style="opacity:.6;font-size:9px;">${r.elem.split(' ')[0]}</small>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- ─── ABA 3: ATRIBUTOS & PERÍCIAS ─── -->
          <div class="char-tab-content ${activeTab === 'atributos' ? 'active' : ''}" id="tab-atributos-${i}">
            <!-- PREVIEW DE STATS CALCULADOS -->
            <div class="char-stats-summary-bar">
              <div class="css-stat-item">
                <span class="css-stat-label">Vida (PV)</span>
                <span class="css-stat-val" style="color:#e05050;">${pvMax}</span>
              </div>
              <div class="css-stat-item">
                <span class="css-stat-label">Esforço (PE)</span>
                <span class="css-stat-val" style="color:#e0b040;">${peMax}</span>
              </div>
              <div class="css-stat-item">
                <span class="css-stat-label">Sanidade (SAN)</span>
                <span class="css-stat-val" style="color:#50a0e0;">${sanMax}</span>
              </div>
              <div class="css-stat-item">
                <span class="css-stat-label">Defesa Passiva</span>
                <span class="css-stat-val" style="color:#4ade80;">${defPassiva}</span>
              </div>
              <div class="css-stat-item">
                <span class="css-stat-label">Deslocamento</span>
                <span class="css-stat-val" style="color:#d8b4fe;">9m</span>
              </div>
            </div>

            <!-- DISTRIBUIÇÃO DE ATRIBUTOS -->
            <div class="form-group">
              <label class="form-label">
                <span>Atributos da Ficha (Regras Oficiais)</span>
                <span style="color:var(--gold);">Pontos restantes: <strong id="char-pts-${i}">${char.pointsRemaining}</strong></span>
              </label>
              <div class="attrs-row">
                ${['agilidade', 'forca', 'intelecto', 'presenca', 'vigor'].map(attr => `
                  <div class="attr-box">
                    <span class="attr-box-name">${attr.slice(0,3)}</span>
                    <div class="attr-box-controls">
                      <button class="attr-btn" onclick="changeCharAttr(${i}, '${attr}', -1)">−</button>
                      <span class="attr-val" id="attr-val-${i}-${attr}">${char.attrs[attr]}</span>
                      <button class="attr-btn" onclick="changeCharAttr(${i}, '${attr}', 1)">+</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SELEÇÃO DE PERÍCIAS TREINADAS -->
            <div class="form-group">
              <label class="form-label">
                <span>Perícias Treinadas (+5 nos testes)</span>
                <span style="color:var(--text-d);">${char.skills.length} selecionadas</span>
              </label>
              <div class="skills-selector-grid">
                ${ALL_SKILLS.map(sk => {
                  const sel = (char.skills || []).includes(sk);
                  return `
                    <div class="skill-chip ${sel ? 'selected' : ''}" onclick="toggleCharSkill(${i}, '${sk}')">
                      <span>${sk}</span>
                      <span style="font-size:10px;opacity:.7;">${sel ? '✓ +5' : '+'}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- ─── ABA 4: INVENTÁRIO & ITENS CUSTOMIZADOS ─── -->
          <div class="char-tab-content ${activeTab === 'inventario' ? 'active' : ''}" id="tab-inventario-${i}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <label class="form-label" style="margin:0;color:var(--gold);">
                <span>🎒 Inventário do Agente (${inventory.length} itens)</span>
              </label>
              <button type="button" class="btn-add-item" onclick="toggleCharItemForm(${i}, true)">+ Adicionar Item Personalizado</button>
            </div>

            <!-- FORMULÁRIO DE NOVO ITEM -->
            <div class="custom-item-form" id="char-item-form-${i}" style="display:none;">
              <div class="cif-header">Cadastrar Equipamento / Arma / Item Personalizado</div>
              <div class="cif-grid">
                <div class="cif-field">
                  <label class="field-sublabel">Nome do Item *</label>
                  <input id="char-inp-item-nome-${i}" class="form-input" type="text" placeholder="Ex: Pistola Custom 9mm, Frasco de Veneno...">
                </div>
                <div class="cif-field">
                  <label class="field-sublabel">Macro Ação Principal *</label>
                  <select id="char-sel-item-acao-${i}" class="form-input">
                    <option value="Ataque">⚔ Ataque</option>
                    <option value="Defesa">🛡 Defesa</option>
                    <option value="Cura">💉 Cura</option>
                    <option value="Investigação">🔍 Investigação</option>
                    <option value="Ocultismo">🔮 Ocultismo</option>
                    <option value="Veneno">☠ Veneno</option>
                    <option value="Utilidade">🛠 Utilidade</option>
                    <option value="Fuga">💨 Fuga</option>
                    <option value="Suporte">✨ Suporte</option>
                  </select>
                </div>
              </div>
              <div class="cif-field" style="margin-bottom:12px;">
                <label class="field-sublabel">Descrição & Efeito Narrativo</label>
                <textarea id="char-inp-item-desc-${i}" class="form-input" rows="2" placeholder="Descreva como o item age quando utilizado em jogo..."></textarea>
              </div>
              <div class="cif-field" style="margin-bottom:12px;">
                <label class="field-sublabel">URL da Imagem / Ícone (Opcional)</label>
                <input id="char-inp-item-foto-${i}" class="form-input" type="text" placeholder="https://exemplo.com/item.png">
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button type="button" class="btn-cancel-item" onclick="toggleCharItemForm(${i}, false)">Cancelar</button>
                <button type="button" class="btn-save-item" onclick="addCharCustomItem(${i})">Salvar Item no Dossiê</button>
              </div>
            </div>

            <!-- LISTA DE ITENS CARREGADOS -->
            <div id="char-inventory-list-${i}" class="inventory-creator-list">
              ${renderInventoryCardsHtml(char.inventory, i)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderInventoryCardsHtml(inv, charIdx) {
  if (!inv || inv.length === 0) {
    return `<div style="color:var(--text-d);font-size:12px;font-style:italic;padding:8px 0;">Nenhum item equipado. Clique em "+ Adicionar Item Personalizado" para equipar seu agente.</div>`;
  }

  return inv.map((item, idx) => {
    const nome = typeof item === "string" ? item : item.nome;
    const acao = (typeof item === "object" && item.acao) ? item.acao : "Utilidade";
    const desc = (typeof item === "object" && item.descricao) ? item.descricao : "Equipamento padrão do agente.";
    const foto = (typeof item === "object" && item.foto) ? item.foto : "";
    const acaoKey = (acao || "utilidade").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return `
      <div class="inv-creator-card">
        ${foto ? `<img class="inv-creator-img" src="${esc(foto)}" alt="${esc(nome)}">` : `<div class="inv-creator-icon">📦</div>`}
        <div class="inv-creator-details">
          <div class="inv-creator-name-row">
            <span class="inv-creator-name">${esc(nome)}</span>
            <span class="badge-macro-action action-${acaoKey}">${esc(ACTION_ICONS[acao] || `⚡ ${acao}`)}</span>
          </div>
          <div class="inv-creator-desc">${esc(desc)}</div>
        </div>
        <button type="button" class="btn-del-item" onclick="removeCharInventoryItem(${charIdx}, ${idx})" title="Remover item">✕</button>
      </div>
    `;
  }).join('');
}

function createDefaultChar(idx) {
  const cls = "Combatente";
  const base = CLASS_BASES.combatente;
  return {
    activeTab: "identidade",
    name: "",
    age: 28,
    gender: "Masculino",
    origin: "Investigador",
    originCustom: "",
    nex: "NEX 5% (Recruta)",
    personality: "",
    fear: "",
    appearance: "",
    history: "",
    class: cls,
    trilha: "Guerreiro",
    affinity: "Nenhuma",
    rituais: ["Luz", "Cicatrização"],
    auto: true,
    avatar: getRandomHumanPortrait(),
    attrs: { agilidade: 1, forca: 1, intelecto: 1, presenca: 1, vigor: 1 },
    pointsRemaining: 4,
    skills: [...base.skills_default],
    inventory: JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[cls] || []))
  };
}

function switchCharTab(charIdx, tabName) {
  state.characters[charIdx].activeTab = tabName;
  renderCharacters();
}

function toggleCharAuto(i, isAuto) {
  state.characters[i].auto = isAuto;
  const minimizedBox = document.getElementById("char-minimized-" + i);
  const formBox = document.getElementById("char-form-" + i);
  if (minimizedBox && formBox) {
    minimizedBox.style.display = isAuto ? "flex" : "none";
    if (isAuto) formBox.classList.remove("active");
    else formBox.classList.add("active");
  }
}

function updateCharClassPref(i, cls) {
  if (cls === "Aleatório") {
    state.characters[i].class = "Combatente";
  } else {
    state.characters[i].class = cls;
  }
  const trilhas = TRILHAS_BY_CLASS[state.characters[i].class] || TRILHAS_BY_CLASS.Combatente;
  state.characters[i].trilha = trilhas[0].nome;
  state.characters[i].inventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[state.characters[i].class] || []));
  const base = CLASS_BASES[state.characters[i].class.toLowerCase()] || CLASS_BASES.combatente;
  state.characters[i].skills = [...base.skills_default];
  updateCharHeaderPreview(i);
}

function setCharClass(i, cls) {
  state.characters[i].class = cls;
  const trilhas = TRILHAS_BY_CLASS[cls] || TRILHAS_BY_CLASS.Combatente;
  state.characters[i].trilha = trilhas[0].nome;
  state.characters[i].inventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[cls] || []));
  const base = CLASS_BASES[cls.toLowerCase()] || CLASS_BASES.combatente;
  state.characters[i].skills = [...base.skills_default];
  renderCharacters();
}

function setCharTrilha(i, trilha) {
  state.characters[i].trilha = trilha;
  renderCharacters();
}

function updateCharAffinity(i, aff) {
  state.characters[i].affinity = aff;
}

function updateCharNex(i, nex) {
  state.characters[i].nex = nex;
  renderCharacters();
}

function toggleCharRitual(i, ritual) {
  const char = state.characters[i];
  if (!char.rituais) char.rituais = [];
  const idx = char.rituais.indexOf(ritual);
  if (idx >= 0) {
    char.rituais.splice(idx, 1);
  } else {
    if (char.rituais.length >= 3) {
      char.rituais.shift();
    }
    char.rituais.push(ritual);
  }
  renderCharacters();
}

function toggleCharSkill(charIdx, skill) {
  const char = state.characters[charIdx];
  if (!char.skills) char.skills = [];
  const idx = char.skills.indexOf(skill);
  if (idx >= 0) {
    char.skills.splice(idx, 1);
  } else {
    char.skills.push(skill);
  }
  renderCharacters();
}

function updateCharName(i, name) {
  state.characters[i].name = name;
  updateCharHeaderPreview(i);
}

function updateCharOrigin(i, origin) {
  state.characters[i].origin = origin;
  renderCharacters();
}

function updateCharOriginCustom(i, val) {
  state.characters[i].originCustom = val;
}

function updateCharAge(i, age) {
  state.characters[i].age = parseInt(age, 10) || 28;
}

function updateCharGender(i, gender) {
  state.characters[i].gender = gender;
}

function updateCharPersonality(i, val) {
  state.characters[i].personality = val;
}

function updateCharFear(i, val) {
  state.characters[i].fear = val;
}

function updateCharAppearance(i, appearance) {
  state.characters[i].appearance = appearance;
}

function updateCharHistory(i, history) {
  state.characters[i].history = history;
}

function toggleCharItemForm(charIdx, show) {
  const f = document.getElementById(`char-item-form-${charIdx}`);
  if (f) f.style.display = show ? "block" : "none";
}

function addCharCustomItem(charIdx) {
  const nome = document.getElementById(`char-inp-item-nome-${charIdx}`)?.value.trim();
  const acao = document.getElementById(`char-sel-item-acao-${charIdx}`)?.value || "Utilidade";
  const desc = document.getElementById(`char-inp-item-desc-${charIdx}`)?.value.trim() || "Item customizado do agente.";
  const foto = document.getElementById(`char-inp-item-foto-${charIdx}`)?.value.trim() || "";

  if (!nome) {
    alert("Por favor, insira ao menos o nome do item!");
    return;
  }

  if (!state.characters[charIdx].inventory) state.characters[charIdx].inventory = [];
  state.characters[charIdx].inventory.push({ nome, acao, descricao: desc, foto });

  const f = document.getElementById(`char-item-form-${charIdx}`);
  if (f) {
    document.getElementById(`char-inp-item-nome-${charIdx}`).value = "";
    document.getElementById(`char-inp-item-desc-${charIdx}`).value = "";
    document.getElementById(`char-inp-item-foto-${charIdx}`).value = "";
    f.style.display = "none";
  }

  const listEl = document.getElementById(`char-inventory-list-${charIdx}`);
  if (listEl) {
    listEl.innerHTML = renderInventoryCardsHtml(state.characters[charIdx].inventory, charIdx);
  }
}

function removeCharInventoryItem(charIdx, itemIdx) {
  if (state.characters[charIdx]?.inventory) {
    state.characters[charIdx].inventory.splice(itemIdx, 1);
    const listEl = document.getElementById(`char-inventory-list-${charIdx}`);
    if (listEl) {
      listEl.innerHTML = renderInventoryCardsHtml(state.characters[charIdx].inventory, charIdx);
    }
  }
}

function updateCharAvatarUrl(i, url) {
  if (url.startsWith('[Foto')) return;
  state.characters[i].avatar = url;
  const img = document.getElementById("char-avatar-img-" + i);
  if (img) img.src = url;
}

function handleAvatarFileUpload(i, inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    state.characters[i].avatar = dataUrl;
    const img = document.getElementById("char-avatar-img-" + i);
    if (img) img.src = dataUrl;
    renderCharacters();
  };
  reader.readAsDataURL(file);
}

function updateCharHeaderPreview(i) {
  const char = state.characters[i];
  const nameEl = document.getElementById("char-preview-name-" + i);
  if (nameEl) {
    nameEl.innerHTML = `${esc(char.name || `Agente ${i+1}`)} · <span style="color:var(--gold);font-size:12px;letter-spacing:1px;">${char.class} (${char.trilha})</span>`;
  }
}

function rollName(i) {
  const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  state.characters[i].name = name;
  const inp = document.getElementById("char-input-name-" + i);
  if (inp) inp.value = name;
  updateCharHeaderPreview(i);
}

function rollAvatar(i) {
  const url = getRandomHumanPortrait();
  state.characters[i].avatar = url;
  const img = document.getElementById("char-avatar-img-" + i);
  if (img) img.src = url;
  renderCharacters();
}

function changeCharAttr(i, attr, delta) {
  const char = state.characters[i];
  const cur = char.attrs[attr];
  if (delta > 0 && char.pointsRemaining <= 0) return;
  if (delta < 0 && cur <= 0) return;

  char.attrs[attr] += delta;
  char.pointsRemaining -= delta;

  renderCharacters();
}

function randomizeCharacter(i) {
  const char = state.characters[i];
  char.name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  char.class = CLASS_OPTIONS[Math.floor(Math.random() * CLASS_OPTIONS.length)];
  const trilhas = TRILHAS_BY_CLASS[char.class] || TRILHAS_BY_CLASS.Combatente;
  char.trilha = trilhas[Math.floor(Math.random() * trilhas.length)].nome;
  const orig = ALL_ORIGINS[Math.floor(Math.random() * (ALL_ORIGINS.length - 1))];
  char.origin = orig.nome;
  char.originCustom = "";
  char.age = Math.floor(Math.random() * 26) + 20; // 20 - 45 anos
  char.gender = Math.random() > 0.5 ? "Masculino" : "Feminino";
  char.personality = RANDOM_PERSONALITIES[Math.floor(Math.random() * RANDOM_PERSONALITIES.length)];
  char.fear = RANDOM_FEARS[Math.floor(Math.random() * RANDOM_FEARS.length)];
  char.avatar = getRandomHumanPortrait();
  char.inventory = JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[char.class] || []));
  const base = CLASS_BASES[char.class.toLowerCase()] || CLASS_BASES.combatente;
  char.skills = [...base.skills_default];

  if (char.class === "Ocultista") {
    const shuffled = [...RITUAIS_1_CIRCULO].sort(() => 0.5 - Math.random());
    char.rituais = shuffled.slice(0, 3).map(r => r.nome);
  } else {
    char.rituais = [];
  }

  char.attrs = { agilidade: 1, forca: 1, intelecto: 1, presenca: 1, vigor: 1 };
  const attrKeys = ['agilidade', 'forca', 'intelecto', 'presenca', 'vigor'];
  for (let p = 0; p < 4; p++) {
    const k = attrKeys[Math.floor(Math.random() * attrKeys.length)];
    char.attrs[k]++;
  }
  char.pointsRemaining = 0;

  renderCharacters();
}

function randomizeAllCharacters() {
  for (let i = 0; i < state.playerCount; i++) {
    randomizeCharacter(i);
  }
}

// ─── TEMA & MISTÉRIO ─────────────────────────────────────────────────────────
function toggleThemeRandom(isRandom) {
  state.themeRandom = isRandom;
  const randBox = document.getElementById("theme-random-box");
  const manualBox = document.getElementById("theme-manual-box");
  if (randBox && manualBox) {
    randBox.style.display = isRandom ? "flex" : "none";
    manualBox.style.display = isRandom ? "none" : "flex";
  }
  updateLaunchSummary();
}

function selectTheme(cardEl, themeName) {
  document.querySelectorAll(".theme-card-option").forEach(c => c.classList.remove("selected"));
  cardEl.classList.add("selected");
  state.selectedTheme = themeName;
  state.customTheme = "";
  const customArea = document.getElementById("custom-theme-area");
  if (customArea) customArea.style.display = "none";
  updateLaunchSummary();
}

function activateCustomTheme(cardEl) {
  document.querySelectorAll(".theme-card-option").forEach(c => c.classList.remove("selected"));
  cardEl.classList.add("selected");
  const customArea = document.getElementById("custom-theme-area");
  if (customArea) {
    customArea.style.display = "flex";
    const textarea = document.getElementById("custom-theme-input");
    if (textarea) textarea.focus();
  }
  updateLaunchSummary();
}

function randomizeAll() {
  randomizeAllCharacters();
  toggleThemeRandom(true);
  const toggle = document.getElementById("theme-random-toggle");
  if (toggle) toggle.checked = true;
}

function updateLaunchSummary() {
  const sumPlayers = document.getElementById("summary-players");
  const sumTheme = document.getElementById("summary-theme");
  if (sumPlayers) {
    sumPlayers.textContent = state.playerCount === 1 ? "1 Agente (Solo)" : `${state.playerCount} Agentes`;
  }
  if (sumTheme) {
    if (state.themeRandom) {
      sumTheme.textContent = "Aleatório pelo Mestre";
    } else {
      const customInput = document.getElementById("custom-theme-input");
      const customVal = customInput ? customInput.value.trim() : "";
      sumTheme.textContent = customVal ? "Personalizado" : state.selectedTheme;
    }
  }
}

function handleDocUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const nameEl = document.getElementById("doc-file-name");
  const zone = document.getElementById("doc-upload-zone");

  if (nameEl) { nameEl.textContent = "📎 " + file.name; nameEl.style.display = "block"; }
  if (zone) zone.classList.add("has-file");

  const reader = new FileReader();
  reader.onload = (e) => {
    let content = "";
    if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      content = e.target.result;
    } else {
      content = "[DOCUMENTO: " + file.name + " importado como referência para o Mestre]";
    }
    state.customTheme = content;
    const textarea = document.getElementById("custom-theme-input");
    if (textarea && !textarea.value.trim()) {
      textarea.placeholder = "Documento importado: " + file.name + " — você pode complementar com texto livre...";
    }
    updateLaunchSummary();
  };

  if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    reader.readAsText(file, "UTF-8");
  } else {
    reader.readAsArrayBuffer(file);
  }
}

// ─── INICIAR MISSÃO ──────────────────────────────────────────────────────────
function launchMission() {
  const isMulti = state.playerCount > 1;
  const customThemeInput = document.getElementById("custom-theme-input");
  const customTheme = customThemeInput ? (customThemeInput.value.trim() || state.customTheme) : state.customTheme;

  const finalThemeName = state.themeRandom
    ? "Aleatório"
    : (customTheme || state.selectedTheme);

  const themeData = {
    masterDecides: state.themeRandom,
    themes: state.themeRandom ? [] : [finalThemeName]
  };

  const personagens = state.characters.slice(0, state.playerCount).map((c, i) => {
    const isAuto = c.auto;
    const inv = (c.inventory && c.inventory.length > 0)
      ? c.inventory
      : JSON.parse(JSON.stringify(DEFAULT_CLASS_KITS[c.class] || DEFAULT_CLASS_KITS.Combatente));

    const originFinal = (c.origin === "Personalizada" && c.originCustom)
      ? c.originCustom
      : (c.origin || "Investigador");

    return {
      jogador_num: i + 1,
      name: c.name.trim() || `Agente ${i + 1}`,
      class: c.class || "Combatente",
      trilha: c.trilha || "Guerreiro",
      affinity: c.affinity || "Nenhuma",
      nex: c.nex || "NEX 5% (Recruta)",
      rituais: c.rituais || [],
      skills: c.skills || [],
      origin: originFinal,
      age: c.age || 28,
      gender: c.gender || "Masculino",
      personality: c.personality || "",
      fear: c.fear || "",
      appearance: c.appearance || "",
      history: c.history || "",
      inventory: inv,
      auto: isAuto,
      avatar_url: c.avatar,
      attributes: isAuto ? {} : c.attrs
    };
  });

  const gameMode = {
    tipo: isMulti ? "multiplayer" : "individual",
    personagens,
    npcs_fixos: []
  };

  const pendingCharacter = isMulti
    ? { multi: true, personagens, gameMode }
    : personagens[0];

  sessionStorage.setItem("pendingCharacter", JSON.stringify(pendingCharacter));
  sessionStorage.setItem("themeChoice", JSON.stringify(themeData));
  sessionStorage.setItem("gameMode", JSON.stringify(gameMode));
  sessionStorage.setItem("mp_total", String(state.playerCount));
  sessionStorage.setItem("mp_queue", JSON.stringify(personagens));
  sessionStorage.setItem("mp_queue_idx", "0");

  window.location = "loading.html";
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  setCount(2);
  updateLaunchSummary();
});
