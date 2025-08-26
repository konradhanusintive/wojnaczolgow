import * as THREE from "three";
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// --- PRYWATNE FUNKCJE POMOCNICZE ---

/**
 * Pobiera wysokość terenu w danym punkcie (x, z).
 * Wymaga mapy wysokości i parametrów terenu.
 */
function getHeightAt(x, z, heightMap, terrainParams) {
    if (!heightMap || !terrainParams) return 0;
    const { size, segments } = terrainParams;
    const gridX = (x + size / 2) / size * segments;
    const gridZ = (z + size / 2) / size * segments;
    const x1 = Math.floor(gridX);
    const z1 = Math.floor(gridZ);
    const x2 = Math.min(x1 + 1, segments);
    const z2 = Math.min(z1 + 1, segments);
    if (x1 < 0 || x1 > segments || z1 < 0 || z1 > segments || !heightMap[x1] || !heightMap[x2]) return 0;
    const h11 = heightMap[x1][z1];
    const h12 = heightMap[x1][z2];
    const h21 = heightMap[x2][z1];
    const h22 = heightMap[x2][z2];
    if (h11 === undefined || h12 === undefined || h21 === undefined || h22 === undefined) return 0;
    const tx = gridX - x1;
    const tz = gridZ - z1;
    const h_x1 = h11 * (1 - tx) + h21 * tx;
    const h_x2 = h12 * (1 - tx) + h22 * tx;
    return h_x1 * (1 - tz) + h_x2 * tz;
}

// --- FUNKCJE TWORZENIA ELEMENTÓW ---

function createBarkCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 512;
    const context = canvas.getContext('2d');
    const baseColor = '#5C4033'; const darkColor = '#3d2a21';
    context.fillStyle = baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 800; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const length = Math.random() * 100 + 50;
        const width = Math.random() * 2 + 1;
        const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.1;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.fillStyle = darkColor;
        context.globalAlpha = Math.random() * 0.5 + 0.2;
        context.fillRect(-width / 2, -length / 2, width, length);
        context.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createFoliageCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const length = Math.random() * 120 + 30;
        const startX = centerX + Math.cos(angle) * (Math.random() * 20);
        const startY = centerY + Math.sin(angle) * (Math.random() * 20);
        const endX = centerX + Math.cos(angle) * length;
        const endY = centerY + Math.sin(angle) * length;
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, `rgba(30, 60, 30, ${0.5 + Math.random() * 0.5})`);
        gradient.addColorStop(0.5, `rgba(46, 77, 46, ${0.2 + Math.random() * 0.3})`);
        gradient.addColorStop(1, `rgba(50, 80, 50, 0)`);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.strokeStyle = gradient;
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    // Redukcja halo: używamy premultiplied alpha, bez mipmap i filtrów liniowych
    tex.premultiplyAlpha = true;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

// Zoptymalizowane materiały, tworzone raz
const trunkMaterial = new THREE.MeshLambertMaterial({ map: createBarkCanvasTexture() });
const foliageMaterial = new THREE.MeshLambertMaterial({
    color: 0x5a9447,
    alphaMap: createFoliageCanvasTexture(),
    transparent: true,
    alphaTest: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide
});

