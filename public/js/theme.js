// Temas do BASE_RPG_MASTER_PROMPT.json
const THEMES = [
  { id:"terror",     icon:"👁",  name:"Terror",         desc:"Medo real, entidades, atmosfera opressiva" },
  { id:"suspense",   icon:"🕵",  name:"Suspense",       desc:"Mistério e investigação paranormal" },
  { id:"cosmico",    icon:"🌌",  name:"Cósmico",        desc:"Horrores além da compreensão humana" },
  { id:"slasher",    icon:"🔪",  name:"Slasher",        desc:"Sobrevivência, perseguição, predador" },
  { id:"acao",       icon:"💥",  name:"Ação",           desc:"Combate intenso e adrenalina constante" },
  { id:"aventura",   icon:"🗺",  name:"Aventura",       desc:"Exploração, descobertas e desafios" },
  { id:"romance",    icon:"🩸",  name:"Romance",        desc:"Laços emocionais em meio ao caos" },
  { id:"fantasia",   icon:"⚔",  name:"Fantasia",       desc:"Magia, monstros e mundos ocultos" },
  { id:"magia",      icon:"🌑",  name:"Magia",          desc:"Rituais, ocultismo e o Outro Lado" },
  { id:"ficcao",     icon:"🤖",  name:"Ficção Científica", desc:"Tecnologia, experimentos e anomalias" },
];

let selectedThemes = [];
let masterDecides = false;

function renderGrid() {
  const grid = document.getElementById("theme-grid");
  grid.innerHTML = THEMES.map(t => {
    const isSelected = selectedThemes.includes(t.id);
    const isDisabled = !isSelected && selectedThemes.length >= 3 && !masterDecides;
    return `
      <div class="theme-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
           data-id="${t.id}" onclick="toggleTheme('${t.id}')">
        <div class="theme-badge">${selectedThemes.indexOf(t.id) + 1 || ''}</div>
        <div class="theme-icon">${t.icon}</div>
        <div class="theme-name">${t.name}</div>
        <div class="theme-desc">${t.desc}</div>
      </div>`;
  }).join('');
}

function renderSelected() {
  const display = document.getElementById("selected-display");
  const count   = document.getElementById("count-display");
  count.textContent = masterDecides ? "Mestre decide" : selectedThemes.length;

  if (masterDecides) {
    display.innerHTML = `<div class="selected-theme-chip">🎲 O Mestre escolherá os temas</div>`;
    return;
  }

  if (selectedThemes.length === 0) {
    display.innerHTML = `<span class="empty-selection">Nenhum tema selecionado</span>`;
    return;
  }

  display.innerHTML = selectedThemes.map(id => {
    const t = THEMES.find(x => x.id === id);
    return `<div class="selected-theme-chip">
      ${t.icon} ${t.name}
      <button onclick="removeTheme('${id}')">✕</button>
    </div>`;
  }).join('');
}

function updateButton() {
  const btn = document.getElementById("btn-next");
  btn.disabled = !masterDecides && selectedThemes.length === 0;
}

function toggleMaster() {
  masterDecides = !masterDecides;
  const card = document.getElementById("master-card");
  card.classList.toggle("selected", masterDecides);
  if (masterDecides) selectedThemes = [];
  renderGrid();
  renderSelected();
  updateButton();
}

function toggleTheme(id) {
  if (masterDecides) {
    masterDecides = false;
    document.getElementById("master-card").classList.remove("selected");
  }

  const idx = selectedThemes.indexOf(id);
  if (idx >= 0) {
    selectedThemes.splice(idx, 1);
  } else {
    if (selectedThemes.length >= 3) return;
    selectedThemes.push(id);
  }

  renderGrid();
  renderSelected();
  updateButton();
}

function removeTheme(id) {
  selectedThemes = selectedThemes.filter(x => x !== id);
  renderGrid();
  renderSelected();
  updateButton();
}

function goNext() {
  const payload = masterDecides
    ? { masterDecides: true, themes: [] }
    : { masterDecides: false, themes: selectedThemes.map(id => THEMES.find(t => t.id === id).name) };

  sessionStorage.setItem("themeChoice", JSON.stringify(payload));

  // Se já tem modo definido (voltou de mode.html ou custom), vai para create
  const gm = (() => { try { return JSON.parse(sessionStorage.getItem("gameMode") || "{}"); } catch { return {}; } })();
  if (gm.tipo) {
    window.location = "create.html";
  } else {
    // Primeira vez: vai para mode.html para escolher o modo
    window.location = "mode.html";
  }
}

// Init
renderGrid();
renderSelected();
updateButton();
