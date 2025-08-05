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
const MAP_SIZE = 500;
const MUD_BORDER_WIDTH = 15; // Szerokość błota po każdej stronie planszy
const PLAYER_COLLISION_RADIUS = 7;
const POWERUP_TYPES = ["turbo", "machinegun", "missile", "mines"];

const SPAWN_POINTS = [
    { x: 200, z: 0 },   { x: -200, z: 0 },
    { x: 0, z: 200 },   { x: 0, z: -200 },
    { x: 141, z: 141 }, { x: -141, z: -141 },
    { x: 141, z: -141 },{ x: -141, z: 141 }
];
const SPAWN_CLEARANCE_RADIUS = 35; 

// --- Stałe generacji miasta ---
const CITY_GRID_SIZE = 20;
const CITY_CELL_SIZE = 30;
const BUILDING_PROBABILITY = 0.5;
const BUILDING_MIN_FLOORS = 2;
const BUILDING_MAX_FLOORS = 8;
const BRICK_SIZE = { x: 2.0, y: 1.0, z: 4.0 };
const PLAYER_HEIGHT = 4.0;

const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 22, speed: 18, turretRot: 1.8 }, startY: 1.0 },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 35, speed: 12, turretRot: 1.2 }, startY: 1.3 },
  standard: { name: "Standard", stats: { hp: 100, damage: 25, speed: 15, turretRot: 1.5 }, startY: 1.25 },
};

// --- Globalny stan gry na serwerze ---
const gameState = {
  players: {},
  projectiles: {},
  buildings: {},
  crates: {},
  mines: {},
  missiles: {},
  machineGunBullets: {},
};

let nextObjectId = 0;
let crateSpawnTimer = 10.0;

// --- Logika Pomocnicza ---
function handleDamage(player, amount, attackerId) {
    if (!player || player.isDestroyed || player.isSinking) return;
    player.health -= amount;
    if (player.health <= 0) {
        player.isDestroyed = true;
        player.respawnTimer = 3.0; 
        const owner = gameState.players[attackerId];
        if (owner && owner.id !== player.id) {
             owner.score++;
             io.emit('killNotification', { attackerId: owner.id, victimId: player.id });
        }
        io.emit('objectDestroyed', { type: 'player', id: player.id, attackerId: attackerId, hit: true });
    }
}

