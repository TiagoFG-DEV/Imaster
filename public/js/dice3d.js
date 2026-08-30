// dice3d.js — Motor 3D de Dados Paranormais & Sistema Solar Cósmico (Three.js)

const Dice3D = (function() {
  const DICE_RULES_INFO = {
    d20: { name: "d20 — Vinte Faces", desc: "Testes de Atributo, Perícias, Iniciativa, Ataques e Resistência", color: 0xc9a84c, faces: 20 },
    d12: { name: "d12 — Doze Faces", desc: "Dano de Armas Pesadas (Montante, Acha, Machado de Duas Mãos)", color: 0xe04040, faces: 12 },
    d10: { name: "d10 — Dez Faces", desc: "Dano de Fuzis de Caça, Carabinas, Espingardas e Rituais de Dano", color: 0x3b82f6, faces: 10 },
    d8:  { name: "d8 — Oito Faces", desc: "Dano de Armas Médias (Espadas, Katana, Revólver) e Rituais como Cicatrização", color: 0x10b981, faces: 8 },
    d6:  { name: "d6 — Seis Faces", desc: "Dano de Armas Leves (Pistola 9mm, Faca), Ataque Furtivo (+2d6) e Perito (+1d6)", color: 0xa855f7, faces: 6 },
    d4:  { name: "d4 — Quatro Faces", desc: "Dano de Ataques Desarmados/Socos, Adagas e Armas Improvisadas", color: 0xf59e0b, faces: 4 },
    d3:  { name: "d3 — Três Faces", desc: "Rolagem especial de sorte (1d6 ÷ 2) e testes de Moeda do Medo", color: 0xec4899, faces: 3 }
  };

  function createDiceGeometry(type, size = 1.6) {
    switch (type.toLowerCase()) {
      case "d20":
        return new THREE.IcosahedronGeometry(size, 0);
      case "d12":
        return new THREE.DodecahedronGeometry(size, 0);
      case "d10":
        return new THREE.ConeGeometry(size * 1.1, size * 1.6, 5);
      case "d8":
        return new THREE.OctahedronGeometry(size, 0);
      case "d6":
        return new THREE.BoxGeometry(size * 1.25, size * 1.25, size * 1.25);
      case "d4":
        return new THREE.TetrahedronGeometry(size * 1.3, 0);
      case "d3":
        return new THREE.CylinderGeometry(size, size, size * 0.7, 3);
      default:
        return new THREE.IcosahedronGeometry(size, 0);
    }
  }

  function createDiceMaterial(color = 0xc9a84c, wireframe = false) {
    return new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: wireframe,
      emissive: new THREE.Color(color).multiplyScalar(0.25),
      flatShading: true
    });
  }

  // ─── SISTEMA SOLAR DE DADOS 3D (MENU PRINCIPAL) ───
  function initDiceSolarSystem(containerId) {
    const container = document.getElementById(containerId);
    if (!container || typeof THREE === "undefined") return null;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06060a, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Luzes Ambientais & Místicas
    const ambientLight = new THREE.AmbientLight(0x181424, 2.0);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffdf80, 3.8, 25);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const goldKeyLight = new THREE.DirectionalLight(0xffe89e, 1.2);
    goldKeyLight.position.set(5, 6, 7);
    scene.add(goldKeyLight);

    const bloodRimLight = new THREE.PointLight(0xa82020, 2.2, 20);
    bloodRimLight.position.set(-6, -4, 4);
    scene.add(bloodRimLight);

    const solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    // ─── 1. SOL CENTRAL: D20 ───
    const sunGeo = createDiceGeometry("d20", 1.45);
    const sunMat = createDiceMaterial(0xc9a84c);
    sunMat.emissive = new THREE.Color(0x705214);
    sunMat.roughness = 0.2;
    sunMat.metalness = 0.9;
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.castShadow = true;

    const sunWireMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0, wireframe: true, transparent: true, opacity: 0.45 });
    const sunWire = new THREE.Mesh(sunGeo, sunWireMat);
    sunWire.scale.set(1.025, 1.025, 1.025);
    sunMesh.add(sunWire);
    solarSystemGroup.add(sunMesh);

    // Anéis Rúnicos Ocultos ao redor do D20 Central
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xc9a84c, wireframe: true, transparent: true, opacity: 0.18 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.015, 6, 48), ringMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.015, 6, 36), ringMat);
    ring2.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 6;
    solarSystemGroup.add(ring1);
    solarSystemGroup.add(ring2);

    // ─── 2. PLANETAS ORBITANTES: D4, D6, D8, D10, D12, D3 ───
    const PLANET_CONFIGS = [
      { type: "d4",  color: 0xf59e0b, size: 0.36, radius: 2.6, speed: 0.75, incX: 0.20, incZ: 0.10, rot: [1.4, 0.8, 1.1] },
      { type: "d6",  color: 0xa855f7, size: 0.42, radius: 3.4, speed: 0.58, incX: -0.22, incZ: 0.18, rot: [0.9, 1.3, 0.7] },
      { type: "d8",  color: 0x10b981, size: 0.46, radius: 4.2, speed: 0.46, incX: 0.28, incZ: -0.15, rot: [1.1, 0.9, 1.4] },
      { type: "d10", color: 0x3b82f6, size: 0.48, radius: 5.0, speed: 0.38, incX: -0.18, incZ: 0.24, rot: [0.8, 1.4, 0.6] },
      { type: "d12", color: 0xe04040, size: 0.52, radius: 5.8, speed: 0.30, incX: 0.32, incZ: 0.12, rot: [0.7, 0.8, 1.2] },
      { type: "d3",  color: 0xec4899, size: 0.34, radius: 6.6, speed: 0.24, incX: -0.26, incZ: -0.20, rot: [1.2, 0.7, 0.9] }
    ];

    const planets = [];

    PLANET_CONFIGS.forEach((cfg, idx) => {
      const orbitGroup = new THREE.Group();
      orbitGroup.rotation.x = cfg.incX;
      orbitGroup.rotation.z = cfg.incZ;
      solarSystemGroup.add(orbitGroup);

      // Trilha de Órbita Circular Mística
      const trackPoints = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        trackPoints.push(new THREE.Vector3(Math.cos(theta) * cfg.radius, 0, Math.sin(theta) * cfg.radius));
      }
      const trackGeo = new THREE.BufferGeometry().setFromPoints(trackPoints);
      const trackMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending
      });
      const trackLine = new THREE.Line(trackGeo, trackMat);
      orbitGroup.add(trackLine);

      // Malha do Dado Planeta
      const pGeo = createDiceGeometry(cfg.type, cfg.size);
      const pMat = createDiceMaterial(cfg.color);
      pMat.emissive = new THREE.Color(cfg.color).multiplyScalar(0.25);
      const pMesh = new THREE.Mesh(pGeo, pMat);

      const pWireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 });
      const pWire = new THREE.Mesh(pGeo, pWireMat);
      pWire.scale.set(1.03, 1.03, 1.03);
      pMesh.add(pWire);

      orbitGroup.add(pMesh);

      const initialAngle = (idx / PLANET_CONFIGS.length) * Math.PI * 2 + (idx * 0.4);

      planets.push({
        mesh: pMesh,
        orbitGroup: orbitGroup,
        radius: cfg.radius,
        speed: cfg.speed,
        rot: cfg.rot,
        angle: initialAngle
      });
    });

    // ─── 3. POEIRA ESTELAR / PARTÍCULAS PARANORMAIS ───
    const partCount = 220;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i += 3) {
      partPos[i] = (Math.random() - 0.5) * 22;
      partPos[i+1] = (Math.random() - 0.5) * 18;
      partPos[i+2] = (Math.random() - 0.5) * 14;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({
      color: 0xc9a84c,
      size: 0.07,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    // Interação do Mouse & Clique
    let mouseX = 0, mouseY = 0;
    let targetTiltX = 0, targetTiltY = 0;
    let burstImpulse = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener("click", (e) => {
      // Impulso ao clicar em áreas vazias
      if (e.target.tagName !== "BUTTON" && e.target.tagName !== "A") {
        burstImpulse = 1.0;
        playDiceSound();
      }
    });

    window.addEventListener("resize", () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      burstImpulse *= 0.95;
      const speedMultiplier = 1.0 + burstImpulse * 3.5;

      // Rotação do D20 Sun Central
      sunMesh.rotation.y += (0.4 + burstImpulse * 4.0) * delta;
      sunMesh.rotation.x = Math.sin(time * 0.8) * 0.15;
      sunMesh.rotation.z = Math.cos(time * 0.6) * 0.1;
      sunMesh.position.y = Math.sin(time * 1.6) * 0.1;

      // Anéis
      ring1.rotation.z += 0.3 * delta;
      ring2.rotation.y -= 0.25 * delta;

      // Planetas Orbitantes
      planets.forEach((p) => {
        p.angle += p.speed * speedMultiplier * delta * 0.7;
        p.mesh.position.x = Math.cos(p.angle) * p.radius;
        p.mesh.position.z = Math.sin(p.angle) * p.radius;
        p.mesh.position.y = Math.sin(p.angle * 2.0) * 0.2;

        p.mesh.rotation.x += (p.rot[0] + burstImpulse * 5) * delta;
        p.mesh.rotation.y += (p.rot[1] + burstImpulse * 6) * delta;
        p.mesh.rotation.z += (p.rot[2] + burstImpulse * 4) * delta;
      });

      // Partículas
      particles.rotation.y = time * 0.03;
      particles.rotation.x = Math.sin(time * 0.04) * 0.08;

      // Tilt e Parallax Suave
      targetTiltY = mouseX * 0.35;
      targetTiltX = -mouseY * 0.25;
      solarSystemGroup.rotation.y += (targetTiltY - solarSystemGroup.rotation.y) * 0.05;
      solarSystemGroup.rotation.x += (targetTiltX - solarSystemGroup.rotation.x) * 0.05;

      renderer.render(scene, camera);
    }
    animate();

    return {
      triggerBurst: () => {
        burstImpulse = 1.0;
        playDiceSound();
      }
    };
  }

  function initIntroScene(containerId) {
    return initDiceSolarSystem(containerId);
  }

  // ─── DADO 3D INDIVIDUAL INTERATIVO (MODAL DE ROLAGEM) ───
  function renderDie3D(containerEl, diceType = "d20") {
    if (!containerEl || typeof THREE === "undefined") return null;

    const w = containerEl.clientWidth > 0 ? containerEl.clientWidth : 90;
    const h = containerEl.clientHeight > 0 ? containerEl.clientHeight : 90;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, (w > 0 && h > 0) ? (w / h) : 1, 0.1, 50);
    camera.position.set(0, 0, 4.2);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
    } catch (e) {
      console.warn("[Dice3D] Falha ao inicializar WebGLRenderer:", e);
      return null;
    }

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;display:block;";
    renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
    
    while (containerEl.firstChild) {
      containerEl.removeChild(containerEl.firstChild);
    }
    containerEl.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x221832, 2.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffe89e, 2.2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xa855f7, 2.5, 8);
    rimLight.position.set(-3, -2, 2);
    scene.add(rimLight);

    const info = DICE_RULES_INFO[diceType.toLowerCase()] || DICE_RULES_INFO.d20;
    const geo = createDiceGeometry(diceType, 1.22);
    const mat = createDiceMaterial(info.color);
    mat.roughness = 0.2;
    mat.metalness = 0.85;
    const mesh = new THREE.Mesh(geo, mat);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0, wireframe: true, transparent: true, opacity: 0.35 });
    const wire = new THREE.Mesh(geo, wireMat);
    wire.scale.set(1.03, 1.03, 1.03);
    mesh.add(wire);

    scene.add(mesh);

    let isRolling = false;
    let rollStart = 0;
    let rollDuration = 1200;
    let velX = 0.4, velY = 0.6, velZ = 0.3;
    let animId = null;
    let disposed = false;

    function loop(now) {
      if (disposed) return;
      animId = requestAnimationFrame(loop);

      if (isRolling) {
        const elapsed = now - rollStart;
        const progress = Math.min(1, elapsed / rollDuration);
        const ease = 1 - Math.pow(progress, 2.2);
        mesh.rotation.x += (velX * 24 * ease) * 0.016;
        mesh.rotation.y += (velY * 28 * ease) * 0.016;
        mesh.rotation.z += (velZ * 20 * ease) * 0.016;
        mesh.position.y = Math.sin(progress * Math.PI * 3) * ease * 0.35;
        mesh.scale.setScalar(1 + ease * 0.15);

        if (progress >= 1) {
          isRolling = false;
          mesh.position.y = 0;
          mesh.scale.setScalar(1);
        }
      } else {
        mesh.rotation.y += 0.012;
        mesh.rotation.x = Math.sin(now * 0.0015) * 0.18;
        mesh.position.y = Math.sin(now * 0.0025) * 0.06;
      }

      renderer.render(scene, camera);
    }

    animId = requestAnimationFrame(loop);

    return {
      roll: (duration = 1200) => {
        isRolling = true;
        rollStart = performance.now();
        rollDuration = duration;
        velX = 0.5 + Math.random() * 0.8;
        velY = 0.6 + Math.random() * 0.9;
        velZ = 0.4 + Math.random() * 0.7;
      },
      destroy: () => {
        disposed = true;
        if (animId) cancelAnimationFrame(animId);
        try {
          geo.dispose();
          mat.dispose();
          wireMat.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        } catch (e) {}
      }
    };
  }

  // ─── MODAL DE ROLAGEM 3D (CHAT / SESSÃO) ───
  function rollModal3D(containerEl, diceType = "d20", targetValue = 20, onComplete) {
    if (!containerEl || typeof THREE === "undefined") {
      if (onComplete) onComplete(targetValue);
      return;
    }

    const w = containerEl.clientWidth || 300;
    const h = containerEl.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    containerEl.innerHTML = "";
    containerEl.appendChild(renderer.domElement);

    const light1 = new THREE.PointLight(0xffdf80, 2.8, 12);
    light1.position.set(3, 4, 4);
    scene.add(light1);

    const light2 = new THREE.AmbientLight(0x201525, 1.5);
    scene.add(light2);

    const info = DICE_RULES_INFO[diceType.toLowerCase()] || DICE_RULES_INFO.d20;
    const geo = createDiceGeometry(diceType, 1.4);
    const mat = createDiceMaterial(info.color);
    const mesh = new THREE.Mesh(geo, mat);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
    const wire = new THREE.Mesh(geo, wireMat);
    wire.scale.set(1.02, 1.02, 1.02);
    mesh.add(wire);

    scene.add(mesh);

    let startTime = performance.now();
    const duration = 1800;
    let isFinished = false;

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        const speed = (1 - Math.pow(progress, 2)) * 0.45;
        mesh.rotation.x += speed * 1.5;
        mesh.rotation.y += speed * 2.1;
        mesh.rotation.z += speed * 1.2;
        mesh.position.y = Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.4;
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      } else if (!isFinished) {
        isFinished = true;
        mesh.rotation.set(0.3, 0.4, 0);
        mesh.position.y = 0;
        renderer.render(scene, camera);

        playDiceSettleSound();
        if (onComplete) onComplete(targetValue);
      }
    }
    requestAnimationFrame(frame);
  }

  let audioCtx = null;
  let isMuted = true;
  let droneOsc1 = null, droneOsc2 = null, droneGain = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    } catch(e) {}
  }

  function toggleParanormalAudio() {
    initAudio();
    if (!audioCtx) return false;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isMuted = !isMuted;
    if (!isMuted) {
      startAmbientDrone();
    } else {
      stopAmbientDrone();
    }
    return !isMuted;
  }

  function startAmbientDrone() {
    if (!audioCtx || droneGain) return;
    try {
      droneGain = audioCtx.createGain();
      droneGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      droneGain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 3);
      droneGain.connect(audioCtx.destination);

      droneOsc1 = audioCtx.createOscillator();
      droneOsc1.type = "sawtooth";
      droneOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, audioCtx.currentTime);

      droneOsc1.connect(filter);
      filter.connect(droneGain);
      droneOsc1.start();

      droneOsc2 = audioCtx.createOscillator();
      droneOsc2.type = "sine";
      droneOsc2.frequency.setValueAtTime(108, audioCtx.currentTime);
      droneOsc2.connect(filter);
      droneOsc2.start();
    } catch(e) {}
  }

  function stopAmbientDrone() {
    if (!droneGain || !audioCtx) return;
    try {
      droneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
      setTimeout(() => {
        if (droneOsc1) { droneOsc1.stop(); droneOsc1.disconnect(); droneOsc1 = null; }
        if (droneOsc2) { droneOsc2.stop(); droneOsc2.disconnect(); droneOsc2 = null; }
        if (droneGain) { droneGain.disconnect(); droneGain = null; }
      }, 1000);
    } catch(e) {}
  }

  function playDiceSound() {
    if (!audioCtx || isMuted) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400 + Math.random() * 200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}
  }

  function playDiceSettleSound() {
    if (!audioCtx || isMuted) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  }

  return {
    DICE_RULES_INFO,
    initDiceSolarSystem,
    initIntroScene,
    renderDie3D,
    rollModal3D,
    toggleParanormalAudio,
    playDiceSound,
    playDiceSettleSound
  };
})();
