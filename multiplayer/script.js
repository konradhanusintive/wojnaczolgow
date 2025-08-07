import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
// import { createSkydomeBackground } from './background.js';
import { createSkyboxBackground } from './background.js';
// --- ZMIENNE GLOBALNE I KONFIGURACJA KLIENTA ---
let scene, renderer, clock, camera;
let localPlayerId = null;
let clientGameState = {};
let selectionRenderers = [];
let isGameStarted = false;
let isSelectionScreenActive = false;
let brickMaterial;
let greySmokeMaterial, blackSmokeMaterial, cloudSmokeMaterial, empEffectMaterial;
let minimapCanvas, minimapCtx;
let minimapScanAngle = 0;

let heightMap; 
let terrainMesh;
let terrainParams;

let mapWaterMesh;
let currentWaterLevel = -Infinity;
let targetWaterLevel = -Infinity;

let trackCanvas, trackCtx, trackTexture, trackMesh;
const TRACK_CANVAS_RESOLUTION = 1024;
const MIN_TRACK_DISTANCE = 1.0;

let raycaster;
const mouse = new THREE.Vector2();
const targetPoint = new THREE.Vector3();
const aimables = []; 

const keys = {};
let canFire = true;
let fireCooldown = 0.5;

const gameObjects = {
    players: {},
    buildings: {},
    crates: {},
    ammoCrates: {},
    smokeClouds: {},
    mines: {},
    missiles: {},
    machineGunBullets: {},
    projectiles: {},
    particles: [],
    wreckage: [],
    smokeParticles: [], 
};

const socket = io();

// --- STAŁE I DANE ---
const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 1.0, speed: 18, turretRot: 1.8 }, create: createPL01Tank, hullWidth: 6.0 },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 1.0, speed: 12, turretRot: 1.2 }, create: createAbramsTank, hullWidth: 6.5 },
  standard: { name: "Standard", stats: { hp: 100, damage: 1.0, speed: 15, turretRot: 1.5 }, create: createStandardTank, hullWidth: 5.5 },
};

const WEAPONS_DATA = {
    he:     { name: 'Odłamkowo-Burzący',  icon: '💥', cooldown: 0.8 },
    ap:     { name: 'Przeciwpancerny',     icon: '🚀', cooldown: 0.6 },
    heat:   { name: 'Kumulacyjny',         icon: '🔥', cooldown: 1.0 },
    emp:    { name: 'EMP',                 icon: '⚡', cooldown: 1.5 },
    smoke:  { name: 'Dymny',               icon: '💨', cooldown: 2.0 },
    guided: { name: 'Naprowadzany',        icon: '🎯', cooldown: 1.2 }
};
const WEAPON_KEYS = ['he', 'ap', 'heat', 'emp', 'smoke', 'guided'];

const TANK_QUOTES = [
  "Jedziesz, pociśnij go!", "Trafiony... ale nie zatopiony!", "Mam Cię na celowniku!",
  "Ktoś zamawiał pizzę z ołowiem?", "Auć, to bolało!", "Potrzebuję wsparcia! Albo kawy.",
  "Zaraz wracam, muszę przeładować.", "Bum! I po strachu.",
];

// --- Implementacja szumu Perlina (dla tekstur) ---
const PerlinNoise = new (function() {
    this.p = new Uint8Array(512); this.init = function(seed) { const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor((seed % 1) * (i + 1)); seed = (seed * 9301 + 49297) % 233280; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = p[i]; }; const fade = t => t * t * t * (t * (t * 6 - 15) + 10); const lerp = (t, a, b) => a + t * (b - a); const grad = (hash, x, y) => { const h = hash & 15; const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : 0; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); }; this.noise = function(x, y) { const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = fade(x); const v = fade(y); const p = this.p; const A = p[X] + Y, B = p[X + 1] + Y; return lerp(v, lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)), lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1)) ); };
})();
PerlinNoise.init(Math.random());

// --- FUNKCJE TWORZĄCE OBIEKTY 3D ---
const LAMBERT_MATERIAL = (color) => new THREE.MeshLambertMaterial({ color });
function createTrackTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 128; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#3a3a3a"; ctx.fillRect(0, 0, 32, 128); ctx.fillStyle = "#2a2a2a";
  for (let i = 0; i < 128; i += 8) { ctx.fillRect(0, i, 32, 4); } const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; return texture;
}
const trackMaterial = new THREE.MeshLambertMaterial({ map: createTrackTexture() });

function createGroundTexture(heightData, params) {
    const canvas = document.createElement("canvas"); const size = 512; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d"); const sandColor = new THREE.Color("#d2b48c"); const grassColor = new THREE.Color("#3c581a"); const rockColor = new THREE.Color("#6b6b47"); const dirtColor = new THREE.Color("#5C4033");
    const minHeight = -params.amplitude; const maxHeight = params.amplitude;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const u = i / (size - 1); const v = j / (size - 1); const worldX = (u - 0.5) * params.size; const worldZ = (v - 0.5) * params.size; const max_dist = Math.max(Math.abs(worldX), Math.abs(worldZ));
            const gridX = Math.floor(u * params.segments); const gridY = Math.floor(v * params.segments); const height = heightData[gridX][gridY]; const normalizedHeight = (maxHeight - minHeight) > 0 ? (height - minHeight) / (maxHeight - minHeight) : 0;
            let color;
            if (max_dist > params.size / 2 - params.mudBorderWidth) { color = dirtColor.clone(); }
            else if (max_dist < params.sandyAreaRadius) { color = sandColor.clone(); const noise = PerlinNoise.noise(i * 0.2, j * 0.2) * 0.03; color.offsetHSL(0, 0, noise); }
            else { color = grassColor.clone(); if (normalizedHeight > 0.5) { color.lerp(dirtColor, (normalizedHeight - 0.5) * 2); } if (normalizedHeight > 0.7) { color.lerp(rockColor, (normalizedHeight - 0.7) * 3.33); } const noise = PerlinNoise.noise(i * 0.1, j * 0.1) * 0.05; color.offsetHSL(0, 0, noise); }
            ctx.fillStyle = `#${color.getHexString()}`; ctx.fillRect(i, j, 1, 1);
        }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; return texture;
}