// --- Logika Strzelania ---
function fireCannon(playerId, direction) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.isReloading || player.ammo <= 0) return;
    player.ammo--;
    const projectileId = `proj_${nextObjectId++}`;
    const projectile = {
        id: projectileId, ownerId: playerId, damage: TANKS_DATA[player.tankType].stats.damage,
        position: { ...player.position }, // Pozycja startowa pocisku
        direction: direction, // Użyj kierunku od klienta
        velocity: 160, lifespan: 3.0,
    };
    gameState.projectiles[projectileId] = projectile;
    io.emit('objectCreated', { type: 'projectile', data: projectile });
    if (player.ammo <= 0) { handlePlayerAction({ id: playerId }, { type: 'reload' }); }
}
function fireMachineGun(playerId, direction) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.powerUpTimer <= 0) return;
    const bulletId = `bullet_${nextObjectId++}`;
    const bullet = {
        id: bulletId, ownerId: playerId, damage: 3, position: { ...player.position },
        direction: direction, // Użyj kierunku od klienta
        velocity: 200, lifespan: 2.0,
    };
    gameState.machineGunBullets[bulletId] = bullet;
    io.emit('objectCreated', { type: 'machineGunBullet', data: bullet });
}
function fireMissile(playerId, direction) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.powerUpAmmo <= 0) return;
    player.powerUpAmmo--;
    const missileId = `missile_${nextObjectId++}`;
    const missile = {
        id: missileId, ownerId: playerId, damage: TANKS_DATA[player.tankType].stats.damage * 2, position: { ...player.position },
        direction: direction, // Użyj kierunku od klienta
        lifespan: 10.0,
    };
    gameState.missiles[missileId] = missile;
    io.emit('objectCreated', { type: 'missile', data: missile });
    if(player.powerUpAmmo <= 0) deactivatePowerUp(playerId);
}
function dropMine(playerId){
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isSinking || player.activePowerUp !== 'mines' || player.powerUpAmmo <= 0) return;
    player.powerUpAmmo--;
    const mineId = `mine_${nextObjectId++}`;
    const backOffset = 7;
    const minePosition = {
        x: player.position.x - Math.sin(player.rotation.y) * backOffset, y: 0.25,
        z: player.position.z - Math.cos(player.rotation.y) * backOffset
    };
    const mine = { id: mineId, ownerId: playerId, position: minePosition };
    gameState.mines[mineId] = mine;
    io.emit('objectCreated', { type: 'mine', data: mine });
    if(player.powerUpAmmo <= 0) deactivatePowerUp(playerId);
}
function handlePlayerAction(socket, action) {
    const player = gameState.players[socket.id];
    if (!player || player.isDestroyed || player.isSinking) return;
    switch (action.type) {
        case "fire":
            if (!player.activePowerUp) fireCannon(socket.id, action.direction);
            else if (player.activePowerUp === 'machinegun') fireMachineGun(socket.id, action.direction);
            else if (player.activePowerUp === 'missile') fireMissile(socket.id, action.direction);
            else fireCannon(socket.id, action.direction);
            break;
        case "reload":
            if (!player.isReloading && player.ammo < 8) {
                player.isReloading = true;
                setTimeout(() => {
                    const currentPlayer = gameState.players[socket.id];
                    if (currentPlayer) { currentPlayer.ammo = 8; currentPlayer.isReloading = false; }
                }, 3000);
            }
            break;
        case "heal":
            if (player.medkits > 0 && player.health < player.maxHealth) {
                player.medkits--; player.health = Math.min(player.health + 40, player.maxHealth);
            }
            break;
        case "dropMine": dropMine(socket.id); break;
    }
}
function activatePowerUp(playerId, type) {
    const player = gameState.players[playerId];
    if (!player) return;
    deactivatePowerUp(playerId);
    player.activePowerUp = type;
    switch (type) {
        case "turbo": player.powerUpTimer = 10; break;
        case "machinegun": player.powerUpTimer = 15; break;
        case "missile": player.powerUpAmmo = 1; break;
        case "mines": player.powerUpAmmo = 5; break;
    }
}
function deactivatePowerUp(playerId) {
    const player = gameState.players[playerId];
    if (player) {
        player.activePowerUp = null; player.powerUpTimer = 0; player.powerUpAmmo = 0;
    }
}
// --- Główna pętla gry ---
function gameLoop() {
    const delta = 1 / 30;

    // --- Aktualizacja Graczy ---
    for (const id in gameState.players) {
        const player = gameState.players[id];
        
        if (player.isSinking) {
            player.sinkingTimer -= delta;
            player.position.y -= 3.5 * delta;
            if (player.sinkingTimer <= 0) {
                player.isDestroyed = true;
                player.respawnTimer = 3.0; 
                player.isSinking = false; 
                player.sinkingAngle = { x: 0, z: 0 };
                io.emit('objectDestroyed', { type: 'player', id: player.id, attackerId: id, hit: false });
            }
            continue; 
        }
        
        if (player.isDestroyed) {
            player.respawnTimer -= delta;
            if (player.respawnTimer <= 0) {
                const tankData = TANKS_DATA[player.tankType];
                player.health = tankData.stats.hp; 
                player.ammo = 8; 
                player.isDestroyed = false;
                const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
                player.position = { x: spawnPoint.x, y: tankData.startY, z: spawnPoint.z };
            }
            continue;
        }

        const stats = TANKS_DATA[player.tankType].stats;
        let moveSpeed = stats.speed * delta * (player.activePowerUp === 'turbo' ? 2.5 : 1);
        const rotateSpeed = stats.turretRot * delta;

        const oldPos = { ...player.position };
        const moveVector = { x: 0, z: 0 };

        if (player.keys.KeyW || player.keys.ArrowUp) {
            moveVector.x += Math.sin(player.rotation.y) * moveSpeed;
            moveVector.z += Math.cos(player.rotation.y) * moveSpeed;
        }
        if (player.keys.KeyS || player.keys.ArrowDown) {
            moveVector.x -= Math.sin(player.rotation.y) * moveSpeed;
            moveVector.z -= Math.cos(player.rotation.y) * moveSpeed;
        }
        // Ruch podwozia jest teraz niezależny od myszy
        if (player.keys.KeyA || player.keys.ArrowLeft) player.rotation.y += rotateSpeed * 0.8;
        if (player.keys.KeyD || player.keys.ArrowRight) player.rotation.y -= rotateSpeed * 0.8;


        if (moveVector.x !== 0 || moveVector.z !== 0) {
            const newPosX = oldPos.x + moveVector.x;
            const newPosZ = oldPos.z + moveVector.z;
            player.position.x = newPosX;
            if (checkPlayerBuildingCollision(player)) { player.position.x = oldPos.x; }
            player.position.z = newPosZ;
            if (checkPlayerBuildingCollision(player)) { player.position.z = oldPos.z; }
        }
        
        // Wieża i lufa są teraz kontrolowane przez klienta (myszką)
        // Usunięto sterowanie Q, E, F, V

        // Logika tonięcia: czołg tonie dopiero po zjechaniu z błota
        const safeZone = MAP_SIZE / 2 + MUD_BORDER_WIDTH;
        if (Math.abs(player.position.x) > safeZone || Math.abs(player.position.z) > safeZone) {
            if (!player.isSinking) {
                 player.isSinking = true;
                 player.sinkingTimer = 2.0;
                 const tiltMagnitude = Math.PI / 6;
                 const edgeX = Math.max(-safeZone, Math.min(safeZone, player.position.x));
                 const edgeZ = Math.max(-safeZone, Math.min(safeZone, player.position.z));
                 const vecToEdgeX = player.position.x - edgeX;
                 const vecToEdgeZ = player.position.z - edgeZ;
                 const len = Math.sqrt(vecToEdgeX*vecToEdgeX + vecToEdgeZ*vecToEdgeZ) || 1;
                 const normX = vecToEdgeX / len;
                 const normZ = vecToEdgeZ / len;
                 player.sinkingAngle.x = -normZ * tiltMagnitude;
                 player.sinkingAngle.z = normX * tiltMagnitude;
            }
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
    }

  const allProjectiles = [
      { list: gameState.projectiles, type: 'projectile' }, { list: gameState.machineGunBullets, type: 'machineGunBullet' }
  ];
  for (const projGroup of allProjectiles) {
    for (const id in projGroup.list) {
        const p = projGroup.list[id];
        p.position.x += p.direction.x * p.velocity * delta;
        p.position.y += p.direction.y * p.velocity * delta;
        p.position.z += p.direction.z * p.velocity * delta;
        p.lifespan -= delta;
        let destroyed = false;
        
        for (const playerId in gameState.players) {
            if (p.ownerId === playerId) continue; const player = gameState.players[playerId]; if (player.isDestroyed || player.isSinking) continue;
            const distance = Math.sqrt((p.position.x - player.position.x) ** 2 + (p.position.z - player.position.z) ** 2);
            if (distance < PLAYER_COLLISION_RADIUS) { handleDamage(player, p.damage, p.ownerId); destroyed = true; break; }
        }
        if (destroyed) { delete projGroup.list[id]; io.emit('objectDestroyed', { type: projGroup.type, id: id, hit: true }); continue; }

        for(const buildingId in gameState.buildings) {
            const building = gameState.buildings[buildingId];
            const bPos = building.position; const bDim = building.dimensions;
            if (p.position.x >= bPos.x - bDim.x / 2 && p.position.x <= bPos.x + bDim.x / 2 &&
                p.position.y >= bPos.y && p.position.y <= bPos.y + bDim.y &&
                p.position.z >= bPos.z - bDim.z / 2 && p.position.z <= bPos.z + bDim.z / 2)
            {
                const impactPoint = { ...p.position }; const destroyedBrickIndices = [];
                const destructionRadius = 2.5;
                const localHit = { x: p.position.x - bPos.x, y: p.position.y - bPos.y, z: p.position.z - bPos.z };
                for (let i = 0; i < building.bricks.length; i++) {
                    const brick = building.bricks[i];
                    if (brick) {
                        const distSq = (brick.x - localHit.x)**2 + (brick.y - localHit.y)**2 + (brick.z - localHit.z)**2;
                        if (distSq < destructionRadius**2) { building.bricks[i] = null; destroyedBrickIndices.push(i); }
                    }
                }
                if (destroyedBrickIndices.length > 0) { io.emit('buildingDamaged', { buildingId, destroyedBrickIndices, impactPoint }); }
                destroyed = true; break;
            }
        }
        if (p.lifespan <= 0 || destroyed || p.position.y < -5) {
            delete projGroup.list[id]; 
            io.emit('objectDestroyed', { type: projGroup.type, id: id, hit: destroyed }); 
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
          const speed = 100 * delta;
          const angleToTarget = Math.atan2(targetPlayer.position.z - m.position.z, targetPlayer.position.x - m.position.x);
          m.position.x += Math.cos(angleToTarget) * speed; m.position.z += Math.sin(angleToTarget) * speed;
          if(minDistance < PLAYER_COLLISION_RADIUS) { handleDamage(targetPlayer, m.damage, m.ownerId); destroyed = true; }
      }
      if(m.lifespan <= 0 || destroyed) { delete gameState.missiles[id]; io.emit('objectDestroyed', { type: 'missile', id: id, hit: true }); }
  }
  for (const mineId in gameState.mines) {
      const mine = gameState.mines[mineId];
      for (const playerId in gameState.players) {
          if(playerId === mine.ownerId || gameState.players[playerId].isDestroyed || gameState.players[playerId].isSinking) continue; const player = gameState.players[playerId];
          const dist = Math.sqrt((player.position.x - mine.position.x)**2 + (player.position.z - mine.position.z)**2);
          if(dist < 3) { handleDamage(player, 50, mine.ownerId); delete gameState.mines[mineId]; io.emit('objectDestroyed', {type: 'mine', id: mineId, hit: true}); break; }
      }
  }
  for(const id in gameState.players) {
      const player = gameState.players[id];
      if (player.powerUpTimer > 0) { player.powerUpTimer -= delta; if (player.powerUpTimer <= 0) { deactivatePowerUp(id); } }
  }
  
  if (Object.keys(gameState.crates).length < 3) {
      crateSpawnTimer -= delta;
      if (crateSpawnTimer <= 0) {
          const crateId = `crate_${nextObjectId++}`;
          let cratePos;
          let isSafe = false;
          while(!isSafe) {
              isSafe = true;
              cratePos = { x: (Math.random() - 0.5) * (MAP_SIZE - 40), y: 0, z: (Math.random() - 0.5) * (MAP_SIZE - 40) };
              for(const sp of SPAWN_POINTS) {
                  const dist = Math.sqrt((cratePos.x - sp.x)**2 + (cratePos.z - sp.z)**2);
                  if (dist < SPAWN_CLEARANCE_RADIUS) {
                      isSafe = false;
                      break;
                  }
              }
          }

          gameState.crates[crateId] = {
              id: crateId, position: cratePos,
              powerUpType: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
          };
          io.emit('objectCreated', {type: 'crate', data: gameState.crates[crateId]}); crateSpawnTimer = 15.0;
      }
  }

  io.emit("gameStateUpdate", gameState);
}

// --- Funkcja sprawdzania kolizji gracza z budynkami ---
function checkPlayerBuildingCollision(player) {
    const playerRadius = 3.5;
    for (const buildingId in gameState.buildings) {
        const building = gameState.buildings[buildingId];
        const { position: bPos, dimensions: bDim } = building;

        if (player.position.x + playerRadius < bPos.x - bDim.x / 2 ||
            player.position.x - playerRadius > bPos.x + bDim.x / 2 ||
            player.position.z + playerRadius < bPos.z - bDim.z / 2 ||
            player.position.z - playerRadius > bPos.z + bDim.z / 2) {
            continue; 
        }

        for (const brick of building.bricks) {
            if (!brick) continue;
            const brickWorldPos = { x: bPos.x + brick.x, y: bPos.y + brick.y, z: bPos.z + brick.z, };
            const brickAABB = {
                minX: brickWorldPos.x - BRICK_SIZE.x / 2, maxX: brickWorldPos.x + BRICK_SIZE.x / 2,
                minY: brickWorldPos.y - BRICK_SIZE.y / 2, maxY: brickWorldPos.y + BRICK_SIZE.y / 2,
                minZ: brickWorldPos.z - BRICK_SIZE.z / 2, maxZ: brickWorldPos.z - BRICK_SIZE.z / 2,
            };

            if (player.position.x + playerRadius > brickAABB.minX && player.position.x - playerRadius < brickAABB.maxX &&
                0 < brickAABB.maxY && PLAYER_HEIGHT > brickAABB.minY &&
                player.position.z + playerRadius > brickAABB.minZ && player.position.z - playerRadius < brickAABB.maxZ) {
                return true;
            }
        }
    }
    return false;
}

// --- Tworzenie świata i połączenia ---
function createProceduralCity() {
    const cityOrigin = { x: - (CITY_GRID_SIZE * CITY_CELL_SIZE) / 2, z: - (CITY_GRID_SIZE * CITY_CELL_SIZE) / 2 };
    for (let i = 0; i < CITY_GRID_SIZE; i++) {
        for (let j = 0; j < CITY_GRID_SIZE; j++) {
            if (Math.random() < BUILDING_PROBABILITY) {
                const position = {
                    x: cityOrigin.x + i * CITY_CELL_SIZE + CITY_CELL_SIZE / 2,
                    y: 0,
                    z: cityOrigin.z + j * CITY_CELL_SIZE + CITY_CELL_SIZE / 2,
                };
                
                if (Math.abs(position.x) > MAP_SIZE / 2 || Math.abs(position.z) > MAP_SIZE / 2) {
                    continue;
                }
                
                let isTooCloseToSpawn = false;
                for(const sp of SPAWN_POINTS) {
                    const distance = Math.sqrt((position.x - sp.x)**2 + (position.z - sp.z)**2);
                    if (distance < SPAWN_CLEARANCE_RADIUS + CITY_CELL_SIZE / 2) {
                        isTooCloseToSpawn = true;
                        break;
                    }
                }
                if (isTooCloseToSpawn || Math.sqrt(position.x**2 + position.z**2) < 50) {
                    continue;
                }
                
                const id = `bld_${nextObjectId++}`;
                const floors = BUILDING_MIN_FLOORS + Math.floor(Math.random() * (BUILDING_MAX_FLOORS - BUILDING_MIN_FLOORS));
                const widthBricks = 5 + Math.floor(Math.random() * 5);
                const depthBricks = 5 + Math.floor(Math.random() * 5);
                const dimensions = { x: widthBricks * BRICK_SIZE.x, y: floors * BRICK_SIZE.y, z: depthBricks * BRICK_SIZE.z };
                
                const bricks = [];
                for (let y = 0; y < floors; y++) {
                    for (let x = 0; x < widthBricks; x++) {
                        for (let z = 0; z < depthBricks; z++) {
                            if (x === 0 || x === widthBricks - 1 || z === 0 || z === depthBricks - 1) {
                                bricks.push({
                                    x: (x - widthBricks / 2 + 0.5) * BRICK_SIZE.x,
                                    y: y * BRICK_SIZE.y + BRICK_SIZE.y / 2,
                                    z: (z - depthBricks / 2 + 0.5) * BRICK_SIZE.z,
                                });
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
  socket.on("selectTank", (tankType) => {
    if (gameState.players[socket.id] || !TANKS_DATA[tankType]) return;
    const tankData = TANKS_DATA[tankType];

    const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const startPos = { x: spawnPoint.x, y: tankData.startY, z: spawnPoint.z };

    gameState.players[socket.id] = {
      id: socket.id, tankType: tankType, position: startPos, rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }, turretRotation: { x: 0, y: 0, z: 0 },
      mantletRotation: { x: 0, y: 0, z: 0 }, health: tankData.stats.hp, maxHealth: tankData.stats.hp, ammo: 8, medkits: 3, score: 0,
      isReloading: false, isDestroyed: false, respawnTimer: 0, keys: {},
      activePowerUp: null, powerUpTimer: 0, powerUpAmmo: 0,
      isSinking: false, sinkingTimer: 0, sinkingAngle: { x: 0, z: 0 },
    };
    
    socket.emit("gameStarted", { 
        playerId: socket.id, 
        initialState: gameState,
        spawnPoints: SPAWN_POINTS
    });
    
    socket.broadcast.emit("playerConnected", gameState.players[socket.id]);
    console.log(`Gracz ${socket.id} wybrał czołg ${tankType}.`);
  });
  socket.on("playerInput", (keys) => { if (gameState.players[socket.id]) { gameState.players[socket.id].keys = keys; } });
  
  socket.on("playerAimUpdate", (aimData) => {
      const player = gameState.players[socket.id];
      if(player) {
          player.turretRotation.y = aimData.turretY;
          player.mantletRotation.x = aimData.mantletX;
      }
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
  createProceduralCity();
  setInterval(gameLoop, 1000 / 30);
});
