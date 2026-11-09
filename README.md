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

## Story- & Sandbox-Modus (Spiel-Logik, Design folgt zuletzt)
Spiel-Engine in `src/game/` (pure Funktionen, JSON-Spielstand, deterministischer Zufall):
- **Story:** Opas Garage → Straßenfest → Gewerbe & Biersteuer → Keller → Landesmeisterschaft → eigene Brauerei. Kapitel mit Zielen, Ereignissen und Entscheidungen mit echten Folgen (`src/game/story.js`).
- **Sandbox:** unbegrenzt Geld/Zutaten, volle Ausrüstung, keine Story – die Qualitäts-Simulation läuft trotzdem.
- **Hopfenformen mit Folgen:** Doldenhopfen (Aroma, altert schnell), Pellets (Standard, lagerstabil), Extrakt (billig, 30 % α, aber kein Aroma und „harte“ Bittere). Alter Hopfen oxidiert und bringt weniger Bittere.
- **Weitere Folgen:** Gärtemperatur (Garage im Sommer/Winter vs. Kühlung), Hefemenge, Hygiene/Infektion, Gärplätze, Kesselgröße, Hobbygrenze 200 L/Jahr, Verkaufsverbot ohne Gewerbe, Biersteuer, Liefervertrag (Extrakt-Exklusivität vs. regionaler Hopfenbauer).

```
npm run game            # Story im Terminal spielen  („hilfe“ zeigt die Befehle)
npm run game:sandbox    # Sandbox im Terminal
npm test                # Logik-, Spiel- und Story-Tests (inkl. Bot, der die Story durchspielt)
```
Steuer- und Rechtsregeln sind für das Spiel vereinfacht.