function createBrickMaterial() {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8a3d29"; ctx.fillRect(0, 0, 128, 128); ctx.strokeStyle = "#a15d4a"; ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128); ctx.fillStyle = "rgba(0,0,0,0.1)"; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map: texture });
}
function createStandardTank(color) { const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color); const hullWidth = 5.5, hullHeight = 1.8, hullLength = 9.0; const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength - 2), hullMaterial); mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull); const glacis = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight * 1.2, 2.5), hullMaterial); glacis.position.set(0, hullHeight / 2 - 0.2, -hullLength / 2 + 0.5); glacis.rotation.x = -Math.PI / 6; hullGroup.add(glacis); const trackWidth = 1.2, trackHeight = 2.4, trackLength = hullLength + 1; const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial); const rightTrack = leftTrack.clone(); leftTrack.position.x = -hullWidth / 2 - trackWidth / 2; rightTrack.position.x = hullWidth / 2 + trackWidth / 2; trackGroup.add(leftTrack, rightTrack); tank.add(hullGroup); const turretPoints = [new THREE.Vector3(2, 0, 2), new THREE.Vector3(2, 0, -2.5), new THREE.Vector3(-2, 0, -2.5), new THREE.Vector3(-2, 0, 2), new THREE.Vector3(1.5, 2, 1.5), new THREE.Vector3(1.5, 2, -2), new THREE.Vector3(-1.5, 2, -2), new THREE.Vector3(-1.5, 2, 1.5)]; turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1)))); const mantlet = new THREE.Group(); mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.8, -2.5); turretGroup.add(mantlet); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 6, 12), LAMBERT_MATERIAL(0x333333)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 3; mantlet.add(barrel); turretGroup.position.y = hullHeight + 0.1; turretGroup.position.z = 1; tank.add(turretGroup); tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank; }
function createPL01Tank(color) { const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color); const hullWidth = 6.0, hullHeight = 1.5, hullLength = 9.5; const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.8, hullHeight, hullLength), hullMaterial); mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull); const sidePanelGeom = new THREE.BoxGeometry(0.5, hullHeight * 1.5, hullLength); const leftPanel = new THREE.Mesh(sidePanelGeom, hullMaterial); leftPanel.position.set(-hullWidth / 2, hullHeight / 2, 0); leftPanel.rotation.z = 0.5; hullGroup.add(leftPanel); const rightPanel = new THREE.Mesh(sidePanelGeom, hullMaterial); rightPanel.position.set(hullWidth / 2, hullHeight / 2, 0); rightPanel.rotation.z = -0.5; hullGroup.add(rightPanel); tank.add(hullGroup); const trackWidth = 1.0, trackHeight = 1.8, trackLength = hullLength + 1; const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial); leftTrack.position.x = -hullWidth / 2 + 0.5; const rightTrack = leftTrack.clone(); rightTrack.position.x = hullWidth / 2 - 0.5; trackGroup.add(leftTrack, rightTrack); trackGroup.position.y = trackHeight / 2 - 0.5; hullGroup.add(trackGroup); const turretPoints = [new THREE.Vector3(2.5, 0, 3), new THREE.Vector3(2.5, 0, -3), new THREE.Vector3(-2.5, 0, -3), new THREE.Vector3(-2.5, 0, 3), new THREE.Vector3(0, 1.8, 2.5), new THREE.Vector3(0, 1.8, -2.5)]; turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1)))); const mantlet = new THREE.Group(); mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.5), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.6, -2.8); turretGroup.add(mantlet); const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 7), LAMBERT_MATERIAL(0x333333)); barrel.position.z = 3.5; mantlet.add(barrel); turretGroup.position.y = hullHeight; tank.add(turretGroup); tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank; }
function createAbramsTank(color) { const tank = new THREE.Group(); const hullGroup = new THREE.Group(); const turretGroup = new THREE.Group(); const hullMaterial = LAMBERT_MATERIAL(color); const hullWidth = 6.5, hullHeight = 2.0, hullLength = 10.0; const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.7, hullHeight, hullLength), hullMaterial); mainHull.position.y = hullHeight / 2; hullGroup.add(mainHull); const trackWidth = 1.4, trackHeight = 2.0, trackLength = hullLength; const trackGroup = new THREE.Group(); const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial); leftTrack.position.x = -hullWidth / 2 + 0.8; const rightTrack = leftTrack.clone(); rightTrack.position.x = hullWidth / 2 - 0.8; trackGroup.add(leftTrack, rightTrack); trackGroup.position.y = trackHeight / 2 - 0.6; hullGroup.add(trackGroup); tank.add(hullGroup); const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 1.0, 8), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1))); turretGroup.add(turretBase); const turretTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 6.0), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1))); turretTop.position.y = 1.1; turretGroup.add(turretTop); const mantlet = new THREE.Group(); mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1.5), LAMBERT_MATERIAL(0x444444))); mantlet.position.set(0, 0.5, -3.0); turretGroup.add(mantlet); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 8, 12), LAMBERT_MATERIAL(0x333333)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 4; mantlet.add(barrel); turretGroup.position.y = hullHeight; tank.add(turretGroup); tank.hullGroup = hullGroup; tank.turret = turretGroup; tank.mantlet = mantlet; tank.barrel = barrel; return tank; }

function getHeightAt(x, z) {
    if (!heightMap || !terrainParams) return 0;
    const { size, segments } = terrainParams; const gridX = (x + size / 2) / size * segments; const gridZ = (z + size / 2) / size * segments;
    const x1 = Math.floor(gridX); const z1 = Math.floor(gridZ); const x2 = Math.min(x1 + 1, segments); const z2 = Math.min(z1 + 1, segments);
    if (x1 < 0 || x1 > segments || z1 < 0 || z1 > segments || !heightMap[x1] || !heightMap[x2]) return 0;
    const h11 = heightMap[x1][z1]; const h12 = heightMap[x1][z2]; const h21 = heightMap[x2][z1]; const h22 = heightMap[x2][z2];
    if (h11 === undefined || h12 === undefined || h21 === undefined || h22 === undefined) return 0;
    const tx = gridX - x1; const tz = gridZ - z1; const h_x1 = h11 * (1 - tx) + h21 * tx; const h_x2 = h12 * (1 - tx) + h22 * tx; return h_x1 * (1 - tz) + h_x2 * tz;
}

function createBuildingMesh(buildingData) {
    const { id, position, brickSize, bricks, dimensions } = buildingData;
    const brickGeometry = new THREE.BoxGeometry(brickSize.x, brickSize.y, brickSize.z);
    if (!brickMaterial) { brickMaterial = createBrickMaterial(); }
    const instancedMesh = new THREE.InstancedMesh(brickGeometry, brickMaterial, bricks.length);
    let minHeight = Infinity;
    const halfW = dimensions.x / 2; const halfD = dimensions.z / 2;
    const corners = [ { x: position.x - halfW, z: position.z - halfD }, { x: position.x + halfW, z: position.z - halfD }, { x: position.x - halfW, z: position.z + halfD }, { x: position.x + halfW, z: position.z + halfD }, { x: position.x, z: position.z } ];
    for (const corner of corners) { const h = getHeightAt(corner.x, corner.z); if (h < minHeight) minHeight = h; }
    instancedMesh.position.set(position.x, minHeight, position.z);
    const matrix = new THREE.Matrix4(); let instanceIdx = 0;
    for (const brick of bricks) { if (brick) { matrix.setPosition(brick.x, brick.y, brick.z); instancedMesh.setMatrixAt(instanceIdx, matrix); } instanceIdx++; }
    instancedMesh.instanceMatrix.needsUpdate = true;
    gameObjects.buildings[id] = { mesh: instancedMesh, data: buildingData, };
    scene.add(instancedMesh); aimables.push(instancedMesh);
}
function createBrickDebris(position, count) {
    if (!brickMaterial) return; const brickGeometry = new THREE.BoxGeometry(1, 0.5, 2);
    for (let i = 0; i < count; i++) {
        const wreckClone = new THREE.Mesh(brickGeometry, brickMaterial); wreckClone.position.copy(position);
        const wreckObject = {
            object: wreckClone,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 25, Math.random() * 20 + 5, (Math.random() - 0.5) * 25),
            angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
            lifespan: Math.random() * 2 + 1,
        };
        gameObjects.wreckage.push(wreckObject); scene.add(wreckClone);
    }
}
function createSupplyCrate() {
    const crate = new THREE.Group(); const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8B4513"; ctx.fillRect(0, 0, 256, 256); ctx.font = "bold 180px Arial"; ctx.fillStyle = "yellow";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 128, 138);
    const material = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas) });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.5), material); base.position.y = 1; crate.add(base); return crate;
}
function createAmmoCrateMesh() {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: 0x4B5320 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2), material);
    group.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 2.2), material.clone());
    lid.material.color.setHex(0x3B401A);
    lid.position.y = 0.9;
    group.add(lid);
    return group;
}

