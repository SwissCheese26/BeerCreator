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

## Alle Bierarten, Skill-Level, Kosten, Info-Texte
- **22 Bierstile** (`src/core/data.js`): Pils, Helles, Märzen, Weizen, Pale Ale, IPA, Stout, Doppelbock, Kölsch, Dunkel, Schwarzbier, Bock, Altbier, Rauchbier, Porter, Imperial Stout, Dubbel, Tripel, Saison, Witbier, Dunkelweizen, New England IPA, Berliner Weisse – jeder mit Startrezept, Zielbereichen und Maischplan. Dazu 17 Malze, 14 Hopfen, 8 Hefen.
- **Skill-Level** (`src/game/progress.js`): 8 Stufen (Anfänger … Braulegende), XP aus fertigen Suden (mehr bei schwierigen Stilen und guter Qualität, Bonus beim ersten Mal). Jeder Stil hat Schwierigkeit 1–5, Mindest-Level und **Kursgebühr**; ohne Kurs kein Sud. Level senkt Ungenauigkeit und Infektionsrisiko, und die ersten drei Sude eines Stils gelingen selten perfekt (Übung).
- **Kosten:** Kurse, Ausrüstung, Zutaten, Energie/Wasser, Desinfektion; jeder Sud zeigt Kosten gesamt und pro Liter (`batch.cost`, `batch.costPerLiter`).
- **Info-Texte** (`src/game/info.js`): zu jedem Malz, Hopfen, jeder Hopfenform, Hefe, jedem Stil, jeder Ausrüstung, jedem Level, Kennwert und Fehlaroma – `getInfo(kind, id)` / `findInfo(id)`; im Terminal: `info citra`. Ein Test stellt sicher, dass nichts ohne Text bleibt.
- **Sandbox:** alle Stile frei, Level einstellbar (`level 1–8`), damit man die Folgen von Können ausprobieren kann.

## Version 2: Tutorial, Wirtschaft, Spenden, Abtei
- **Hauptmenü** mit Story, Sandbox, Rezept-Rechner. Beim neuen Spiel gibst du deiner Brauerei einen eigenen Namen (eigenes Logo: siehe Issue #1).
- **Dashboard** mit großen Kacheln (🍺 Brauen, 🛒 Einkauf, 🫧 Gärkeller, 📦 Lager & Verkauf, 🙏 Spenden, 🏆 Bierliga, 🔧 Ausrüstung, 🎓 Kurse, 📔 Tagebuch, 📖 Sudbuch). Bereiche sind anfangs gesperrt (🔒) und werden kapitelweise freigeschaltet.
- **Tutorial „Opas Sudbuch“** (`src/game/tutorial.js`): 11 geführte Schritte mit Opa Heinrich und Gerda – Einkaufen, Putzen, Maischen (Temperatur treffen), Läutern, Kochen, Kühlen, Gärplatz wählen, Warten, Abfüllen, Probieren. Überspringbar.
- **Wirtschaft** (`src/game/config.js`, `engine.js`): Biersteuer mit Mengenstaffel (§ 2 BierStG) – auch auf verschenktes Bier, sobald ein Gewerbe läuft; Absatzwege Hofverkauf / Gastro / Festival (Sommer, Standgebühr) / Schwarzverkauf (ohne Steuer, aber Kontrollen mit Nachzahlung, Strafe, Ansehensverlust); Nachfrage nach Ruf und Saison; Ruf nur durch Qualität (Wochen-Deckel); Energie und Flaschen kosten beim Ansetzen; Malz-Sackrabatt; Versicherung mit Gewerbe; Hobbygrenze mit Steuer-Nachzahlung; 80 € Hobby-Budget pro Monat aus dem Job.
- **Spenden & Ansehen**: Kirche, Tafel, Kindergarten, Feuerwehr (auch Freibier). Abnehmende Wirkung pro Woche.
- **Abtei St. Gambrin (gegr. 1253, erfunden)**: Wer Ansehen ≥ 30 hat, ≥ 300 € gespendet hat, stabil gute klassische Biere braut und sauber bleibt, bekommt Besuch von Bruder Anselm → Dubbel-Rezept → Gemeinschaftssud mit Siegel (+40 % Preis, 30 % des Erlöses an die Abtei).
- **Bierliga** (`src/game/league.js`): Rangliste mit 19 erfundenen Konkurrenten – du startest unten.
- Steuer- und Rechtsregeln sind vereinfacht; alle Brauereien, Personen und die Abtei sind erfunden.

## Rezept-Werkstatt (Brauen)

- Rezept frei bauen: Malze (Anteile), Hopfengaben (Sorte, Form, Zeitpunkt, Gramm), Hefe, Stammwürze, Maischverfahren (Kombirast, Stufen, Ferulasäurerast, Dekoktion) und Reifung (kalte Lagerung, Flaschengärung, Kalthopfung, Holzfass).
- **Potenzial** (0–100) = Höchstpunktzahl des Rezepts: Stiltreue 30, passende Zutaten 20, Hopfenaroma 10, Feinschliff 40 (Kniffe wie edles Grundmalz aus Bodenmälzung, ideales Maischverfahren, typische Zutat, Reifung). Standardrezepte liegen bei ca. 75–80, mit allen Kniffen sind über 92 („Trappisten-Niveau“) möglich.
- Gärtemperatur, Hefemenge, Hygiene und Erfahrung ziehen davon ab; die Vorschau zeigt die erwartete Qualität.
- **Sortiment**: Rezepte mit eigenem Namen speichern und wieder laden.
- Neuer Absatzweg **Getränkehändler holt ab**: nimmt jede Menge, zahlt aber wenig.
