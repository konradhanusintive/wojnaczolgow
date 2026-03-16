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

/**
 * Tworzy siatkę 3D dla helikoptera szturmowego.
 * @param {THREE.Color} color - Kolor jednostki.
 * @returns {THREE.Group} Grupa reprezentująca model helikoptera.
 */
export function createHelicopter(color) {
    const helicopter = new THREE.Group();
    const hullGroup = new THREE.Group();
    
    const matName = 'heliMat';
    const mainMaterial = LAMBERT_MATERIAL(color, matName);
    const darkMaterial = LAMBERT_MATERIAL(0x333333, 'heliDark');
    const glassMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x88ccff, 
        transparent: true, 
        opacity: 0.6, 
        shininess: 100 
    });

    // --- KADŁUB ---
    const bodyGeom = new THREE.BoxGeometry(2.5, 3.0, 8.0);
    const body = new THREE.Mesh(bodyGeom, mainMaterial);
    body.position.y = 2.0;
    hullGroup.add(body);

    // Kokpit (szyba)
    const cockpitGeom = new THREE.BoxGeometry(2.2, 1.5, 2.5);
    const cockpit = new THREE.Mesh(cockpitGeom, glassMaterial);
    cockpit.position.set(0, 2.5, 4.0); // Z przodu
    cockpit.rotation.x = 0.2;
    hullGroup.add(cockpit);

    // Ogon
    const tailGeom = new THREE.BoxGeometry(1.0, 1.0, 9.0);
    const tail = new THREE.Mesh(tailGeom, mainMaterial);
    tail.position.set(0, 2.5, -6.5);
    hullGroup.add(tail);

    // Płozy
    const skidGeom = new THREE.BoxGeometry(0.5, 0.5, 7.0);
    const leftSkid = new THREE.Mesh(skidGeom, darkMaterial);
    leftSkid.position.set(-1.5, 0.25, 1.0);
    const rightSkid = new THREE.Mesh(skidGeom, darkMaterial);
    rightSkid.position.set(1.5, 0.25, 1.0);
    
    // Nogi płóz
    const legGeom = new THREE.BoxGeometry(0.3, 1.5, 0.3);
    const legFL = new THREE.Mesh(legGeom, darkMaterial); legFL.position.set(-1.5, 1.0, 3.0);
    const legBL = new THREE.Mesh(legGeom, darkMaterial); legBL.position.set(-1.5, 1.0, -1.0);
    const legFR = new THREE.Mesh(legGeom, darkMaterial); legFR.position.set(1.5, 1.0, 3.0);
    const legBR = new THREE.Mesh(legGeom, darkMaterial); legBR.position.set(1.5, 1.0, -1.0);
    
    hullGroup.add(leftSkid, rightSkid, legFL, legBL, legFR, legBR);

    // Wirnik główny
    const rotorGroup = new THREE.Group();
    const bladeGeom = new THREE.BoxGeometry(0.5, 0.1, 14.0);
    const blade1 = new THREE.Mesh(bladeGeom, darkMaterial);
    const blade2 = blade1.clone(); blade2.rotation.y = Math.PI / 2;
    rotorGroup.add(blade1, blade2);
    rotorGroup.position.set(0, 4.0, 0); // Na górze kadłuba
    hullGroup.add(rotorGroup);

    // Wirnik ogonowy
    const tailRotorGroup = new THREE.Group();
    const tailBladeGeom = new THREE.BoxGeometry(0.2, 2.5, 0.2);
    const tailBlade1 = new THREE.Mesh(tailBladeGeom, darkMaterial);
    const tailBlade2 = tailBlade1.clone(); tailBlade2.rotation.x = Math.PI / 2;
    tailRotorGroup.add(tailBlade1, tailBlade2);
    tailRotorGroup.position.set(0.6, 2.5, -10.5); // Na końcu ogona
    hullGroup.add(tailRotorGroup);

    // Pylony na rakiety (boczne skrzydła)
    const wingGeom = new THREE.BoxGeometry(5.0, 0.5, 1.5);
    const wings = new THREE.Mesh(wingGeom, mainMaterial);
    wings.position.set(0, 2.0, 1.0);
    hullGroup.add(wings);

    // Podwieszone wyrzutnie rakiet
    const podGeom = new THREE.CylinderGeometry(0.5, 0.5, 2.0, 8);
    const leftPod = new THREE.Mesh(podGeom, darkMaterial);
    leftPod.rotation.x = Math.PI / 2;
    leftPod.position.set(-2.0, 1.5, 1.5);
    const rightPod = leftPod.clone();
    rightPod.position.set(2.0, 1.5, 1.5);
    hullGroup.add(leftPod, rightPod);

    helicopter.add(hullGroup);

    // Działko pod dziobem (jako turret)
    const turretGroup = new THREE.Group();
    const gunGeom = new THREE.BoxGeometry(0.8, 0.8, 2.0);
    const gunBody = new THREE.Mesh(gunGeom, darkMaterial);
    gunBody.position.set(0, -0.5, 0); // Podwieszone
    turretGroup.add(gunBody);

    // Lufa działka
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.0), darkMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.5, 1.5);
    turretGroup.add(barrel);

    // Punkt wylotu pocisku
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.5, 0); // W lokalnym układzie lufy
    barrel.add(barrelTip);

    // Pozycjonowanie "wieży" (działka)
    turretGroup.position.set(0, 1.5, 4.0); // Pod dziobem
    hullGroup.add(turretGroup);

    // Punkt wylotu spalin (dla efektu dymu przy uszkodzeniu)
    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, 3.0, -2.0);
    hullGroup.add(exhaustPoint);

    // Przypisanie referencji
    helicopter.hullGroup = hullGroup;
    helicopter.turret = turretGroup; // Działko rusza się lewo/prawo
    helicopter.mantlet = new THREE.Group(); // Atrapa, bo działko rusza się całe
    helicopter.barrel = barrel;
    helicopter.barrelTip = barrelTip;
    helicopter.exhaustPoint = exhaustPoint;
    
    // Dodatkowe referencje dla animacji
    helicopter.mainRotor = rotorGroup;
    helicopter.tailRotor = tailRotorGroup;

    return helicopter;
}

