import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// --- ZMIENNE GLOBALNE I KONFIGURACJA KLIENTA ---
let scene, renderer, clock, camera;
let localPlayerId = null;
let clientGameState = {}; // Lokalna kopia stanu gry z serwera
let selectionRenderers = [];
let isGameStarted = false;
let isSelectionScreenActive = false;

const keys = {};
const gameObjects = {
  players: {},
  houses: {},
  toilets: {},
  crates: {},
  projectiles: {}, // Dodano do śledzenia pocisków
  particles: [],
};

const socket = io();

// --- STAŁE I DANE ---
const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 22, speed: 18, turretRot: 1.8 }, create: createPL01Tank },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 35, speed: 12, turretRot: 1.2 }, create: createAbramsTank },
  standard: { name: "Standard", stats: { hp: 100, damage: 25, speed: 15, turretRot: 1.5 }, create: createStandardTank },
};
const MAP_SIZE = 500;

// --- FUNKCJE TWORZĄCE OBIEKTY 3D (bez zmian) ---
const LAMBERT_MATERIAL = (color) => new THREE.MeshLambertMaterial({ color });
function createTrackTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 128; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#3a3a3a"; ctx.fillRect(0, 0, 32, 128); ctx.fillStyle = "#2a2a2a";
  for (let i = 0; i < 128; i += 8) { ctx.fillRect(0, i, 32, 4); } const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; return texture;
}
const trackMaterial = new THREE.MeshLambertMaterial({ map: createTrackTexture() });
function createGroundTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#3c581a"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) { const x = Math.random() * 256; const y = Math.random() * 256; ctx.fillStyle = Math.random() > 0.7 ? "#6B8E23" : "#556B2F"; ctx.fillRect(x, y, 2, 2); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(32, 32); return texture;
}
function createStandardTank(color) {
    const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color);
    const hullWidth = 5.5, hullHeight = 1.8, hullLength = 9.0; const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength - 2), hullMaterial);
    mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull); const glacis = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight * 1.2, 2.5), hullMaterial);
    glacis.position.set(0, hullHeight / 2 - 0.2, -hullLength / 2 + 0.5); glacis.rotation.x = -Math.PI / 6; hullGroup.add(glacis); const trackWidth = 1.2, trackHeight = 2.4, trackLength = hullLength + 1;
    const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial); const rightTrack = leftTrack.clone();
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2; rightTrack.position.x = hullWidth / 2 + trackWidth / 2; trackGroup.add(leftTrack, rightTrack); tank.add(hullGroup);
    const turretPoints = [new THREE.Vector3(2, 0, 2), new THREE.Vector3(2, 0, -2.5), new THREE.Vector3(-2, 0, -2.5), new THREE.Vector3(-2, 0, 2), new THREE.Vector3(1.5, 2, 1.5), new THREE.Vector3(1.5, 2, -2), new THREE.Vector3(-1.5, 2, -2), new THREE.Vector3(-1.5, 2, 1.5)];
    turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1)))); const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.8, -2.5); turretGroup.add(mantlet);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 6, 12), LAMBERT_MATERIAL(0x333333)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 3; mantlet.add(barrel);
    turretGroup.position.y = hullHeight + 0.1; turretGroup.position.z = 1; tank.add(turretGroup); tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
}
function createPL01Tank(color) {
    const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color); const hullWidth = 6.0, hullHeight = 1.5, hullLength = 9.5;
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.8, hullHeight, hullLength), hullMaterial); mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull);
    const sidePanelGeom = new THREE.BoxGeometry(0.5, hullHeight * 1.5, hullLength); const leftPanel = new THREE.Mesh(sidePanelGeom, hullMaterial); leftPanel.position.set(-hullWidth / 2, hullHeight / 2, 0); leftPanel.rotation.z = 0.5; hullGroup.add(leftPanel);
    const rightPanel = new THREE.Mesh(sidePanelGeom, hullMaterial); rightPanel.position.set(hullWidth / 2, hullHeight / 2, 0); rightPanel.rotation.z = -0.5; hullGroup.add(rightPanel); tank.add(hullGroup);
    const trackWidth = 1.0, trackHeight = 1.8, trackLength = hullLength + 1; const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial);
    leftTrack.position.x = -hullWidth / 2 + 0.5; const rightTrack = leftTrack.clone(); rightTrack.position.x = hullWidth / 2 - 0.5; trackGroup.add(leftTrack, rightTrack); trackGroup.position.y = trackHeight / 2 - 0.5; hullGroup.add(trackGroup);
    const turretPoints = [new THREE.Vector3(2.5, 0, 3), new THREE.Vector3(2.5, 0, -3), new THREE.Vector3(-2.5, 0, -3), new THREE.Vector3(-2.5, 0, 3), new THREE.Vector3(0, 1.8, 2.5), new THREE.Vector3(0, 1.8, -2.5)];
    turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1)))); const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.5), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.6, -2.8); turretGroup.add(mantlet);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 7), LAMBERT_MATERIAL(0x333333)); barrel.position.z = 3.5; mantlet.add(barrel); turretGroup.position.y = hullHeight; tank.add(turretGroup);
    tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
}
function createAbramsTank(color) {
    const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color); const hullWidth = 6.5, hullHeight = 2.0, hullLength = 10.0;
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.7, hullHeight, hullLength), hullMaterial); mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull);
    const trackWidth = 1.4, trackHeight = 2.0, trackLength = hullLength; const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial);
    leftTrack.position.x = -hullWidth / 2 + 0.8; const rightTrack = leftTrack.clone(); rightTrack.position.x = hullWidth / 2 - 0.8; trackGroup.add(leftTrack, rightTrack); trackGroup.position.y = trackHeight / 2 - 0.6; hullGroup.add(trackGroup); tank.add(hullGroup);
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 1.0, 8), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1))); turretGroup.add(turretBase);
    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 6.0), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1))); turretTop.position.y = 1.1; turretGroup.add(turretTop); const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1.5), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.5, -3.0); turretGroup.add(mantlet);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 8, 12), LAMBERT_MATERIAL(0x333333)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 4; mantlet.add(barrel);
    turretGroup.position.y = hullHeight; tank.add(turretGroup); tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
}
function createHouse() {
    const house = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 20), LAMBERT_MATERIAL(0xac8c6c)); body.position.y = 5; house.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 10, 6, 4), LAMBERT_MATERIAL(0xc05454)); roof.position.y = 10 + 3; roof.rotation.y = Math.PI / 4; house.add(roof); return house;
}
function createToilet() {
    const toilet = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 4), LAMBERT_MATERIAL(0x8b4513)); body.position.y = 3.5; toilet.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), LAMBERT_MATERIAL(0x5d3a1a)); roof.position.y = 7.25; roof.rotation.x = 0.2; toilet.add(roof); return toilet;
}
function createSupplyCrate() {
    const crate = new THREE.Group(); const material = LAMBERT_MATERIAL(0x8B4513); const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.5), material); base.position.y = 1;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 3, 16, 1, false, 0, Math.PI), material); lid.rotation.z = Math.PI / 2; lid.position.y = 2; crate.add(base, lid); return crate;
}

