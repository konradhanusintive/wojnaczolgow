// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Konfiguracja i stałe gry ---
const PORT = process.env.PORT || 3000;
const POWERUP_TYPES = ["turbo", "machinegun", "mines"]; 
const PLAYER_COLLISION_RADIUS = 7;
const MAX_TRACKS = 500; // Maksymalna liczba śladów na mapie jednocześnie
const TRACK_DISTANCE_THRESHOLD = 3.0; // Jak daleko czołg musi przejechać, by zostawić ślad

// Domyślne/startowe wartości, które mogą być zmienione przez pierwszego gracza
let MAP_SIZE = 500; 
let TERRAIN_AMPLITUDE = 20;
let TERRAIN_SCALE = 120;
let isGameConfigured = false; 

const MAP_SIZES = { S: 300, M: 500, L: 700, XL: 900, XXL: 1200 };

const TERRAIN_SEGMENTS = 100;
let heightMap = [];
const SANDY_AREA_RADIUS = 150; 
const HILL_TRANSITION_WIDTH = 50;
const MUD_BORDER_WIDTH = 30;

const SPAWN_POINTS = [
    { x: 0.4, z: 0 },   { x: -0.4, z: 0 },
    { x: 0, z: 0.4 },   { x: 0, z: -0.4 },
    { x: 0.28, z: 0.28 }, { x: -0.28, z: -0.28 },
    { x: 0.28, z: -0.28 },{ x: -0.28, z: 0.28 }
];
const SPAWN_CLEARANCE_RADIUS = 35; 

const CITY_GRID_SIZE = 20;
const CITY_CELL_SIZE = 30;
const BUILDING_PROBABILITY = 0.5;
const BUILDING_MIN_FLOORS = 2;
const BUILDING_MAX_FLOORS = 8;
const BRICK_SIZE = { x: 2.0, y: 1.0, z: 4.0 };
const PLAYER_HEIGHT = 4.0;
const TANK_LENGTH = 10.0; 

const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 1.0, speed: 18, turretRot: 1.8 }, startY: 1.0, hullWidth: 6.0 },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 1.0, speed: 12, turretRot: 1.2 }, startY: 1.3, hullWidth: 6.5 },
  standard: { name: "Standard", stats: { hp: 100, damage: 1.0, speed: 15, turretRot: 1.5 }, startY: 1.25, hullWidth: 5.5 },
};

const WEAPONS_DATA = {
    he:     { id: 'he',     name: 'Odłamkowo-Burzący',  damage: 25, velocity: 140, blastRadius: 12, type: 'projectile', impulse: 15, recoilImpulse: 10 },
    ap:     { id: 'ap',     name: 'Przeciwpancerny',     damage: 40, velocity: 220, blastRadius: 0,  type: 'projectile', impulse: 25, recoilImpulse: 15 },
    heat:   { id: 'heat',   name: 'Kumulacyjny',         damage: 55, velocity: 160, blastRadius: 0,  type: 'projectile', impulse: 20, recoilImpulse: 18 },
    emp:    { id: 'emp',    name: 'EMP',                 damage: 0,  velocity: 150, blastRadius: 8,  type: 'projectile', effectDuration: 4.0, impulse: 5, recoilImpulse: 5 },
    smoke:  { id: 'smoke',  name: 'Dymny',               damage: 0,  velocity: 100, blastRadius: 15, type: 'projectile', impulse: 2, recoilImpulse: 3 },
    guided: { id: 'guided', name: 'Naprowadzany',        damage: 45, velocity: 100, blastRadius: 3,  type: 'missile', lifespan: 10.0, impulse: 18, recoilImpulse: 8 }
};

const gameState = {
  players: {},
  projectiles: {},
  buildings: {},
  crates: {},
  ammoCrates: {},
  smokeClouds: {},
  mines: {},
  missiles: {},
  machineGunBullets: {},
  tracks: {},
  craters: {}
};

let nextObjectId = 0;
let crateSpawnTimer = 10.0;
let ammoCrateSpawnTimer = 15.0;

// --- Implementacja szumu Perlina ---
const PerlinNoise = new (function() {
    this.p = new Uint8Array(512);
    this.init = function(seed) {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor((seed % 1) * (i + 1));
            seed = (seed * 9301 + 49297) % 233280;
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = p[i];
    };
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t, a, b) => a + t * (b - a);
    const grad = (hash, x, y) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };
    this.noise = function(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = fade(x);
        const v = fade(y);
        const p = this.p;
        const A = p[X] + Y, B = p[X + 1] + Y;
        return lerp(v,
            lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
            lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
        );
    };
})();