/**
 * Tworzy UFO (Latający Spodek).
 */
export function createUFO(color) {
    const ufo = new THREE.Group();
    const hullGroup = new THREE.Group();
    const material = LAMBERT_MATERIAL(0xaaddff, 'ufoSilver'); // Srebrny
    const domeMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8, shininess: 100 });
    const darkMat = LAMBERT_MATERIAL(0x222222, 'ufoDark');

    // Dysk główny
    const diskGeom = new THREE.CylinderGeometry(3.5, 1.5, 1.0, 16);
    const disk = new THREE.Mesh(diskGeom, material);
    hullGroup.add(disk);

    // Pierścień (będzie się kręcił)
    const ringGeom = new THREE.TorusGeometry(3.5, 0.3, 8, 24);
    const ring = new THREE.Mesh(ringGeom, darkMat);
    ring.rotation.x = Math.PI / 2;
    hullGroup.add(ring);

    // Kopuła
    const domeGeom = new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeom, domeMat);
    dome.position.y = 0.5;
    hullGroup.add(dome);

    ufo.add(hullGroup);

    // Działko (pod spodem)
    const turretGroup = new THREE.Group();
    const gunBall = new THREE.Mesh(new THREE.SphereGeometry(0.5), darkMat);
    turretGroup.add(gunBall);
    
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.0;
    turretGroup.add(barrel);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.0, 0);
    barrel.add(barrelTip);

    turretGroup.position.y = -0.5;
    hullGroup.add(turretGroup);

    const exhaustPoint = new THREE.Object3D();
    exhaustPoint.position.set(0, -0.5, 0);
    hullGroup.add(exhaustPoint);

    ufo.hullGroup = hullGroup;
    ufo.turret = turretGroup;
    ufo.mantlet = new THREE.Group();
    ufo.barrel = barrel;
    ufo.barrelTip = barrelTip;
    ufo.exhaustPoint = exhaustPoint;
    ufo.spinRing = ring; // Ref do animacji

    return ufo;
}