// --- LOGIKA UI ---
function initializeUI() {
    document.getElementById("intro-logo").addEventListener("animationend", () => {
        document.getElementById("intro-screen").style.display = "none"; document.getElementById("start-screen").style.display = "flex";
        initSelectionScreenRenderers(); animateSelectionScreen(); isSelectionScreenActive = true;
    });
    Object.keys(TANKS_DATA).forEach((tankKey) => {
        const tank = TANKS_DATA[tankKey];
        document.getElementById(`bar-${tankKey}-hp`).style.width = `${(tank.stats.hp / 150) * 100}%`; document.getElementById(`bar-${tankKey}-dmg`).style.width = `${(tank.stats.damage / 40) * 100}%`;
        document.getElementById(`bar-${tankKey}-spd`).style.width = `${(tank.stats.speed / 20) * 100}%`; document.getElementById(`bar-${tankKey}-rot`).style.width = `${(tank.stats.turretRot / 2) * 100}%`;
    });
    document.querySelectorAll(".select-button").forEach((button) => {
        button.addEventListener("click", (e) => {
            if (button.disabled) return; const card = e.target.closest(".tank-card"); const tankType = card.id.split("-")[1];
            socket.emit("selectTank", tankType); document.getElementById("start-screen").style.display = "none"; isSelectionScreenActive = false;
            selectionRenderers.forEach(({ renderer }) => renderer.dispose()); selectionRenderers = [];
        });
    });
}
function initSelectionScreenRenderers() {
    Object.keys(TANKS_DATA).forEach((tankKey) => {
        const canvas = document.getElementById(`canvas-${tankKey}`); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        scene.add(new THREE.AmbientLight(0xffffff, 1.2)); const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); dirLight.position.set(5, 10, 7); scene.add(dirLight);
        const tankMesh = TANKS_DATA[tankKey].create(new THREE.Color(0xaaaaaa)); tankMesh.scale.set(0.2, 0.2, 0.2); tankMesh.position.y = -1.5; scene.add(tankMesh); camera.position.z = 5;
        selectionRenderers.push({ scene, camera, renderer, tankMesh });
    });
}
function animateSelectionScreen() {
    if (!isSelectionScreenActive) return; requestAnimationFrame(animateSelectionScreen);
    selectionRenderers.forEach((item) => { item.tankMesh.rotation.y += 0.01; item.renderer.render(item.scene, item.camera); });
}
function updateHUD() {
    const hudEl = document.getElementById('hud'); if (!isGameStarted || !localPlayerId || !clientGameState.players || !clientGameState.players[localPlayerId]) { hudEl.style.display = 'none'; return; }
    hudEl.style.display = 'block'; const playerState = clientGameState.players[localPlayerId]; const maxHealth = playerState.maxHealth;
    document.getElementById('hp-value').innerText = `${Math.max(0, playerState.health.toFixed(0))} / ${maxHealth}`; const hpPercent = (Math.max(0, playerState.health) / maxHealth) * 100;
    const hpBar = document.getElementById('hp-bar'); hpBar.style.width = `${hpPercent}%`; hpBar.className = `hud-bar-fill ${hpPercent < 30 ? "low" : ""}`;
    document.getElementById('ammo-value').innerText = `${playerState.ammo} / 8 ${playerState.isReloading ? '(Przeładowuję...)' : ''}`;
    document.getElementById('medkits-value').innerText = playerState.medkits; document.getElementById('score-value').innerText = playerState.score;
    const respawnMsgEl = document.getElementById('respawn-message');
    if (playerState.isDestroyed && playerState.respawnTimer > 0) { respawnMsgEl.style.display = 'block'; respawnMsgEl.innerText = `ODRODZENIE ZA: ${Math.ceil(playerState.respawnTimer)}`; }
    else { respawnMsgEl.style.display = 'none'; }
}
function updateScoreboard() {
    const scoreDisplay = document.getElementById("score-display"); if (!clientGameState.players) return;
    let scoresHtml = Object.values(clientGameState.players).sort((a, b) => b.score - a.score)
        .map(p => `<div><span>${p.id === localPlayerId ? 'YOU' : p.id.substring(0, 6)}</span><span>${p.score}</span></div>`).join('');
    scoreDisplay.innerHTML = scoresHtml;
}

