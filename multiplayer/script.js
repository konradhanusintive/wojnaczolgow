import * as THREE from "three";
import { createSkydomeBackground } from './background.js';
import { createEnvironment } from './environment.js';
import { 
    createStandardTank, createPL01Tank, createAbramsTank, LAMBERT_MATERIAL,
    createTigerITank, createT3485Tank, createCromwellTank, createAMX1375Tank,
    createType59Tank, createChiHaTank, createStrv103BTank, createP40Tank,
    createSkodaT25Tank, createRamIITank, createSentinelAC1Tank, createTuranIIITank,
    createBT42Tank, createShotKalDaletTank, createNahuelDL43Tank, createChonmaHoTank,
    createK2BlackPantherTank, createRooikatTank
} from './tankModels.js'; 

let scene, renderer, clock, camera;
let localPlayerId = null;
let clientGameState = {};
let isGameStarted = false;
let isSelectionScreenActive = false;
let tankSelectionManager;
let environmentMeshes = {}; 

let brickMaterial;
let greySmokeMaterial, blackSmokeMaterial, cloudSmokeMaterial, empEffectMaterial, muzzleFlashMaterial, fireMaterial, scorchMarkMaterial;
let minimapCanvas, minimapCtx;
let minimapScanAngle = 0;

let heightMap;
let terrainMesh;
let terrainParams;

let raycaster;
const mouse = new THREE.Vector2();
const targetPoint = new THREE.Vector3();
const aimables = []; 

// === ZMIENNE DLA TRYBU SNAJPERSKIEGO ===
let isSniperModeActive = false;
let sniperZoomLevel = 1.0;
const SNIPER_MIN_ZOOM = 1.0;
const SNIPER_MAX_ZOOM = 10.0;
const SNIPER_SENSITIVITY = 0.002;
const BASE_FOV = 75; 
const mouseDelta = new THREE.Vector2();
// === Pomocnicze wektory dla kamery snajperskiej ===
const sniperCameraPosition = new THREE.Vector3();
const sniperLookAtTarget = new THREE.Vector3();
const sniperLaserEndPoint = new THREE.Vector3();

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
    particles: [], // Zmodyfikowana tablica do przechowywania spójnych obiektów cząstek
    wreckage: [],
    smokeParticles: [], 
    tracks: {},
    craters: {},
    fires: {},
    fallingTrees: [],
    trees: {},
    rocks: {}
};

const socket = io();

// --- STAŁE I DANE ---
const TANKS_DATA = {
  // Istniejące czołgi (standard to teraz M4 Sherman)
  pl01: { 
    name: "PL-01 Concept (Polska)", 
    description: "Lekki czołg wsparcia ogniowego o niskim profilu i nowoczesnym kamuflażu adaptacyjnym. Szybki i zwinny, idealny do szybkich ataków.", 
    stats: { hp: 85, damage: 1.0, speed: 18, turretRot: 1.8 }, 
    create: createPL01Tank, hullWidth: 6.0, sniperCamYOffset: 1.8, isPremium: false 
  },
  abrams: { 
    name: "M1 Abrams (USA)", 
    description: "Amerykański czołg podstawowy, znany z niezawodności i potężnego pancerza. Wolniejszy, ale niezwykle wytrzymały i zabójczy w natarciu.", 
    stats: { hp: 130, damage: 1.0, speed: 12, turretRot: 1.2 }, 
    create: createAbramsTank, hullWidth: 6.5, sniperCamYOffset: 2.2, isPremium: true 
  },
  standard: { 
    name: "M4 Sherman (USA)", 
    description: "Wszechstronny, klasyczny czołg średni. Dobrze zbalansowany pod względem mobilności, pancerza i siły ognia, doskonały dla początkujących.", 
    stats: { hp: 100, damage: 1.0, speed: 15, turretRot: 1.5 }, 
    create: createStandardTank, hullWidth: 5.5, sniperCamYOffset: 2.0, isPremium: false 
  },
  
  // Nowe czołgi
  tigerI: { 
    name: "Tiger I (Niemcy)", 
    description: "Legendarny, ciężki czołg o grubym pancerzu i potężnym dziale. Powolny, ale niemal nie do zatrzymania, gdy znajdzie się na pozycji.", 
    stats: { hp: 140, damage: 1.2, speed: 10, turretRot: 1.0 }, 
    create: createTigerITank, hullWidth: 7.0, sniperCamYOffset: 2.5, isPremium: false 
  },
  t3485: { 
    name: "T-34-85 (ZSRR)", 
    description: "Ikoniczny czołg średni, oferujący dobrą mobilność i skuteczną armatę. Idealny do manewrów flankingowych i wspierania ataku.", 
    stats: { hp: 105, damage: 1.05, speed: 16, turretRot: 1.6 }, 
    create: createT3485Tank, hullWidth: 5.0, sniperCamYOffset: 1.9, isPremium: false 
  },
  cromwell: { 
    name: "Cromwell (Wielka Brytania)", 
    description: "Szybki czołg pościgowy o dużej prędkości maksymalnej. Doskonały do zwiadu i zaskakiwania przeciwników z flanki.", 
    stats: { hp: 90, damage: 0.9, speed: 20, turretRot: 1.9 }, 
    create: createCromwellTank, hullWidth: 4.8, sniperCamYOffset: 1.8, isPremium: false 
  },
  amx1375: { 
    name: "AMX 13 75 (Francja)", 
    description: "Lekki czołg z magazynkiem, zdolny do szybkiego oddawania strzałów. Doskonały dla graczy preferujących taktykę 'uderz i uciekaj'.", 
    stats: { hp: 80, damage: 0.95, speed: 22, turretRot: 2.0 }, 
    create: createAMX1375Tank, hullWidth: 4.0, sniperCamYOffset: 1.5, isPremium: false 
  },
  type59: { 
    name: "Type 59 (Chiny)", 
    description: "Solidny czołg średni o okrągłej wieży i niezawodnym pancerzu. Trudny do penetracji i skuteczny w walce na średnim dystansie.", 
    stats: { hp: 110, damage: 1.1, speed: 14, turretRot: 1.3 }, 
    create: createType59Tank, hullWidth: 5.8, sniperCamYOffset: 2.0, isPremium: true 
  },
  chiha: { 
    name: "Chi-Ha (Japonia)", 
    description: "Japoński czołg średni, zwrotny i kompaktowy. Mimo skromnego pancerza, oferuje dobrą manewrowość do wsparcia drużyny.", 
    stats: { hp: 70, damage: 0.8, speed: 12, turretRot: 1.4 }, 
    create: createChiHaTank, hullWidth: 4.5, sniperCamYOffset: 1.7, isPremium: false 
  },
  strv103b: { 
    name: "Strv 103B (Szwecja)", 
    description: "Bezwieżowy niszczyciel czołgów o niskiej sylwetce i potężnym dziale. Jego unikalna konstrukcja pozwala na błyskawiczne celowanie korpusem.", 
    stats: { hp: 120, damage: 1.3, speed: 17, turretRot: 0.0 }, 
    create: createStrv103BTank, hullWidth: 6.0, sniperCamYOffset: 1.5, isPremium: true 
  }, 
  p40: { 
    name: "P40 (Włochy)", 
    description: "Włoski czołg ciężki z dobrze opancerzonym frontem. Niezbyt szybki, ale skuteczny w obronie i przebijaniu linii wroga.", 
    stats: { hp: 95, damage: 0.9, speed: 13, turretRot: 1.4 }, 
    create: createP40Tank, hullWidth: 5.2, sniperCamYOffset: 1.9, isPremium: false 
  },
  skodaT25: { 
    name: "Škoda T 25 (Czechosłowacja)", 
    description: "Średni czołg z systemem automatycznego ładowania. Oferuje serię szybkich strzałów, idealny do eliminowania osłabionych wrogów.", 
    stats: { hp: 90, damage: 1.0, speed: 18, turretRot: 1.7 }, 
    create: createSkodaT25Tank, hullWidth: 4.8, sniperCamYOffset: 1.8, isPremium: false 
  },
  ramII: { 
    name: "Ram II (Kanada)", 
    description: "Kanadyjski czołg średni, oparty na podwoziu M3 Lee. Solidny pancerz i niezawodna armata czynią go dobrym wsparciem.", 
    stats: { hp: 100, damage: 0.95, speed: 14, turretRot: 1.5 }, 
    create: createRamIITank, hullWidth: 5.6, sniperCamYOffset: 2.1, isPremium: false 
  },
  sentinelAC1: { 
    name: "Sentinel AC 1 (Australia)", 
    description: "Australijski czołg krążownik, dobrze zbalansowany pod kątem mobilności i siły ognia. Wszechstronny w różnych rolach bojowych.", 
    stats: { hp: 100, damage: 0.98, speed: 13, turretRot: 1.4 }, 
    create: createSentinelAC1Tank, hullWidth: 5.3, sniperCamYOffset: 2.0, isPremium: false 
  },
  turanIII: { 
    name: "Turán III (Węgry)", 
    description: "Ulepszony węgierski czołg średni, z lepszym pancerzem i armatą. Skuteczny w starciach na bliskim i średnim dystansie.", 
    stats: { hp: 88, damage: 0.85, speed: 11, turretRot: 1.3 }, 
    create: createTuranIIITank, hullWidth: 5.0, sniperCamYOffset: 1.8, isPremium: false 
  },
  bt42: { 
    name: "BT-42 (Finlandia)", 
    description: "Fiński czołg wsparcia ogniowego z haubicą. Mobilny i zdolny do zadawania dużych obrażeń obszarowych, idealny do nękania wrogów.", 
    stats: { hp: 80, damage: 1.1, speed: 20, turretRot: 1.5 }, 
    create: createBT42Tank, hullWidth: 4.2, sniperCamYOffset: 1.7, isPremium: false 
  },
  shotkaldalet: { 
    name: "Shot Kal Dalet (Izrael)", 
    description: "Izraelski czołg podstawowy (Centurion) z wieloma modyfikacjami. Silny pancerz, niezawodna armata, gotowy do walki w każdych warunkach.", 
    stats: { hp: 125, damage: 1.15, speed: 12, turretRot: 1.1 }, 
    create: createShotKalDaletTank, hullWidth: 6.0, sniperCamYOffset: 2.1, isPremium: true 
  },
  nahueldl43: { 
    name: "Nahuel DL 43 (Argentyna)", 
    description: "Argentyński czołg średni, bazujący na rozwiązaniach Shermana. Dobrze opancerzony, ze solidnym uzbrojeniem głównym.", 
    stats: { hp: 98, damage: 1.0, speed: 14, turretRot: 1.4 }, 
    create: createNahuelDL43Tank, hullWidth: 5.5, sniperCamYOffset: 2.0, isPremium: false 
  },
  chonmaho: { 
    name: "Ch'ŏnma-ho (Korea Północna)", 
    description: "Zmodyfikowany radziecki T-62. Charakteryzuje się mocnym działem i solidnym pancerzem wieży, skuteczny w natarciu.", 
    stats: { hp: 115, damage: 1.1, speed: 15, turretRot: 1.3 }, 
    create: createChonmaHoTank, hullWidth: 6.0, sniperCamYOffset: 2.0, isPremium: false 
  },
  k2blackpanther: { 
    name: "K2 Black Panther (Korea Południowa)", 
    description: "Nowoczesny czołg podstawowy z Korei Płd. Posiada zaawansowaną technologię, potężne działo i wyśmienitą mobilność. Elitarna jednostka.", 
    stats: { hp: 150, damage: 1.3, speed: 18, turretRot: 1.7 }, 
    create: createK2BlackPantherTank, hullWidth: 6.8, sniperCamYOffset: 2.3, isPremium: true 
  },
  rooikat: { 
    name: "Rooikat (RPA)", 
    description: "Szybki, kołowy pojazd opancerzony z dużą armatą. Idealny do zwiadu, szybkich flankowań i nękania celów na otwartym terenie.", 
    stats: { hp: 75, damage: 1.0, speed: 25, turretRot: 1.9 }, 
    create: createRooikatTank, hullWidth: 3.5, sniperCamYOffset: 1.6, isPremium: false 
  },
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
    return new THREE.MeshLambertMaterial({ map: texture, name: 'brickMaterial' });
}