// --- Funkcje do obsługi terenu ---
function generateHeightMap() {
    PerlinNoise.init(Math.random());
    console.log(`Generowanie mapy (${MAP_SIZE}x${MAP_SIZE}) z amplitudą: ${TERRAIN_AMPLITUDE}, skalą: ${TERRAIN_SCALE}`);
    heightMap = new Array(TERRAIN_SEGMENTS + 1);
    for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
        heightMap[i] = new Array(TERRAIN_SEGMENTS + 1);
        for (let j = 0; j <= TERRAIN_SEGMENTS; j++) {
            const x = (i / TERRAIN_SEGMENTS - 0.5) * MAP_SIZE;
            const z = (j / TERRAIN_SEGMENTS - 0.5) * MAP_SIZE;
            
            const dist_x = Math.abs(x);
            const dist_z = Math.abs(z);
            const max_dist = Math.max(dist_x, dist_z);

            const nx = i / TERRAIN_SEGMENTS;
            const ny = j / TERRAIN_SEGMENTS;

            let height = 0;
            const hill_noise = PerlinNoise.noise(nx * TERRAIN_SCALE / 100, ny * TERRAIN_SCALE / 100)
                             + 0.5 * PerlinNoise.noise(nx * TERRAIN_SCALE / 50, ny * TERRAIN_SCALE / 50)
                             + 0.25 * PerlinNoise.noise(nx * TERRAIN_SCALE / 25, ny * TERRAIN_SCALE / 25);
            const normalized_hill_height = hill_noise / (1 + 0.5 + 0.25) * TERRAIN_AMPLITUDE;

            if (max_dist < SANDY_AREA_RADIUS) {
                height = 0;
            } else if (max_dist < SANDY_AREA_RADIUS + HILL_TRANSITION_WIDTH) {
                const transition_factor = (max_dist - SANDY_AREA_RADIUS) / HILL_TRANSITION_WIDTH;
                const eased_factor = transition_factor * transition_factor * (3 - 2 * transition_factor);
                height = lerp(0, normalized_hill_height, eased_factor);
            } else {
                height = normalized_hill_height;
            }
            heightMap[i][j] = height;
        }
    }
}
function lerp(a, b, t) { return a + (b - a) * t; }
function getHeightAt(x, z) {
    if (!heightMap || heightMap.length === 0) return 0;
    const gridX = (x + MAP_SIZE / 2) / MAP_SIZE * TERRAIN_SEGMENTS;
    const gridZ = (z + MAP_SIZE / 2) / MAP_SIZE * TERRAIN_SEGMENTS;
    const x1 = Math.floor(gridX); const z1 = Math.floor(gridZ);
    const x2 = Math.min(x1 + 1, TERRAIN_SEGMENTS); const z2 = Math.min(z1 + 1, TERRAIN_SEGMENTS);
    if (x1 < 0 || x1 > TERRAIN_SEGMENTS || z1 < 0 || z1 > TERRAIN_SEGMENTS) return 0;
    if (!heightMap[x1] || !heightMap[x2] || heightMap[x1][z1] === undefined || heightMap[x1][z2] === undefined || heightMap[x2][z1] === undefined || heightMap[x2][z2] === undefined) return 0;
    const h11 = heightMap[x1][z1]; const h12 = heightMap[x1][z2]; const h21 = heightMap[x2][z1]; const h22 = heightMap[x2][z2];
    const tx = gridX - x1; const tz = gridZ - z1;
    const h_x1 = h11 * (1 - tx) + h21 * tx; const h_x2 = h12 * (1 - tx) + h22 * tx;
    return h_x1 * (1 - tz) + h_x2 * tz;
}

function getTerrainTypeAt(x, z) {
    const max_dist = Math.max(Math.abs(x), Math.abs(z));
    if (max_dist > MAP_SIZE / 2 - MUD_BORDER_WIDTH) return 'mud';
    if (max_dist < SANDY_AREA_RADIUS) return 'sand';
    return 'grass';
}

// --- Logika Pomocnicza ---
function handleDamage(player, amount, attackerId, impulseDirection = {x:0, y:0, z:0}, impulseMagnitude = 0, impactPoint = player.position) {
    if (!player || player.isDestroyed || player.isSinking) return;
    
    player.health -= amount;

    player.impulse.x += impulseDirection.x * impulseMagnitude;
    player.impulse.z += impulseDirection.z * impulseMagnitude;
    
    io.emit('playerHit', { 
        victimId: player.id, 
        impactPoint: impactPoint, 
        impulse: { x: impulseDirection.x, y: impulseDirection.y, z: impulseDirection.z }
    });

    if (player.health <= 0) {
        player.isDestroyed = true; player.respawnTimer = 3.0; 
        const owner = gameState.players[attackerId];
        if (owner && owner.id !== player.id) {
             owner.score++; io.emit('killNotification', { attackerId: owner.id, victimId: player.id });
        }
        io.emit('objectDestroyed', { type: 'player', id: player.id, attackerId: attackerId, hit: true });
    }
}
function applyEMP(player, duration) {
    if (!player || player.isDestroyed || player.isSinking) return;
    player.isEmpDisabled = true;
    player.empDisableTimer = Math.max(player.empDisableTimer, duration);
}

