// load.js v5 — Cards de Save Estilo Baralho com 3D, Solo/Multi badge, delete modal, lightbox

(function(){
  const c = document.getElementById("bg-canvas"); if(!c) return;
  const cx = c.getContext("2d"), pts = [];
  function resize(){ c.width=innerWidth; c.height=innerHeight; } resize();
  window.addEventListener("resize", resize);
  for(let i=0;i<50;i++) pts.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:.5+Math.random()*1.5,vx:(Math.random()-.5)*.3,vy:-.1-Math.random()*.35,a:.06+Math.random()*.25, color: Math.random() > 0.7 ? '#8a1a1a' : '#c9a84c'});
  (function loop(){
    cx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-10){p.y=c.height+10;p.x=Math.random()*c.width;}
      cx.save(); cx.globalAlpha=p.a; cx.fillStyle=p.color;
      cx.beginPath(); cx.arc(p.x,p.y,p.r,0,Math.PI*2); cx.fill(); cx.restore();
    });
    requestAnimationFrame(loop);
  })();
})();

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// Naipes temáticos por modo
function getSuit(mode) {
  if (mode === "multiplayer_local") return "♣";
  return "⸸";
}

// Badge de modo
function modeBadge(mode, playerCount) {
  if (mode === "multiplayer_local" || playerCount > 1) {
    return `<span class="sc-mode-badge badge-multi">♣ MULTIPLAYER LOCAL · ${playerCount}P</span>`;
  }
  return `<span class="sc-mode-badge badge-solo">⸸ SOLO</span>`;
}

// Resolução determinística e persistente de retrato
function deterministicAvatar(name, sessionId) {
  const seed = (name || "agente") + "_" + (sessionId || "session");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 99;
  return `https://randomuser.me/api/portraits/men/${Math.abs(hash) + 1}.jpg`;
}

// Mini avatares dos agentes na listagem de saves
function playersRow(s) {
  const chars = Array.isArray(s.characters) && s.characters.length > 0
    ? s.characters
    : [{ name: s.character, avatar_url: s.avatar }];
  const total = s.playerCount || chars.length || 1;

  const shown = chars.slice(0, 4);
  const extra = total - shown.length;
  return `<div class="sc-players-row">
    ${shown.map(c => {
      const avatarSrc = c.avatar_url || c.avatar || s.avatar || deterministicAvatar(c.name, s.sessionId);
      return `<img class="sc-player-avatar" src="${esc(avatarSrc)}" title="${esc(c.name || 'Agente')}" onerror="this.src='https://randomuser.me/api/portraits/men/1.jpg'">`;
    }).join('')}
    ${extra > 0 ? `<div class="sc-player-count-badge">+${extra}</div>` : ''}
  </div>`;
}