/**
 * Tworzy Zeppelin "Iron Whale".
 */
export function createIronWhale(color) {
    const ship = new THREE.Group();
    const hullGroup = new THREE.Group();
    const balloonMat = LAMBERT_MATERIAL(color, 'zeppColor');
    const metalMat = LAMBERT_MATERIAL(0x555555, 'zeppMetal');

    // Balon
    const balloonGeom = new THREE.CylinderGeometry(2.0, 2.0, 9.0, 12);
    const balloon = new THREE.Mesh(balloonGeom, balloonMat);
    balloon.rotation.x = Math.PI / 2;
    hullGroup.add(balloon);

    // Gondola
    const gondolaGeom = new THREE.BoxGeometry(1.5, 1.0, 4.0);
    const gondola = new THREE.Mesh(gondolaGeom, metalMat);
    gondola.position.y = -2.0;
    hullGroup.add(gondola);

    // Stateczniki
    const finGeom = new THREE.BoxGeometry(0.2, 3.0, 2.0);
    const finV = new THREE.Mesh(finGeom, metalMat);
    finV.position.z = -3.5;
    hullGroup.add(finV);
    const finH = finV.clone();
    finH.rotation.z = Math.PI / 2;
    hullGroup.add(finH);

    // Śmigła (boczne)
    const propGroup = new THREE.Group();
    const propBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.2), metalMat);
    propGroup.add(propBlade);
    const propLeft = propGroup.clone(); propLeft.position.set(-2.2, 0, 0);
    const propRight = propGroup.clone(); propRight.position.set(2.2, 0, 0);
    hullGroup.add(propLeft, propRight);

    ship.add(hullGroup);

    // Działko (na dziobie gondoli)
    const turretGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.25;
    turretGroup.add(barrel);
    turretGroup.position.set(0, -2.0, 2.0);
    hullGroup.add(turretGroup);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.25, 0);
    barrel.add(barrelTip);

    ship.hullGroup = hullGroup;
    ship.turret = turretGroup;
    ship.mantlet = new THREE.Group();
    ship.barrel = barrel;
    ship.barrelTip = barrelTip;
    ship.exhaustPoint = propLeft; 
    ship.props = [propLeft, propRight];

    return ship;
}

/**
 * Tworzy Drona "X-Type".
 */
export function createXDrone(color) {
    const drone = new THREE.Group();
    const hullGroup = new THREE.Group();
    const mat = LAMBERT_MATERIAL(color, 'droneMat');
    const dark = LAMBERT_MATERIAL(0x111111, 'droneDark');

    // Korpus centralny
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2.0), mat);
    hullGroup.add(body);

    // Ramiona X
    const armGeom = new THREE.BoxGeometry(0.5, 0.2, 6.0);
    const arm1 = new THREE.Mesh(armGeom, dark);
    arm1.rotation.y = Math.PI / 4;
    hullGroup.add(arm1);
    const arm2 = new THREE.Mesh(armGeom, dark);
    arm2.rotation.y = -Math.PI / 4;
    hullGroup.add(arm2);

    // Wirniki na końcach
    const rotorGeom = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 8);
    const rotors = [];
    [ {x: 2, z: 2}, {x: -2, z: -2}, {x: 2, z: -2}, {x: -2, z: 2} ].forEach(pos => {
        const r = new THREE.Mesh(rotorGeom, LAMBERT_MATERIAL(0x00ffff, 'droneRotor')); // Neonowe
        r.position.set(pos.x, 0.2, pos.z);
        hullGroup.add(r);
        rotors.push(r);
    });

    drone.add(hullGroup);

    // Działko podwieszane
    const turretGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.0), dark);
    barrel.position.z = 1.0;
    turretGroup.add(barrel);
    turretGroup.position.y = -0.5;
    hullGroup.add(turretGroup);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 0, 1.0);
    barrel.add(barrelTip);

    drone.hullGroup = hullGroup;
    drone.turret = turretGroup;
    drone.mantlet = new THREE.Group();
    drone.barrel = barrel;
    drone.barrelTip = barrelTip;
    drone.exhaustPoint = body;
    drone.rotors = rotors;

    return drone;
}