// --- LOGIKA GRY (KLIENT) ---
function initGame(payload) {
    localPlayerId = payload.playerId; clientGameState = payload.initialState; isGameStarted = true;
    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 200, 450);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const dirLight = new THREE.DirectionalLight(0xffffff, 0.7); dirLight.position.set(100, 80, 50); scene.add(dirLight);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), new THREE.MeshLambertMaterial({ map: createGroundTexture() })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    reconcileGameState(clientGameState); setupEventListeners(); animate();
}
function setupEventListeners() {
    document.addEventListener("keydown", (e) => { keys[e.code] = true; });
    document.addEventListener("keyup", (e) => {
        keys[e.code] = false; if (!isGameStarted || !localPlayerId) return;
        // --- POPRAWKA: Dodano nasłuchiwanie na Enter ---
        if (e.code === 'Enter') socket.emit('playerAction', { type: 'fire' });
        if (e.code === 'KeyR') socket.emit('playerAction', { type: 'reload' });
        if (e.code === 'KeyB') socket.emit('playerAction', { type: 'heal' });
    });
    const menuEl = document.getElementById("menu"), mapEl = document.getElementById("map-overlay"), scoreEl = document.getElementById("score-overlay");
    document.addEventListener("keydown", (e) => {
        if (!isGameStarted) return; if (e.code === "Escape") menuEl.style.display = menuEl.style.display === "flex" ? "none" : "flex";
        if (e.code === "KeyM") mapEl.style.display = mapEl.style.display === "flex" ? "none" : "flex";
        if (e.code === "Tab") { e.preventDefault(); scoreEl.style.display = "flex"; updateScoreboard(); }
    });
    document.addEventListener("keyup", (e) => { if (e.code === "Tab") scoreEl.style.display = "none"; });
}
function reconcileGameState(serverState) {
    const serverPlayerIds = Object.keys(serverState.players || {}); const clientPlayerIds = Object.keys(gameObjects.players);
    for (const id of serverPlayerIds) {
        if (!clientPlayerIds.includes(id)) {
            const playerData = serverState.players[id]; const tankColor = (id === localPlayerId) ? 0x38a849 : 0xcc3333;
            const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(tankColor));
            tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z); scene.add(tank); gameObjects.players[id] = tank;
        }
    }
    for (const id of clientPlayerIds) { if (!serverPlayerIds.includes(id)) { scene.remove(gameObjects.players[id]); delete gameObjects.players[id]; } }
    const objectTypes = ['houses', 'toilets', 'crates'];
    for (const type of objectTypes) {
        const serverObjectIds = Object.keys(serverState[type] || {}); const clientObjectIds = Object.keys(gameObjects[type]);
        for (const id of serverObjectIds) {
            if (!clientObjectIds.includes(id)) {
                const data = serverState[type][id]; let newObject;
                if (type === 'houses') newObject = createHouse(); else if (type === 'toilets') newObject = createToilet(); else if (type === 'crates') newObject = createSupplyCrate();
                if (newObject) { newObject.position.set(data.position.x, data.position.y, data.position.z); if (data.rotationY) newObject.rotation.y = data.rotationY; scene.add(newObject); gameObjects[type][id] = newObject; }
            }
        }
        for (const id of clientObjectIds) { if (!serverObjectIds.includes(id)) { scene.remove(gameObjects[type][id]); delete gameObjects[type][id]; } }
    }
}
function createProjectileMesh(data) {
    const ownerTank = gameObjects.players[data.ownerId];
    if (!ownerTank) return;
    
    const projectile = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.25, 1.0, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 2 })
    );

    // Oblicz pozycję i kierunek na podstawie modelu czołgu właściciela
    const startPosition = new THREE.Vector3();
    ownerTank.barrel.getWorldPosition(startPosition); // Używamy zapisanego odniesienia do lufy
    projectile.position.copy(startPosition);

    gameObjects.projectiles[data.id] = projectile;
    scene.add(projectile);
}