// --- Logika Strzelania ---
function fireWeapon(playerId, action) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.isReloading || player.isEmpDisabled) return;
    
    if (player.activePowerUp === 'machinegun') {
        fireMachineGun(playerId, action);
        return;
    }
    
    const weaponId = player.currentWeapon;
    const weaponData = WEAPONS_DATA[weaponId];
    if (!weaponData || player.ammo[weaponId] <= 0) return;
    
    player.ammo[weaponId]--;
    const { direction, startPosition } = action;

    const recoilMagnitude = weaponData.recoilImpulse || 0;
    player.impulse.x -= direction.x * recoilMagnitude;
    player.impulse.z -= direction.z * recoilMagnitude;

    if (weaponData.type === 'projectile') {
        const projectileId = `proj_${nextObjectId++}`;
        const projectile = {
            id: projectileId, ownerId: playerId, weaponId: weaponId,
            damage: weaponData.damage, blastRadius: weaponData.blastRadius,
            position: startPosition, direction: direction,
            velocity: weaponData.velocity, lifespan: 4.0, impulse: weaponData.impulse,
        };
        gameState.projectiles[projectileId] = projectile;
        io.emit('objectCreated', { type: 'projectile', data: projectile });
    } else if (weaponData.type === 'missile') {
        const missileId = `missile_${nextObjectId++}`;
        const missile = {
            id: missileId, ownerId: playerId, weaponId: weaponId,
            damage: weaponData.damage, blastRadius: weaponData.blastRadius,
            position: startPosition, direction: direction,
            lifespan: weaponData.lifespan, impulse: weaponData.impulse,
        };
        gameState.missiles[missileId] = missile;
        io.emit('objectCreated', { type: 'missile', data: missile });
    }
}
function fireMachineGun(playerId, action) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.powerUpTimer <= 0) return;
    const { direction, startPosition } = action;

    const recoilMagnitude = 1.5;
    player.impulse.x -= direction.x * recoilMagnitude;
    player.impulse.z -= direction.z * recoilMagnitude;

    const bulletId = `bullet_${nextObjectId++}`;
    const bullet = {
        id: bulletId, ownerId: playerId, damage: 3, position: startPosition,
        direction: direction, velocity: 200, lifespan: 2.0, impulse: 2,
    };
    gameState.machineGunBullets[bulletId] = bullet;
    io.emit('objectCreated', { type: 'machineGunBullet', data: bullet });
}
function dropMine(playerId){
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.activePowerUp !== 'mines' || player.powerUpAmmo <= 0) return;
    player.powerUpAmmo--;
    const mineId = `mine_${nextObjectId++}`;
    const backOffset = 7;
    const minePosition = {
        x: player.position.x - Math.sin(player.rotation.y) * backOffset,
        z: player.position.z - Math.cos(player.rotation.y) * backOffset,
        y: 0 
    };
    minePosition.y = getHeightAt(minePosition.x, minePosition.z) + 0.25;
    const mine = { id: mineId, ownerId: playerId, position: minePosition };
    gameState.mines[mineId] = mine;
    io.emit('objectCreated', { type: 'mine', data: mine });
    if(player.powerUpAmmo <= 0) deactivatePowerUp(playerId);
}
function handlePlayerAction(socket, action) {
    const player = gameState.players[socket.id];
    if (!player || player.isDestroyed || player.isSinking) return;
    switch (action.type) {
        case "fire": fireWeapon(socket.id, action); break;
        case "heal":
            if (player.medkits > 0 && player.health < player.maxHealth) {
                player.medkits--; player.health = Math.min(player.health + 40, player.maxHealth);
            }
            break;
        case "dropMine": dropMine(socket.id); break;
        case "toggleLaser": if (player.laserData) { player.laserData.enabled = !player.laserData.enabled; } break;
        case "switchWeapon":
            if (action.weaponId && WEAPONS_DATA[action.weaponId]) {
                player.currentWeapon = action.weaponId;
            }
            break;
    }
}
function activatePowerUp(playerId, type) {
    const player = gameState.players[playerId];
    if (!player) return;
    deactivatePowerUp(playerId); player.activePowerUp = type;
    switch (type) {
        case "turbo": player.powerUpTimer = 10; break;
        case "machinegun": player.powerUpTimer = 15; break;
        case "mines": player.powerUpAmmo = 5; break;
    }
}
function deactivatePowerUp(playerId) {
    const player = gameState.players[playerId];
    if (player) { player.activePowerUp = null; player.powerUpTimer = 0; player.powerUpAmmo = 0; }
}
// --- Główna pętla gry ---
function gameLoop() {
    const delta = 1 / 30;

    for (const id in gameState.players) {
        const player = gameState.players[id];
        
        if (player.isEmpDisabled) {
            player.empDisableTimer -= delta;
            if (player.empDisableTimer <= 0) player.isEmpDisabled = false;
        }
        
        if (player.isSinking) {
            player.sinkingTimer -= delta; player.position.y -= 3.5 * delta;
            if (player.sinkingTimer <= 0) {
                player.isDestroyed = true; player.respawnTimer = 3.0; player.isSinking = false; 
                player.sinkingAngle = { x: 0, z: 0 }; player.rotation.x = 0;
                io.emit('objectDestroyed', { type: 'player', id: player.id, attackerId: id, hit: false });
            }
            continue; 
        }
        
        if (player.isDestroyed) {
            player.respawnTimer -= delta;
            if (player.respawnTimer <= 0) {
                const tankData = TANKS_DATA[player.tankType];
                player.health = tankData.stats.hp; 
                player.ammo = { he: 10, ap: 10, heat: 5, emp: 3, smoke: 3, guided: 2 };
                player.isDestroyed = false;
                const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
                player.position = { x: spawnPoint.x * (MAP_SIZE/2), y: 0, z: spawnPoint.z * (MAP_SIZE/2) };
                player.position.y = getHeightAt(player.position.x, player.position.z) + tankData.startY;
                player.rotation.x = 0;
            }
            continue;
        }

        const stats = TANKS_DATA[player.tankType].stats;
        let moveSpeed = stats.speed * delta * (player.activePowerUp === 'turbo' ? 2.5 : 1);
        const rotateSpeed = stats.turretRot * delta;

        const oldPos = { ...player.position };
        const moveVector = { x: 0, z: 0 };

        if (!player.isEmpDisabled) {
            if (player.keys.KeyW || player.keys.ArrowUp) {
                moveVector.x += Math.sin(player.rotation.y) * moveSpeed;
                moveVector.z += Math.cos(player.rotation.y) * moveSpeed;
            }
            if (player.keys.KeyS || player.keys.ArrowDown) {
                moveVector.x -= Math.sin(player.rotation.y) * moveSpeed;
                moveVector.z -= Math.cos(player.rotation.y) * moveSpeed;
            }
            if (player.keys.KeyA || player.keys.ArrowLeft) player.rotation.y += rotateSpeed * 0.8;
            if (player.keys.KeyD || player.keys.ArrowRight) player.rotation.y -= rotateSpeed * 0.8;
        }

        player.position.x += player.impulse.x * delta;
        player.position.z += player.impulse.z * delta;
        player.impulse.x *= 0.85; 
        player.impulse.z *= 0.85;
        if (Math.abs(player.impulse.x) < 0.1) player.impulse.x = 0;
        if (Math.abs(player.impulse.z) < 0.1) player.impulse.z = 0;

        if (moveVector.x !== 0 || moveVector.z !== 0) {
            if (player.keys.KeyW || player.keys.ArrowUp) {
                const lookAheadDist = 2.0;
                const lookAheadX = player.position.x + Math.sin(player.rotation.y) * lookAheadDist;
                const lookAheadZ = player.position.z + Math.cos(player.rotation.y) * lookAheadDist;
                const currentHeight = player.position.y - TANKS_DATA[player.tankType].startY;
                const futureHeight = getHeightAt(lookAheadX, lookAheadZ);
                const slope = (futureHeight - currentHeight) / lookAheadDist;
                const maxSlope = 0.8;
                if (slope > maxSlope) { moveVector.x = 0; moveVector.z = 0; }
            }
            const newPosX = player.position.x + moveVector.x; 
            const newPosZ = player.position.z + moveVector.z;
            
            const tempPos = { ...player.position };
            player.position.x = newPosX; if (checkPlayerBuildingCollision(player)) { player.position.x = tempPos.x; }
            player.position.z = newPosZ; if (checkPlayerBuildingCollision(player)) { player.position.z = tempPos.z; }
        }
        
        const tankData = TANKS_DATA[player.tankType];
        const groundHeight = getHeightAt(player.position.x, player.position.z);
        player.position.y = groundHeight + tankData.startY;

        const halfLength = TANK_LENGTH / 2;
        const frontX = player.position.x + Math.sin(player.rotation.y) * halfLength;
        const frontZ = player.position.z + Math.cos(player.rotation.y) * halfLength;
        const backX = player.position.x - Math.sin(player.rotation.y) * halfLength;
        const backZ = player.position.z - Math.cos(player.rotation.y) * halfLength;
        const frontHeight = getHeightAt(frontX, frontZ); const backHeight = getHeightAt(backX, backZ);
        const heightDifference = backHeight - frontHeight;
        player.rotation.x = Math.atan2(heightDifference, TANK_LENGTH);

        const safeZone = MAP_SIZE / 2;
        if (Math.abs(player.position.x) > safeZone + TANK_LENGTH / 2 || Math.abs(player.position.z) > safeZone + TANK_LENGTH / 2) {
            if (!player.isSinking) {
                 player.isSinking = true; player.sinkingTimer = 2.0; const tiltMagnitude = Math.PI / 6;
                 const edgeX = Math.max(-safeZone, Math.min(safeZone, player.position.x));
                 const edgeZ = Math.max(-safeZone, Math.min(safeZone, player.position.z));
                 const vecToEdgeX = player.position.x - edgeX; const vecToEdgeZ = player.position.z - edgeZ;
                 const len = Math.sqrt(vecToEdgeX*vecToEdgeX + vecToEdgeZ*vecToEdgeZ) || 1;
                 const normX = vecToEdgeX / len; const normZ = vecToEdgeZ / len;
                 player.sinkingAngle.x = -normZ * tiltMagnitude; player.sinkingAngle.z = normX * tiltMagnitude;
            }
        }

        // --- Tworzenie śladów gąsienic ---
        const distSq = (player.position.x - player.lastTrackPos.x)**2 + (player.position.z - player.lastTrackPos.z)**2;
        if (distSq > TRACK_DISTANCE_THRESHOLD**2) {
            const trackWidth = tankData.hullWidth / 2 - 0.5;
            const cosR = Math.cos(player.rotation.y);
            const sinR = Math.sin(player.rotation.y);
            
            const rightTrackPos = { x: player.position.x + cosR * trackWidth, z: player.position.z - sinR * trackWidth };
            const leftTrackPos = { x: player.position.x - cosR * trackWidth, z: player.position.z + sinR * trackWidth };

            [leftTrackPos, rightTrackPos].forEach(pos => {
                const trackId = `track_${nextObjectId++}`;
                const track = {
                    id: trackId,
                    position: { x: pos.x, y: getHeightAt(pos.x, pos.z), z: pos.z },
                    rotationY: player.rotation.y,
                    lifespan: 20.0, // 20 sekund życia
                    type: getTerrainTypeAt(pos.x, pos.z)
                };
                gameState.tracks[trackId] = track;
                io.emit('objectCreated', { type: 'track', data: track });
            });
            player.lastTrackPos = { ...player.position };
        }


        for (const otherId in gameState.players) {
            if (id === otherId) continue; const otherPlayer = gameState.players[otherId]; if (otherPlayer.isDestroyed || otherPlayer.isSinking) continue;
            const dist = Math.sqrt((player.position.x - otherPlayer.position.x) ** 2 + (player.position.z - otherPlayer.position.z) ** 2);
            if (dist < PLAYER_COLLISION_RADIUS) {
                const overlap = (PLAYER_COLLISION_RADIUS - dist) / 2; const angle = Math.atan2(player.position.z - otherPlayer.position.z, player.position.x - otherPlayer.position.x);
                player.position.x += Math.cos(angle) * overlap; player.position.z += Math.sin(angle) * overlap;
            }
        }

        for (const crateId in gameState.crates) {
            const crate = gameState.crates[crateId];
            const dist = Math.sqrt((player.position.x - crate.position.x) ** 2 + (player.position.z - crate.position.z) ** 2);
            if (dist < 5) {
                activatePowerUp(id, crate.powerUpType); delete gameState.crates[crateId];
                io.emit('objectDestroyed', { type: 'crate', id: crateId }); crateSpawnTimer = 1.0;
            }
        }
        for (const crateId in gameState.ammoCrates) {
            const crate = gameState.ammoCrates[crateId];
            const dist = Math.sqrt((player.position.x - crate.position.x) ** 2 + (player.position.z - crate.position.z) ** 2);
            if (dist < 5) {
                player.ammo.he = Math.min(player.ammo.he + 5, 20);
                player.ammo.ap = Math.min(player.ammo.ap + 5, 20);
                player.ammo.heat = Math.min(player.ammo.heat + 2, 10);
                player.ammo.guided = Math.min(player.ammo.guided + 1, 5);
                delete gameState.ammoCrates[crateId];
                io.emit('objectDestroyed', { type: 'ammoCrate', id: crateId }); ammoCrateSpawnTimer = 10.0;
            }
        }
    }

    const allProjectiles = [ { list: gameState.projectiles, type: 'projectile' }, { list: gameState.machineGunBullets, type: 'machineGunBullet' } ];
    for (const projGroup of allProjectiles) {
        for (const id in projGroup.list) {
            const p = projGroup.list[id];
            p.position.x += p.direction.x * p.velocity * delta; p.position.y += p.direction.y * p.velocity * delta; p.position.z += p.direction.z * p.velocity * delta;
            p.lifespan -= delta; let destroyed = false;
            
            for (const playerId in gameState.players) {
                if (p.ownerId === playerId) continue; const player = gameState.players[playerId]; if (player.isDestroyed || player.isSinking) continue;
                const distance = Math.sqrt((p.position.x - player.position.x) ** 2 + (p.position.y - player.position.y) ** 2 + (p.position.z - player.position.z) ** 2);
                if (distance < PLAYER_COLLISION_RADIUS) { 
                    if (p.blastRadius > 0) { destroyed = true; } 
                    else { handleDamage(player, p.damage, p.ownerId, p.direction, p.impulse, p.position); destroyed = true; }
                    break; 
                }
            }
            if (destroyed) { /* Handled below */ }
            else if (checkProjectileBuildingCollision(p, Object.values(gameState.buildings))) { destroyed = true; }
            else if (getHeightAt(p.position.x, p.position.z) > p.position.y) {
                destroyed = true;
                // --- Tworzenie kraterów ---
                if (p.weaponId === 'he') {
                    const craterId = `crater_${nextObjectId++}`;
                    const crater = {
                        id: craterId,
                        position: { x: p.position.x, y: getHeightAt(p.position.x, p.position.z), z: p.position.z },
                        radius: 6 + Math.random() * 2
                    };
                    gameState.craters[craterId] = crater;
                    io.emit('objectCreated', { type: 'crater', data: crater });
                }
            }
            
            if (p.lifespan <= 0) destroyed = true;

            if (destroyed) {
                const impactPoint = { ...p.position };
                if (p.blastRadius > 0) {
                    const weaponData = WEAPONS_DATA[p.weaponId];
                    for (const playerId in gameState.players) {
                        const player = gameState.players[playerId]; if (player.isDestroyed || player.isSinking) continue;
                        const dist = Math.sqrt((player.position.x - impactPoint.x)**2 + (player.position.z - impactPoint.z)**2);
                        if (dist < p.blastRadius) {
                            const damageFalloff = 1 - (dist / p.blastRadius);
                            const impulseFalloff = Math.max(0, 1 - (dist / p.blastRadius));
                            const impulseDirection = { x: player.position.x - impactPoint.x, y: 0, z: player.position.z - impactPoint.z };
                            const len = Math.sqrt(impulseDirection.x**2 + impulseDirection.z**2) || 1;
                            impulseDirection.x /= len; impulseDirection.z /= len;
                            handleDamage(player, p.damage * damageFalloff, p.ownerId, impulseDirection, p.impulse * impulseFalloff, impactPoint);
                        }
                    }
                     if (p.weaponId === 'emp') {
                        for (const playerId in gameState.players) {
                           const player = gameState.players[playerId]; if (player.isDestroyed || player.isSinking) continue;
                           const dist = Math.sqrt((player.position.x - impactPoint.x)**2 + (player.position.z - impactPoint.z)**2);
                           if (dist < p.blastRadius) applyEMP(player, weaponData.effectDuration);
                        }
                    } else if (p.weaponId === 'smoke') {
                        const cloudId = `smoke_${nextObjectId++}`;
                        gameState.smokeClouds[cloudId] = { id: cloudId, position: impactPoint, radius: p.blastRadius, lifespan: 20.0 };
                        io.emit('objectCreated', { type: 'smokeCloud', data: gameState.smokeClouds[cloudId] });
                    }
                }
                delete projGroup.list[id]; 
                io.emit('objectDestroyed', { type: projGroup.type, id: id, hit: true, weaponId: p.weaponId }); 
            }
        }
    }
  
    for (const id in gameState.missiles) {
        const m = gameState.missiles[id]; m.lifespan -= delta; let targetPlayer = null; let minDistance = Infinity;
        for(const pId in gameState.players) {
            if(pId === m.ownerId || gameState.players[pId].isDestroyed || gameState.players[pId].isSinking) continue; const p = gameState.players[pId];
            const dist = Math.sqrt((m.position.x - p.position.x)**2 + (m.position.z - p.position.z)**2);
            if (dist < minDistance) { minDistance = dist; targetPlayer = p; }
        }
        let destroyed = false;
        if (targetPlayer) {
            const speed = WEAPONS_DATA.guided.velocity * delta;
            const targetPosWithLead = { x: targetPlayer.position.x, y: targetPlayer.position.y, z: targetPlayer.position.z };
            const angleToTarget = Math.atan2(targetPosWithLead.z - m.position.z, targetPosWithLead.x - m.position.x);
            const angleToTargetY = Math.atan2(targetPosWithLead.y - m.position.y, Math.sqrt((targetPosWithLead.x - m.position.x)**2 + (targetPosWithLead.z - m.position.z)**2));
            m.position.x += Math.cos(angleToTarget) * speed; m.position.z += Math.sin(angleToTarget) * speed; m.position.y += Math.sin(angleToTargetY) * speed;
            if(minDistance < PLAYER_COLLISION_RADIUS) destroyed = true;
        }
        if(m.lifespan <= 0) destroyed = true;
        if(destroyed) {
             for (const playerId in gameState.players) {
                const player = gameState.players[playerId]; if (player.isDestroyed || player.isSinking) continue;
                const dist = Math.sqrt((player.position.x - m.position.x)**2 + (player.position.z - m.position.z)**2);
                if (dist < m.blastRadius) {
                    const damageFalloff = 1 - (dist / m.blastRadius);
                    const impulseFalloff = Math.max(0, 1 - (dist / m.blastRadius));
                    const impulseDirection = { x: player.position.x - m.position.x, z: player.position.z - m.position.z, y: 0 };
                    const len = Math.sqrt(impulseDirection.x**2 + impulseDirection.z**2) || 1;
                    impulseDirection.x /= len; impulseDirection.z /= len;
                    handleDamage(player, m.damage * damageFalloff, m.ownerId, impulseDirection, m.impulse * impulseFalloff, m.position);
                }
            }
            delete gameState.missiles[id]; io.emit('objectDestroyed', { type: 'missile', id: id, hit: true, weaponId: 'guided' }); 
        }
    }
    for (const mineId in gameState.mines) {
        const mine = gameState.mines[mineId];
        for (const playerId in gameState.players) {
            if(playerId === mine.ownerId || gameState.players[playerId].isDestroyed || gameState.players[playerId].isSinking) continue; const player = gameState.players[playerId];
            const dist = Math.sqrt((player.position.x - mine.position.x)**2 + (player.position.z - mine.position.z)**2);
            if(dist < 3) { 
                const impulseDirection = {x: player.position.x - mine.position.x, z: player.position.z - mine.position.z, y: 0};
                const len = Math.sqrt(impulseDirection.x**2 + impulseDirection.z**2) || 1;
                impulseDirection.x /= len; impulseDirection.z /= len;
                handleDamage(player, 50, mine.ownerId, impulseDirection, 40, mine.position); 
                delete gameState.mines[mineId]; 
                io.emit('objectDestroyed', {type: 'mine', id: mineId, hit: true}); 
                break; 
            }
        }
    }

    const trackKeys = Object.keys(gameState.tracks);
    if(trackKeys.length > MAX_TRACKS) {
        const oldestTrackId = trackKeys[0]; // Prosta implementacja FIFO
        delete gameState.tracks[oldestTrackId];
        io.emit('objectDestroyed', { type: 'track', id: oldestTrackId });
    }

    for (let id in gameState.tracks) {
        gameState.tracks[id].lifespan -= delta;
        if (gameState.tracks[id].lifespan <= 0) {
            delete gameState.tracks[id];
            io.emit('objectDestroyed', { type: 'track', id: id });
        }
    }

    for (let id in gameState.smokeClouds) {
        gameState.smokeClouds[id].lifespan -= delta;
        if (gameState.smokeClouds[id].lifespan <= 0) {
            delete gameState.smokeClouds[id];
            io.emit('objectDestroyed', { type: 'smokeCloud', id: id });
        }
    }
    for(const id in gameState.players) {
        const player = gameState.players[id];
        if (player.powerUpTimer > 0) { player.powerUpTimer -= delta; if (player.powerUpTimer <= 0) deactivatePowerUp(id); }
    }
  
    if (Object.keys(gameState.crates).length < 3) {
        crateSpawnTimer -= delta;
        if (crateSpawnTimer <= 0) {
            const crateId = `crate_${nextObjectId++}`; let cratePos; let isSafe = false;
            while(!isSafe) {
                isSafe = true; cratePos = { x: (Math.random() - 0.5) * (MAP_SIZE - 40), y: 0, z: (Math.random() - 0.5) * (MAP_SIZE - 40) };
                for(const sp of SPAWN_POINTS) {
                    if (Math.sqrt((cratePos.x - sp.x * (MAP_SIZE/2))**2 + (cratePos.z - sp.z * (MAP_SIZE/2))**2) < SPAWN_CLEARANCE_RADIUS) { isSafe = false; break; }
                }
            }
            cratePos.y = getHeightAt(cratePos.x, cratePos.z);
            gameState.crates[crateId] = { id: crateId, position: cratePos, powerUpType: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)] };
            io.emit('objectCreated', {type: 'crate', data: gameState.crates[crateId]}); crateSpawnTimer = 15.0;
        }
    }
     if (Object.keys(gameState.ammoCrates).length < 4) {
        ammoCrateSpawnTimer -= delta;
        if (ammoCrateSpawnTimer <= 0) {
            const crateId = `ammo_crate_${nextObjectId++}`; let cratePos; let isSafe = false;
            while(!isSafe) {
                isSafe = true; cratePos = { x: (Math.random() - 0.5) * (MAP_SIZE - 60), y: 0, z: (Math.random() - 0.5) * (MAP_SIZE - 60) };
                 for(const sp of SPAWN_POINTS) {
                    if (Math.sqrt((cratePos.x - sp.x * (MAP_SIZE/2))**2 + (cratePos.z - sp.z * (MAP_SIZE/2))**2) < SPAWN_CLEARANCE_RADIUS) { isSafe = false; break; }
                }
            }
            cratePos.y = getHeightAt(cratePos.x, cratePos.z);
            gameState.ammoCrates[crateId] = { id: crateId, position: cratePos };
            io.emit('objectCreated', {type: 'ammoCrate', data: gameState.ammoCrates[crateId]}); ammoCrateSpawnTimer = 20.0;
        }
    }

    io.emit("gameStateUpdate", gameState);
}