/**
 * Tworzy "Void Glider" (Pustynny Ślizgacz).
 */
export function createVoidGlider(color) {
    const glider = new THREE.Group();
    const hullGroup = new THREE.Group();
    const mat = LAMBERT_MATERIAL(0x330033, 'voidMat'); // Ciemny fiolet
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xaa00aa });

    // Trójkątny kształt
    const shape = new THREE.Shape();
    shape.moveTo(0, 4);
    shape.lineTo(2.5, -2);
    shape.lineTo(0, -1);
    shape.lineTo(-2.5, -2);
    shape.lineTo(0, 4);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.25;
    hullGroup.add(mesh);

    // Kryształ napędowy
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), glowMat);
    crystal.position.set(0, 1.0, -1.0);
    hullGroup.add(crystal);

    glider.add(hullGroup);

    // Działko - lewitująca kula
    const turretGroup = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4), glowMat);
    turretGroup.add(orb);
    turretGroup.position.set(0, -0.5, 3.0);
    hullGroup.add(turretGroup);

    const barrel = new THREE.Object3D(); // Niewidzialna lufa
    barrel.position.z = 1.0;
    turretGroup.add(barrel);
    
    const barrelTip = new THREE.Object3D();
    barrel.add(barrelTip);

    glider.hullGroup = hullGroup;
    glider.turret = turretGroup;
    glider.mantlet = new THREE.Group();
    glider.barrel = barrel;
    glider.barrelTip = barrelTip;
    glider.exhaustPoint = crystal;
    glider.crystal = crystal;

    return glider;
}

/**
 * Tworzy "Ważkę" (Dragonfly Gunship).
 */
export function createDragonfly(color) {
    const fly = new THREE.Group();
    const hullGroup = new THREE.Group();
    const bodyMat = LAMBERT_MATERIAL(color, 'dragonBody');
    const wingMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

    // Ciało - cienkie i długie
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 6.0, 4, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    hullGroup.add(body);

    // Głowa
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9), LAMBERT_MATERIAL(0x000000, 'dragonEyes'));
    head.position.z = 3.2;
    hullGroup.add(head);

    // Skrzydła (4 sztuki)
    const wingGeom = new THREE.PlaneGeometry(5.0, 1.0);
    const wings = [];
    
    const w1 = new THREE.Mesh(wingGeom, wingMat); w1.position.set(2.5, 0.5, 1.5);
    const w2 = new THREE.Mesh(wingGeom, wingMat); w2.position.set(-2.5, 0.5, 1.5);
    const w3 = new THREE.Mesh(wingGeom, wingMat); w3.position.set(2.5, 0.5, -0.5);
    const w4 = new THREE.Mesh(wingGeom, wingMat); w4.position.set(-2.5, 0.5, -0.5);
    
    hullGroup.add(w1, w2, w3, w4);
    wings.push(w1, w2, w3, w4);

    fly.add(hullGroup);

    // Działko pod głową
    const turretGroup = new THREE.Group();
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0), LAMBERT_MATERIAL(0x333333, 'dragonGun'));
    gun.rotation.x = Math.PI / 2;
    gun.position.z = 1.0;
    turretGroup.add(gun);
    turretGroup.position.set(0, -0.8, 2.5);
    hullGroup.add(turretGroup);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.0, 0);
    gun.add(barrelTip);

    fly.hullGroup = hullGroup;
    fly.turret = turretGroup;
    fly.mantlet = new THREE.Group();
    fly.barrel = gun;
    fly.barrelTip = barrelTip;
    fly.exhaustPoint = new THREE.Object3D();
    fly.wings = wings;

    return fly;
}

/**
 * Tworzy Sześcian Bojowy (The Brick).
 */
