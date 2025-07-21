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
const COLLISION_RADIUS = 7;
const HOUSE_HEALTH = 2;
const POWERUP_TYPES = ["turbo", "machinegun", "missile", "mines"];

const TANKS_DATA = {
  pl01: { name: "PL-01 Concept", stats: { hp: 85, damage: 22, speed: 18, turretRot: 1.8 }, startY: 1.0 },
  abrams: { name: "M1 Abrams", stats: { hp: 130, damage: 35, speed: 12, turretRot: 1.2 }, startY: 1.3 },
  standard: { name: "Standard", stats: { hp: 100, damage: 25, speed: 15, turretRot: 1.5 }, startY: 1.25 },
};

// --- Globalny stan gry na serwerze ---
const gameState = {
  players: {},
  projectiles: {},
  houses: {},
  toilets: {},
  crates: {},
};

let nextObjectId = 0;
let crateSpawnTimer = 10.0;

// --- Logika serwera ---

function fireCannon(playerId) {
    const player = gameState.players[playerId];
    if (!player || player.isDestroyed || player.isReloading || player.ammo <= 0) return;

    player.ammo--;

    const projectileId = `proj_${nextObjectId++}`;
    const projectile = {
        id: projectileId,
        ownerId: playerId,
        damage: TANKS_DATA[player.tankType].stats.damage,
        position: { ...player.position },
        rotationY: player.rotation.y,
        turretRotationY: player.turretRotation.y,
        mantletRotationX: player.mantletRotation.x,
        velocity: 160,
        lifespan: 3.0,
    };

    gameState.projectiles[projectileId] = projectile;
    io.emit('objectCreated', { type: 'projectile', data: projectile });

    if (player.ammo <= 0) {
        handlePlayerAction({ id: playerId }, { type: 'reload' });
    }
}

function handlePlayerAction(socket, action) {
    const player = gameState.players[socket.id];
    if (!player || player.isDestroyed) return;

    switch (action.type) {
        case "fire":
            fireCannon(socket.id);
            break;
        case "reload":
            if (!player.isReloading) {
                player.isReloading = true;
                setTimeout(() => {
                    const currentPlayer = gameState.players[socket.id];
                    if (currentPlayer) {
                        currentPlayer.ammo = 8;
                        currentPlayer.isReloading = false;
                    }
                }, 3000);
            }
            break;
        case "heal":
            if (player.medkits > 0 && player.health < player.maxHealth) {
                player.medkits--;
                player.health = Math.min(player.health + 40, player.maxHealth);
            }
            break;
    }
}


