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
let canFire = true;
let fireCooldown = 0; // Czas w sekundach

const gameObjects = {
  players: {},
  houses: {},
  toilets: {},
  crates: {},
  fences: {},
  mines: {},
  missiles: {},
  machineGunBullets: {},
  projectiles: {},
  particles: [],
  wreckage: [],
};

const socket = io();

// --- STAŁE I DANE ---
const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 22, speed: 18, turretRot: 1.8 }, create: createPL01Tank },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 35, speed: 12, turretRot: 1.2 }, create: createAbramsTank },
  standard: { name: "Standard", stats: { hp: 100, damage: 25, speed: 15, turretRot: 1.5 }, create: createStandardTank },
};
const MAP_SIZE = 500;
const TANK_QUOTES = [
  "Jedziesz, pociśnij go!", "Trafiony... ale nie zatopiony!", "Mam Cię na celowniku!",
  "Ktoś zamawiał pizzę z ołowiem?", "Auć, to bolało!", "Potrzebuję wsparcia! Albo kawy.",
  "Zaraz wracam, muszę przeładować.", "Bum! I po strachu.",
];


// --- FUNKCJE TWORZĄCE OBIEKTY 3D ---
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
    turretGroup.position.y = hullHeight + 0.1; turretGroup.position.z = 1; tank.add(turretGroup);
    tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
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
    tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
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
    turretGroup.position.y = hullHeight; tank.add(turretGroup);
    tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank;
}
function createHouse() {
    const house = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 20), LAMBERT_MATERIAL(0xac8c6c)); body.position.y = 5; house.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 10, 6, 4), LAMBERT_MATERIAL(0xc05454)); roof.position.y = 10 + 3; roof.rotation.y = Math.PI / 4; house.add(roof);
    house.userData = { body, roof }; return house;
}
function createToilet() {
    const toilet = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 4), LAMBERT_MATERIAL(0x8b4513)); body.position.y = 3.5; toilet.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), LAMBERT_MATERIAL(0x5d3a1a)); roof.position.y = 7.25; roof.rotation.x = 0.2; toilet.add(roof); return toilet;
}
function createSupplyCrate() {
    const crate = new THREE.Group();
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8B4513"; ctx.fillRect(0, 0, 256, 256); ctx.font = "bold 180px Arial"; ctx.fillStyle = "yellow";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 128, 138);
    const material = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas) });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.5), material); base.position.y = 1; crate.add(base); return crate;
}
function createFenceSegment() {
    const segment = new THREE.Group(); const postMaterial = LAMBERT_MATERIAL(0x654321);
    const postGeom = new THREE.BoxGeometry(0.5, 4, 0.5); const post1 = new THREE.Mesh(postGeom, postMaterial);
    post1.position.set(-5, 2, 0); segment.add(post1); const post2 = post1.clone(); post2.position.set(5, 2, 0); segment.add(post2);
    const barGeom = new THREE.BoxGeometry(10, 0.5, 0.2); const bar1 = new THREE.Mesh(barGeom, postMaterial);
    bar1.position.set(0, 2.5, 0); segment.add(bar1); return segment;
}
function createExplosion(position, scale) {
  const particleCount = 20 * scale;
  for (let i = 0; i < particleCount; i++) {
    const color = Math.random() > 0.5 ? 0xffa500 : 0xff4500;
    const particle = new THREE.Mesh( new THREE.SphereGeometry(0.2 * scale, 4, 4), new THREE.MeshBasicMaterial({ color: color }) );
    particle.position.copy(position);
    particle.velocity = new THREE.Vector3( Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 20 * scale);
    particle.lifespan = Math.random() * 0.8 + 0.3;
    gameObjects.particles.push(particle);
    scene.add(particle);
  }
}
function destroyObjectWithWreckage(object, parts) {
    createExplosion(object.position, 4);
    object.visible = false;
    parts.forEach((part) => {
        const wreckClone = part.clone();
        object.getWorldPosition(wreckClone.position);
        wreckClone.position.y += part.position.y;
        object.getWorldQuaternion(wreckClone.quaternion);
        scene.add(wreckClone);
        const wreckObject = {
            object: wreckClone,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 15, Math.random() * 15 + 5, (Math.random() - 0.5) * 15),
            angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
            lifespan: 10.0,
        };
        gameObjects.wreckage.push(wreckObject);
    });
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

    const powerupHUD = document.getElementById('powerup-hud');
    if (playerState.activePowerUp) {
        powerupHUD.style.display = 'block';
        let text = "";
        switch (playerState.activePowerUp) {
            case "turbo": text = `TURBO: ${playerState.powerUpTimer.toFixed(1)}s`; break;
            case "machinegun": text = `KARABIN: ${playerState.powerUpTimer.toFixed(1)}s`; break;
            case "missile": text = `RAKIETA: ${playerState.powerUpAmmo}x`; break;
            case "mines": text = `MINY: ${playerState.powerUpAmmo}x`; break;
        }
        powerupHUD.innerText = text;
    } else {
        powerupHUD.style.display = 'none';
    }

    const respawnMsgEl = document.getElementById('respawn-message');
    if (playerState.isDestroyed && playerState.respawnTimer > 0) { respawnMsgEl.style.display = 'block'; respawnMsgEl.innerText = `ODRODZENIE ZA: ${Math.ceil(playerState.respawnTimer)}`; }
    else { respawnMsgEl.style.display = 'none'; }
}
function updateScoreboard() {
    const scoreDisplay = document.getElementById("score-display"); if (!clientGameState.players) return;
    let scoresHtml = Object.values(clientGameState.players).sort((a, b) => b.score - a.score)
        .map(p => `<div><span style="color: ${p.id === localPlayerId ? '#38a849' : '#cc3333'}">${p.id === localPlayerId ? 'TY' : p.id.substring(0, 6)}</span><span>${p.score}</span></div>`).join('');
    scoreDisplay.innerHTML = scoresHtml;
}
function showTankQuote(playerId) {
    const playerTank = gameObjects.players[playerId];
    if (!playerTank || !camera) return;

    let bubble = document.getElementById(`bubble-${playerId}`);
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.id = `bubble-${playerId}`;
        document.getElementById('speech-bubbles-container').appendChild(bubble);
    }
    
    bubble.innerText = TANK_QUOTES[Math.floor(Math.random() * TANK_QUOTES.length)];
    bubble.style.display = "block";
    
    setTimeout(() => {
        if(bubble) bubble.style.display = "none";
    }, 4000);
}