function createExplosion(position, scale, color = null) {
  const particleCount = 20 * scale;
  for (let i = 0; i < particleCount; i++) {
    const particleColor = color ? color : (Math.random() > 0.5 ? 0xffa500 : 0xff4500);
    const particle = new THREE.Mesh( new THREE.SphereGeometry(0.2 * scale, 4, 4), new THREE.MeshBasicMaterial({ color: particleColor }) );
    particle.position.copy(position);
    particle.velocity = new THREE.Vector3( Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 20 * scale);
    particle.lifespan = Math.random() * 0.8 + 0.3;
    gameObjects.particles.push(particle);
    scene.add(particle);
  }
}
function destroyObjectWithWreckage(object, parts) {
    createExplosion(object.position, 4); object.visible = false;
    parts.forEach((part) => {
        const wreckClone = part.clone(); object.getWorldPosition(wreckClone.position); wreckClone.position.y += part.position.y;
        object.getWorldQuaternion(wreckClone.quaternion); scene.add(wreckClone);
        const wreckObject = {
            object: wreckClone,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 15, Math.random() * 15 + 5, (Math.random() - 0.5) * 15),
            angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
            lifespan: 10.0,
        };
        gameObjects.wreckage.push(wreckObject);
    });
}
function createSpawnMarker() {
    const marker = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 8); const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 4; marker.add(pole);
    const flagGeo = new THREE.PlaneGeometry(3, 2); const flagMat = new THREE.MeshBasicMaterial({ color: 0x1E90FF, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(1.5, 6.5, 0); marker.add(flag); return marker;
}
function createPlayerLaser() {
    const laserGeometry = new THREE.BufferGeometry(); const positions = new Float32Array(2 * 3);
    laserGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6, linewidth: 2, });
    const laser = new THREE.Line(laserGeometry, laserMaterial); laser.frustumCulled = false; laser.visible = false;
    scene.add(laser); return laser;
}
function createSmokeTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}
function emitSmokeParticle(tank, material) {
    const smokeOffset = new THREE.Vector3(0, 1.5, 4.5); smokeOffset.applyQuaternion(tank.quaternion);
    const smokePos = new THREE.Vector3().copy(tank.position).add(smokeOffset);
    const startSize = 1.5 + Math.random() * 1; const endSize = startSize * 4;
    const particle = {
        mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material.clone()),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 2 + 1, (Math.random() - 0.5) * 0.8),
        lifespan: Math.random() * 2 + 2, initialLifespan: 0, startSize, endSize
    };
    particle.initialLifespan = particle.lifespan; particle.mesh.position.copy(smokePos); particle.mesh.scale.set(startSize, startSize, startSize);
    gameObjects.smokeParticles.push(particle); scene.add(particle.mesh);
}
function createEMPTankEffect(tankMesh) {
    if (!tankMesh) return;
    if (!empEffectMaterial) { empEffectMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7, wireframe: true }); }
    const effectMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 8), empEffectMaterial);
    const effect = {
        mesh: effectMesh,
        target: tankMesh,
        lifespan: 0.2,
    };
    gameObjects.particles.push(effect);
    scene.add(effectMesh);
}
function createSmokeCloud(position, radius, duration) {
    const cloud = {
        particles: [],
        position,
        radius,
        lifespan: duration,
        initialLifespan: duration,
    };
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
        const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudSmokeMaterial.clone());
        const p = {
            mesh: pMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
            startPos: new THREE.Vector3( (Math.random() - 0.5) * radius * 0.8, Math.random() * radius * 0.3, (Math.random() - 0.5) * radius * 0.8 ),
            startSize: radius * (0.8 + Math.random() * 0.5),
        };
        p.mesh.position.copy(position).add(p.startPos);
        cloud.particles.push(p);
        scene.add(p.mesh);
    }
    gameObjects.smokeClouds[Date.now()] = cloud;
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
            if (button.disabled) return; 
            const card = e.target.closest(".tank-card"); const tankType = card.id.split("-")[1];
            const mapSize = document.querySelector('input[name="map-size"]:checked').value;
            const amplitude = parseInt(document.getElementById('terrain-amplitude').value, 10);
            const scale = parseInt(document.getElementById('terrain-scale').value, 10);
            socket.emit("joinGame", { tankType: tankType, config: { mapSize: mapSize, amplitude: amplitude, scale: scale } }); 
            document.getElementById("start-screen").style.display = "none"; isSelectionScreenActive = false;
            selectionRenderers.forEach(({ renderer }) => renderer.dispose()); selectionRenderers = [];
        });
    });
    const ampSlider = document.getElementById('terrain-amplitude'); const ampValue = document.getElementById('amplitude-value'); ampSlider.addEventListener('input', () => ampValue.textContent = ampSlider.value);
    const scaleSlider = document.getElementById('terrain-scale'); const scaleValue = document.getElementById('scale-value'); scaleSlider.addEventListener('input', () => scaleValue.textContent = scaleSlider.value);

    const weaponBar = document.getElementById('weapon-bar');
    WEAPON_KEYS.forEach((key, index) => {
        const weaponData = WEAPONS_DATA[key];
        const slot = document.createElement('div');
        slot.className = 'weapon-slot';
        slot.id = `weapon-slot-${key}`;
        slot.innerHTML = `
            <div class="weapon-key">${index + 1}</div>
            <div class="weapon-icon">${weaponData.icon}</div>
            <div class="weapon-ammo">0</div>
        `;
        slot.addEventListener('click', () => {
            socket.emit('playerAction', { type: 'switchWeapon', weaponId: key });
        });
        weaponBar.appendChild(slot);
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
    const hudEl = document.getElementById('hud'); 
    const minimapEl = document.getElementById('minimap-container');
    const weaponBarEl = document.getElementById('weapon-bar');
    if (!isGameStarted || !localPlayerId || !clientGameState.players || !clientGameState.players[localPlayerId]) { 
        hudEl.style.display = 'none'; minimapEl.style.display = 'none'; weaponBarEl.style.display = 'none';
        return; 
    }
    hudEl.style.display = 'block'; minimapEl.style.display = 'block'; weaponBarEl.style.display = 'flex';
    
    const playerState = clientGameState.players[localPlayerId]; const maxHealth = playerState.maxHealth;
    document.getElementById('hp-value').innerText = `${Math.max(0, playerState.health.toFixed(0))} / ${maxHealth}`; const hpPercent = (Math.max(0, playerState.health) / maxHealth) * 100;
    const hpBar = document.getElementById('hp-bar'); hpBar.style.width = `${hpPercent}%`; hpBar.className = `hud-bar-fill ${hpPercent < 30 ? "low" : ""}`;
    document.getElementById('medkits-value').innerText = playerState.medkits; document.getElementById('score-value').innerText = playerState.score;

    WEAPON_KEYS.forEach(key => {
        const slot = document.getElementById(`weapon-slot-${key}`);
        const ammoCount = playerState.ammo[key] || 0;
        slot.querySelector('.weapon-ammo').innerText = ammoCount;
        if (ammoCount <= 0) { slot.classList.add('no-ammo'); } else { slot.classList.remove('no-ammo'); }
        if (key === playerState.currentWeapon) { slot.classList.add('active'); } else { slot.classList.remove('active'); }
    });

    const powerupHUD = document.getElementById('powerup-hud');
    if (playerState.activePowerUp) {
        powerupHUD.style.display = 'block'; let text = "";
        switch (playerState.activePowerUp) {
            case "turbo": text = `TURBO: ${playerState.powerUpTimer.toFixed(1)}s`; break;
            case "machinegun": text = `KARABIN: ${playerState.powerUpTimer.toFixed(1)}s`; break;
            case "mines": text = `MINY: ${playerState.powerUpAmmo}x`; break;
        }
        powerupHUD.innerText = text;
    } else { powerupHUD.style.display = 'none'; }
    if (playerState.isEmpDisabled) {
        powerupHUD.style.display = 'block';
        powerupHUD.innerText = `SYSTEMY WYŁĄCZONE: ${playerState.empDisableTimer.toFixed(1)}s`;
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
function showCustomQuote(playerId, text) {
    const playerTank = gameObjects.players[playerId]; if (!playerTank || !camera) return;
    let bubble = document.getElementById(`bubble-${playerId}`);
    if (!bubble) { bubble = document.createElement('div'); bubble.className = 'speech-bubble'; bubble.id = `bubble-${playerId}`; document.getElementById('speech-bubbles-container').appendChild(bubble); }
    bubble.innerText = text; bubble.style.display = "block"; return bubble;
}
function showTankQuote(playerId) {
    const quote = TANK_QUOTES[Math.floor(Math.random() * TANK_QUOTES.length)]; const bubble = showCustomQuote(playerId, quote);
    if (bubble) { setTimeout(() => { if(bubble) bubble.style.display = "none"; }, 4000); }
}
function displayKillNotification(attackerId, victimId) {
    const container = document.getElementById('kill-feed-container'); if (!container) return;
    const attackerName = attackerId === localPlayerId ? 'TY' : `Gracz ${attackerId.substring(0, 5)}`;
    const victimName = victimId === localPlayerId ? 'Ciebie' : `gracza ${victimId.substring(0, 5)}`;
    const messages = [ `🤠 ${attackerName} wysłał ${victimName} na złom! 💥`, `💣 ${attackerName} zrobił z ${victimName} konfetti! 🎉`, `🔥 ${attackerName} podgrzał atmosferę, eliminując ${victimName}!`, `🚀 ${attackerName} pokazał ${victimName}, gdzie raki zimują! 🦀`, `🎯 ${attackerName} trafia w dziesiątkę... a ${victimName} w pył! 💨` ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const notificationElement = document.createElement('div'); notificationElement.className = 'kill-notification';
    notificationElement.innerHTML = message; container.appendChild(notificationElement);
    setTimeout(() => { notificationElement.remove(); }, 5000); 
}
function displayJoinNotification(playerId) {
    const container = document.getElementById('kill-feed-container'); if (!container) return;
    const playerName = `Gracz ${playerId.substring(0, 5)}`; const notificationElement = document.createElement('div');
    notificationElement.className = 'join-notification'; notificationElement.innerHTML = `👋 ${playerName} dołączył do bitwy!`;
    container.appendChild(notificationElement); setTimeout(() => { notificationElement.remove(); }, 5000);
}

// --- LOGIKA GRY (KLIENT) ---
function initGame(payload) {
    localPlayerId = payload.playerId; clientGameState = payload.initialState; isGameStarted = true;
    heightMap = payload.heightMap; terrainParams = payload.terrainParams;
    
    currentWaterLevel = payload.waterLevel;
    targetWaterLevel = payload.waterLevel;

    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); 
    renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x87CEEB); scene.fog = new THREE.Fog(0x87CEEB, 2000, 15000); 
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000); clock = new THREE.Clock();
    createSkyboxBackground(scene);
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(100, 80, 50); dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; scene.add(dirLight);
    raycaster = new THREE.Raycaster(); document.body.classList.add('crosshair-cursor');
    minimapCanvas = document.getElementById('minimap'); minimapCanvas.width = 220; minimapCanvas.height = 220; minimapCtx = minimapCanvas.getContext('2d');
    const terrainGeometry = new THREE.PlaneGeometry(terrainParams.size, terrainParams.size, terrainParams.segments, terrainParams.segments);
    const vertices = terrainGeometry.attributes.position.array; const segments = terrainParams.segments;
    for (let i = 0; i <= segments; i++) { for (let j = 0; j <= segments; j++) { vertices[(i * (segments + 1) + j) * 3 + 2] = heightMap[j][i]; } }
    terrainGeometry.attributes.position.needsUpdate = true; terrainGeometry.computeVertexNormals();
    const groundMaterial = new THREE.MeshLambertMaterial({ map: createGroundTexture(heightMap, terrainParams) });
    terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial); terrainMesh.rotation.x = -Math.PI / 2; terrainMesh.name = 'ground';
    terrainMesh.receiveShadow = true; scene.add(terrainMesh); aimables.push(terrainMesh);
    trackCanvas = document.createElement('canvas'); trackCanvas.width = TRACK_CANVAS_RESOLUTION; trackCanvas.height = TRACK_CANVAS_RESOLUTION;
    trackCtx = trackCanvas.getContext('2d'); trackCtx.fillStyle = 'rgba(0,0,0,0)'; trackCtx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);
    trackTexture = new THREE.CanvasTexture(trackCanvas);
    const trackPlaneMaterial = new THREE.MeshBasicMaterial({ map: trackTexture, transparent: true, depthWrite: false });
    trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(terrainParams.size, terrainParams.size), trackPlaneMaterial);
    trackMesh.rotation.x = -Math.PI / 2; trackMesh.position.y = 0.05; scene.add(trackMesh);
    
    // --- MODYFIKACJA: Przywrócenie dwóch rodzajów wody ---
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x006994, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.75,
    });
    
    // 1. Woda na mapie, animowana
    const mapWaterGeometry = new THREE.PlaneGeometry(terrainParams.size, terrainParams.size);
    mapWaterMesh = new THREE.Mesh(mapWaterGeometry, waterMaterial);
    mapWaterMesh.rotation.x = -Math.PI / 2;
    mapWaterMesh.position.y = currentWaterLevel;
    scene.add(mapWaterMesh);
    
    // 2. Woda poza mapą, statyczna, powodująca tonięcie
    const outOfBoundsWaterGeometry = new THREE.PlaneGeometry(terrainParams.size * 5, terrainParams.size * 5);
    const outOfBoundsWater = new THREE.Mesh(outOfBoundsWaterGeometry, waterMaterial);
    outOfBoundsWater.rotation.x = -Math.PI / 2;
    outOfBoundsWater.position.y = -0.5; // Stała, niska pozycja
    scene.add(outOfBoundsWater);

    if (payload.spawnPoints) { for(const sp of payload.spawnPoints) { const marker = createSpawnMarker(); marker.position.set(sp.x, getHeightAt(sp.x, sp.z), sp.z); scene.add(marker); } }
    const smokeTexture = createSmokeTexture();
    greySmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0x888888, depthWrite: false });
    blackSmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0x222222, depthWrite: false });
    cloudSmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0xcccccc, depthWrite: false, opacity: 0.8 });
    reconcileGameState(clientGameState); setupEventListeners(); animate();
    setInterval(() => { if(clientGameState.players[localPlayerId] && !clientGameState.players[localPlayerId].isDestroyed && !clientGameState.players[localPlayerId].isSinking) { if (Math.random() > 0.6) showTankQuote(localPlayerId); } }, 15000 + Math.random() * 5000);
}
function handleFireInput() {
    if (!canFire || !localPlayerId || !clientGameState.players[localPlayerId] || clientGameState.players[localPlayerId].isDestroyed) return;

    const playerState = clientGameState.players[localPlayerId];
    if (playerState.isEmpDisabled) return;
    
    let currentCooldown = 0.5;
    if (playerState.activePowerUp === 'machinegun') { currentCooldown = 0.08; } 
    else { const weaponData = WEAPONS_DATA[playerState.currentWeapon]; if(weaponData) currentCooldown = weaponData.cooldown; }
    
    const localPlayerMesh = gameObjects.players[localPlayerId];
    const barrelWorldPos = new THREE.Vector3(); localPlayerMesh.barrel.getWorldPosition(barrelWorldPos);
    const direction = new THREE.Vector3().subVectors(targetPoint, barrelWorldPos).normalize();
    socket.emit('playerAction', { type: 'fire', direction: direction, startPosition: barrelWorldPos });
    canFire = false; fireCooldown = currentCooldown;
}