function checkPlayerBuildingCollision(player) {
    const playerRadius = 3.5;
    for (const buildingId in gameState.buildings) {
        const building = gameState.buildings[buildingId]; const { position: bPos, dimensions: bDim } = building;
        if (player.position.x + playerRadius < bPos.x - bDim.x / 2 || player.position.x - playerRadius > bPos.x + bDim.x / 2 || player.position.z + playerRadius < bPos.z - bDim.z / 2 || player.position.z - playerRadius > bPos.z + bDim.z / 2) continue;
        let minBuildingHeight = Infinity;
        const corners = [ { x: bPos.x - bDim.x/2, z: bPos.z - bDim.z/2 }, { x: bPos.x + bDim.x/2, z: bPos.z - bDim.z/2 }, { x: bPos.x - bDim.x/2, z: bPos.z + bDim.z/2 }, { x: bPos.x + bDim.x/2, z: bPos.z + bDim.z/2 }];
        corners.forEach(c => { const h = getHeightAt(c.x, c.z); if(h < minBuildingHeight) minBuildingHeight = h; });
        const playerAABB = { minY: player.position.y - TANKS_DATA[player.tankType].startY, maxY: player.position.y - TANKS_DATA[player.tankType].startY + PLAYER_HEIGHT };
        const buildingAABB = { minY: minBuildingHeight, maxY: minBuildingHeight + bDim.y };
        if (playerAABB.maxY < buildingAABB.minY || playerAABB.minY > buildingAABB.maxY) continue;
        return true;
    }
    return false;
}
function checkProjectileBuildingCollision(projectile, buildings) {
    for (const building of buildings) {
        const { position: bPos, dimensions: bDim } = building;
        if (projectile.position.x < bPos.x - bDim.x / 2 || projectile.position.x > bPos.x + bDim.x / 2 || projectile.position.z < bPos.z - bDim.z / 2 || projectile.position.z > bPos.z + bDim.z / 2) continue;
        let minBuildingHeight = Infinity;
        const corners = [ { x: bPos.x - bDim.x/2, z: bPos.z - bDim.z/2 }, { x: bPos.x + bDim.x/2, z: bPos.z - bDim.z/2 }, { x: bPos.x - bDim.x/2, z: bPos.z + bDim.z/2 }, { x: bPos.x + bDim.x/2, z: bPos.z + bDim.z/2 }];
        corners.forEach(c => { const h = getHeightAt(c.x, c.z); if(h < minBuildingHeight) minBuildingHeight = h; });
        if (projectile.position.y < minBuildingHeight || projectile.position.y > minBuildingHeight + bDim.y) continue;

        if (projectile.weaponId === 'he' || projectile.weaponId === 'heat' || projectile.weaponId === 'guided') {
            const impactPoint = { ...projectile.position }; const destroyedBrickIndices = []; const destructionRadius = 2.5;
            const buildingGroundHeight = getHeightAt(building.position.x, building.position.z);
            const localHit = { x: projectile.position.x - building.position.x, y: projectile.position.y - buildingGroundHeight, z: projectile.position.z - building.position.z };
            for (let i = 0; i < building.bricks.length; i++) {
                const brick = building.bricks[i];
                if (brick) {
                    const distSq = (brick.x - localHit.x)**2 + (brick.y - localHit.y)**2 + (brick.z - localHit.z)**2;
                    if (distSq < destructionRadius**2) { building.bricks[i] = null; destroyedBrickIndices.push(i); }
                }
            }
            if (destroyedBrickIndices.length > 0) io.emit('buildingDamaged', { buildingId: building.id, destroyedBrickIndices, impactPoint });
        }
        return true;
    }
    return false;
}