// --- LOGIKA GRY (KLIENT) ---
function initGame(payload) {
    localPlayerId = payload.playerId; clientGameState = payload.initialState; isGameStarted = true;
    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 200, 450);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const dirLight = new THREE.DirectionalLight(0xffffff, 0.7); dirLight.position.set(100, 80, 50); scene.add(dirLight);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), new THREE.MeshLambertMaterial({ map: createGroundTexture() })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    reconcileGameState(clientGameState);
    setupEventListeners();
    animate();
    setInterval(() => {
        if(clientGameState.players[localPlayerId] && !clientGameState.players[localPlayerId].isDestroyed) {
             if (Math.random() > 0.6) showTankQuote(localPlayerId);
        }
    }, 15000 + Math.random() * 5000);
}
function handleFireInput() {
    if (!canFire || !localPlayerId || clientGameState.players[localPlayerId].isDestroyed) return;

    const playerState = clientGameState.players[localPlayerId];
    let cooldownTime = 0.5;
    if(playerState.activePowerUp === 'machinegun') {
        cooldownTime = 0.08;
    } else if (playerState.activePowerUp === 'missile') {
        cooldownTime = 1.0;
    }

    socket.emit('playerAction', { type: 'fire' });
    canFire = false;
    fireCooldown = cooldownTime;
}
function setupEventListeners() {
    document.addEventListener("keydown", (e) => {
        keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleFireInput();
        }
    });
    document.addEventListener("keyup", (e) => {
        keys[e.code] = false; if (!isGameStarted || !localPlayerId) return;
        if (e.code === 'KeyR') socket.emit('playerAction', { type: 'reload' });
        if (e.code === 'KeyB') socket.emit('playerAction', { type: 'heal' });
        if (e.code === 'KeyG') socket.emit('playerAction', { type: 'dropMine' });
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
    const serverPlayerIds = Object.keys(serverState.players || {});
    for (const id of serverPlayerIds) {
        if (!gameObjects.players[id]) {
            const playerData = serverState.players[id]; const tankColor = (id === localPlayerId) ? 0x38a849 : 0xcc3333;
            const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(tankColor));
            tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z); scene.add(tank); gameObjects.players[id] = tank;
        }
    }
    const objectTypes = ['houses', 'toilets', 'crates', 'fences'];
    for (const type of objectTypes) {
        const serverObjectIds = Object.keys(serverState[type] || {});
        for (const id of serverObjectIds) {
            if (!gameObjects[type][id]) {
                createObjectMesh({type: type.slice(0, -1), data: serverState[type][id]});
            }
        }
    }
}
function createObjectMesh(payload) {
    const { type, data } = payload;
    let newMesh;
    let container = gameObjects[type + 's'];

    if(!container) return;
    if(container[data.id]) return;

    switch(type) {
        case 'projectile': newMesh = new THREE.Mesh( new THREE.CapsuleGeometry(0.25, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 2 }) ); break;
        case 'machineGunBullet': newMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffa500 })); break;
        case 'missile':
            newMesh = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 12), LAMBERT_MATERIAL(0xcccccc));
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 12), LAMBERT_MATERIAL(0xff0000));
            tip.position.y = 1.5; newMesh.add(body, tip);
            break;
        case 'mine': newMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16), LAMBERT_MATERIAL(0x444444)); break;
        case 'crate': newMesh = createSupplyCrate(); break;
        case 'toilet': newMesh = createToilet(); break;
        case 'house': newMesh = createHouse(); break;
        case 'fence': newMesh = createFenceSegment(); break;
    }

    if (newMesh) {
        newMesh.position.set(data.position.x, data.position.y, data.position.z);
        if(data.rotationY) newMesh.rotation.y = data.rotationY;
        container[data.id] = newMesh;
        // Zapisz poprzednią pozycję, aby umożliwić obliczenie kierunku
        newMesh.lastPosition = new THREE.Vector3().copy(newMesh.position);
        scene.add(newMesh);
    }
}