function getHeightAt(x, z) {
    if (!heightMap || !terrainParams) return 0;
    const { size, segments } = terrainParams; const gridX = (x + size / 2) / size * segments; const gridZ = (z + size / 2) / size * segments;
    const x1 = Math.floor(gridX); const z1 = Math.floor(gridZ); const x2 = Math.min(x1 + 1, segments); const z2 = Math.min(z1 + 1, segments);
    if (x1 < 0 || x1 > segments || z1 < 0 || z1 > segments || !heightMap[x1] || !heightMap[x2]) return 0;
    const h11 = heightMap[x1][z1]; const h12 = heightMap[x1][z2]; const h21 = heightMap[x2][z1]; const h22 = heightMap[x2][z2];
    if (h11 === undefined || h12 === undefined || h21 === undefined || h22 === undefined) return 0;
    const tx = gridX - x1; const tz = gridZ - z1; const h_x1 = h11 * (1 - tx) + h21 * tx; const h_x2 = h12 * (1 - tx) + h22 * tx; 
    return h_x1 * (1 - tz) + h_x2 * tz;
}

function createTrackMarkTexture(type) {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Failed to get 2D context for track mark texture canvas.");
        return null;
    }
    const color = (type === 'sand' || type === 'mud') 
        ? 'rgba(100, 80, 60, 0.25)'
        : 'rgba(80, 55, 35, 0.35)';
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    const transparent = 'rgba(0,0,0,0)';
    gradient.addColorStop(0, transparent);
    gradient.addColorStop(0.15, color);
    gradient.addColorStop(0.85, color);
    gradient.addColorStop(1, transparent);
    ctx.fillStyle = gradient;
    for (let i = 2; i < canvas.height; i += 8) {
        ctx.fillRect(0, i, canvas.width, 4);
    }
    return new THREE.CanvasTexture(canvas);
}

// Globalne materiały dla śladów gąsienic, aby nie tworzyć ich w kółko
const sandTrackMaterial = new THREE.MeshBasicMaterial({ map: createTrackMarkTexture('sand'), transparent: true, depthWrite: false, name: 'sandTrackMaterial' });
const grassTrackMaterial = new THREE.MeshBasicMaterial({ map: createTrackMarkTexture('grass'), transparent: true, depthWrite: false, name: 'grassTrackMaterial' });


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
    const material = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas), name: 'supplyCrateMaterial' });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.5), material); base.position.y = 1; crate.add(base); return crate;
}
function createAmmoCrateMesh() {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: 0x4B5320, name: 'ammoCrateMaterial' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2), material);
    group.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 2.2), material.clone());
    lid.material.color.setHex(0x3B401A);
    lid.position.y = 0.9;
    group.add(lid);
    return group;
}