function setupEventListeners() {
    document.addEventListener("keydown", (e) => { 
        keys[e.code] = true; 
        if (!isGameStarted || !localPlayerId) return;
        if (e.code.startsWith('Digit')) {
            const index = parseInt(e.code.replace('Digit', ''), 10) - 1;
            if (index >= 0 && index < WEAPON_KEYS.length) {
                const weaponId = WEAPON_KEYS[index];
                socket.emit('playerAction', { type: 'switchWeapon', weaponId: weaponId });
            }
        }
    });
    document.addEventListener("keyup", (e) => {
        keys[e.code] = false; if (!isGameStarted || !localPlayerId) return;
        if (e.code === 'KeyB') socket.emit('playerAction', { type: 'heal' });
        if (e.code === 'KeyG') socket.emit('playerAction', { type: 'dropMine' });
        if (e.code === 'KeyL') socket.emit('playerAction', { type: 'toggleLaser' });
    });
    const menuEl = document.getElementById("menu"), mapEl = document.getElementById("map-overlay"), scoreEl = document.getElementById("score-overlay");
    document.addEventListener("keydown", (e) => {
        if (!isGameStarted) return; if (e.code === "Escape") { menuEl.style.display = menuEl.style.display === "flex" ? "none" : "flex"; }
        if (e.code === "KeyM") mapEl.style.display = mapEl.style.display === "flex" ? "none" : "flex";
        if (e.code === "Tab") { e.preventDefault(); scoreEl.style.display = "flex"; updateScoreboard(); }
    });
    document.addEventListener("keyup", (e) => { if (e.code === "Tab") scoreEl.style.display = "none"; });
    document.addEventListener('mousemove', (e) => { if (isGameStarted) { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = - (e.clientY / window.innerHeight) * 2 + 1; } });
    document.addEventListener('mousedown', (e) => { if(isGameStarted && e.button === 0) { handleFireInput(); } });
    document.addEventListener('contextmenu', e => e.preventDefault());
}