// --- GŁÓWNA PĘTLA RENDEROWANIA ---
function animate() {
    if (!isGameStarted) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    socket.emit("playerInput", keys);

    // Interpolacja czołgów
    for (const id in clientGameState.players) {
        const serverTank = clientGameState.players[id]; const clientTank = gameObjects.players[id];
        if (clientTank) {
            if (serverTank.isDestroyed) { clientTank.visible = false; continue; }
            clientTank.visible = true;
            clientTank.position.lerp(new THREE.Vector3(serverTank.position.x, serverTank.position.y, serverTank.position.z), 0.25);
            const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, serverTank.rotation.y, 0));
            clientTank.quaternion.slerp(targetQuaternion, 0.25);
            clientTank.turret.rotation.y = serverTank.turretRotation.y;
            clientTank.mantlet.rotation.x = serverTank.mantletRotation.x;
        }
    }
    
    // Interpolacja pocisków
    for (const id in clientGameState.projectiles) {
        const serverProjectile = clientGameState.projectiles[id];
        const clientProjectile = gameObjects.projectiles[id];
        if (clientProjectile && serverProjectile) {
            clientProjectile.position.lerp(new THREE.Vector3(serverProjectile.position.x, serverProjectile.position.y, serverProjectile.position.z), 0.5);
        }
    }

    for (const id in gameObjects.crates) { gameObjects.crates[id].rotation.y += 0.5 * delta; }
    const localPlayerMesh = gameObjects.players[localPlayerId];
    if (localPlayerMesh) {
        // POPRAWKA: Ujemna wartość 'z' umieszcza kamerę ZA czołgiem
        const offset = new THREE.Vector3(0, 20, -30);
        const cameraTargetPosition = localPlayerMesh.position.clone().add(offset.applyQuaternion(localPlayerMesh.quaternion));
        camera.position.lerp(cameraTargetPosition, 0.1);
        camera.lookAt(localPlayerMesh.position.clone().add(new THREE.Vector3(0, 3, 0)));
    }
    updateHUD();
    renderer.render(scene, camera);
}