// --- GŁÓWNA PĘTLA RENDEROWANIA ---
function animate() {
    if (!isGameStarted) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (fireCooldown > 0) {
        fireCooldown -= delta;
    } else {
        canFire = true;
    }
    if(keys['Space'] || keys['Enter']) {
        if(clientGameState.players[localPlayerId]?.activePowerUp === 'machinegun') {
            handleFireInput();
        }
    }

    socket.emit("playerInput", keys);

    for (const id in clientGameState.players) {
        const serverTank = clientGameState.players[id]; const clientTank = gameObjects.players[id];
        if (clientTank && serverTank) {
            if (serverTank.isDestroyed) { clientTank.visible = false; continue; }
            clientTank.visible = true;
            clientTank.position.lerp(new THREE.Vector3(serverTank.position.x, serverTank.position.y, serverTank.position.z), 0.25);
            const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, serverTank.rotation.y, 0));
            clientTank.quaternion.slerp(targetQuaternion, 0.25);
            clientTank.turret.rotation.y = serverTank.turretRotation.y;
            clientTank.mantlet.rotation.x = serverTank.mantletRotation.x;
        }
    }
    
    // Interpolacja i rotacja pocisków
    const projectileTypes = ['projectiles', 'machineGunBullets', 'missiles'];
    for(const type of projectileTypes) {
        const container = clientGameState[type];
        if(!container) continue;
        for (const id in container) {
            const serverObj = container[id];
            const clientObj = gameObjects[type][id];
            if (clientObj && serverObj) {
                const serverPos = new THREE.Vector3(serverObj.position.x, serverObj.position.y, serverObj.position.z);
                
                // Oblicz kierunek ruchu na podstawie ostatniej i obecnej pozycji
                const moveDirection = serverPos.clone().sub(clientObj.lastPosition).normalize();
                
                // Obróć obiekt, aby "patrzył" w kierunku lotu
                if (moveDirection.lengthSq() > 0.001) {
                    clientObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection);
                    if (type === 'missile') clientObj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/2));
                }

                clientObj.position.lerp(serverPos, 0.5);
                clientObj.lastPosition.copy(clientObj.position);
            }
        }
    }

    for (const id in gameObjects.crates) { gameObjects.crates[id].rotation.y += 0.5 * delta; }
    
    const gravity = -9.8;
    for (let i = gameObjects.particles.length - 1; i >= 0; i--) {
        const p = gameObjects.particles[i];
        p.lifespan -= delta;
        if (p.lifespan <= 0) {
            scene.remove(p); p.geometry.dispose(); p.material.dispose(); gameObjects.particles.splice(i, 1);
        } else {
            p.velocity.y += gravity * delta; p.position.add(p.velocity.clone().multiplyScalar(delta));
        }
    }

    const wreckGravity = -30;
    for (let i = gameObjects.wreckage.length - 1; i >= 0; i--) {
        const wreck = gameObjects.wreckage[i];
        wreck.lifespan -= delta;
        if (wreck.lifespan <= 0) {
            scene.remove(wreck.object); wreck.object.traverse(c => { if(c.isMesh) { c.geometry.dispose(); c.material.dispose(); }}); gameObjects.wreckage.splice(i, 1); continue;
        }
        if (wreck.object.position.y > 0) {
            wreck.velocity.y += wreckGravity * delta; wreck.object.position.add(wreck.velocity.clone().multiplyScalar(delta));
            wreck.object.rotation.x += wreck.angularVelocity.x * delta;
            wreck.object.rotation.y += wreck.angularVelocity.y * delta;
            wreck.object.rotation.z += wreck.angularVelocity.z * delta;
        } else { wreck.object.position.y = 0; }
    }

     for (const playerId in gameObjects.players) {
        const bubble = document.getElementById(`bubble-${playerId}`);
        const playerTank = gameObjects.players[playerId];
        if (bubble && playerTank && bubble.style.display !== 'none') {
            const vector = new THREE.Vector3(playerTank.position.x, playerTank.position.y + 6, playerTank.position.z);
            vector.project(camera);
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
            bubble.style.left = `${x}px`;
            bubble.style.top = `${y}px`;
        }
    }

    const localPlayerMesh = gameObjects.players[localPlayerId];
    if (localPlayerMesh) {
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
    createObjectMesh(payload);
});