// Zmodyfikowana funkcja createExplosion
function createExplosion(position, scale, color = null) {
  const particleCount = 20 * scale;
  for (let i = 0; i < particleCount; i++) {
    const particleColor = color ? color : (Math.random() > 0.5 ? 0xffa500 : 0xff4500);
    const particleMesh = new THREE.Mesh( new THREE.SphereGeometry(0.2 * scale, 4, 4), new THREE.MeshBasicMaterial({ color: particleColor, name: 'explosionParticleMaterial' }) ); // Jawna nazwa
    particleMesh.position.copy(position);
    
    // Tworzymy spójny obiekt cząstki
    const particleWrapper = {
        mesh: particleMesh,
        velocity: new THREE.Vector3( Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 20 * scale),
        lifespan: Math.random() * 0.8 + 0.3,
    };
    gameObjects.particles.push(particleWrapper);
    scene.add(particleWrapper.mesh); // Dodajemy mesh z wrappera do sceny
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
    const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 8); const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888, name: 'spawnPoleMaterial' });
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 4; marker.add(pole);
    const flagGeo = new THREE.PlaneGeometry(3, 2); const flagMat = new THREE.MeshBasicMaterial({ color: 0x1E90FF, side: THREE.DoubleSide, name: 'spawnFlagMaterial' });
    const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(1.5, 6.5, 0); marker.add(flag); return marker;
}
function createPlayerLaser() {
    const laserGeometry = new THREE.BufferGeometry(); const positions = new Float32Array(2 * 3);
    laserGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6, linewidth: 2, name: 'playerLaserMaterial' });
    const laser = new THREE.Line(laserGeometry, laserMaterial); laser.frustumCulled = false; laser.visible = false;
    scene.add(laser); return laser;
}
function createSmokeTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Failed to get 2D context for smoke texture canvas."); return null; }
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}
function createFireTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Failed to get 2D context for fire texture canvas."); return null; }
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 200, 50, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 80, 0, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}
function createScorchMarkTexture() {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128; const ctx = canvas.getContext("2d");
    if (!ctx) { console.error("Failed to get 2D context for scorch mark texture canvas."); return null; }
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(20, 10, 0, 0.8)");
    gradient.addColorStop(1, "rgba(20, 10, 0, 0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}
function createMuzzleFlashTexture() {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) { console.error("Failed to get 2D context for muzzle flash texture canvas."); return null; }
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 220, 180, 1)"); gradient.addColorStop(0.3, "rgba(255, 180, 50, 0.8)"); gradient.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}
function emitSmokeParticle(tank, material, position, velocity, startSize, endSize, lifespan) {
    const particle = {
        mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material.clone()),
        velocity: velocity,
        lifespan: lifespan, initialLifespan: 0, startSize, endSize
    };
    particle.initialLifespan = particle.lifespan; particle.mesh.position.copy(position); particle.mesh.scale.set(startSize, startSize, startSize);
    gameObjects.smokeParticles.push(particle); scene.add(particle.mesh);
}
function triggerMuzzleFlash(barrel) {
    const flashMap = createMuzzleFlashTexture();
    if (!flashMap) { console.warn("Muzzle flash texture failed to load."); return; }
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, name: 'muzzleFlashSpriteMaterial' })); // Jawna nazwa
    barrel.getWorldPosition(flash.position);
    const scale = 3 + Math.random() * 2;
    flash.scale.set(scale, scale, scale);
    flash.rotation.z = Math.random() * Math.PI * 2;
    const particle = {
        mesh: flash,
        lifespan: 0.15,
        isFlash: true,
    };
    gameObjects.particles.push(particle);
    scene.add(flash);
    setTimeout(() => {
        if (!barrel) return;
        const smokePos = new THREE.Vector3();
        barrel.getWorldPosition(smokePos);
        for(let i = 0; i < 5; i++) {
            const vel = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
            vel.add(new THREE.Vector3(0,0,5).applyQuaternion(barrel.getWorldQuaternion(new THREE.Quaternion()))).multiplyScalar(0.5);
            emitSmokeParticle(null, greySmokeMaterial, smokePos, vel, 0.5, 3, 1.5 + Math.random());
        }
    }, 50);
}
// Zmodyfikowana funkcja createHitEffect
function createHitEffect(position, impulse) {
    for (let i = 0; i < 15; i++) {
        const particleMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.8),
            new THREE.MeshBasicMaterial({ color: 0xffff00, name: 'hitEffectParticleMaterial' }) // Jawna nazwa
        );
        particleMesh.position.copy(position);
        const randomDir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const reflection = new THREE.Vector3().copy(impulse).reflect(randomDir).normalize();
        
        // Tworzymy spójny obiekt cząstki
        const particleWrapper = {
            mesh: particleMesh,
            velocity: reflection.multiplyScalar(Math.random() * 20 + 10),
            lifespan: Math.random() * 0.4 + 0.2,
        };
        gameObjects.particles.push(particleWrapper);
        scene.add(particleWrapper.mesh); // Dodajemy mesh z wrappera do sceny
  }
    createExplosion(position, 1.0);
}
function createEMPTankEffect(tankMesh) {
    if (!tankMesh) return;
    if (!empEffectMaterial) { empEffectMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7, wireframe: true, name: 'empEffectMaterial' }); } // Jawna nazwa
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
    const cloudSmokeTexture = createSmokeTexture();
    if (!cloudSmokeTexture) { console.warn("Cloud smoke texture failed to load."); return; }
    const baseCloudSmokeMaterial = new THREE.MeshBasicMaterial({ map: cloudSmokeTexture, transparent: true, color: 0xcccccc, depthWrite: false, opacity: 0.8, name: 'cloudSmokeParticleMaterial' }); // Jawna nazwa
    for (let i = 0; i < particleCount; i++) {
        const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), baseCloudSmokeMaterial.clone());
        const p = {
            mesh: pMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5 ),
            startPos: new THREE.Vector3( (Math.random() - 0.5) * radius * 0.8, Math.random() * radius * 0.3, (Math.random() - 0.5) * radius * 0.8 ),
            startSize: radius * (0.8 + Math.random() * 0.5),
        };
        p.mesh.position.copy(position).add(p.startPos);
        cloud.particles.push(p);
        scene.add(p.mesh);
    }
    gameObjects.smokeClouds[Date.now()] = cloud;
}
function createFireEffect(fireData) {
    const fireObject = {
        id: fireData.id,
        particles: [],
        position: new THREE.Vector3(fireData.position.x, fireData.position.y, fireData.position.z)
    };
    const particleCount = 70;
    const fireEffectTexture = createFireTexture();
    if (!fireEffectTexture) { console.warn("Fire effect texture failed to load."); return; }
    const baseFireMaterial = new THREE.MeshBasicMaterial({ map: fireEffectTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, name: 'fireEffectParticleMaterial' }); // Jawna nazwa
    for (let i = 0; i < particleCount; i++) {
        const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), baseFireMaterial.clone());
        const lifespan = 0.5 + Math.random() * 0.8;
        const p = {
            mesh: pMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 4 + 2, (Math.random() - 0.5) * 2),
            initialLifespan: lifespan,
            lifespan: lifespan,
            startSize: 1.5 + Math.random() * 2,
            endSize: 0,
        };
        const spawnRadius = fireData.initialRadius * 0.5;
        p.mesh.position.copy(fireObject.position).add(
            new THREE.Vector3(
                (Math.random() - 0.5) * spawnRadius,
                Math.random() * 1.5,
                (Math.random() - 0.5) * spawnRadius
            )
        );
        fireObject.particles.push(p);
        scene.add(p.mesh);
    }
    gameObjects.fires[fireData.id] = fireObject;
}

