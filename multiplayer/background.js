// background.js
// Ten plik zawiera logikę do generowania tła typu Skydome (sfera z teksturą).

import * as THREE from 'three';

/**
 * Tworzy i dodaje do sceny sferę z panoramiczną teksturą nieba i gór.
 * @param {THREE.Scene} scene - Główna scena gry.
 */
export function createSkydomeBackground(scene) {
    const skyGeometry = new THREE.SphereGeometry(4000, 64, 32);

    const textureLoader = new THREE.TextureLoader();
    const skyTexture = textureLoader.load(
        'https://www.eso.org/public/archives/images/publicationtiff/eso0932a.tif',
        () => {
            console.log("Tekstura Skydome załadowana pomyślnie.");
        },
        undefined, // onProgress callback, niepotrzebny
        (error) => {
            console.error("Błąd podczas ładowania tekstury Skydome:", error);
            // Fallback na prosty kolor w razie błędu
            scene.background = new THREE.Color(0x87CEEB);
        }
    );
    
    const skyMaterial = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide 
    });

    const skydome = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skydome);
}