function createBeautifulPineTreeMesh() {
    const treeGroup = new THREE.Group();
    const trunkHeight = 8 + Math.random() * 7;
    const trunkRadius = 0.25 + Math.random() * 0.55; // większa zmienność grubości
    
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 10);
    const trunkMatVar = trunkMaterial.clone(); trunkMatVar.color = new THREE.Color().setHSL(0.07, 0.5, 0.25 + Math.random()*0.15);
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMatVar);
    trunkMesh.position.y = trunkHeight / 2; // <-- Ważna zmiana: pivot pnia na dole
    
    const foliageGeometries = [];
    const foliageLevels = 5;
    const foliagePlanesPerLevel = 7;
    for (let i = 0; i < foliageLevels; i++) {
        const levelY = trunkHeight * (0.4 + (i / foliageLevels) * 0.6);
        const levelRadius = (1 - (levelY / trunkHeight)) * trunkHeight * 0.8;
        for (let j = 0; j < foliagePlanesPerLevel; j++) {
            const planeSize = levelRadius * (1.2 + Math.random() * 0.5);
            const foliagePlane = new THREE.PlaneGeometry(planeSize, planeSize);
            const matrix = new THREE.Matrix4();
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * levelRadius * 0.5,
                levelY,
                (Math.random() - 0.5) * levelRadius * 0.5
            );
            const rotation = new THREE.Euler(
                (Math.random() - 0.5) * Math.PI * 0.5,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * Math.PI * 0.5
            );
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
            foliagePlane.applyMatrix4(matrix);
            foliageGeometries.push(foliagePlane);
        }
    }
    const foliageGeometry = BufferGeometryUtils.mergeGeometries(foliageGeometries);
    const foliageMesh = new THREE.Mesh(foliageGeometry, foliageMaterial);

    treeGroup.add(trunkMesh);
    treeGroup.add(foliageMesh);
    return treeGroup;
}

// === NOWE KORONY I TYPY DRZEW ===
const LEAF_COLORS = [0x5a9447, 0x4e8a3b, 0x6aa84f, 0x3c6b4b, 0x7fb26f];

function noisySphere(radius, detail = 2, strength = 0.25) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const nx = (Math.random() - 0.5) * strength;
        const ny = (Math.random() - 0.5) * strength;
        const nz = (Math.random() - 0.5) * strength;
        pos.setXYZ(i, pos.getX(i) + nx, pos.getY(i) + ny, pos.getZ(i) + nz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
}

function createRoundDeciduousTree() {
    const group = new THREE.Group();
    const h = 7 + Math.random() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + Math.random()*0.3, 0.4 + Math.random()*0.3, h, 12), trunkMaterial.clone());
    trunk.material.color = new THREE.Color().setHSL(0.08, 0.5, 0.28 + Math.random()*0.18);
    trunk.position.y = h / 2;
    group.add(trunk);
    const mat = new THREE.MeshLambertMaterial({ color: LEAF_COLORS[Math.floor(Math.random()*LEAF_COLORS.length)] });
    const crown = new THREE.Mesh(noisySphere(3 + Math.random()*1.2, 2, 0.35), mat);
    crown.position.y = h * 0.8;
    group.add(crown);
    return group;
}

function createBoxyDeciduousTree() {
    const group = new THREE.Group();
    const h = 6.5 + Math.random() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 + Math.random()*0.35, 0.38 + Math.random()*0.35, h, 10), trunkMaterial.clone());
    trunk.material.color = new THREE.Color().setHSL(0.07, 0.5, 0.26 + Math.random()*0.2);
    trunk.position.y = h / 2; group.add(trunk);
    const mat = new THREE.MeshLambertMaterial({ color: LEAF_COLORS[Math.floor(Math.random()*LEAF_COLORS.length)] });
    const crown = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const size = 2.2 + Math.random()*1.2;
        const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
        box.position.set((Math.random()-0.5)*1.8, h*0.75 + (Math.random()-0.5)*0.8, (Math.random()-0.5)*1.8);
        crown.add(box);
    }
    group.add(crown);
    return group;
}

function createLowPolyDeciduousTree() {
    const group = new THREE.Group();
    const h = 7 + Math.random()*5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 + Math.random()*0.3, 0.35 + Math.random()*0.3, h, 8), trunkMaterial.clone());
    trunk.material.color = new THREE.Color().setHSL(0.07, 0.5, 0.24 + Math.random()*0.2);
    trunk.position.y = h/2; group.add(trunk);
    const mat = new THREE.MeshLambertMaterial({ color: LEAF_COLORS[Math.floor(Math.random()*LEAF_COLORS.length)] });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + Math.random()*1.0), mat);
    crown.position.y = h*0.78; group.add(crown);
    return group;
}