// --- KLASA DO ZARZĄDZANIA EKRANEM WYBORU ---
class TankSelectionManager {
    constructor(tankKeys) {
        this.tankKeys = tankKeys;
        this.renderTargets = [];
        this.isActive = false;
        this.animationFrameId = null;
        // Współdzielony renderer WebGL (jeden kontekst dla wszystkich miniatur)
        this.sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.sharedRenderer.setPixelRatio(window.devicePixelRatio || 1);
    }
    init() {
        this.tankKeys.forEach(tankKey => {
            const canvas = document.getElementById(`canvas-${tankKey}`);
            if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
                console.warn(`Canvas for ${tankKey} not found or has no size (width: ${canvas?.clientWidth}, height: ${canvas?.clientHeight}). Skipping miniature setup.`);
                return; // Pomiń setup, jeśli canvas nie jest gotowy
            }
            const scene = new THREE.Scene();
            // Ustawienia kamery dla miniatury
            const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
            camera.position.set(0, 3, 7); 
            // Skonfiguruj rozmiar canvasa (atrybuty) dla ostrego obrazu
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
            const ctx2d = canvas.getContext('2d');
            
            scene.background = new THREE.Color(0x1a1a1a); 

            scene.add(new THREE.AmbientLight(0xffffff, 1.5)); 
            const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); 
            dirLight.position.set(5, 10, 7).normalize();
            scene.add(dirLight);
            const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight2.position.set(-5, 5, -7).normalize();
            scene.add(dirLight2);

            const tankMesh = TANKS_DATA[tankKey].create(new THREE.Color(0xaaaaaa));
            tankMesh.scale.set(0.7, 0.7, 0.7); 
            tankMesh.position.y = -0.8; // Dostosuj, aby czołg był wyżej w podglądzie
            scene.add(tankMesh);

            camera.lookAt(0, tankMesh.position.y + 0.5, 0); // Spójrz lekko w dół, na środek czołgu
            
            const target = {
                canvas, ctx2d, scene, camera, tankMesh,
                isDragging: false,
                initialMouse: { x: 0, y: 0 },
                initialRotation: { y: 0 },
                initialZoom: camera.position.z,
                zoomSpeed: 0.05
            };

            // Zapisz referencje do handlerów, aby móc je usunąć później
            target.mousedownHandler = (e) => {
                target.isDragging = true;
                target.initialMouse.x = e.clientX;
                target.initialRotation.y = target.tankMesh.rotation.y;
                canvas.style.cursor = 'grabbing';
            };
            target.mouseupHandler = () => { 
                target.isDragging = false;
                canvas.style.cursor = 'grab';
            };
            target.mousemoveHandler = (e) => {
                if (!target.isDragging) return;
                const deltaX = e.clientX - target.initialMouse.x;
                target.tankMesh.rotation.y = target.initialRotation.y + deltaX * 0.01;
            };
            target.wheelHandler = (e) => {
                e.preventDefault();
                camera.position.z += e.deltaY * target.zoomSpeed;
                camera.position.z = Math.max(5, Math.min(12, camera.position.z)); 
                target.initialZoom = camera.position.z; 
            };
            target.contextmenuHandler = (e) => e.preventDefault();

            this.addEventListeners(target);
            this.renderTargets.push(target);
        });
        this.startAnimation();
    }
    addEventListeners(target) {
        const { canvas } = target;
        canvas.addEventListener('mousedown', target.mousedownHandler);
        canvas.addEventListener('mouseup', target.mouseupHandler);
        canvas.addEventListener('mousemove', target.mousemoveHandler);
        canvas.addEventListener('wheel', target.wheelHandler);
        canvas.addEventListener('contextmenu', target.contextmenuHandler);
    }
    startAnimation() { 
        this.isActive = true; 
        this.animate(); // Wywołanie funkcji strzałkowej
    }
    stopAnimation() {
        this.isActive = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }
    animate = () => { // Zmieniono na funkcję strzałkową
        if (!this.isActive) return;
        this.renderTargets.forEach(target => {
            const { canvas, ctx2d, scene, camera, tankMesh } = target;
            if (!target.isDragging) tankMesh.rotation.y += 0.005;
            const width = canvas.width;
            const height = canvas.height;
            if (width === 0 || height === 0) return;
            this.sharedRenderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            this.sharedRenderer.render(scene, camera);
            ctx2d.clearRect(0, 0, width, height);
            ctx2d.drawImage(this.sharedRenderer.domElement, 0, 0, width, height);
        });
        this.animationFrameId = requestAnimationFrame(this.animate);
    }
    destroy() {
        this.stopAnimation();
        this.renderTargets.forEach(target => {
            target.scene.traverse(obj => {
                if(obj.isMesh){
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(mat => {
                                if (mat.map) mat.map.dispose();
                                mat.dispose();
                            });
                        } else {
                            if (obj.material.map) obj.material.map.dispose();
                            obj.material.dispose();
                        }
                    }
                }
            });
            // Usunięcie event listener'ów
            target.canvas.removeEventListener('mousedown', target.mousedownHandler);
            target.canvas.removeEventListener('mouseup', target.mouseupHandler);
            target.canvas.removeEventListener('mousemove', target.mousemoveHandler);
            target.canvas.removeEventListener('wheel', target.wheelHandler);
            target.canvas.removeEventListener('contextmenu', target.contextmenuHandler);
        });
        this.renderTargets = [];
        // Zwolnij współdzielony renderer
        this.sharedRenderer.dispose();
    }
}

// --- LOGIKA UI ---
function initializeUI() {
    document.getElementById("intro-logo").addEventListener("animationend", () => {
        document.getElementById("intro-screen").style.display = "none"; 
        document.getElementById("start-screen").style.display = "flex";
        setTimeout(() => {
            isSelectionScreenActive = true;
            tankSelectionManager = new TankSelectionManager(Object.keys(TANKS_DATA));
            tankSelectionManager.init();
        }, 100); 
    });
    
    const tankSelectionContainer = document.querySelector('.tank-selection-container');
    tankSelectionContainer.innerHTML = ''; 

    // Pobierz maksymalne wartości dla pasków statystyk
    const maxHp = Math.max(...Object.values(TANKS_DATA).map(t => t.stats.hp));
    const maxDamage = Math.max(...Object.values(TANKS_DATA).map(t => t.stats.damage));
    const maxSpeed = Math.max(...Object.values(TANKS_DATA).map(t => t.stats.speed));
    const maxTurretRot = Math.max(...Object.values(TANKS_DATA).map(t => t.stats.turretRot));

    // Generowanie kart czołgów dynamicznie
    Object.keys(TANKS_DATA).forEach((tankKey) => {
        const tank = TANKS_DATA[tankKey];
        const tankCard = document.createElement('div');
        tankCard.className = `tank-card ${tank.isPremium ? 'locked' : ''}`;
        tankCard.id = `select-${tankKey}`;
        tankCard.innerHTML = `
            ${tank.isPremium ? '<div class="premium-label">PREMIUM</div>' : ''}
            <h3>${tank.name}</h3>
            <canvas id="canvas-${tankKey}" class="tank-canvas"></canvas>
            <p class="tank-description">${tank.description}</p>
            <div class="stats-container">
                <div class="stat-line"><span>Życie</span><div class="stat-bar-container"><div id="bar-${tankKey}-hp" class="stat-bar-fill"></div></div></div>
                <div class="stat-line"><span>Obrażenia</span><div class="stat-bar-container"><div id="bar-${tankKey}-dmg" class="stat-bar-fill"></div></div></div>
                <div class="stat-line"><span>Prędkość</span><div class="stat-bar-container"><div id="bar-${tankKey}-spd" class="stat-bar-fill"></div></div></div>
                <div class="stat-line"><span>Obrót Wieży</span><div class="stat-bar-container"><div id="bar-${tankKey}-rot" class="stat-bar-fill"></div></div></div>
            </div>
            <button class="select-button" ${tank.isPremium ? 'disabled' : ''}>Wybierz i Walcz</button>
        `;
        tankSelectionContainer.appendChild(tankCard);

        // Aktualizacja pasków statystyk (relative to max values)
        document.getElementById(`bar-${tankKey}-hp`).style.width = `${(tank.stats.hp / maxHp) * 100}%`; 
        document.getElementById(`bar-${tankKey}-dmg`).style.width = `${(tank.stats.damage / maxDamage) * 100}%`;
        document.getElementById(`bar-${tankKey}-spd`).style.width = `${(tank.stats.speed / maxSpeed) * 100}%`; 
        document.getElementById(`bar-${tankKey}-rot`).style.width = `${(tank.stats.turretRot / maxTurretRot) * 100}%`; 
    });
    document.querySelectorAll(".select-button").forEach((button) => {
        button.addEventListener("click", (e) => {
            if (button.disabled) return; 
            isSelectionScreenActive = false;
            if (tankSelectionManager) tankSelectionManager.destroy(); 
            const card = e.target.closest(".tank-card"); 
            const tankType = card.id.split("-")[1]; 
            const mapSize = document.querySelector('input[name="map-size"]:checked').value;
            const amplitude = parseInt(document.getElementById('terrain-amplitude').value, 10);
            const scale = parseInt(document.getElementById('terrain-scale').value, 10);
            socket.emit("joinGame", { tankType: tankType, config: { mapSize: mapSize, amplitude: amplitude, scale: scale } }); 
            document.getElementById("start-screen").style.display = "none";
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
        slot.innerHTML = `<div class="weapon-key">${index + 1}</div><div class="weapon-icon">${weaponData.icon}</div><div class="weapon-ammo">0</div>`;
        slot.addEventListener('click', () => {
            socket.emit('playerAction', { type: 'switchWeapon', weaponId: key });
        });
        weaponBar.appendChild(slot);
    });
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
    const messages = [ `🤠 ${attackerName} wysłał ${victimName} na złom! 💥`, `💣 ${attackerName} zrobił z ${victimName} konfetti! 🎉`, `🔥 ${attackerName} podgrzał atmosferę, eliminując ${victimId}!`, `🚀 ${attackerName} pokazał ${victimName}, gdzie raki zimują! 🦀`, `🎯 ${attackerName} trafia w dziesiątkę... a ${victimName} w pył! 💨` ];
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
    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); 
    renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x87CEEB); scene.fog = new THREE.Fog(0x87CEEB, 2000, 15000); 
    camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 20000); clock = new THREE.Clock();
    createSkydomeBackground(scene);
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(100, 80, 50); dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; scene.add(dirLight);
    raycaster = new THREE.Raycaster();
    
    minimapCanvas = document.getElementById('minimap'); minimapCanvas.width = 220; minimapCanvas.height = 220; minimapCtx = minimapCanvas.getContext('2d');
    const terrainGeometry = new THREE.PlaneGeometry(terrainParams.size, terrainParams.size, terrainParams.segments, terrainParams.segments);
    const vertices = terrainGeometry.attributes.position.array; const segments = terrainParams.segments;
    for (let i = 0; i <= segments; i++) { for (let j = 0; j <= segments; j++) { vertices[(j * (segments + 1) + i) * 3 + 2] = heightMap[i][j]; } }
    terrainGeometry.attributes.position.needsUpdate = true; terrainGeometry.computeVertexNormals();
    const groundMaterial = new THREE.MeshLambertMaterial({ map: createGroundTexture(heightMap, terrainParams), name: 'groundMaterial' }); // Jawna nazwa
    terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial); terrainMesh.rotation.x = -Math.PI / 2; terrainMesh.name = 'ground';
    terrainMesh.receiveShadow = true; scene.add(terrainMesh); aimables.push(terrainMesh);
    
    const waterGeometry = new THREE.PlaneGeometry(terrainParams.size * 5, terrainParams.size * 5);
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x006994, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.75, name: 'waterMaterial' }); // Jawna nazwa
    const water = new THREE.Mesh(waterGeometry, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.y = -0.5; scene.add(water);
    if (payload.spawnPoints) { for(const sp of payload.spawnPoints) { const marker = createSpawnMarker(); marker.position.set(sp.x, getHeightAt(sp.x, sp.z), sp.z); scene.add(marker); } }
    const smokeTexture = createSmokeTexture();
    greySmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0x888888, depthWrite: false, name: 'greySmokeMaterial' }); // Jawna nazwa
    blackSmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0x222222, depthWrite: false, name: 'blackSmokeMaterial' }); // Jawna nazwa
    cloudSmokeMaterial = new THREE.MeshBasicMaterial({ map: smokeTexture, transparent: true, color: 0xcccccc, depthWrite: false, opacity: 0.8, name: 'cloudSmokeMaterial' }); // Jawna nazwa
    muzzleFlashMaterial = new THREE.SpriteMaterial({ map: createMuzzleFlashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, name: 'muzzleFlashMaterial' }); // Jawna nazwa
    
    fireMaterial = new THREE.MeshBasicMaterial({ map: createFireTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, name: 'fireMaterial' }); // Jawna nazwa
    scorchMarkMaterial = new THREE.MeshBasicMaterial({ map: createScorchMarkTexture(), transparent: true, depthWrite: false, name: 'scorchMarkMaterial' }); // Jawna nazwa

    clientGameState.heightMap = heightMap;
    environmentMeshes = createEnvironment(scene, terrainParams, clientGameState, aimables);
    
    gameObjects.trees = environmentMeshes.trees;
    gameObjects.rocks = environmentMeshes.rocks;

    reconcileGameState(clientGameState);
    
    if (clientGameState.trees) {
        clientGameState.trees.forEach(treeData => {
            if (treeData.state === 'fallen' && gameObjects.trees[treeData.id]) {
                 gameObjects.trees[treeData.id].visible = false;
            }
        });
    }
    
    setupEventListeners(); 
    animate();
    setInterval(() => { if(clientGameState.players[localPlayerId] && !clientGameState.players[localPlayerId].isDestroyed && !clientGameState.players[localPlayerId].isSinking) { if (Math.random() > 0.6) showTankQuote(localPlayerId); } }, 15000 + Math.random() * 5000);
}