function reconcileGameState(serverState) {
    const serverPlayerIds = Object.keys(serverState.players || {});
    for (const id of serverPlayerIds) {
        if (!gameObjects.players[id]) {
            const playerData = serverState.players[id]; const tankColor = (id === localPlayerId) ? 0x38a849 : 0xcc3333;
            const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(tankColor));
            tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
            tank.isSinkingBubbleShown = false; tank.laserSight = createPlayerLaser();
            tank.lastTrackPos = new THREE.Vector3(Infinity, Infinity, Infinity);
            scene.add(tank); gameObjects.players[id] = tank;
        }
    }
    const serverBuildingIds = Object.keys(serverState.buildings || {});
    for (const id of serverBuildingIds) { if (!gameObjects.buildings[id]) { createBuildingMesh(serverState.buildings[id]); } }
    const objectTypes = ['crates', 'ammoCrates'];
    for (const type of objectTypes) {
        const serverObjectIds = Object.keys(serverState[type] || {});
        for (const id of serverObjectIds) { if (!gameObjects[type][id]) { createObjectMesh({type: type.slice(0, -1), data: serverState[type][id]}); } }
    }
}
function createObjectMesh(payload) {
    const { type, data } = payload;
    let newMesh; let container = gameObjects[type + 's'];
    if(!container || container[data.id]) return; 

    switch(type) {
        case 'projectile': 
            const pColors = { he: 0xffa500, ap: 0xcccccc, heat: 0xff4500, emp: 0x00ffff, smoke: 0xaaaaaa };
            newMesh = new THREE.Mesh( new THREE.CapsuleGeometry(0.25, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: pColors[data.weaponId] || 0xffff00, emissive: pColors[data.weaponId] || 0xffff00, emissiveIntensity: 2 }) ); 
            break;
        case 'machineGunBullet': newMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffa500 })); break;
        case 'missile':
            newMesh = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 12), LAMBERT_MATERIAL(0xcccccc));
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 12), LAMBERT_MATERIAL(0xff0000)); tip.position.y = 1.5; newMesh.add(body, tip); break;
        case 'mine': newMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16), LAMBERT_MATERIAL(0x444444)); break;
        case 'crate': newMesh = createSupplyCrate(); break;
        case 'ammoCrate': newMesh = createAmmoCrateMesh(); break;
    }
    if (newMesh) {
        newMesh.position.set(data.position.x, data.position.y, data.position.z);
        if(data.rotationY) newMesh.rotation.y = data.rotationY;
        container[data.id] = newMesh;
        newMesh.lastPosition = new THREE.Vector3().copy(newMesh.position);
        scene.add(newMesh);
    }
}