function createConiferStackedCones() {
    const group = new THREE.Group();
    const h = 9 + Math.random()*7;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + Math.random()*0.3, 0.45 + Math.random()*0.35, h, 10), trunkMaterial.clone());
    trunk.material.color = new THREE.Color().setHSL(0.07, 0.5, 0.24 + Math.random()*0.2);
    trunk.position.y = h/2; group.add(trunk);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3c6b4b });
    const tiers = 6 + Math.floor(Math.random()*3);
    for(let i=0;i<tiers;i++){
        const r = (tiers - i) * 1.1;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, r*1.2, 16), mat);
        cone.position.y = h*0.25 + i*(h*0.07);
        group.add(cone);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), mat); tip.position.y = h*0.95; group.add(tip);
    return group;
}

function createCypressSlim() {
    const group = new THREE.Group();
    const h = 10 + Math.random()*8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 + Math.random()*0.2, 0.27 + Math.random()*0.2, h, 8), trunkMaterial.clone());
    trunk.material.color = new THREE.Color().setHSL(0.07, 0.5, 0.22 + Math.random()*0.18);
    trunk.position.y = h/2; group.add(trunk);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2e6b3f });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, h*0.95, 18), mat);
    cone.position.y = h*0.55; group.add(cone);
    return group;
}

function createPalmModern() {
    const group = new THREE.Group();
    const h = 11 + Math.random()*7;
    const trunkGeo = new THREE.CylinderGeometry(0.22 + Math.random()*0.15, 0.4 + Math.random()*0.2, h, 10, 12, true);
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMaterial.clone());
    trunkMesh.material.color = new THREE.Color().setHSL(0.08, 0.5, 0.28 + Math.random()*0.18);
    trunkMesh.position.y = h/2; group.add(trunkMesh);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fa168 });
    for(let i=0;i<10;i++){
        const leafGeo = new THREE.PlaneGeometry(6.5, 1.2, 12, 1);
        const p = leafGeo.attributes.position;
        for(let v=0; v<p.count; v++){
            const x = p.getX(v);
            p.setZ(v, Math.sin((x/6.5)*Math.PI)*0.9);
        }
        p.needsUpdate = true;
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(0, h-0.5, 0);
        leaf.rotation.y = (i/10)*Math.PI*2;
        leaf.rotation.x = -Math.PI/3;
        group.add(leaf);
    }
    return group;
}

const TREE_TYPES = [
    createBeautifulPineTreeMesh,
    createConiferStackedCones,
    createRoundDeciduousTree,
    createBoxyDeciduousTree,
    createLowPolyDeciduousTree,
    createCypressSlim,
    createPalmModern
];


function createRockGeometry(radius, detail) {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const positionAttribute = geometry.getAttribute('position');
    for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        const noise = 0.2 + Math.random() * 0.8;
        vertex.multiplyScalar(noise);
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function createGrassClump() {
    const clump = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
        color: 0x558f44,
        alphaMap: createGrassAlphaMap(),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), material);
        blade.rotation.y = Math.random() * Math.PI;
        blade.position.y = 0.75;
        clump.add(blade);
    }
    return clump;
}

function createGrassAlphaMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(0.3, 'white');
    gradient.addColorStop(1, 'black');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(32, 64);
    ctx.quadraticCurveTo(10, 30, 32, 0);
    ctx.quadraticCurveTo(54, 30, 32, 64);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

// --- GŁÓWNA FUNKCJA EKSPORTOWANA ---