function createProceduralCity() {
    gameState.buildings = {};
    const cityOrigin = { x: - (CITY_GRID_SIZE * CITY_CELL_SIZE) / 2, z: - (CITY_GRID_SIZE * CITY_CELL_SIZE) / 2 };
    for (let i = 0; i < CITY_GRID_SIZE; i++) {
        for (let j = 0; j < CITY_GRID_SIZE; j++) {
            if (Math.random() < BUILDING_PROBABILITY) {
                const position = { x: cityOrigin.x + i * CITY_CELL_SIZE + CITY_CELL_SIZE / 2, y: 0, z: cityOrigin.z + j * CITY_CELL_SIZE + CITY_CELL_SIZE / 2, };
                if (Math.abs(position.x) > MAP_SIZE / 2 || Math.abs(position.z) > MAP_SIZE / 2) continue;
                if (Math.sqrt(position.x**2 + position.z**2) > SANDY_AREA_RADIUS) continue;
                let isTooCloseToSpawn = false;
                for(const sp of SPAWN_POINTS) {
                    if (Math.sqrt((position.x - sp.x * (MAP_SIZE/2))**2 + (position.z - sp.z * (MAP_SIZE/2))**2) < SPAWN_CLEARANCE_RADIUS + CITY_CELL_SIZE / 2) {
                        isTooCloseToSpawn = true; break;
                    }
                }
                if (isTooCloseToSpawn || Math.sqrt(position.x**2 + position.z**2) < 50) continue;
                const id = `bld_${nextObjectId++}`;
                const floors = BUILDING_MIN_FLOORS + Math.floor(Math.random() * (BUILDING_MAX_FLOORS - BUILDING_MIN_FLOORS));
                const widthBricks = 5 + Math.floor(Math.random() * 5); const depthBricks = 5 + Math.floor(Math.random() * 5);
                const dimensions = { x: widthBricks * BRICK_SIZE.x, y: floors * BRICK_SIZE.y, z: depthBricks * BRICK_SIZE.z };
                const bricks = [];
                 for (let y = 0; y < floors; y++) {
                    for (let x = 0; x < widthBricks; x++) {
                        for (let z = 0; z < depthBricks; z++) {
                            if (x === 0 || x === widthBricks - 1 || z === 0 || z === depthBricks - 1 || y === floors - 1) {
                                bricks.push({ x: (x - widthBricks / 2 + 0.5) * BRICK_SIZE.x, y: y * BRICK_SIZE.y + BRICK_SIZE.y / 2, z: (z - depthBricks / 2 + 0.5) * BRICK_SIZE.z });
                            }
                        }
                    }
                }
                gameState.buildings[id] = { id, position, dimensions, bricks, brickSize: BRICK_SIZE };
            }
        }
    }
    console.log(`Świat gry został stworzony: ${Object.keys(gameState.buildings).length} budynków.`);
}