function gameLoop() {
  const delta = 1 / 30;

  // --- Aktualizacja graczy ---
  for (const id in gameState.players) {
    const player = gameState.players[id];
    if (player.isDestroyed) {
      player.respawnTimer -= delta;
      if (player.respawnTimer <= 0) {
        const tankData = TANKS_DATA[player.tankType];
        player.health = tankData.stats.hp;
        player.ammo = 8;
        player.isDestroyed = false;
        player.position = { x: (Math.random() - 0.5) * (MAP_SIZE * 0.8), y: tankData.startY, z: (Math.random() - 0.5) * (MAP_SIZE * 0.8) };
      }
      continue;
    }
    const stats = TANKS_DATA[player.tankType].stats;
    let moveSpeed = stats.speed * delta;
    const rotateSpeed = stats.turretRot * delta;

    // --- POPRAWIONY RUCH KADŁUBA ---
    // Modele czołgów w three.js domyślnie patrzą wzdłuż osi +Z
    if (player.keys.KeyW || player.keys.ArrowUp) {
      player.position.x += Math.sin(player.rotation.y) * moveSpeed;
      player.position.z += Math.cos(player.rotation.y) * moveSpeed;
    }
    if (player.keys.KeyS || player.keys.ArrowDown) {
      player.position.x -= Math.sin(player.rotation.y) * moveSpeed;
      player.position.z -= Math.cos(player.rotation.y) * moveSpeed;
    }
    // Rotacja pozostaje bez zmian
    if (player.keys.KeyA || player.keys.ArrowLeft) player.rotation.y += rotateSpeed * 0.8;
    if (player.keys.KeyD || player.keys.ArrowRight) player.rotation.y -= rotateSpeed * 0.8;
    if (player.keys.KeyQ || player.keys.BracketLeft) player.turretRotation.y += rotateSpeed;
    if (player.keys.KeyE || player.keys.BracketRight) player.turretRotation.y -= rotateSpeed;
    if ((player.keys.KeyF || player.keys.Semicolon) && player.mantletRotation.x > -0.5) player.mantletRotation.x -= rotateSpeed * 0.5;
    if ((player.keys.KeyV || player.keys.Quote) && player.mantletRotation.x < 0.2) player.mantletRotation.x += rotateSpeed * 0.5;
    
    player.position.x = Math.max(-MAP_SIZE / 2, Math.min(MAP_SIZE / 2, player.position.x));
    player.position.z = Math.max(-MAP_SIZE / 2, Math.min(MAP_SIZE / 2, player.position.z));
    
    for (const otherId in gameState.players) {
        if (id === otherId) continue;
        const otherPlayer = gameState.players[otherId];
        if (otherPlayer.isDestroyed) continue;
        const dist = Math.sqrt((player.position.x - otherPlayer.position.x) ** 2 + (player.position.z - otherPlayer.position.z) ** 2);
        if (dist < COLLISION_RADIUS) {
            const overlap = (COLLISION_RADIUS - dist) / 2;
            const angle = Math.atan2(player.position.z - otherPlayer.position.z, player.position.x - otherPlayer.position.x);
            player.position.x += Math.cos(angle) * overlap;
            player.position.z += Math.sin(angle) * overlap;
        }
    }
  }

  // --- Aktualizacja pocisków ---
  for (const id in gameState.projectiles) {
    const p = gameState.projectiles[id];
    
    // --- POPRAWIONY KIERUNEK STRZAŁU ---
    const finalAngleY = p.rotationY + p.turretRotationY;
    const angleX = p.mantletRotationX;

    // Oblicz wektor kierunku (zgodny z ruchem czołgu)
    const dirX = Math.sin(finalAngleY) * Math.cos(angleX);
    const dirY = -Math.sin(angleX); // Ujemny, bo w three.js rotacja X w dół jest dodatnia
    const dirZ = Math.cos(finalAngleY) * Math.cos(angleX);

    p.position.x += dirX * p.velocity * delta;
    p.position.y += dirY * p.velocity * delta;
    p.position.z += dirZ * p.velocity * delta;
    p.lifespan -= delta;

    let destroyed = false;
    
    for (const playerId in gameState.players) {
        if (p.ownerId === playerId) continue;
        const player = gameState.players[playerId];
        if (player.isDestroyed) continue;
        const distance = Math.sqrt((p.position.x - player.position.x) ** 2 + (p.position.z - player.position.z) ** 2);
        if (distance < COLLISION_RADIUS) {
            player.health -= p.damage;
            if (player.health <= 0) {
                player.isDestroyed = true;
                player.respawnTimer = 5.0;
                const owner = gameState.players[p.ownerId];
                if (owner) owner.score++;
            }
            destroyed = true;
            break;
        }
    }
    
    if (p.lifespan <= 0 || destroyed || p.position.y < 0) {
        delete gameState.projectiles[id];
        io.emit('objectDestroyed', { type: 'projectile', id: id });
    }
  }

  io.emit("gameStateUpdate", gameState);
}

// --- Logika pomocnicza i połączenia (bez zmian) ---
function createWorld() {
  for (let i = 0; i < 5; i++) {
    const id = `house_${nextObjectId++}`;
    const position = { x: (Math.random() - 0.5) * (MAP_SIZE * 0.7), y: 0, z: (Math.random() - 0.5) * (MAP_SIZE * 0.7) };
    if (Math.sqrt(position.x ** 2 + position.z ** 2) < 50) { i--; continue; }
    gameState.houses[id] = { id, position, rotationY: Math.random() * Math.PI, health: HOUSE_HEALTH };
  }
  for (let i = 0; i < 10; i++) {
    const id = `toilet_${nextObjectId++}`;
    gameState.toilets[id] = { id, position: { x: (Math.random() - 0.5) * (MAP_SIZE - 80) + 20, y: 0, z: (Math.random() - 0.5) * (MAP_SIZE - 80) + 20 } };
  }
  console.log("Świat gry został stworzony na serwerze.");
}

io.on("connection", (socket) => {
  console.log(`Gracz połączony: ${socket.id}`);
  socket.on("selectTank", (tankType) => {
    if (gameState.players[socket.id] || !TANKS_DATA[tankType]) return;
    const tankData = TANKS_DATA[tankType];
    const startPos = { x: (Math.random() - 0.5) * (MAP_SIZE * 0.8), y: tankData.startY, z: (Math.random() - 0.5) * (MAP_SIZE * 0.8) };
    gameState.players[socket.id] = {
      id: socket.id, tankType: tankType, position: startPos, rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }, turretRotation: { x: 0, y: 0, z: 0 },
      mantletRotation: { x: 0, y: 0, z: 0 }, health: tankData.stats.hp, maxHealth: tankData.stats.hp, ammo: 8, medkits: 3, score: 0,
      isReloading: false, isDestroyed: false, respawnTimer: 0, keys: {},
    };
    socket.emit("gameStarted", { playerId: socket.id, initialState: gameState, });
    socket.broadcast.emit("playerConnected", gameState.players[socket.id]);
    console.log(`Gracz ${socket.id} wybrał czołg ${tankType}.`);
  });
  socket.on("playerInput", (keys) => { if (gameState.players[socket.id]) { gameState.players[socket.id].keys = keys; } });
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
  createWorld();
  setInterval(gameLoop, 1000 / 30);
});