/**
 * audioManager.js — Sistema Dinâmico de Trilha Sonora & Efeitos Sonoros
 * IMaster RPG — Motor Narrativo & Paranormal
 */

const AudioManager = (function() {
  let audioDB = null;
  let currentAudio = null;
  let nextAudio = null;
  let currentTrackInfo = null;
  let currentMood = null;
  let isMuted = localStorage.getItem("imaster_audio_muted") === "true";
  let masterVolume = parseFloat(localStorage.getItem("imaster_audio_vol") || "0.4");
  let audioCtx = null;
  let isUnlocked = false;
  let fadeInterval = null;

  // ─── Inicialização do AudioContext (Web Audio para SFX) ────────────────────
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ─── Carrega banco de áudios ────────────────────────────────────────────────
  async function loadDatabase() {
    if (audioDB) return audioDB;
    try {
      const res = await fetch("data/audioDatabase.json?v=1");
      if (res.ok) {
        audioDB = await res.json();
        return audioDB;
      }
    } catch (e) {
      console.warn("[AudioManager] Falha ao carregar audioDatabase.json:", e);
    }
    return null;
  }

  // ─── Desbloqueio de Autoplay pelo Navegador ─────────────────────────────────
  function unlockAudio() {
    if (isUnlocked) return;
    isUnlocked = true;
    getAudioContext();
    if (currentAudio && currentAudio.paused && !isMuted) {
      currentAudio.play().catch(() => {});
    }
  }

  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
  window.addEventListener("touchstart", unlockAudio, { once: true });

  // ─── Fade In / Fade Out de Música ───────────────────────────────────────────
  function fadeOutAudio(audioEl, durationMs = 1500) {
    if (!audioEl) return;
    const startVol = audioEl.volume;
    const steps = 20;
    const stepTime = durationMs / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const nextVol = Math.max(0, startVol * (1 - step / steps));
      audioEl.volume = nextVol;
      if (step >= steps || nextVol <= 0.01) {
        clearInterval(interval);
        audioEl.pause();
        audioEl.src = "";
      }
    }, stepTime);
  }

  function fadeInAudio(audioEl, targetVol, durationMs = 2000) {
    if (!audioEl) return;
    audioEl.volume = 0;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.log("[AudioManager] Aguardando interação do usuário para áudio:", e.message);
      });
    }

    const steps = 25;
    const stepTime = durationMs / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const currentVol = (targetVol * (step / steps));
      if (!isMuted) {
        audioEl.volume = Math.min(targetVol, currentVol);
      }
      if (step >= steps) {
        clearInterval(interval);
      }
    }, stepTime);
  }

  // ─── Tocar Trilha por Categoria (Mood) ──────────────────────────────────────
  async function setMood(mood, forceNewTrack = false) {
    if (!mood) return;
    const cleanMood = mood.toLowerCase().trim();

    // Se a página for o menu inicial, silêncio absoluto
    if (document.body.classList.contains("menu-page")) {
      stopMusic();
      return;
    }

    if (cleanMood === currentMood && !forceNewTrack && currentAudio && !currentAudio.paused) {
      return; // Já está tocando o clima correto
    }

    const db = await loadDatabase();
    if (!db || !db.categorias || !db.categorias[cleanMood]) {
      console.warn("[AudioManager] Clima musical desconhecido:", cleanMood);
      return;
    }

    const trackList = db.categorias[cleanMood];
    if (!trackList || trackList.length === 0) return;

    // Escolhe aleatoriamente evitando repetir a mesma faixa consecutiva
    let chosen = trackList[Math.floor(Math.random() * trackList.length)];
    if (trackList.length > 1 && currentTrackInfo && chosen.id === currentTrackInfo.id) {
      const filtered = trackList.filter(t => t.id !== currentTrackInfo.id);
      chosen = filtered[Math.floor(Math.random() * filtered.length)];
    }

    playTrack(chosen, cleanMood);
  }

  // ─── Reproduzir Faixa com Crossfade ─────────────────────────────────────────
  function playTrack(track, mood) {
    if (!track || !track.url) return;

    currentMood = mood;
    currentTrackInfo = track;

    // Atualiza widget visual se existir
    updateAudioWidget(track, mood);

    const prevAudio = currentAudio;
    if (prevAudio) {
      fadeOutAudio(prevAudio, 1600);
    }

    const newAudio = new Audio();
    newAudio.src = track.url;
    newAudio.loop = (mood !== "vitoria" && mood !== "derrota"); // Vitória e derrota tocam uma vez ou repetem suave
    newAudio.crossOrigin = "anonymous";

    const targetVolume = (track.volume_padrao || 0.45) * masterVolume;

    currentAudio = newAudio;
    fadeInAudio(newAudio, targetVolume, 2200);

    // Quando terminar (se não estiver em loop), volta para calmo ou repete
    newAudio.onended = () => {
      if (mood === "vitoria" || mood === "derrota") {
        setTimeout(() => setMood("calmo"), 4000);
      }
    };
  }

  function stopMusic(durationMs = 1200) {
    if (currentAudio) {
      fadeOutAudio(currentAudio, durationMs);
      currentAudio = null;
      currentMood = null;
      currentTrackInfo = null;
    }
  }

  // ─── Controle de Volume e Mute ──────────────────────────────────────────────
  function setVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem("imaster_audio_vol", masterVolume.toString());
    if (currentAudio && !isMuted) {
      const base = currentTrackInfo?.volume_padrao || 0.45;
      currentAudio.volume = base * masterVolume;
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("imaster_audio_muted", isMuted.toString());

    if (currentAudio) {
      if (isMuted) {
        currentAudio.volume = 0;
      } else {
        const base = currentTrackInfo?.volume_padrao || 0.45;
        currentAudio.volume = base * masterVolume;
        if (currentAudio.paused) currentAudio.play().catch(() => {});
      }
    }

    updateMuteUI();
    return isMuted;
  }

  // ─── SÍNTESE PROCEDURAL DE EFEITOS SONOROS (Zero-Latency Web Audio) ─────────
  function playSFX(type) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    try {
      switch (type) {
        case "dice_roll": {
          // Cliques secos de rolagem de dado
          for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(800 + Math.random() * 600, t + i * 0.06);
            filter.Q.setValueAtTime(3, t + i * 0.06);

            osc.type = "sine";
            osc.frequency.setValueAtTime(350 + Math.random() * 250, t + i * 0.06);
            osc.frequency.exponentialRampToValueAtTime(100, t + i * 0.06 + 0.04);

            gain.gain.setValueAtTime(0.08 * masterVolume, t + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.04);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.05);
          }
          break;
        }

        case "crit": {
          // Acorde cintilante triunfante / revelação dourada
          const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
          freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(f, t + idx * 0.05);
            gain.gain.setValueAtTime(0.12 * masterVolume, t + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t + idx * 0.05);
            osc.stop(t + idx * 0.05 + 0.85);
          });
          break;
        }

        case "disaster": {
          // Sub-grave pesado de calamidade / desastre
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(140, t);
          osc.frequency.exponentialRampToValueAtTime(35, t + 0.7);

          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(300, t);
          filter.frequency.exponentialRampToValueAtTime(60, t + 0.7);

          gain.gain.setValueAtTime(0.22 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start(t);
          osc.stop(t + 0.8);
          break;
        }

        case "attack": {
          // Golpe / impacto tático cortante
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(300, t);
          osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
          gain.gain.setValueAtTime(0.18 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.17);
          break;
        }

        case "damage_pv": {
          // Impacto pesado visceral de dano
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180, t);
          osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
          gain.gain.setValueAtTime(0.25 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.3);
          break;
        }

        case "damage_san": {
          // Frequência misteriosa e distorcida de trauma mental
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = "sine";
          osc2.type = "sine";
          osc1.frequency.setValueAtTime(440, t);
          osc1.frequency.linearRampToValueAtTime(432, t + 0.6); // Batimento binaural perturbador
          osc2.frequency.setValueAtTime(448, t);
          osc2.frequency.linearRampToValueAtTime(437, t + 0.6);

          gain.gain.setValueAtTime(0.14 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.7);
          osc2.stop(t + 0.7);
          break;
        }

        case "item": {
          // Clique suave de uso de item / poção
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, t);
          osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
          gain.gain.setValueAtTime(0.1 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
          break;
        }

        case "nex_up": {
          // Harmônico místico ascendente da contaminação paranormal
          const freqs = [220, 277.18, 329.63, 440, 554.37];
          freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(f, t + i * 0.07);
            gain.gain.setValueAtTime(0.12 * masterVolume, t + i * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.7);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t + i * 0.07);
            osc.stop(t + i * 0.07 + 0.75);
          });
          break;
        }

        case "turn_change": {
          // Sino misterioso sutil de mudança de turno
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.exponentialRampToValueAtTime(440, t + 0.4);
          gain.gain.setValueAtTime(0.06 * masterVolume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.5);
          break;
        }
      }
    } catch (e) {
      console.warn("[AudioManager] Erro ao executar SFX:", e);
    }
  }

  // ─── Atualização Visual do Widget de Áudio ─────────────────────────────────
  function updateAudioWidget(track, mood) {
    const titleEl = document.getElementById("audio-current-title");
    const moodEl = document.getElementById("audio-current-mood");
    const container = document.getElementById("audio-widget");

    if (titleEl) titleEl.textContent = track ? `${track.titulo} · ${track.origem}` : "Sem reprodução";
    if (moodEl) {
      const moodLabels = {
        calmo: "✦ Investigação / Calmo",
        tenso: "⚠ Suspense / Tensão",
        batalha: "⚔ Combate Ativo",
        perseguicao: "⚡ Perseguição / Fuga",
        vitoria: "🏆 Triunfo da Ordem",
        derrota: "☠ Derrota / Colapso"
      };
      moodEl.textContent = moodLabels[mood] || mood;
    }
    if (container && track) {
      container.classList.add("has-audio");
    }
  }

  function updateMuteUI() {
    const btn = document.getElementById("audio-mute-btn");
    if (btn) {
      btn.innerHTML = isMuted ? "🔇" : "🔊";
      btn.setAttribute("title", isMuted ? "Ativar Áudio" : "Mutar Áudio");
      btn.classList.toggle("is-muted", isMuted);
    }
  }

  // ─── Interface Pública ──────────────────────────────────────────────────────
  return {
    init: async function() {
      await loadDatabase();
      updateMuteUI();
      // Se não for menu principal, inicia em calmo
      if (!document.body.classList.contains("menu-page")) {
        setMood("calmo");
      }
    },
    setMood,
    playSFX,
    setVolume,
    toggleMute,
    stopMusic,
    getCurrentTrack: () => currentTrackInfo,
    getCurrentMood: () => currentMood,
    isMuted: () => isMuted
  };
})();

// Auto-inicialização quando o DOM carregar
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    // Se for página de chat ou jogo, inicia o áudio
    if (document.body.classList.contains("chat-page")) {
      AudioManager.init();
    } else if (document.body.classList.contains("menu-page")) {
      AudioManager.stopMusic();
    }
  });
}