function handleFireInput() {
    if (!canFire || !localPlayerId || !clientGameState.players || !clientGameState.players[localPlayerId] || clientGameState.players[localPlayerId].isDestroyed) return;
    const playerState = clientGameState.players[localPlayerId];
    if (playerState.isEmpDisabled) return;
    let currentCooldown = 0.5;
    if (playerState.activePowerUp === 'machinegun') { currentCooldown = 0.08; } 
    else { const weaponData = WEAPONS_DATA[playerState.currentWeapon]; if(weaponData) currentCooldown = weaponData.cooldown; }
    const localPlayerMesh = gameObjects.players[localPlayerId];
    const barrelWorldPos = new THREE.Vector3(); 
    localPlayerMesh.barrel.getWorldPosition(barrelWorldPos);
    let direction;
    if (isSniperModeActive) {
        direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
    } else {
        direction = new THREE.Vector3().subVectors(targetPoint, barrelWorldPos).normalize();
    }
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
    
    document.addEventListener('mousemove', (e) => { 
        if (document.pointerLockElement === renderer.domElement) {
            mouseDelta.x += e.movementX;
            mouseDelta.y += e.movementY;
        } else {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1; 
            mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
        }
    });
    
    document.addEventListener('mousedown', (e) => {
        if (!isGameStarted) return;
        if (e.button === 0) { handleFireInput(); }
        if (e.button === 2) { 
            renderer.domElement.requestPointerLock();
        }
    });
    document.addEventListener('mouseup', (e) => {
        if (!isGameStarted) return;
        if (e.button === 2) {
            document.exitPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const sniperOverlay = document.getElementById('sniper-overlay');
        const hudElements = [document.getElementById('hud'), document.getElementById('minimap-container'), document.getElementById('weapon-bar')];
        if (document.pointerLockElement === renderer.domElement) {
            isSniperModeActive = true;
            sniperOverlay.style.display = 'block';
            hudElements.forEach(el => el.style.opacity = '0.2');
            document.body.classList.remove('crosshair-cursor');
        } else {
            isSniperModeActive = false;
            sniperZoomLevel = SNIPER_MIN_ZOOM;
            camera.fov = BASE_FOV;
            camera.updateProjectionMatrix();
            sniperOverlay.style.display = 'none';
            hudElements.forEach(el => el.style.opacity = '1');
            document.body.classList.add('crosshair-cursor');
        }
    });

    document.addEventListener('wheel', (e) => {
        if (!isGameStarted || !isSniperModeActive) return;
        if (e.deltaY < 0) {
            sniperZoomLevel = Math.min(SNIPER_MAX_ZOOM, sniperZoomLevel * 1.25);
        } else {
            sniperZoomLevel = Math.max(SNIPER_MIN_ZOOM, sniperZoomLevel / 1.25);
        }
        camera.fov = BASE_FOV / sniperZoomLevel;
        camera.updateProjectionMatrix();
    });

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
            tank.lastPosition = new THREE.Vector3().copy(tank.position);
            tank.exhaustCooldown = 0;
            scene.add(tank); gameObjects.players[id] = tank;
            if (id !== localPlayerId) aimables.push(tank);
        }
    }
    const serverBuildingIds = Object.keys(serverState.buildings || {});
    for (const id of serverBuildingIds) { if (!gameObjects.buildings[id]) { createBuildingMesh(serverState.buildings[id]); } }
    
    const objectTypes = ['crate', 'ammoCrate', 'track'];
    for (const type of objectTypes) {
        const pluralType = type === 'track' ? 'tracks' : type + 's';
        const serverObjectIds = Object.keys(serverState[pluralType] || {});
        for (const id of serverObjectIds) { 
            if (!gameObjects[pluralType][id]) { 
                createObjectMesh({type: type, data: serverState[pluralType][id]}); 
            } 
        }
    }
}