// --- OBSŁUGA ZDARZEŃ Z SERWERA ---
socket.on("connect", () => console.log("Połączono z serwerem!", socket.id));
socket.on("gameStarted", (payload) => { console.log("Gra rozpoczęta! Twój ID:", payload.playerId); initGame(payload); });
socket.on("gameStateUpdate", (serverState) => { clientGameState = serverState; });

socket.on('objectCreated', (payload) => {
    if (payload.type === 'projectile') {
        createProjectileMesh(payload.data);
    }
});
socket.on('objectDestroyed', (payload) => {
    if (payload.type === 'projectile' && gameObjects.projectiles[payload.id]) {
        scene.remove(gameObjects.projectiles[payload.id]);
        delete gameObjects.projectiles[payload.id];
    }
});

socket.on("playerConnected", (playerData) => {
    // Upewnij się, że gra jest uruchomiona i że gracz jeszcze nie istnieje po stronie klienta
    if (!isGameStarted || !scene || gameObjects.players[playerData.id]) {
        return;
    }

    console.log(`Nowy gracz dołączył: ${playerData.id}`);

    // Dodaj nowego gracza do lokalnej kopii stanu gry
    if (clientGameState.players) {
        clientGameState.players[playerData.id] = playerData;
    }

    // Stwórz model 3D dla czołgu nowego gracza
    const tankColor = 0xcc3333; // Inni gracze są zawsze czerwoni
    const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(tankColor));
    
    // Ustaw pozycję i rotację początkową
    tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    tank.rotation.y = playerData.rotation.y;
    
    scene.add(tank);
    gameObjects.players[playerData.id] = tank;
});

socket.on("playerDisconnected", (id) => {
    // Usuń gracza z lokalnej kopii stanu gry
    if (clientGameState.players && clientGameState.players[id]) {
        delete clientGameState.players[id];
    }
    // Usuń obiekt 3D gracza
    if (gameObjects.players[id]) {
        scene.remove(gameObjects.players[id]);
        delete gameObjects.players[id];
        console.log(`Gracz ${id} się rozłączył.`);
    }
});

// --- START APLIKACJI ---
initializeUI();