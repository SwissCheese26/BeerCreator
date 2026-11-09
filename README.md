# Beer Creator

Bier-Rezept-Rechner als Windows-Desktop-App (Electron). Alle Regler wirken live auf alle Werte.

## Starten
```
npm install
npm start        # App starten
npm test         # Logik-Tests
npm run dist     # Windows-Installer (electron-builder)
```

## Aufbau
- `src/core/data.js` – Malze, Hopfen, Hefen, Bierstile (mit Zielbereichen und Startrezepten)
- `src/core/brew.js` – Brau-Logik (reine Funktionen, ohne UI): Stammwürze ↔ Schüttung, Wasser, IBU (Tinseth), Farbe (Morey), Vergärung, Alkohol, Kalorien, Hefemenge, Warnungen
- `src/ui/` – Oberfläche im Apple-Stil (Hell/Dunkel automatisch)
- `test/` – Tests der Logik

## Was passiert, wenn man die Stammwürze erhöht?
Mehr Malz (bei fester Ausbeute), mehr Hauptguss/Nachguss, höherer Alkohol, mehr Restextrakt/Kalorien,
weniger Hopfenausbeute (IBU sinkt), mehr Hefe nötig, ab 14 °P sinkt der Vergärungsgrad.