function createObjectMesh(payload) {
    const { type, data } = payload;
    let newMesh; 
    const pluralType = type.endsWith('s') ? type : (type === 'track' ? 'tracks' : type + 's');
    let container = gameObjects[pluralType];
    if(!container || container[data.id]) return; 

    switch(type) {
        case 'projectile': 
            const pColors = { he: 0xffa500, ap: 0xcccccc, heat: 0xff4500, emp: 0x00ffff, smoke: 0xaaaaaa };
            newMesh = new THREE.Mesh( new THREE.CapsuleGeometry(0.25, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: pColors[data.weaponId] || 0xffff00, emissive: pColors[data.weaponId] || 0xffff00, emissiveIntensity: 2, name: `projectileMaterial_${data.weaponId}` }) ); // Jawna nazwa
            const ownerTank = gameObjects.players[data.ownerId];
            if (ownerTank) triggerMuzzleFlash(ownerTank.barrel);
            break;
        case 'machineGunBullet': 
            newMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffa500, name: 'machineGunBulletMaterial' })); // Jawna nazwa
            break;
        case 'missile':
            newMesh = new THREE.Group(); 
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 12), LAMBERT_MATERIAL(0xcccccc, 'missileBodyMaterial')); // Jawna nazwa
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 12), LAMBERT_MATERIAL(0xff0000, 'missileTipMaterial')); // Jawna nazwa
            tip.position.y = 1.5; newMesh.add(body, tip); 
            break;
        case 'mine': 
            newMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16), LAMBERT_MATERIAL(0x444444, 'mineMaterial')); // Jawna nazwa
            break;
        case 'crate': newMesh = createSupplyCrate(); break;
        case 'ammoCrate': newMesh = createAmmoCrateMesh(); break;
        case 'track':
            const trackMat = (data.type === 'sand' || data.type === 'mud') ? sandTrackMaterial.clone() : grassTrackMaterial.clone();
            newMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.0), trackMat);
            newMesh.rotation.x = -Math.PI / 2;
            newMesh.rotation.z = data.rotationY;
            break;
        case 'fire':
            createFireEffect(data); return;
    }
    if (newMesh) {
        let adjustedY = data.position.y;
        if (type === 'track') {
            adjustedY = data.position.y + 0.06; // Lekko nad ziemią
        } else if (type === 'mine') {
             adjustedY = data.position.y + 0.25; // Lekko nad ziemią
        }
        newMesh.position.set(data.position.x, adjustedY, data.position.z);
        if (data.rotationY && type !== 'track') newMesh.rotation.y = data.rotationY;
        container[data.id] = { 
            mesh: newMesh,
            lifespan: data.lifespan,
            initialLifespan: data.lifespan,
        };
        if (type === 'projectile' || type === 'machineGunBullet' || type === 'missile') {
            container[data.id].lastPosition = new THREE.Vector3().copy(newMesh.position);
        }
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
        if (transformedCorners.every(c => c.x !== undefined)) { ctx.beginPath(); ctx.moveTo(transformedCorners[0].x, transformedCorners[0].y); for(let i = 1; i < transformedCorners.length; i++) { ctx.lineTo(transformedCorners[i].x, transformedCorners[i].y); } ctx.closePath(); ctx.fill(); }
    }
    const crateBlink = Math.sin(currentTime * 0.005) * 0.4 + 0.6; ctx.fillStyle = `rgba(255, 223, 0, ${crateBlink})`; ctx.strokeStyle = `rgba(255, 223, 0, ${crateBlink + 0.2})`; ctx.lineWidth = 2;
    for (const id in clientGameState.crates) { const crate = clientGameState.crates[id]; const transformed = transformPoint(crate.position.x, crate.position.z); if (transformed && transformed.x !== undefined) { ctx.beginPath(); ctx.rect(transformed.x - 4, transformed.y - 4, 8, 8); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = `rgba(100, 200, 100, ${crateBlink})`; ctx.strokeStyle = `rgba(100, 200, 100, ${crateBlink + 0.2})`;
    for (const id in clientGameState.ammoCrates) { const crate = clientGameState.ammoCrates[id]; const transformed = transformPoint(crate.position.x, crate.position.z); if (transformed && transformed.x !== undefined) { ctx.beginPath(); ctx.rect(transformed.x - 4, transformed.y - 4, 8, 8); ctx.fill(); ctx.stroke(); } }
    ctx.fillStyle = '#ff1a1a';
    for (const id in clientGameState.players) {
        if (id === localPlayerId || clientGameState.players[id].isDestroyed || clientGameState.players[id].isSinking) continue;
        const player = clientGameState.players[id]; const transformed = transformPoint(player.position.x, player.position.z);
        if (transformed && transformed.x !== undefined) { ctx.beginPath(); ctx.arc(transformed.x, transformed.y, 5, 0, Math.PI * 2); ctx.fill(); }
    }
    const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius); 
    sweepGradient.addColorStop(0, 'rgba(128, 255, 128, 0.4)'); 
    sweepGradient.addColorStop(0.8, 'rgba(128, 255, 128, 0.1)'); 
    sweepGradient.addColorStop(1, 'rgba(128, 255, 128, 0)'); 
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, minimapScanAngle, minimapScanAngle + Math.PI * 0.3); ctx.closePath(); ctx.fillStyle = sweepGradient; ctx.fill(); ctx.restore(); 
    ctx.save(); ctx.translate(centerX, centerY); ctx.fillStyle = '#66ff66'; ctx.shadowColor = '#66ff66'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, 8); ctx.lineTo(6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(50, 255, 50, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(centerX, centerY, radius - 1.5, 0, Math.PI * 2); ctx.stroke();
}

function updateTerrainMesh(data) {
    if (!terrainMesh) return;
    const { position, radius, depth } = data;
    const { size, segments } = terrainParams;
    const radiusSq = radius * radius;
    const step = size / segments;
    const vertices = terrainMesh.geometry.attributes.position.array;
    const startX_grid = Math.max(0, Math.floor(((position.x - radius) + size / 2) / step));
    const endX_grid = Math.min(segments, Math.ceil(((position.x + radius) + size / 2) / step));
    const startZ_grid = Math.max(0, Math.floor(((position.z - radius) + size / 2) / step));
    const endZ_grid = Math.min(segments, Math.ceil(((position.z + radius) + size / 2) / step));
    for (let j = startZ_grid; j <= endZ_grid; j++) {
        for (let i = startX_grid; i <= endX_grid; i++) {
            const Px = i * step - size / 2;
            const Pz = j * step - size / 2;
            const distSq = (Px - position.x) ** 2 + (Pz - position.z) ** 2;
            if (distSq < radiusSq) {
                const dist = Math.sqrt(distSq);
                const depression = depth * (0.5 * (Math.cos(dist / radius * Math.PI) + 1));
                if (heightMap[i] && heightMap[i][j] !== undefined) {
                    heightMap[i][j] -= depression;
                }
                const vertexIndex = (j * (segments + 1) + i) * 3 + 2;
                vertices[vertexIndex] -= depression;
            }
        }
    }
    terrainMesh.geometry.attributes.position.needsUpdate = true;
    terrainMesh.geometry.computeVertexNormals();
}

function animate() {
    if (isSelectionScreenActive) {
        requestAnimationFrame(animate);
        return;
    }
    if (!isGameStarted) return;
    
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const localPlayerMesh = gameObjects.players[localPlayerId];
    
    if (environmentMeshes && environmentMeshes.grass) {
        environmentMeshes.grass.material.uniforms.time.value = clock.getElapsedTime();
    }

    minimapScanAngle = (minimapScanAngle - delta * 2.5) % (Math.PI * 2);
    if (fireCooldown > 0) { fireCooldown -= delta; } else { canFire = true; }
    socket.emit("playerInput", keys);

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
            
            clientTank.exhaustCooldown -= delta;
            if (serverPlayer.keys.KeyW && clientTank.exhaustCooldown <= 0 && !serverPlayer.isDestroyed && !serverPlayer.isSinking) {
                const exhaustPos = new THREE.Vector3();
                clientTank.exhaustPoint.getWorldPosition(exhaustPos);
                const exhaustVel = new THREE.Vector3(0, 0, 5).applyQuaternion(clientTank.quaternion).multiplyScalar(-1);
                exhaustVel.y += 0.5;
                emitSmokeParticle(clientTank, blackSmokeMaterial, exhaustPos, exhaustVel, 0.8, 3.5, 2.0);
                clientTank.exhaustCooldown = 0.1;
            }

            if (serverPlayer.isEmpDisabled && (!clientTank.empEffect || clientTank.empEffect.lifespan <= 0)) {
                createEMPTankEffect(clientTank);
            }

            if (id !== localPlayerId) { clientTank.turret.rotation.y = serverPlayer.turretRotation.y; clientTank.mantlet.rotation.x = serverPlayer.mantletRotation.x; }
            if (serverPlayer.isSinking && !clientTank.isSinkingBubbleShown) { showCustomQuote(id, "Bul... bul... bul..."); clientTank.isSinkingBubbleShown = true; } 
            else if (!serverPlayer.isSinking && clientTank.isSinkingBubbleShown) { const bubble = document.getElementById(`bubble-${id}`); if (bubble) bubble.style.display = 'none'; clientTank.isSinkingBubbleShown = false; }
            clientTank.smokeCooldown = (clientTank.smokeCooldown || 0) - delta;
            if (clientTank.smokeCooldown <= 0 && !serverPlayer.isDestroyed && !serverPlayer.isSinking) {
                const hpPercent = (serverPlayer.health / serverPlayer.maxHealth) * 100;
                const smokeOffset = new THREE.Vector3(0, 1.5, 4.5); smokeOffset.applyQuaternion(clientTank.quaternion);
                const smokePos = new THREE.Vector3().copy(clientTank.position).add(smokeOffset);
                if (hpPercent < 30) { 
                    emitSmokeParticle(clientTank, blackSmokeMaterial, smokePos, new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 2 + 1, (Math.random() - 0.5) * 0.8), 1.5, 6, 2.5);
                    clientTank.smokeCooldown = 0.08; 
                } 
                else if (hpPercent < 45) { 
                    emitSmokeParticle(clientTank, greySmokeMaterial, smokePos, new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 0.5), 1, 4, 2);
                    clientTank.smokeCooldown = 0.2; 
                }
            }
            if (clientTank.laserSight && serverPlayer.laserData) {
                const laser = clientTank.laserSight;
                laser.visible = serverPlayer.laserData.enabled && !serverPlayer.isDestroyed && !serverPlayer.isSinking;
                if (laser.visible) {
                    const positions = laser.geometry.attributes.position.array;
                    if (isSniperModeActive && id === localPlayerId) {
                        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
                        const intersects = raycaster.intersectObjects(aimables, true);
                        const endPoint = intersects.length > 0 ? intersects[0].point : raycaster.ray.at(10000, sniperLaserEndPoint);
                        const startPoint = new THREE.Vector3();
                        localPlayerMesh.barrel.getWorldPosition(startPoint); // Use barrel position for laser origin
                        positions[0] = startPoint.x; positions[1] = startPoint.y; positions[2] = startPoint.z;
                        positions[3] = endPoint.x; positions[4] = endPoint.y; positions[5] = endPoint.z;
                    } else {
                        const data = serverPlayer.laserData;
                        positions[0] = data.start.x; positions[1] = data.start.y; positions[2] = data.start.z;
                        positions[3] = data.end.x; positions[4] = data.end.y; positions[5] = data.end.z;
                    }
                    laser.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    }
    
    const projectileTypes = ['projectiles', 'machineGunBullets', 'missiles'];
    for(const type of projectileTypes) {
        for (const id in gameObjects[type]) {
            const clientObj = gameObjects[type][id].mesh; 
            const serverObj = clientGameState[type] ? clientGameState[type][id] : null;
            if (clientObj && serverObj) {
                const serverPos = new THREE.Vector3(serverObj.position.x, serverObj.position.y, serverObj.position.z);
                const moveDirection = serverPos.clone().sub(gameObjects[type][id].lastPosition).normalize();
                if (moveDirection.lengthSq() > 0.001) {
                    clientObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection);
                    if (type === 'missiles') clientObj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/2));
                }
                clientObj.position.lerp(serverPos, 0.5); 
                gameObjects[type][id].lastPosition.copy(clientObj.position);
            }
        }
    }
    const crateTypes = ['crates', 'ammoCrates'];
    for(const type of crateTypes) {
        for (const id in gameObjects[type]) { 
            const obj = gameObjects[type][id].mesh;
            obj.rotation.y += 0.5 * delta; 
            const pos = obj.position;
            pos.y = getHeightAt(pos.x, pos.z) + 1.5 + Math.sin(clock.getElapsedTime() * 2 + id.length) * 0.5;
        }
    }

    for (const id in gameObjects.tracks) {
        const track = gameObjects.tracks[id];
        const serverTrack = clientGameState.tracks ? clientGameState.tracks[id] : null;
        if (track && serverTrack && track.initialLifespan) {
            const lifePercent = Math.max(0, serverTrack.lifespan / track.initialLifespan);
            track.mesh.material.opacity = lifePercent;
        }
    }

    for (const id in gameObjects.fires) {
        const fire = gameObjects.fires[id];
        const serverFire = clientGameState.fires[id];
        if (!serverFire) continue;
        const currentRadius = serverFire.radius;
        for (let i = fire.particles.length - 1; i >= 0; i--) {
            const p = fire.particles[i];
            p.lifespan -= delta;
            if (p.lifespan <= 0) {
                p.lifespan = p.initialLifespan;
                const spawnRadius = currentRadius * 0.5;
                p.mesh.position.copy(fire.position).add(
                    new THREE.Vector3((Math.random() - 0.5) * spawnRadius, Math.random() * 1.5, (Math.random() - 0.5) * spawnRadius)
                );
            } else {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
                const lifePercent = p.lifespan / p.initialLifespan;
                p.mesh.material.opacity = Math.sin(lifePercent * Math.PI);
                const currentScale = p.startSize + (p.endSize - p.startSize) * (1 - lifePercent);
                p.mesh.scale.set(currentScale, currentScale, currentScale);
                p.mesh.lookAt(camera.position);
            }
        }
    }

    const gravity = -9.8;
    for (let i = gameObjects.particles.length - 1; i >= 0; i--) {
        const p = gameObjects.particles[i]; 
        p.lifespan -= delta;

        if (p.lifespan <= 0) { 
            scene.remove(p.mesh); 
            if(p.mesh.geometry) p.mesh.geometry.dispose(); 
            if(p.mesh.material) {
                if (Array.isArray(p.mesh.material)) {
                    p.mesh.material.forEach(mat => {
                        if(mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if(p.mesh.material.map) p.mesh.material.map.dispose();
                    p.mesh.material.dispose();
                }
            }
            gameObjects.particles.splice(i, 1); 
        } else { 
            if (p.isFlash) { 
                const scale = p.mesh.scale.x * (1 - delta * 8);
                p.mesh.scale.set(scale, scale, scale);
                p.mesh.material.opacity = p.lifespan / 0.15;
            }
            if (p.velocity) { 
                p.velocity.y += gravity * delta; 
                p.mesh.position.add(p.velocity.clone().multiplyScalar(delta)); 
            }
            if (p.target) { 
                p.mesh.position.copy(p.target.position); 
                if (!clientGameState.players[p.target.id] || !clientGameState.players[p.target.id].isEmpDisabled) p.lifespan = 0; 
            }
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

    for (let i = gameObjects.fallingTrees.length - 1; i >= 0; i--) {
        const tree = gameObjects.fallingTrees[i];
        if (tree.rotationProgress < Math.PI / 2) {
            const rotationAmount = tree.fallSpeed * delta;
            tree.mesh.quaternion.multiply(
                new THREE.Quaternion().setFromAxisAngle(tree.fallAxis, rotationAmount)
            );
            tree.rotationProgress += rotationAmount;
        }
    }
    
    if (localPlayerMesh) {
        const localPlayerState = clientGameState.players[localPlayerId];
        
        if (localPlayerState && !localPlayerState.isDestroyed && !localPlayerState.isSinking && !localPlayerState.isEmpDisabled) {
            const turret = localPlayerMesh.turret; 
            const mantlet = localPlayerMesh.mantlet;
            
            if (isSniperModeActive) {
                turret.rotation.y -= mouseDelta.x * SNIPER_SENSITIVITY;
                mantlet.rotation.x += mouseDelta.y * SNIPER_SENSITIVITY;
                mantlet.rotation.x = Math.max(-0.5, Math.min(0.2, mantlet.rotation.x));
            } else {
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(aimables, true);
                if (intersects.length > 0) { targetPoint.copy(intersects[0].point); } 
                else { const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -localPlayerMesh.position.y); raycaster.ray.intersectPlane(plane, targetPoint); }
                const localTargetInTurret = turret.worldToLocal(targetPoint.clone());
                const targetTurretAngle = Math.atan2(localTargetInTurret.x, localTargetInTurret.z);
                let diff = targetTurretAngle - turret.rotation.y;
                while (diff < -Math.PI) diff += 2 * Math.PI; while (diff > Math.PI) diff -= 2 * Math.PI;
                turret.rotation.y += diff * 0.15;
                const targetMantletAngle = Math.atan2(localTargetInTurret.y, Math.sqrt(localTargetInTurret.x**2 + localTargetInTurret.z**2));
                mantlet.rotation.x = THREE.MathUtils.lerp(mantlet.rotation.x, Math.max(-0.5, Math.min(0.2, targetMantletAngle)), 0.15);
            }
            localPlayerState.turretRotation.y = turret.rotation.y; 
            localPlayerState.mantletRotation.x = mantlet.rotation.x;
            socket.emit('playerAimUpdate', { turretY: turret.rotation.y, mantletX: mantlet.rotation.x });
            const barrelWorldPos = new THREE.Vector3(); 
            localPlayerMesh.barrel.getWorldPosition(barrelWorldPos);
            socket.emit('laserUpdate', { start: barrelWorldPos, end: targetPoint });
        }
        
        mouseDelta.set(0, 0);

        if (isSniperModeActive && localPlayerState && !localPlayerState.isDestroyed && !localPlayerState.isSinking) {
            const tankData = TANKS_DATA[localPlayerState.tankType];
            const cameraOffsetY = tankData.sniperCamYOffset || 1.5;
            localPlayerMesh.barrel.getWorldPosition(sniperCameraPosition); 
            const sniperViewPosition = sniperCameraPosition.clone();
            sniperViewPosition.y += cameraOffsetY;
            const mantletPosition = new THREE.Vector3();
            localPlayerMesh.mantlet.getWorldPosition(mantletPosition);
            const forwardVector = new THREE.Vector3().subVectors(sniperCameraPosition, mantletPosition).normalize();
            forwardVector.y += 0.02; 
            forwardVector.normalize();
            const lookAtTargetPoint = sniperViewPosition.clone().add(forwardVector.multiplyScalar(100));
            camera.position.lerp(sniperViewPosition, 0.7);
            camera.lookAt(lookAtTargetPoint);
        } else if (localPlayerState && (localPlayerState.isSinking || localPlayerState.isDestroyed)) {
            const dronePosition = new THREE.Vector3(localPlayerMesh.position.x, localPlayerMesh.position.y + 20, localPlayerMesh.position.z + 5);
            camera.position.lerp(dronePosition, 0.05); 
            camera.lookAt(localPlayerMesh.position);
        } else if (localPlayerState) {
            const offset = new THREE.Vector3(0, 20, -30);
            const chassisQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, localPlayerState.rotation.y, 0));
            const cameraTargetPosition = localPlayerMesh.position.clone().add(offset.applyQuaternion(chassisQuaternion));
            camera.position.lerp(cameraTargetPosition, 0.1);
            camera.lookAt(localPlayerMesh.position.clone().add(new THREE.Vector3(0, 3, 0)));
        }
    }
    updateHUD(); 
    drawMinimap(); 
    renderer.render(scene, camera);
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
    if (data.devMode) {
        console.log("Tryb deweloperski AKTYWNY. Odblokowywanie zawartości premium.");
        Object.keys(TANKS_DATA).forEach(tankKey => {
            const tank = TANKS_DATA[tankKey];
            if (tank.isPremium) {
                const tankCard = document.getElementById(`select-${tankKey}`);
                const tankButton = tankCard?.querySelector('button');
                const premiumLabel = tankCard?.querySelector('.premium-label');
                if (tankCard) tankCard.classList.remove('locked');
                if (tankButton) {
                    tankButton.disabled = false;
                    tankButton.textContent = 'Wybierz i Walcz';
                }
                if (premiumLabel) premiumLabel.style.display = 'none';
            }
        });
    }
});
socket.on("gameStarted", (payload) => { console.log("Gra rozpoczęta! Twój ID:", payload.playerId); initGame(payload); });
socket.on("gameStateUpdate", (serverState) => {
    if (clientGameState.players && clientGameState.players[localPlayerId] && serverState.players[localPlayerId]) {
        serverState.players[localPlayerId].turretRotation = clientGameState.players[localPlayerId].turretRotation;
        serverState.players[localPlayerId].mantletRotation = clientGameState.players[localPlayerId].mantletRotation;
    }
    clientGameState = serverState;
});
socket.on('objectCreated', (payload) => {
    if (!isGameStarted) return; 
    if (payload.type === 'smokeCloud') {
        createSmokeCloud(new THREE.Vector3(payload.data.position.x, payload.data.position.y, payload.data.position.z), payload.data.radius, payload.data.lifespan);
    } else {
        createObjectMesh(payload);
    }
});
socket.on('objectDestroyed', (payload) => {
    const { type, id } = payload;
    let containerName = type.endsWith('s') ? type : (type === 'track' ? 'tracks' : type + 's');
    if(type === 'machineGunBullet') containerName = 'machineGunBullets';
    if(type === 'ammoCrate') containerName = 'ammoCrates';
    
    if (type === 'fire') {
        const fire = gameObjects.fires[id];
        if (fire) {
            fire.particles.forEach(p => {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
            });
            delete gameObjects.fires[id];
            const scorchMarkSize = payload.radius * 2.5;
            const scorchMark = new THREE.Mesh(
                new THREE.PlaneGeometry(scorchMarkSize, scorchMarkSize),
                scorchMarkMaterial
            );
            scorchMark.position.set(payload.position.x, getHeightAt(payload.position.x, payload.position.z) + 0.1, payload.position.z);
            scorchMark.rotation.x = -Math.PI / 2;
            scene.add(scorchMark);
        }
        return;
    }
    const objectList = gameObjects[containerName];
    const object = objectList ? objectList[id] : null;
    if (object) {
        const mesh = (type === 'player') ? object : object.mesh;
        if(type === 'player' && payload.hit) { 
            destroyObjectWithWreckage(mesh, [mesh.hullGroup, mesh.turret]); 
            if (Math.random() > 0.3) showTankQuote(id); 
        } else if (type !== 'player') {
            if (payload.hit) {
                const weaponId = payload.weaponId;
                if (weaponId === 'he' || weaponId === 'heat' || weaponId === 'guided') createExplosion(mesh.position, 2.5);
                else if (weaponId === 'emp') createExplosion(mesh.position, 2.0, 0x00ffff);
                else if (type === 'projectile') createExplosion(mesh.position, 1.5);
            }
            scene.remove(mesh);
            if (mesh.traverse) {
                mesh.traverse(c => {
                    if (c.isMesh) {
                        c.geometry.dispose();
                        if (c.material.isMaterial) c.material.dispose();
                        if (c.material.map) c.material.map.dispose();
                    }
                });
            }
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
    tank.laserSight = createPlayerLaser();
    tank.lastPosition = new THREE.Vector3().copy(tank.position);
    tank.exhaustCooldown = 0;
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
socket.on('playerHit', (data) => {
    const { victimId, impactPoint, impulse } = data;
    if (gameObjects.players[victimId]) {
        createHitEffect(new THREE.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), new THREE.Vector3(impulse.x, impulse.y, impulse.z));
    }
});
socket.on('terrainDeformed', (data) => {
    updateTerrainMesh(data);
});

socket.on('treeFallen', (data) => {
    if (!isGameStarted || !gameObjects.trees) return;
    const { treeId, fallAxis, fallSpeed } = data;
    const treeMesh = gameObjects.trees[treeId];
    
    if (treeMesh && !treeMesh.isFalling) {
        treeMesh.isFalling = true; 
        gameObjects.fallingTrees.push({
            mesh: treeMesh,
            fallAxis: new THREE.Vector3(fallAxis.x, fallAxis.y, fallAxis.z).normalize(),
            fallSpeed: fallSpeed,
            rotationProgress: 0
        });
        
        const index = aimables.indexOf(treeMesh);
        if (index > -1) {
            aimables.splice(index, 1);
        }
    }
});

// --- START APLIKACJI ---
initializeUI();
animate();