export function createBattleCube(color) {
    const cube = new THREE.Group();
    const hullGroup = new THREE.Group();
    const mat = LAMBERT_MATERIAL(color, 'cubeMat');
    const detailMat = LAMBERT_MATERIAL(0x222222, 'cubeDetail');

    // Główny sześcian
    const box = new THREE.Mesh(new THREE.BoxGeometry(4.0, 4.0, 4.0), mat);
    hullGroup.add(box);

    // Detale (małe sześciany na rogach)
    const smallBoxGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const positions = [
        [2,2,2], [2,2,-2], [2,-2,2], [2,-2,-2],
        [-2,2,2], [-2,2,-2], [-2,-2,2], [-2,-2,-2]
    ];
    positions.forEach(p => {
        const b = new THREE.Mesh(smallBoxGeom, detailMat);
        b.position.set(...p);
        hullGroup.add(b);
    });

    cube.add(hullGroup);

    // Działko - oko na środku
    const turretGroup = new THREE.Group();
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 1.0, 4), LAMBERT_MATERIAL(0xff0000, 'cubeEye'));
    eye.rotation.x = -Math.PI / 2;
    turretGroup.add(eye);
    
    // Lufa w oku
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.0), detailMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.5;
    turretGroup.add(barrel);

    turretGroup.position.z = 2.0;
    hullGroup.add(turretGroup);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.5, 0);
    barrel.add(barrelTip);

    cube.hullGroup = hullGroup;
    cube.turret = turretGroup;
    cube.mantlet = new THREE.Group();
    cube.barrel = barrel;
    cube.barrelTip = barrelTip;
    cube.exhaustPoint = new THREE.Object3D();

    return cube;
}

/**
 * Tworzy Mecha Kroczącego "Titan".
 */
export function createWalkerMech(color) {
    const mech = new THREE.Group();
    const hullGroup = new THREE.Group(); // Korpus
    const mat = LAMBERT_MATERIAL(color, 'mechMat');
    const jointMat = LAMBERT_MATERIAL(0x333333, 'mechJoint');

    // Nogi (statyczne dla modelu bazowego)
    const legGeom = new THREE.BoxGeometry(1.0, 3.5, 1.0);
    const footGeom = new THREE.BoxGeometry(1.5, 0.5, 2.0);

    const leftLeg = new THREE.Group();
    const lUpper = new THREE.Mesh(legGeom, mat); lUpper.position.y = 1.75;
    const lFoot = new THREE.Mesh(footGeom, jointMat); lFoot.position.y = 0.25; lFoot.position.z = 0.5;
    leftLeg.add(lUpper, lFoot);
    leftLeg.position.set(-1.5, 0, 0);

    const rightLeg = new THREE.Group();
    const rUpper = new THREE.Mesh(legGeom, mat); rUpper.position.y = 1.75;
    const rFoot = new THREE.Mesh(footGeom, jointMat); rFoot.position.y = 0.25; rFoot.position.z = 0.5;
    rightLeg.add(rUpper, rFoot);
    rightLeg.position.set(1.5, 0, 0);

    hullGroup.add(leftLeg, rightLeg);

    // Miednica
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.0, 2.5), jointMat);
    pelvis.position.y = 3.5;
    hullGroup.add(pelvis);

    mech.add(hullGroup); // Nogi są częścią "hull"

    // Tułów (jako wieża - będzie się obracać)
    const turretGroup = new THREE.Group();
    const torsoGeom = new THREE.BoxGeometry(3.5, 3.0, 3.5);
    const torso = new THREE.Mesh(torsoGeom, mat);
    torso.position.y = 1.5; // Nad miednicą
    turretGroup.add(torso);

    // Kokpit
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.0), LAMBERT_MATERIAL(0x00aaff, 'mechGlass'));
    cockpit.position.set(0, 1.5, 1.8);
    torso.add(cockpit);

    // Ramiona z bronią
    const armGeom = new THREE.BoxGeometry(1.0, 1.0, 4.0);
    const leftArm = new THREE.Mesh(armGeom, mat);
    leftArm.position.set(-2.5, 1.5, 1.0);
    const rightArm = new THREE.Mesh(armGeom, mat);
    rightArm.position.set(2.5, 1.5, 1.0);
    turretGroup.add(leftArm, rightArm);

    // Lufy (na końcach ramion)
    const barrelGeom = new THREE.CylinderGeometry(0.3, 0.3, 2.0);
    const leftBarrel = new THREE.Mesh(barrelGeom, jointMat);
    leftBarrel.rotation.x = Math.PI / 2; leftBarrel.position.set(0, 0, 2.5);
    leftArm.add(leftBarrel);

    const rightBarrel = new THREE.Mesh(barrelGeom, jointMat);
    rightBarrel.rotation.x = Math.PI / 2; rightBarrel.position.set(0, 0, 2.5);
    rightArm.add(rightBarrel);

    turretGroup.position.y = 4.0; // Na szczycie nóg
    hullGroup.add(turretGroup);

    // Punkt wylotu (bierzemy prawą rękę jako główną)
    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 1.0, 0);
    rightBarrel.add(barrelTip);

    mech.hullGroup = hullGroup;
    mech.turret = turretGroup;
    mech.mantlet = new THREE.Group();
    mech.barrel = rightBarrel; 
    mech.barrelTip = barrelTip;
    mech.exhaustPoint = new THREE.Object3D(); // Plecy

    return mech;
}

