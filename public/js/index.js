// index.js — Inicialização do Sistema Solar 3D e Navegação

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Dice3D !== "undefined" && Dice3D.initDiceSolarSystem) {
    Dice3D.initDiceSolarSystem("three-solar-container");
  }
});

function goCreate() {
  sessionStorage.removeItem("gameMode");
  sessionStorage.removeItem("themeChoice");
  sessionStorage.removeItem("mp_queue");
  sessionStorage.removeItem("mp_queue_idx");
  sessionStorage.removeItem("mp_total");
  sessionStorage.removeItem("mp_created");
  sessionStorage.removeItem("pendingCharacter");
  window.location = "mode.html";
}

function goLoad() {
  window.location = "load.html";
}
