const fs = require('fs');
const path = require('path');

// Definiujemy główny katalog, w którym znajduje się skrypt.
// Możesz też podać konkretną ścieżkę, np. 'C:/Users/TwojaNazwa/Desktop/folder_z_pingwinami'
const glownyKatalog = '.'; 

console.log(`Rozpoczynam przeszukiwanie katalogu: ${path.resolve(glownyKatalog)}`);

// Odczytujemy zawartość głównego katalogu
fs.readdir(glownyKatalog, { withFileTypes: true }, (err, pliki) => {
    if (err) {
        return console.error('Nie udało się odczytać katalogu:', err);
    }

    // Filtrujemy, aby znaleźć tylko podfoldery
    const podfoldery = pliki.filter(plik => plik.isDirectory());

    // Przechodzimy przez każdy podfolder
    podfoldery.forEach(folder => {
        const sciezkaFolderu = path.join(glownyKatalog, folder.name);
        
        // Odczytujemy pliki wewnątrz podfolderu
        fs.readdir(sciezkaFolderu, (err, plikiWFolderze) => {
            if (err) {
                return console.error(`Nie udało się odczytać podfolderu ${folder.name}:`, err);
            }

            console.log(`\n--- Przetwarzam folder: ${folder.name} ---`);

            plikiWFolderze.forEach(nazwaPliku => {
                // Interesują nas tylko pliki .jpg, które zawierają znak "_"
                if (path.extname(nazwaPliku).toLowerCase() === '.jpg' && nazwaPliku.includes('_')) {
                    
                    const staraSciezka = path.join(sciezkaFolderu, nazwaPliku);
                    const czesciNazwy = nazwaPliku.split('_');

                    // Sprawdzamy, czy nazwa ma format "coś_reszta.jpg"
                    if (czesciNazwy.length > 1) {
                        // Bierzemy drugą część nazwy
                        const nowaNazwaPliku = czesciNazwy.slice(1).join('_');
                        const nowaSciezka = path.join(sciezkaFolderu, nowaNazwaPliku);

                        // Zmieniamy nazwę pliku
                        fs.rename(staraSciezka, nowaSciezka, err => {
                            if (err) {
                                console.error(`BŁĄD przy zmianie nazwy ${nazwaPliku}:`, err);
                            } else {
                                console.log(`Zmieniono: ${nazwaPliku} -> ${nowaNazwaPliku}`);
                            }
                        });
                    }
                }
            });
        });
    });
});