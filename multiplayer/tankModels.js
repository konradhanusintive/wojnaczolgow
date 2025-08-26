// tankModels.js
// Ten plik zawiera definicje modeli 3D dla różnych typów czołgów.

import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// --- STAŁE I MATERIAŁY WSPÓLNE DLA CZOŁGÓW ---
// Zmodyfikowano, aby zawsze przypisywać nazwę materiałowi
export const LAMBERT_MATERIAL = (color, matName = 'defaultLambert') => new THREE.MeshLambertMaterial({ color, name: matName });

function createTrackTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
      console.error("Failed to get 2D context for track texture canvas.");
      return null; // Zwróć null, jeśli kontekst nie został uzyskany
  }
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 32, 128);
  ctx.fillStyle = "#2a2a2a";
  for (let i = 0; i < 128; i += 8) {
    ctx.fillRect(0, i, 32, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Zmieniono na funkcję zwracającą singleton, z fallbackiem
let _trackMaterialInstance = null;
export const trackMaterial = () => {
    if (!_trackMaterialInstance) {
        const texture = createTrackTexture();
        if (texture) {
            _trackMaterialInstance = new THREE.MeshLambertMaterial({ map: texture, name: 'trackMaterial' });
        } else {
            console.error("Failed to create track texture. Using fallback material for tracks.");
            _trackMaterialInstance = new THREE.MeshLambertMaterial({ color: 0x3a3a3a, name: 'fallbackTrackMaterial' }); // Fallback material
        }
    }
    return _trackMaterialInstance;
};


// --- FUNKCJE TWORZĄCE MODELE CZOŁGÓW ---

/**
 * Tworzy siatkę 3D dla standardowego czołgu. (USA: M4 Sherman)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createStandardTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'shermanHull');

    const hullWidth = 5.5, hullHeight = 1.8, hullLength = 9.0;
    
    // Główny kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength - 2), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Glacis (przednia płyta)
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight * 1.2, 2.5), hullMaterial);
    glacis.position.set(0, hullHeight / 2 - 0.2, -hullLength / 2 + 0.5);
    glacis.rotation.x = -Math.PI / 6;
    hullGroup.add(glacis);

    // Gąsienice
    const trackWidth = 1.2, trackHeight = 2.4, trackLength = hullLength + 1;
    const trackGroup = new THREE.Group();
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial()); // Użyj funkcji
    const rightTrack = leftTrack.clone();
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    trackGroup.add(leftTrack, rightTrack);
    
    tank.add(hullGroup);

    // Wieża (convex geometry dla bardziej złożonego kształtu)
    const turretPoints = [
        new THREE.Vector3(2, 0, 2),
        new THREE.Vector3(2, 0, -2.5),
        new THREE.Vector3(-2, 0, -2.5),
        new THREE.Vector3(-2, 0, 2),
        new THREE.Vector3(1.5, 2, 1.5),
        new THREE.Vector3(1.5, 2, -2),
        new THREE.Vector3(-1.5, 2, -2),
        new THREE.Vector3(-1.5, 2, 1.5)
    ];
    turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'shermanTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1), LAMBERT_MATERIAL(0x444444, 'shermanMantlet')));
    mantlet.position.set(0, 0.8, -2.5);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 6, 12), LAMBERT_MATERIAL(0x333333, 'shermanBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 1;

    hullGroup.add(turretGroup);

    // Punkt wylotu spalin
    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, (hullLength - 2) / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup; // Referencja do grupy kadłuba
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu PL-01 Concept. (Polska)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createPL01Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'pl01Hull');

    const hullWidth = 6.0, hullHeight = 1.5, hullLength = 9.5;
    
    // Główny kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.8, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Panele boczne (stealth look)
    const sidePanelGeom = new THREE.BoxGeometry(0.5, hullHeight * 1.5, hullLength);
    const leftPanel = new THREE.Mesh(sidePanelGeom, hullMaterial);
    leftPanel.position.set(-hullWidth / 2, hullHeight / 2, 0);
    leftPanel.rotation.z = 0.5;
    hullGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(sidePanelGeom, hullMaterial);
    rightPanel.position.set(hullWidth / 2, hullHeight / 2, 0);
    rightPanel.rotation.z = -0.5;
    hullGroup.add(rightPanel);

    tank.add(hullGroup);

    // Gąsienice (bardziej schowane)
    const trackWidth = 1.0, trackHeight = 1.8, trackLength = hullLength + 1;
    const trackGroup = new THREE.Group();
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 + 0.5;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 - 0.5;
    trackGroup.add(leftTrack, rightTrack);
    trackGroup.position.y = trackHeight / 2 - 0.5;
    hullGroup.add(trackGroup);

    // Wieża (bardziej płaska, futurystyczna)
    const turretPoints = [
        new THREE.Vector3(2.5, 0, 3),
        new THREE.Vector3(2.5, 0, -3),
        new THREE.Vector3(-2.5, 0, -3),
        new THREE.Vector3(-2.5, 0, 3),
        new THREE.Vector3(0, 1.8, 2.5),
        new THREE.Vector3(0, 1.8, -2.5)
    ];
    turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'pl01Turret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.5), LAMBERT_MATERIAL(0x444444, 'pl01Mantlet')));
    mantlet.position.set(0, 0.6, -2.8);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 7), LAMBERT_MATERIAL(0x333333, 'pl01Barrel'));
    barrel.position.z = 3.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 0, 3.5);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight;
    hullGroup.add(turretGroup);

    // Punkt wylotu spalin
    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.7, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu M1 Abrams. (USA - Premium)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createAbramsTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'abramsHull');

    const hullWidth = 6.5, hullHeight = 2.0, hullLength = 10.0;
    
    // Główny kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.7, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.4, trackHeight = 2.0, trackLength = hullLength;
    const trackGroup = new THREE.Group();
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 + 0.8;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 - 0.8;
    trackGroup.add(leftTrack, rightTrack);
    trackGroup.position.y = trackHeight / 2 - 0.6;
    hullGroup.add(trackGroup);

    tank.add(hullGroup);

    // Wieża (bardziej zaokrąglona i masywna)
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 1.0, 8), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'abramsTurretBase'));
    turretBase.position.y = 0.5; // Lekko podniesiona, żeby była nad kadłubem
    turretGroup.add(turretBase);
    
    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 6.0), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'abramsTurretTop'));
    turretTop.position.y = 1.1;
    turretGroup.add(turretTop);

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1.5), LAMBERT_MATERIAL(0x444444, 'abramsMantlet')));
    mantlet.position.set(0, 0.5, -3.0);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 8, 12), LAMBERT_MATERIAL(0x333333, 'abramsBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 4;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 4, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight;
    hullGroup.add(turretGroup);

    // Punkt wylotu spalin
    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.5, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}


// === NOWE MODELE CZOŁGÓW ===

/**
 * Tworzy siatkę 3D dla czołgu Tiger I. (Niemcy)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createTigerITank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'tigerHull');

    const hullWidth = 7.0, hullHeight = 2.2, hullLength = 11.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.8, trackHeight = 2.5, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);
    
    tank.add(hullGroup);

    // Wieża (kwadratowa)
    const turretGeometry = new THREE.BoxGeometry(4.5, 2.5, 4.5);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'tigerTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), LAMBERT_MATERIAL(0x444444, 'tigerMantlet')));
    mantlet.position.set(0, 0.5, -2.5);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 7, 12), LAMBERT_MATERIAL(0x333333, 'tigerBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.5, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu T-34-85. (ZSRR)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createT3485Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 't34Hull');

    const hullWidth = 5.0, hullHeight = 1.7, hullLength = 9.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.1, trackHeight = 2.0, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (zaokrąglona)
    const turretGeometry = new THREE.CylinderGeometry(2.5, 2.0, 1.8, 16, 1, false, 0, Math.PI * 2);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 't34Turret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1), LAMBERT_MATERIAL(0x444444, 't34Mantlet')));
    mantlet.position.set(0, 0.5, -2.0);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 6, 12), LAMBERT_MATERIAL(0x333333, 't34Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Cromwell. (Wielka Brytania)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createCromwellTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'cromwellHull');

    const hullWidth = 4.8, hullHeight = 1.6, hullLength = 8.5;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.0, trackHeight = 1.8, trackLength = hullLength + 0.5;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża
    const turretGeometry = new THREE.BoxGeometry(2.8, 1.8, 3.0);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'cromwellTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.8), LAMBERT_MATERIAL(0x444444, 'cromwellMantlet')));
    mantlet.position.set(0, 0.4, -1.8);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 5, 10), LAMBERT_MATERIAL(0x333333, 'cromwellBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.5, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu AMX 13 75. (Francja)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createAMX1375Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group(); // Wieża oscylacyjna będzie ruchoma w całości
    const hullMaterial = LAMBERT_MATERIAL(color, 'amx13Hull');

    const hullWidth = 4.0, hullHeight = 1.2, hullLength = 7.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 0.9, trackHeight = 1.5, trackLength = hullLength + 0.5;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża oscylacyjna (uproszczony model)
    const lowerTurret = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.8, 12), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'amx13LowerTurret'));
    lowerTurret.position.y = 0.4; // Zmieniono na 0.4, aby była bliżej "ziemi"
    turretGroup.add(lowerTurret);

    const upperTurretPoints = [
        new THREE.Vector3(1.2, 0, 1.5), new THREE.Vector3(1.2, 0, -2.0),
        new THREE.Vector3(-1.2, 0, -2.0), new THREE.Vector3(-1.2, 0, 1.5),
        new THREE.Vector3(0.8, 1.0, 1.0), new THREE.Vector3(0.8, 1.0, -1.5),
        new THREE.Vector3(-0.8, 1.0, -1.5), new THREE.Vector3(-0.8, 1.0, 1.0)
    ];
    const upperTurret = new THREE.Mesh(new ConvexGeometry(upperTurretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.15), 'amx13UpperTurret'));
    upperTurret.position.y = 0.8; // w relacji do dolnej części wieży
    turretGroup.add(upperTurret);
    
    // Lufa jest częścią ruchomej górnej części wieży, nie ma osobnego jarzma
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 4.5, 8), LAMBERT_MATERIAL(0x333333, 'amx13Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.8, 2.2); // W relacji do górnej części wieży
    upperTurret.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.25, 0); // W relacji do lufy
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1; // Cała wieża jest ruchoma
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup; // Cała grupa wieży jest obiektem obrotu
    tank.mantlet = upperTurret; // Użyjemy górnej części wieży jako "mantlet" dla uproszczenia obrotu X
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Type 59. (Chiny)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createType59Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'type59Hull');

    const hullWidth = 5.8, hullHeight = 1.9, hullLength = 9.5;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.2, trackHeight = 2.2, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (zaokrąglona, "garbaty" kształt T-54)
    const turretGeometry = new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const turretTop = new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'type59Turret'));
    turretTop.rotation.x = Math.PI / 2; // Obrót, aby podstawa była płaska
    turretTop.position.y = 0.5; // Delikatnie podniesiona
    turretGroup.add(turretTop);

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.0), LAMBERT_MATERIAL(0x444444, 'type59Mantlet')));
    mantlet.position.set(0, 0.4, -2.2);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 6.5, 12), LAMBERT_MATERIAL(0x333333, 'type59Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.25;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.25, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Chi-Ha. (Japonia)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createChiHaTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'chihaHull');

    const hullWidth = 4.5, hullHeight = 1.5, hullLength = 7.5;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 0.9, trackHeight = 1.6, trackLength = hullLength + 0.5;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (cylindryczna)
    const turretGeometry = new THREE.CylinderGeometry(2.0, 2.0, 1.5, 12);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'chihaTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.7), LAMBERT_MATERIAL(0x444444, 'chihaMantlet')));
    mantlet.position.set(0, 0.3, -1.2);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 4.0, 8), LAMBERT_MATERIAL(0x333333, 'chihaBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.0;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.0, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Strv 103B. (Szwecja)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createStrv103BTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group(); // W Strv 103B cały kadłub jest ruchomy góra-dół
    const hullMaterial = LAMBERT_MATERIAL(color, 'strvHull');

    const hullWidth = 6.0, hullHeight = 1.5, hullLength = 10.0;

    // Kadłub (niska sylwetka, klinowy przód)
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    const frontWedgePoints = [
        new THREE.Vector3(-hullWidth / 2, 0, -hullLength / 2),
        new THREE.Vector3(hullWidth / 2, 0, -hullLength / 2),
        new THREE.Vector3(hullWidth / 2 * 0.8, hullHeight * 0.8, -hullLength / 2 + 3),
        new THREE.Vector3(-hullWidth / 2 * 0.8, hullHeight * 0.8, -hullLength / 2 + 3),
        new THREE.Vector3(-hullWidth / 2, 0, hullLength / 2), // tył
        new THREE.Vector3(hullWidth / 2, 0, hullLength / 2),  // tył
        new THREE.Vector3(hullWidth / 2 * 0.8, hullHeight * 0.8, hullLength / 2 - 3), // tył góra
        new THREE.Vector3(-hullWidth / 2 * 0.8, hullHeight * 0.8, hullLength / 2 - 3) // tył góra
    ];
    // Zbudujmy uproszczony kadłub z ConvexGeometry, żeby oddać kształt.
    const customHull = new THREE.Mesh(new ConvexGeometry(frontWedgePoints), hullMaterial);
    customHull.position.y = hullHeight / 2; // Ustawienie na wysokości
    // Usuwamy mainHull, bo customHull go zastępuje
    hullGroup.remove(mainHull);
    hullGroup.add(customHull);


    // Gąsienice
    const trackWidth = 1.3, trackHeight = 1.8, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Lufa jest sztywno zamontowana w kadłubie, nie ma wieży ani jarzma
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 7.0, 12), LAMBERT_MATERIAL(0x333333, 'strvBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, hullHeight * 0.5 + 0.3, -hullLength / 2 + 3.5); // Lufa z przodu kadłuba
    hullGroup.add(barrel); // Lufa jest częścią hullGroup

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.5, 0);
    barrel.add(barrelTip);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = new THREE.Group(); // Pusta grupa na wieżę, bo jej nie ma
    tank.mantlet = new THREE.Group(); // Pusta grupa na jarzmo
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu P40. (Włochy)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createP40Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'p40Hull');

    const hullWidth = 5.2, hullHeight = 1.8, hullLength = 8.8;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.1, trackHeight = 2.0, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (kanciasta)
    const turretGeometry = new THREE.BoxGeometry(3.0, 2.0, 3.5);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'p40Turret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.8), LAMBERT_MATERIAL(0x444444, 'p40Mantlet')));
    mantlet.position.set(0, 0.4, -2.0);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 5.5, 10), LAMBERT_MATERIAL(0x333333, 'p40Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.75;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.75, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Škoda T 25. (Czechosłowacja)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createSkodaT25Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'skodaHull');

    const hullWidth = 4.8, hullHeight = 1.7, hullLength = 8.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.0, trackHeight = 1.8, trackLength = hullLength + 0.8;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (zaokrąglona, z załadowaniem automatycznym)
    const turretGeometry = new THREE.CylinderGeometry(2.2, 1.8, 1.6, 16);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'skodaTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.8), LAMBERT_MATERIAL(0x444444, 'skodaMantlet')));
    mantlet.position.set(0, 0.4, -1.5);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 5.0, 10), LAMBERT_MATERIAL(0x333333, 'skodaBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.5, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Ram II. (Kanada)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createRamIITank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'ramIIHull');

    const hullWidth = 5.6, hullHeight = 2.0, hullLength = 8.5;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.3, trackHeight = 2.2, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (okrągła, niski profil)
    const turretGeometry = new THREE.CylinderGeometry(2.5, 2.5, 1.2, 24);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'ramIITurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.8), LAMBERT_MATERIAL(0x444444, 'ramIIMantlet')));
    mantlet.position.set(0, 0.3, -1.8);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 5.8, 12), LAMBERT_MATERIAL(0x333333, 'ramIIBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.9;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.9, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Sentinel AC 1. (Australia)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createSentinelAC1Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'sentinelHull');

    const hullWidth = 5.3, hullHeight = 1.9, hullLength = 8.7;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.1, trackHeight = 2.1, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (odlewana, zaokrąglona)
    const turretGeometry = new THREE.SphereGeometry(2.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const turretTop = new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'sentinelTurret'));
    turretTop.rotation.x = Math.PI / 2;
    turretTop.position.y = 0.5;
    turretGroup.add(turretTop);

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.8), LAMBERT_MATERIAL(0x444444, 'sentinelMantlet')));
    mantlet.position.set(0, 0.4, -2.0);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 5.5, 10), LAMBERT_MATERIAL(0x333333, 'sentinelBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.75;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.75, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Turán III. (Węgry)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createTuranIIITank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'turanIIIHull');

    const hullWidth = 5.0, hullHeight = 1.7, hullLength = 8.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.0, trackHeight = 1.9, trackLength = hullLength + 0.8;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (duża, lekko zaokrąglona)
    const turretGeometry = new THREE.CylinderGeometry(2.3, 2.0, 1.7, 16);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'turanIIITurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.8), LAMBERT_MATERIAL(0x444444, 'turanIIIMantlet')));
    mantlet.position.set(0, 0.4, -1.5);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 5.2, 10), LAMBERT_MATERIAL(0x333333, 'turanIIIBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 2.6;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 2.6, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu BT-42. (Finlandia)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createBT42Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'bt42Hull');

    const hullWidth = 4.2, hullHeight = 1.5, hullLength = 7.0;

    // Kadłub (BT-7)
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 0.8, trackHeight = 1.5, trackLength = hullLength + 0.5;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (duża, zaokrąglona jak haubica)
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.8, 16), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'bt42TurretBase'));
    turretBase.position.y = 0.4; // Zmieniono na 0.4, aby była bliżej "ziemi"
    turretGroup.add(turretBase);

    const turretTopPoints = [
        new THREE.Vector3(2.0, 0, 2.0), new THREE.Vector3(2.0, 0, -2.0),
        new THREE.Vector3(-2.0, 0, -2.0), new THREE.Vector3(-2.0, 0, 2.0),
        new THREE.Vector3(1.5, 1.5, 1.5), new THREE.Vector3(1.5, 1.5, -1.5),
        new THREE.Vector3(-1.5, 1.5, -1.5), new THREE.Vector3(-1.5, 1.5, 1.5)
    ];
    const turretTop = new THREE.Mesh(new ConvexGeometry(turretTopPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.15), 'bt42TurretTop'));
    turretTop.position.y = 0.8;
    turretGroup.add(turretTop);


    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.0), LAMBERT_MATERIAL(0x444444, 'bt42Mantlet')));
    mantlet.position.set(0, 0.5, -1.5);
    turretTop.add(mantlet); // Mantlet jest częścią górnej wieży, nie całej grupy

    // Lufa (krótka haubica)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 3.0, 12), LAMBERT_MATERIAL(0x333333, 'bt42Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.5, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Shot Kal Dalet (Centurion). (Izrael)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createShotKalDaletTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'shotkalHull');

    const hullWidth = 6.0, hullHeight = 2.0, hullLength = 10.0;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.4, trackHeight = 2.2, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (Centurion, odlewana)
    const turretGeometry = new THREE.SphereGeometry(2.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const turretTop = new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'shotkalTurret'));
    turretTop.rotation.x = Math.PI / 2;
    turretTop.position.y = 0.5;
    turretGroup.add(turretTop);

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 1.0), LAMBERT_MATERIAL(0x444444, 'shotkalMantlet')));
    mantlet.position.set(0, 0.5, -2.5);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.33, 7.0, 12), LAMBERT_MATERIAL(0x333333, 'shotkalBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.5;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.5, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Nahuel DL 43. (Argentyna)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createNahuelDL43Tank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'nahuelHull');

    const hullWidth = 5.5, hullHeight = 1.9, hullLength = 9.0;

    // Kadłub (podobny do Shermana)
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.2, trackHeight = 2.1, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (kanciasta)
    const turretGeometry = new THREE.BoxGeometry(3.2, 2.0, 3.5);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'nahuelTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.8), LAMBERT_MATERIAL(0x444444, 'nahuelMantlet')));
    mantlet.position.set(0, 0.4, -2.0);
    turretGroup.add(mantlet);

    // Lufa
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 6.0, 10), LAMBERT_MATERIAL(0x333333, 'nahuelBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.0;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.0, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    turretGroup.position.z = 0;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Ch'ŏnma-ho (T-62). (Korea Północna)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createChonmaHoTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'chonmahoHull');

    const hullWidth = 6.0, hullHeight = 1.8, hullLength = 9.5;

    // Kadłub
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.3, trackHeight = 2.0, trackLength = hullLength + 1;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (duża, okrągła, odlewana - jak w T-62)
    const turretGeometry = new THREE.SphereGeometry(2.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const turretTop = new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'chonmahoTurret'));
    turretTop.rotation.x = Math.PI / 2;
    turretTop.position.y = 0.5;
    turretGroup.add(turretTop);

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.0), LAMBERT_MATERIAL(0x444444, 'chonmahoMantlet')));
    mantlet.position.set(0, 0.4, -2.5);
    turretGroup.add(mantlet);

    // Lufa (długa, potężna)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 7.5, 12), LAMBERT_MATERIAL(0x333333, 'chonmahoBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.75;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.75, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu K2 Black Panther. (Korea Południowa)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createK2BlackPantherTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'k2Hull');

    const hullWidth = 6.8, hullHeight = 2.2, hullLength = 10.5;

    // Kadłub (nowoczesny, kanciasty)
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Gąsienice
    const trackWidth = 1.5, trackHeight = 2.5, trackLength = hullLength + 1.5;
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), trackMaterial());
    leftTrack.position.x = -hullWidth / 2 - trackWidth / 2;
    const rightTrack = leftTrack.clone();
    rightTrack.position.x = hullWidth / 2 + trackWidth / 2;
    hullGroup.add(leftTrack, rightTrack);

    tank.add(hullGroup);

    // Wieża (nowoczesna, kanciasta, niski profil)
    const turretPoints = [
        new THREE.Vector3(3.0, 0, 3.5), new THREE.Vector3(3.0, 0, -3.5),
        new THREE.Vector3(-3.0, 0, -3.5), new THREE.Vector3(-3.0, 0, 3.5),
        new THREE.Vector3(2.5, 1.5, 3.0), new THREE.Vector3(2.5, 1.5, -3.0),
        new THREE.Vector3(-2.5, 1.5, -3.0), new THREE.Vector3(-2.5, 1.5, 3.0),
        new THREE.Vector3(0, 2.0, 2.8), new THREE.Vector3(0, 2.0, -2.8) // Kątowe płyty wieży
    ];
    turretGroup.add(new THREE.Mesh(new ConvexGeometry(turretPoints), LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'k2Turret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.8, 1.2), LAMBERT_MATERIAL(0x444444, 'k2Mantlet')));
    mantlet.position.set(0, 0.6, -3.0);
    turretGroup.add(mantlet);

    // Lufa (długa, potężna)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 8.0, 12), LAMBERT_MATERIAL(0x333333, 'k2Barrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 4.0;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 4.0, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}

/**
 * Tworzy siatkę 3D dla czołgu Rooikat. (Republika Południowej Afryki)
 * @param {THREE.Color} color - Kolor czołgu.
 * @returns {THREE.Group} Grupa reprezentująca model czołgu.
 */
export function createRooikatTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const hullMaterial = LAMBERT_MATERIAL(color, 'rooikatHull');

    const hullWidth = 3.5, hullHeight = 1.5, hullLength = 9.0; // Długi i wąski kadłub, kołowy

    // Kadłub (kołowy pojazd, użyjemy box geometry dla uproszczenia, ale z dużą długością)
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, hullHeight, hullLength), hullMaterial);
    mainHull.position.y = hullHeight / 2;
    hullGroup.add(mainHull);

    // Koła (8x8), dla uproszczenia jako proste cylindry
    const wheelRadius = 1.0;
    const wheelThickness = 0.5;
    const wheelMaterial = LAMBERT_MATERIAL(0x222222, 'rooikatWheel');

    for (let i = 0; i < 4; i++) {
        const wheelOffset = hullLength / 2 - (i * (hullLength / 3)); // Rozłożenie kół
        const leftWheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 12), wheelMaterial);
        leftWheel.rotation.x = Math.PI / 2; // Obrót, aby cylinder był "leżący"
        leftWheel.position.set(-hullWidth / 2 - wheelThickness / 2, -wheelRadius + 0.1, wheelOffset);
        hullGroup.add(leftWheel);

        const rightWheel = leftWheel.clone();
        rightWheel.position.x = hullWidth / 2 + wheelThickness / 2;
        hullGroup.add(rightWheel);
    }
    
    tank.add(hullGroup);

    // Wieża (niska, lekko kanciasta)
    const turretGeometry = new THREE.BoxGeometry(2.5, 1.5, 3.0);
    turretGroup.add(new THREE.Mesh(turretGeometry, LAMBERT_MATERIAL(color.clone().offsetHSL(0, 0, 0.1), 'rooikatTurret')));

    // Jarzmo działa
    const mantlet = new THREE.Group();
    mantlet.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.8), LAMBERT_MATERIAL(0x444444, 'rooikatMantlet')));
    mantlet.position.set(0, 0.4, -1.8);
    turretGroup.add(mantlet);

    // Lufa (długa, armata dużej prędkości)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 6.5, 12), LAMBERT_MATERIAL(0x333333, 'rooikatBarrel'));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 3.25;
    mantlet.add(barrel);

    // Koniec lufy (punkt wylotu pocisku)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 3.25, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = hullHeight + 0.1;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, hullHeight * 0.6, hullLength / 2 - 1.0);
    hullGroup.add(exhaustPoint);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = mantlet;
    tank.barrel = barrel;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = exhaustPoint;

    return tank;
}