function drawMinimap() {
    if (!isGameStarted || !localPlayerId || !clientGameState.players || !clientGameState.players[localPlayerId] || !minimapCtx) { return; }
    const localPlayer = clientGameState.players[localPlayerId];
    if (localPlayer.isDestroyed || localPlayer.isSinking) { minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height); return; }
    const ctx = minimapCtx; const canvas = minimapCanvas; const centerX = canvas.width / 2; const centerY = canvas.height / 2;
    const radius = canvas.width / 2; const scale = radius / (terrainParams.size * 0.55);
    const playerRot = localPlayer.rotation.y; const cosR = Math.cos(playerRot); const sinR = Math.sin(playerRot);
    const transformPoint = (x, z) => { const dx = x - localPlayer.position.x; const dz = z - localPlayer.position.z; const rotatedX = dx * cosR + dz * sinR; const rotatedZ = -dx * sinR + dz * cosR; return { x: centerX + rotatedX * scale, y: centerY - rotatedZ * scale }; };
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(10, 25, 10, 0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(50, 255, 50, 0.2)'; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(r => { ctx.beginPath(); ctx.arc(centerX, centerY, radius * r, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(centerX - radius, centerY); ctx.lineTo(centerX + radius, centerY); ctx.moveTo(centerX, centerY - radius); ctx.lineTo(centerX, centerY + radius); ctx.stroke();
    const currentTime = Date.now();
    ctx.fillStyle = 'rgba(50, 200, 50, 0.25)';
    for (const id in gameObjects.buildings) {
        const buildingData = gameObjects.buildings[id]?.data; if (!buildingData) continue;
        const bPos = buildingData.position; const bDim = buildingData.dimensions; const halfW = bDim.x / 2; const halfD = bDim.z / 2;
        const corners = [ { x: bPos.x - halfW, z: bPos.z - halfD }, { x: bPos.x + halfW, z: bPos.z - halfD }, { x: bPos.x + halfW, z: bPos.z + halfD }, { x: bPos.x - halfW, z: bPos.z + halfD }, ];
        const transformedCorners = corners.map(c => transformPoint(c.x, c.z));
        if (transformedCorners.every(c => c !== null)) { ctx.beginPath(); ctx.moveTo(transformedCorners[0].x, transformedCorners[0].y); for(let i = 1; i < transformedCorners.length; i++) { ctx.lineTo(transformedCorners[i].x, transformedCorners[i].y); } ctx.closePath(); ctx.fill(); }
    }
    const crateBlink = Math.sin(currentTime * 0.005) * 0.4 + 0.6; ctx.fillStyle = `rgba(255, 223, 0, ${crateBlink})`; ctx.strokeStyle = `rgba(255, 223, 0, ${crateBlink + 0.2})`; ctx.lineWidth = 2;
    for (const id in clientGameState.crates) { const crate = clientGameState.crates[id]; const transformed = transformPoint(crate.position.x, crate.position.z); if (transformed) { ctx.beginPath(); ctx.rect(transformed.x - 4, transformed.y - 4, 8, 8); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = `rgba(100, 200, 100, ${crateBlink})`; ctx.strokeStyle = `rgba(100, 200, 100, ${crateBlink + 0.2})`;
    for (const id in clientGameState.ammoCrates) { const crate = clientGameState.ammoCrates[id]; const transformed = transformPoint(crate.position.x, crate.position.z); if (transformed) { ctx.beginPath(); ctx.rect(transformed.x - 4, transformed.y - 4, 8, 8); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = '#ff1a1a';
    for (const id in clientGameState.players) {
        if (id === localPlayerId || clientGameState.players[id].isDestroyed || clientGameState.players[id].isSinking) continue;
        const player = clientGameState.players[id]; const transformed = transformPoint(player.position.x, player.position.z);
        if (transformed) { ctx.beginPath(); ctx.arc(transformed.x, transformed.y, 5, 0, Math.PI * 2); ctx.fill(); }
    }
    const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius); sweepGradient.addColorStop(0, 'rgba(128, 255, 128, 0.4)'); sweepGradient.addColorStop(0.8, 'rgba(128, 255, 128, 0.1)'); sweepGradient.addColorStop(1, 'rgba(128, 255, 128, 0)');
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, minimapScanAngle, minimapScanAngle + Math.PI * 0.3); ctx.closePath(); ctx.fillStyle = sweepGradient; ctx.fill(); ctx.restore(); 
    ctx.save(); ctx.translate(centerX, centerY); ctx.fillStyle = '#66ff66'; ctx.shadowColor = '#66ff66'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, 8); ctx.lineTo(6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(50, 255, 50, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(centerX, centerY, radius - 1.5, 0, Math.PI * 2); ctx.stroke();
}
function drawTracks(tank) {
    const state = clientGameState.players[tank.id]; if (!state) return;
    const tankData = TANKS_DATA[state.tankType]; const trackWidth = tankData.hullWidth / 2 - 0.5;
    const rightTrackOffset = new THREE.Vector3(trackWidth, 0, 0).applyQuaternion(tank.quaternion); const leftTrackOffset = new THREE.Vector3(-trackWidth, 0, 0).applyQuaternion(tank.quaternion);
    const rightTrackPos = tank.position.clone().add(rightTrackOffset); const leftTrackPos = tank.position.clone().add(leftTrackOffset);
    [leftTrackPos, rightTrackPos].forEach(trackPos => {
        const canvasX = (trackPos.x / terrainParams.size + 0.5) * TRACK_CANVAS_RESOLUTION; const canvasY = (trackPos.z / terrainParams.size + 0.5) * TRACK_CANVAS_RESOLUTION;
        trackCtx.save(); trackCtx.translate(canvasX, canvasY); trackCtx.rotate(-state.rotation.y);
        trackCtx.fillStyle = 'rgba(0, 0, 0, 0.1)'; trackCtx.fillRect(-1.5, -3, 3, 6); trackCtx.restore();
    });
    trackTexture.needsUpdate = true;
}

function animate() {
    if (!isGameStarted) return; requestAnimationFrame(animate);
    const delta = clock.getDelta();
    minimapScanAngle = (minimapScanAngle - delta * 2.5) % (Math.PI * 2);
    if (fireCooldown > 0) { fireCooldown -= delta; } else { canFire = true; }
    socket.emit("playerInput", keys);

    if (mapWaterMesh && currentWaterLevel !== targetWaterLevel) {
        currentWaterLevel = THREE.MathUtils.lerp(currentWaterLevel, targetWaterLevel, 0.01);
        mapWaterMesh.position.y = currentWaterLevel;

        if (Math.abs(currentWaterLevel - targetWaterLevel) < 0.01) {
            currentWaterLevel = targetWaterLevel;
        }
    }

    for (const id in clientGameState.players) {
        const serverPlayer = clientGameState.players[id]; const clientTank = gameObjects.players[id];
        if (clientTank && serverPlayer) {
            clientTank.visible = !serverPlayer.isDestroyed;
            clientTank.position.lerp(new THREE.Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z), 0.25);
            const targetChassisQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, serverPlayer.rotation.y, 0));
            const targetPitchQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(serverPlayer.rotation.x, 0, 0));
            const targetSinkingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(serverPlayer.sinkingAngle.x, 0, serverPlayer.sinkingAngle.z));
            const finalQuaternion = targetChassisQuaternion.multiply(targetPitchQuaternion).multiply(targetSinkingQuaternion);
            clientTank.quaternion.slerp(finalQuaternion, 0.15);

            if (serverPlayer.isEmpDisabled && (!clientTank.empEffect || clientTank.empEffect.lifespan <= 0)) {
                createEMPTankEffect(clientTank);
            }

            if (clientTank.position.distanceTo(clientTank.lastTrackPos) > MIN_TRACK_DISTANCE && Math.max(Math.abs(clientTank.position.x), Math.abs(clientTank.position.z)) < terrainParams.sandyAreaRadius) {
                drawTracks(clientTank); clientTank.lastTrackPos.copy(clientTank.position);
            }
            if (id !== localPlayerId) { clientTank.turret.rotation.y = serverPlayer.turretRotation.y; clientTank.mantlet.rotation.x = serverPlayer.mantletRotation.x; }
            
            // --- MODYFIKACJA: "bul bul bul" tylko gdy flaga isSinking jest prawdziwa (czyli poza mapą) ---
            if (serverPlayer.isSinking && !clientTank.isSinkingBubbleShown) { 
                showCustomQuote(id, "Bul... bul... bul..."); 
                clientTank.isSinkingBubbleShown = true; 
            } else if (!serverPlayer.isSinking && clientTank.isSinkingBubbleShown) { 
                const bubble = document.getElementById(`bubble-${id}`); 
                if (bubble) bubble.style.display = 'none'; 
                clientTank.isSinkingBubbleShown = false; 
            }
            
            clientTank.smokeCooldown = (clientTank.smokeCooldown || 0) - delta;
            if (clientTank.smokeCooldown <= 0 && !serverPlayer.isDestroyed && !serverPlayer.isSinking) {
                const hpPercent = (serverPlayer.health / serverPlayer.maxHealth) * 100;
                if (hpPercent < 30) { emitSmokeParticle(clientTank, blackSmokeMaterial); clientTank.smokeCooldown = 0.08; } 
                else if (hpPercent < 45) { emitSmokeParticle(clientTank, greySmokeMaterial); clientTank.smokeCooldown = 0.2; }
            }
            if (clientTank.laserSight && serverPlayer.laserData) {
                const laser = clientTank.laserSight; const data = serverPlayer.laserData;
                const isVisible = data.enabled && !serverPlayer.isDestroyed && !serverPlayer.isSinking; laser.visible = isVisible;
                if (isVisible) {
                    const positions = laser.geometry.attributes.position.array;
                    positions[0] = data.start.x; positions[1] = data.start.y; positions[2] = data.start.z;
                    positions[3] = data.end.x; positions[4] = data.end.y; positions[5] = data.end.z;
                    laser.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    }
    
    const projectileTypes = ['projectiles', 'machineGunBullets', 'missiles'];
    for(const type of projectileTypes) {
        const container = gameObjects[type]; if(!container) continue;
        for (const id in container) {
            const clientObj = container[id]; const serverObj = clientGameState[type] ? clientGameState[type][id] : null;
            if (clientObj && serverObj) {
                const serverPos = new THREE.Vector3(serverObj.position.x, serverObj.position.y, serverObj.position.z);
                const moveDirection = serverPos.clone().sub(clientObj.lastPosition).normalize();
                if (moveDirection.lengthSq() > 0.001) {
                    clientObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection);
                    if (type === 'missiles') clientObj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/2));
                }
                clientObj.position.lerp(serverPos, 0.5); clientObj.lastPosition.copy(clientObj.position);
            }
        }
    }
    const crateTypes = ['crates', 'ammoCrates'];
    for(const type of crateTypes) {
        for (const id in gameObjects[type]) { 
            gameObjects[type][id].rotation.y += 0.5 * delta; const pos = gameObjects[type][id].position;
            pos.y = getHeightAt(pos.x, pos.z) + 1.5 + Math.sin(clock.getElapsedTime() * 2 + id.length) * 0.5;
        }
    }

    const gravity = -9.8;
    for (let i = gameObjects.particles.length - 1; i >= 0; i--) {
        const p = gameObjects.particles[i]; p.lifespan -= delta;
        if (p.lifespan <= 0) { scene.remove(p.mesh || p); if(p.geometry) p.geometry.dispose(); if(p.material) p.material.dispose(); gameObjects.particles.splice(i, 1); } 
        else { 
            if (p.velocity) { p.velocity.y += gravity * delta; p.position.add(p.velocity.clone().multiplyScalar(delta)); }
            if (p.target) { p.mesh.position.copy(p.target.position); if (!clientGameState.players[p.target.id] || !clientGameState.players[p.target.id].isEmpDisabled) p.lifespan = 0; }
        }
    }
    
    for (let i = gameObjects.smokeParticles.length - 1; i >= 0; i--) {
        const p = gameObjects.smokeParticles[i]; p.lifespan -= delta;
        if (p.lifespan <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); gameObjects.smokeParticles.splice(i, 1); }
        else {
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta)); const lifePercent = p.lifespan / p.initialLifespan;
            p.mesh.material.opacity = lifePercent; const currentScale = p.startSize + (p.endSize - p.startSize) * (1 - lifePercent);
            p.mesh.scale.set(currentScale, currentScale, currentScale); p.mesh.lookAt(camera.position);
        }
    }
    for (const id in gameObjects.smokeClouds) {
        const cloud = gameObjects.smokeClouds[id]; cloud.lifespan -= delta;
        if (cloud.lifespan <= 0) {
            cloud.particles.forEach(p => scene.remove(p.mesh)); delete gameObjects.smokeClouds[id];
        } else {
            const lifePercent = cloud.lifespan / cloud.initialLifespan;
            cloud.particles.forEach(p => {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
                const currentScale = p.startSize * (1 - Math.abs(lifePercent - 0.5) * 2);
                p.mesh.scale.set(currentScale, currentScale, currentScale);
                p.mesh.material.opacity = Math.min(0.8, lifePercent * 2);
                p.mesh.lookAt(camera.position);
            });
        }
    }
    const wreckGravity = -30;
    for (let i = gameObjects.wreckage.length - 1; i >= 0; i--) {
        const wreck = gameObjects.wreckage[i]; wreck.lifespan -= delta;
        const wreckGroundHeight = getHeightAt(wreck.object.position.x, wreck.object.position.z);
        if (wreck.lifespan <= 0) { scene.remove(wreck.object); wreck.object.traverse(c => { if(c.isMesh) { c.geometry.dispose(); if(c.material.isMaterial) c.material.dispose(); }}); gameObjects.wreckage.splice(i, 1); continue; }
        if (wreck.object.position.y > wreckGroundHeight) {
            wreck.velocity.y += wreckGravity * delta; wreck.object.position.add(wreck.velocity.clone().multiplyScalar(delta));
            wreck.object.rotation.x += wreck.angularVelocity.x * delta; wreck.object.rotation.y += wreck.angularVelocity.y * delta; wreck.object.rotation.z += wreck.angularVelocity.z * delta;
        } else { wreck.object.position.y = wreckGroundHeight; wreck.velocity.y = 0; wreck.angularVelocity.multiplyScalar(0.95); }
    }
     for (const playerId in gameObjects.players) {
        const bubble = document.getElementById(`bubble-${playerId}`); const playerTank = gameObjects.players[playerId];
        if (bubble && playerTank && bubble.style.display !== 'none') {
            const vector = new THREE.Vector3(playerTank.position.x, playerTank.position.y + 6, playerTank.position.z);
            vector.project(camera);
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth; const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
            bubble.style.left = `${x}px`; bubble.style.top = `${y}px`;
        }
    }
    const localPlayerMesh = gameObjects.players[localPlayerId];
    if (localPlayerMesh) {
        const localPlayerState = clientGameState.players[localPlayerId];
        raycaster.setFromCamera(mouse, camera); const intersects = raycaster.intersectObjects(aimables, true);
        if (intersects.length > 0) { targetPoint.copy(intersects[0].point); } 
        else { const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -localPlayerMesh.position.y); raycaster.ray.intersectPlane(plane, targetPoint); }

        if (localPlayerState && !localPlayerState.isDestroyed && !localPlayerState.isSinking && !localPlayerState.isEmpDisabled) {
            const turret = localPlayerMesh.turret; const mantlet = localPlayerMesh.mantlet;
            const localTargetInTurret = turret.worldToLocal(targetPoint.clone());
            const targetTurretAngle = Math.atan2(localTargetInTurret.x, localTargetInTurret.z);
            let diff = targetTurretAngle - turret.rotation.y;
            while (diff < -Math.PI) diff += 2 * Math.PI; while (diff > Math.PI) diff -= 2 * Math.PI;
            turret.rotation.y += diff * 0.15;
            const targetMantletAngle = Math.atan2(localTargetInTurret.y, Math.sqrt(localTargetInTurret.x**2 + localTargetInTurret.z**2));
            mantlet.rotation.x = THREE.MathUtils.lerp(mantlet.rotation.x, Math.max(-0.5, Math.min(0.2, targetMantletAngle)), 0.15);
            localPlayerState.turretRotation.y = turret.rotation.y; localPlayerState.mantletRotation.x = mantlet.rotation.x;
            socket.emit('playerAimUpdate', { turretY: turret.rotation.y, mantletX: mantlet.rotation.x });
            const barrelWorldPos = new THREE.Vector3(); localPlayerMesh.barrel.getWorldPosition(barrelWorldPos);
            socket.emit('laserUpdate', { start: barrelWorldPos, end: targetPoint });
        }
        
        if (localPlayerState && (localPlayerState.isSinking || localPlayerState.isDestroyed)) {
            const dronePosition = new THREE.Vector3(localPlayerMesh.position.x, localPlayerMesh.position.y + 20, localPlayerMesh.position.z + 5);
            camera.position.lerp(dronePosition, 0.05); camera.lookAt(localPlayerMesh.position);
        } else if (localPlayerState) {
            const offset = new THREE.Vector3(0, 20, -30);
            const chassisQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, localPlayerState.rotation.y, 0));
            const cameraTargetPosition = localPlayerMesh.position.clone().add(offset.applyQuaternion(chassisQuaternion));
            camera.position.lerp(cameraTargetPosition, 0.1);
            camera.lookAt(localPlayerMesh.position.clone().add(new THREE.Vector3(0, 3, 0)));
        }
    }
    updateHUD(); drawMinimap(); renderer.render(scene, camera);
}