export function createEnvironment(scene, terrainParams, gameState, aimables) {
    console.log("Tworzenie zsynchronizowanego, dynamicznego otoczenia...");

    const createdObjects = {
        trees: {},
        rocks: {},
        grass: null
    };

    // === 1. Generowanie Lasu z Pojedynczych, Unikalnych Drzew ===
    if (gameState.trees) {
        gameState.trees.forEach(treeData => {
            const typeIndex = (typeof treeData.type === 'number' && treeData.type >=0 && treeData.type < TREE_TYPES.length)
                ? treeData.type
                : (treeData.id % TREE_TYPES.length);
            const treeMesh = TREE_TYPES[typeIndex]();
            treeMesh.position.set(treeData.position.x, treeData.position.y, treeData.position.z);
            treeMesh.rotation.y = treeData.rotationY;
            treeMesh.scale.set(treeData.scale, treeData.scale, treeData.scale);
            treeMesh.castShadow = true;
            scene.add(treeMesh);
            aimables.push(treeMesh); // Dodajemy drzewa do celów
            createdObjects.trees[treeData.id] = treeMesh;
        });
    }

    // === 2. Generowanie Wielkich Głazów (zgodnie z danymi z serwera) ===
    if (gameState.rocks) {
        const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x778899 });
        gameState.rocks.forEach(rockData => {
            const rockGeo = createRockGeometry(rockData.radius, rockData.detail);
            const rockMesh = new THREE.Mesh(rockGeo, rockMaterial);
            rockMesh.castShadow = true;
            rockMesh.position.set(rockData.position.x, rockData.position.y, rockData.position.z);
            rockMesh.rotation.set(rockData.rotation.x, rockData.rotation.y, rockData.rotation.z);
            scene.add(rockMesh);
            aimables.push(rockMesh); // Dodajemy skały do celów
            createdObjects.rocks[rockData.id] = rockMesh;
        });
    }

    // === 3. Generowanie GĘSTEJ, ANIMOWANEJ Trawy (InstancedMesh z ShaderMaterial) ===
    const GRASS_COUNT = 40000;
    const { size, sandyAreaRadius } = terrainParams;
    const dummy = new THREE.Object3D();

    const grassGeometries = [];
    createGrassClump().children.forEach(mesh => {
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrix);
        grassGeometries.push(geo);
    });
    const grassClumpGeo = BufferGeometryUtils.mergeGeometries(grassGeometries);
    
    const vertexShader = `
        uniform float time;
        varying vec2 vUv;
        void main() {
            vUv = uv;
            vec3 pos = position;
            if (pos.y > 0.1) {
                pos.x += sin(time * 0.8 + instanceMatrix[3][0] * 0.1) * 0.15;
                pos.z += cos(time * 0.6 + instanceMatrix[3][2] * 0.1) * 0.15;
            }
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
        }
    `;
    const fragmentShader = `
        uniform sampler2D alphaMap;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
            float alpha = texture2D(alphaMap, vUv).r;
            if (alpha < 0.1) discard;
            gl_FragColor = vec4(color, alpha);
        }
    `;

    const grassMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            alphaMap: { value: createGrassAlphaMap() },
            color: { value: new THREE.Color(0x5a9447) }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const grassInstancedMesh = new THREE.InstancedMesh(grassClumpGeo, grassMaterial, GRASS_COUNT);
    let grassPlaced = 0;
    for (let i = 0; i < GRASS_COUNT; i++) {
        let x = (Math.random() - 0.5) * size;
        let z = (Math.random() - 0.5) * size;
        const distFromCenter = Math.sqrt(x * x + z * z);
        const slope = 0; // Pomijamy slope, bo nie mamy tu dostępu do pełnej mapy
        if (distFromCenter > sandyAreaRadius && slope < 0.7) {
            const y = getHeightAt(x, z, gameState.heightMap, terrainParams);
            const scale = 0.7 + Math.random() * 0.6;
            dummy.position.set(x, y, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            grassInstancedMesh.setMatrixAt(grassPlaced++, dummy.matrix);
        }
    }
    grassInstancedMesh.count = grassPlaced;
    scene.add(grassInstancedMesh);
    createdObjects.grass = grassInstancedMesh;

    console.log(`Otoczenie stworzone! Dodano ${Object.keys(createdObjects.trees).length} drzew, ${Object.keys(createdObjects.rocks).length} głazów i ${grassPlaced} kęp trawy.`);
    
    return createdObjects;
}