/**
 * Tworzy Futurystyczny Czołg Poduszkowiec "Wraith".
 */
export function createFutureHoverTank(color) {
    const tank = new THREE.Group();
    const hullGroup = new THREE.Group();
    const turretGroup = new THREE.Group();
    const mat = LAMBERT_MATERIAL(color, 'wraithMat');
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

    // Kadłub - płaski, opływowy
    const hullGeom = new THREE.CylinderGeometry(3.5, 4.5, 1.5, 6);
    const hull = new THREE.Mesh(hullGeom, mat);
    hull.position.y = 1.0;
    hullGroup.add(hull);

    // Silniki antygrawitacyjne
    const hoverPad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 16), glowMat);
    hoverPad.position.set(2.5, 0.2, 2.5);
    hullGroup.add(hoverPad);
    const hp2 = hoverPad.clone(); hp2.position.set(-2.5, 0.2, 2.5); hullGroup.add(hp2);
    const hp3 = hoverPad.clone(); hp3.position.set(2.5, 0.2, -2.5); hullGroup.add(hp3);
    const hp4 = hoverPad.clone(); hp4.position.set(-2.5, 0.2, -2.5); hullGroup.add(hp4);

    tank.add(hullGroup);

    // Wieża - lewitująca kula
    const sphereGeom = new THREE.SphereGeometry(1.8, 32, 32);
    const sphere = new THREE.Mesh(sphereGeom, mat);
    turretGroup.add(sphere);

    // Pierścienie wokół wieży
    const ringGeom = new THREE.TorusGeometry(2.2, 0.1, 8, 32);
    const ring1 = new THREE.Mesh(ringGeom, glowMat);
    ring1.rotation.x = Math.PI / 2;
    turretGroup.add(ring1);

    // Działo energetyczne (railgun)
    const railGeom = new THREE.BoxGeometry(0.8, 0.5, 6.0);
    const rail = new THREE.Mesh(railGeom, LAMBERT_MATERIAL(0x222222, 'wraithRail'));
    rail.position.z = 2.0;
    turretGroup.add(rail);

    // Rdzeń działa
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5.0), glowMat);
    core.position.y = 0;
    rail.add(core);

    turretGroup.position.y = 2.5;
    hullGroup.add(turretGroup);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0, 0, 2.5);
    rail.add(barrelTip);

    tank.hullGroup = hullGroup;
    tank.turret = turretGroup;
    tank.mantlet = new THREE.Group();
    tank.barrel = rail;
    tank.barrelTip = barrelTip;
    tank.exhaustPoint = hull; 

    return tank;
}