socket.on('objectDestroyed', (payload) => {
    const { type, id, hit } = payload;
    let containerName = type.endsWith('y') ? type.slice(0, -1) + 'ies' : type + 's';
    if(type === 'machineGunBullet') containerName = 'machineGunBullets';

    const objectList = gameObjects[containerName];
    const object = objectList ? objectList[id] : null;

    if (object) {
        if(hit) {
            if (type === 'player') {
                destroyObjectWithWreckage(object, [object.hullGroup, object.turret]);
                if (Math.random() > 0.3) showTankQuote(id);
            } else if (type === 'house') {
                 destroyObjectWithWreckage(object, [object.userData.body, object.userData.roof]);
            }
             else {
                createExplosion(object.position, 1.5);
            }
        }
        scene.remove(object);
        if(object.traverse) object.traverse(c => { if(c.isMesh) { c.geometry.dispose(); c.material.dispose(); }});
        delete objectList[id];
    }
});


socket.on("playerConnected", (playerData) => {
    if (!isGameStarted || !scene || gameObjects.players[playerData.id]) return;
    console.log(`Nowy gracz dołączył: ${playerData.id}`);
    if (clientGameState.players) { clientGameState.players[playerData.id] = playerData; }
    const tankColor = 0xcc3333; 
    const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(tankColor));
    tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    tank.rotation.y = playerData.rotation.y;
    scene.add(tank);
    gameObjects.players[playerData.id] = tank;
});

socket.on("playerDisconnected", (id) => {
    if (clientGameState.players && clientGameState.players[id]) { delete clientGameState.players[id]; }
    const bubble = document.getElementById(`bubble-${id}`);
    if(bubble) bubble.remove();
    if (gameObjects.players[id]) {
        scene.remove(gameObjects.players[id]);
        delete gameObjects.players[id];
        console.log(`Gracz ${id} się rozłączył.`);
    }
});

// --- START APLIKACJI ---
initializeUI();