// background.js
// Ten plik zawiera logikę do generowania tła typu Skybox (sześcian z teksturami).

import * as THREE from 'three';

/**
 * Tworzy i ustawia tło sceny przy użyciu techniki Skybox.
 * Skybox wykorzystuje 6 oddzielnych obrazów do stworzenia iluzji otoczenia.
 * @param {THREE.Scene} scene - Główna scena gry.
 */
export function createSkyboxBackground(scene) {
    // --- POCZĄTEK MODYFIKACJI ---

    // 1. ZDEFINIUJ ZAKRES LOSOWANIA
    // Ustaw minimalny i maksymalny numer folderu, który chcesz losować.
    // Jeśli masz foldery od 'penguins (1)' do 'penguins (8)', ustaw min = 1 i max = 8.
    const min = 1;
    const max = 45; // Zmień tę wartość, jeśli masz więcej folderów

    // 2. WYLOSUJ LICZBĘ
    // Ta linia losuje liczbę całkowitą z podanego wyżej zakresu (włącznie z min i max).
    const losowaLiczba = Math.floor(Math.random() * (max - min + 1)) + min;

    console.log(`Wylosowano folder: assets/penguins (${losowaLiczba})/`);

    // 3. UŻYJ WYLOSOWANEJ LICZBY W ŚCIEŻCE
    // Używamy "template literals" (znaków ``), aby wstawić zmienną do tekstu.
    // const sciezkaDoFolderu = `assets/penguins (${losowaLiczba})/`;
    const sciezkaDoFolderu = `assets/penguins (${losowaLiczba})/`;
    
    // --- KONIEC MODYFIKACJI ---

    const loader = new THREE.CubeTextureLoader();
    
    // Ustaw ścieżkę do folderu z teksturami, używając wylosowanej liczby.
    const texture = loader.setPath(sciezkaDoFolderu).load(
        [
                'ft.jpg', // Przednia ściana
                'bk.jpg',  // Tylna ściana
                'up.jpg', // Górna ściana
                'dn.jpg', // Dolna ściana
                'rt.jpg', // Prawa ściana
                'lf.jpg' // Lewa ściana
                

                
        ],
        // Funkcja wywoływana po pomyślnym załadowaniu
        () => {
            console.log("Tekstury Skybox załadowane pomyślnie.");
        },
        // onProgress callback, niepotrzebny
        undefined, 
        // Funkcja wywoływana w przypadku błędu
        (error) => {
            console.error(`Błąd podczas ładowania tekstur Skybox ze ścieżki: ${sciezkaDoFolderu}`, error);
            // Awaryjny powrót do prostego koloru w razie błędu
            scene.background = new THREE.Color(0x1a2a3a); // Ciemnoniebieski
        }
    );

    // Ustawienie załadowanej tekstury jako tło całej sceny.
    // Jest to bardziej wydajne niż tworzenie ręcznie sześcianu.
    scene.background = texture;
}