async function loadSessions() {
  const grid = document.getElementById("sessions-grid");
  const none = document.getElementById("no-sessions");
  try {
    const r    = await fetch("/api/sessions");
    const list = await r.json();
    if (!list.length) { grid.style.display="none"; none.style.display="block"; return; }
    grid.innerHTML = "";
    grid.style.display = "grid";
    list.forEach(s => {
      const card = document.createElement("div");
      const modeStr = s.mode || "individual";
      const isDead = s.status === "morto";
      card.className = "session-card" + (isDead ? " dead" : "");
      const suit = getSuit(modeStr);
      const playerCount = s.playerCount || 1;

      card.innerHTML = `
        <!-- Cantos estilo baralho -->
        <span class="sc-suit-tl">${suit}</span>
        <span class="sc-suit-br">${suit}</span>

        <!-- Header -->
        <div class="sc-card-header">
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;">
            ${modeBadge(modeStr, playerCount)}
            <div class="sc-title">${esc(s.title)}</div>
          </div>
          ${playersRow(s)}
          <button class="sc-delete" title="Deletar sessão" onclick="deleteSession(event,'${esc(s.sessionId)}')">✕</button>
        </div>

        <!-- Body -->
        <div class="sc-card-body">
          <div class="sc-char">${esc(s.character)}</div>
          <div class="sc-class">${esc(s.class)}</div>
          <div class="sc-meta-row">
            <span class="sc-nex">NEX ${esc(s.nex)}</span>
            <span class="sc-turns">${s.turnCount||0} turno${(s.turnCount||0)!==1?"s":""}</span>
          </div>
          <div class="sc-summary">${esc(s.summary)}</div>
        </div>

        <!-- Footer -->
        <div class="sc-card-footer">
          <span class="sc-status ${isDead ? 'morto' : 'vivo'}">${isDead ? '† Morto' : '● Ativo'}</span>
          <span class="sc-date">${fmtDate(s.lastUpdate)}</span>
        </div>
      `;
      card.addEventListener("click", (e) => {
        if (e.target.closest('.sc-delete')) return;
        openSession(s.sessionId);
      });
      grid.appendChild(card);
    });

    // Mouse tilt 3D nos cards
    document.querySelectorAll('.session-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        card.style.transform = `translateY(-8px) scale(1.015) rotateY(${dx * 8}deg) rotateX(${-dy * 6}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });

  } catch(e) {
    grid.innerHTML = `<p class="session-loading">Erro ao carregar sessões: ${esc(e.message)}</p>`;
  }
}

async function openSession(sessionId) {
  try {
    const [stateR, loadR] = await Promise.all([
      fetch(`/api/session-state/${sessionId}`),
      fetch("/api/load-session", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sessionId })
      })
    ]);
    const state = stateR.ok ? await stateR.json() : { history:[], sheet:null };
    const data  = loadR.ok  ? await loadR.json()  : {};
    if (!loadR.ok) throw new Error(data.error || "Erro ao carregar sessão");

    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("sessionIntro", JSON.stringify({
      history:            state.history   || [],
      narration:          data.narration  || "A missão continua.",
      sheet:              data.sheet      || state.sheet,
      all_characters:     data.all_characters || state.all_characters || (data.sheet ? [data.sheet] : (state.sheet ? [state.sheet] : [])),
      game_mode:          data.game_mode || state.game_mode || { tipo: "individual" },
      initiative_order:   data.initiative_order || state.initiative_order || [],
      current_turn_index: data.current_turn_index ?? state.current_turn_index ?? 0,
      visual_background:  data.visual_background || state.visual_background || null,
      last_dice:          data.last_dice  || state.last_dice,
      dice_request:       data.dice_request || null,
      isResume:           true
    }));
    window.location = "chat.html";
  } catch(e) { showErrorModal("Erro ao carregar: " + e.message); }
}

async function deleteSession(evt, sessionId) {
  evt.stopPropagation();
  showConfirmModal(
    "Deletar Sessão",
    "Esta sessão será excluída permanentemente. Esta ação não pode ser desfeita.",
    async () => {
      try {
        const r = await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
        loadSessions();
      } catch(e) { showErrorModal("Erro ao deletar: " + e.message); }
    }
  );
}

function showConfirmModal(title, text, onConfirm) {
  let overlay = document.getElementById("confirm-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "confirm-overlay";
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-icon">⸸</div>
        <div class="confirm-title" id="confirm-title">Confirmar</div>
        <div class="confirm-text" id="confirm-text">Tem certeza?</div>
        <div class="confirm-actions">
          <button class="confirm-btn-cancel" id="confirm-cancel" onclick="closeConfirmModal()">Cancelar</button>
          <button class="confirm-btn-delete" id="confirm-ok">Excluir</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-text").textContent  = text;
  document.getElementById("confirm-ok").onclick = () => { closeConfirmModal(); onConfirm(); };
  overlay.classList.add("active");
  overlay.onclick = e => { if (e.target === overlay) closeConfirmModal(); };
}

function closeConfirmModal() {
  const overlay = document.getElementById("confirm-overlay");
  if (overlay) overlay.classList.remove("active");
}

function showErrorModal(msg) {
  showConfirmModal("Erro", msg, () => {});
  setTimeout(() => {
    const ok = document.getElementById("confirm-ok");
    if (ok) ok.style.display = "none";
    const cancel = document.getElementById("confirm-cancel");
    if (cancel) cancel.textContent = "Fechar";
  }, 50);
}

window.addEventListener("focus", loadSessions);
window.addEventListener("pageshow", loadSessions);

loadSessions();
