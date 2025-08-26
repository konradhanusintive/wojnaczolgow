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
    return new THREE.CanvasTexture(canvas);
}

// Zoptymalizowane materiały, tworzone raz
const trunkMaterial = new THREE.MeshLambertMaterial({ map: createBarkCanvasTexture() });
const foliageMaterial = new THREE.MeshLambertMaterial({
    map: createFoliageCanvasTexture(),
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide
});

function createBeautifulPineTreeMesh() {
    const treeGroup = new THREE.Group();
    const trunkHeight = 8 + Math.random() * 7;
    const trunkRadius = 0.3 + Math.random() * 0.4;
    
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 10);
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
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
            const treeMesh = createBeautifulPineTreeMesh();
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