// --- OBSŁUGA ZDARZEŃ Z SERWERA ---
socket.on("connect", () => { console.log("Połączono z serwerem!", socket.id); });
socket.on('serverStatus', (data) => {
    if(data.configured) {
        console.log("Serwer już skonfigurowany. Blokowanie opcji."); const configPanel = document.getElementById('server-config-panel');
        configPanel.disabled = true; document.querySelector(`input[name="map-size"][value="${data.settings.mapSize}"]`).checked = true;
        const ampSlider = document.getElementById('terrain-amplitude'); const ampValue = document.getElementById('amplitude-value');
        ampSlider.value = data.settings.amplitude; ampValue.textContent = data.settings.amplitude;
        const scaleSlider = document.getElementById('terrain-scale'); const scaleValue = document.getElementById('scale-value');
        scaleSlider.value = data.settings.scale; scaleValue.textContent = data.settings.scale;
    } else { console.log("Serwer oczekuje na konfigurację."); }
});
socket.on("gameStarted", (payload) => { console.log("Gra rozpoczęta! Twój ID:", payload.playerId); initGame(payload); });
socket.on("gameStateUpdate", (serverState) => {
    if (clientGameState.players && clientGameState.players[localPlayerId] && serverState.players[localPlayerId]) {
        serverState.players[localPlayerId].turretRotation = clientGameState.players[localPlayerId].turretRotation;
        serverState.players[localPlayerId].mantletRotation = clientGameState.players[localPlayerId].mantletRotation;
    }
    clientGameState = serverState;
});
socket.on('waterLevelUpdate', (data) => {
    console.log(`Otrzymano aktualizację poziomu wody. Cel: ${data.targetLevel.toFixed(2)}`);
    targetWaterLevel = data.targetLevel;
});
socket.on('objectCreated', (payload) => {
    if (payload.type === 'smokeCloud') {
        const { position, radius, lifespan } = payload.data;
        createSmokeCloud(new THREE.Vector3(position.x, position.y, position.z), radius, lifespan);
    } else {
        createObjectMesh(payload);
    }
});
socket.on('objectDestroyed', (payload) => {
    const { type, id, hit, weaponId } = payload;
    let containerName = type.endsWith('y') ? type.slice(0, -1) + 'ies' : type + 's';
    if(type === 'machineGunBullet') containerName = 'machineGunBullets';
    if(type === 'ammoCrate') containerName = 'ammoCrates';
    const objectList = gameObjects[containerName];
    const object = objectList ? objectList[id] : null;

    if (object) {
        if (hit) {
            if (type === 'player') { destroyObjectWithWreckage(object, [object.hullGroup, object.turret]); if (Math.random() > 0.3) showTankQuote(id); }
            else if (weaponId === 'he' || weaponId === 'heat' || weaponId === 'guided') { createExplosion(object.position, 2.5); }
            else if (weaponId === 'emp') { createExplosion(object.position, 2.0, 0x00ffff); }
            else if (type === 'projectile') { createExplosion(object.position, 1.5); }
        }
        if (type !== 'player') {
            scene.remove(object); if(object.traverse) object.traverse(c => { if(c.isMesh) { c.geometry.dispose(); if(c.material && c.material.isMaterial) c.material.dispose(); }});
            delete objectList[id];
        }
    }
});
socket.on('buildingDamaged', ({ buildingId, destroyedBrickIndices, impactPoint }) => {
    const building = gameObjects.buildings[buildingId];
    if (building) {
        const zeroScaleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        for (const index of destroyedBrickIndices) { building.mesh.setMatrixAt(index, zeroScaleMatrix); building.data.bricks[index] = null; }
        building.mesh.instanceMatrix.needsUpdate = true;
        createBrickDebris(impactPoint, 5 + Math.floor(Math.random() * 5));
    }
});
socket.on("playerConnected", (playerData) => {
    if (!isGameStarted || !scene || gameObjects.players[playerData.id]) return;
    console.log(`Nowy gracz dołączył: ${playerData.id}`);
    if (clientGameState.players) { clientGameState.players[playerData.id] = playerData; }
    const tank = TANKS_DATA[playerData.tankType].create(new THREE.Color(0xcc3333));
    tank.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    tank.rotation.y = playerData.rotation.y; tank.isSinkingBubbleShown = false;
    tank.laserSight = createPlayerLaser(); tank.lastTrackPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    scene.add(tank); gameObjects.players[playerData.id] = tank; aimables.push(tank);
    displayJoinNotification(playerData.id);
});
socket.on("playerDisconnected", (id) => {
    if (clientGameState.players && clientGameState.players[id]) { delete clientGameState.players[id]; }
    const bubble = document.getElementById(`bubble-${id}`); if(bubble) bubble.remove();
    if (gameObjects.players[id]) {
        const index = aimables.indexOf(gameObjects.players[id]); if (index > -1) { aimables.splice(index, 1); }
        scene.remove(gameObjects.players[id].laserSight); scene.remove(gameObjects.players[id]);
        delete gameObjects.players[id]; console.log(`Gracz ${id} się rozłączył.`);
    }
});
socket.on('killNotification', ({ attackerId, victimId }) => { displayKillNotification(attackerId, victimId); });

// --- MODYFIKACJA: Udostępnienie funkcji `flood` w konsoli ---
window.flood = function(percentage) {
    if (socket && socket.connected) {
        const p = parseInt(percentage, 10);
        if (isNaN(p) || p < 0 || p > 100) {
            console.error("Proszę podać liczbę w zakresie 0-100.");
            return;
        }
        console.log(`Wysyłanie żądania zmiany poziomu wody do ${p}%...`);
        socket.emit('clientRequestFlood', p);
    } else {
        console.error("Nie połączono z serwerem. Nie można wysłać polecenia.");
    }
};

// --- START APLIKACJI ---
initializeUI();