io.on("connection", (socket) => {
  console.log(`Gracz połączony: ${socket.id}`);
  if (isGameConfigured) {
      socket.emit('serverStatus', { configured: true, settings: { mapSize: Object.keys(MAP_SIZES).find(key => MAP_SIZES[key] === MAP_SIZE), amplitude: TERRAIN_AMPLITUDE, scale: TERRAIN_SCALE } });
  } else {
      socket.emit('serverStatus', { configured: false });
  }

  socket.on("joinGame", (data) => {
    if (gameState.players[socket.id]) return; 
    if (!isGameConfigured) {
        isGameConfigured = true; MAP_SIZE = MAP_SIZES[data.config.mapSize] || 500;
        TERRAIN_AMPLITUDE = data.config.amplitude; TERRAIN_SCALE = data.config.scale;
        console.log("Serwer skonfigurowany przez pierwszego gracza:", data.config);
        generateHeightMap(); createProceduralCity();
        socket.broadcast.emit('serverStatus', { configured: true, settings: { mapSize: data.config.mapSize, amplitude: TERRAIN_AMPLITUDE, scale: TERRAIN_SCALE } });
    }
    const tankType = data.tankType; if (!TANKS_DATA[tankType]) return;
    const tankData = TANKS_DATA[tankType];
    const spawnPoint = SPAWN_POINTS[Object.keys(gameState.players).length % SPAWN_POINTS.length];
    const startPos = { x: spawnPoint.x * (MAP_SIZE / 2), y: 0, z: spawnPoint.z * (MAP_SIZE / 2) };
    startPos.y = getHeightAt(startPos.x, startPos.z) + tankData.startY;

    gameState.players[socket.id] = {
      id: socket.id, tankType: tankType, position: startPos, 
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }, 
      turretRotation: { x: 0, y: 0, z: 0 }, mantletRotation: { x: 0, y: 0, z: 0 },
      health: tankData.stats.hp, maxHealth: tankData.stats.hp, 
      medkits: 3, score: 0, isDestroyed: false, respawnTimer: 0, keys: {},
      isSinking: false, sinkingTimer: 0, sinkingAngle: { x: 0, z: 0 },
      impulse: { x: 0, y: 0, z: 0 },
      lastTrackPos: { ...startPos },
      activePowerUp: null, powerUpTimer: 0, powerUpAmmo: 0,
      isEmpDisabled: false, empDisableTimer: 0,
      currentWeapon: 'he',
      ammo: { he: 10, ap: 10, heat: 5, emp: 3, smoke: 3, guided: 2 },
      laserData: { enabled: true, start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } }
    };
    
    socket.emit("gameStarted", { 
        playerId: socket.id, initialState: gameState,
        spawnPoints: SPAWN_POINTS.map(p => ({ x: p.x * MAP_SIZE / 2, z: p.z * MAP_SIZE / 2 })),
        heightMap: heightMap,
        terrainParams: { size: MAP_SIZE, segments: TERRAIN_SEGMENTS, amplitude: TERRAIN_AMPLITUDE, sandyAreaRadius: SANDY_AREA_RADIUS, mudBorderWidth: MUD_BORDER_WIDTH }
    });
    
    socket.broadcast.emit("playerConnected", gameState.players[socket.id]);
    console.log(`Gracz ${socket.id} wybrał czołg ${tankType}.`);
  });

  socket.on("playerInput", (keys) => { if (gameState.players[socket.id]) { gameState.players[socket.id].keys = keys; } });
  socket.on("playerAimUpdate", (aimData) => {
      const player = gameState.players[socket.id];
      if(player && !player.isEmpDisabled) { player.turretRotation.y = aimData.turretY; player.mantletRotation.x = aimData.mantletX; }
  });
  socket.on("laserUpdate", (data) => {
      const player = gameState.players[socket.id];
      if (player && player.laserData) { player.laserData.start = data.start; player.laserData.end = data.end; }
  });
  socket.on("playerAction", (action) => { handlePlayerAction(socket, action); });
  socket.on("disconnect", () => {
    console.log(`Gracz rozłączony: ${socket.id}`);
    delete gameState.players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

server.listen(PORT, () => {
  console.log(`Serwer nasłuchuje na porcie ${PORT}`);
  setInterval(gameLoop, 1000 / 30);
});