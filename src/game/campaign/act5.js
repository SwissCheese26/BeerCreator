// Akt V – Wachstum & Krise (Kapitel 15–18): Handel, Hopfenkrise, Skandal, Übernahmeangebot.
import { spend, rand } from '../state.js';
import { addXp } from '../progress.js';
import { ensureStory, addRep, addHonor, addCash, fine, persona, lvl, allies, offerQuest, questSettled, QUESTS, stockOf, say } from './common.js';
import { AUTO_OFFERS } from './tick.js';
import { rankOf } from './helpers.js';
import { buyTech, hasTech } from '../business.js';
import { takeBeer } from './early.js';

Object.assign(QUESTS, {
  kette_pils: { story: true, who: 'lindner', title: 'Rahmenvertrag: Pils fürs Regal', kind: 'deliver', styles: ['pils'], liters: 70, minQ: 72, days: 75, retryDays: 40, ibu: [28, 42], paid: true,
    text: 'Die Handelskette will Pils ins Regal: 70 Liter, Qualität 72, zwischen 28 und 42 IBU („nicht zu bitter, nicht zu brav“). 600 € – der Preis ist niedrig, aber die Menge verspricht Dauerkunden. Teillieferungen sind erlaubt.',
    reward: s => { addCash(s, 600); addRep(s, 3); s.regulars = Math.min(60, (s.regulars || 0) + 5); return 'Das Pils steht im Regal, Eckplatz, Augenhöhe. 600 €, Ruf +3, fünf neue Stammkunden.'; }, fail: s => { addRep(s, -3); s.flags.kette_verstimmt = true; } },
  kette_helles: { story: true, who: 'lindner', title: 'Rahmenvertrag: Helles fürs Regal', kind: 'deliver', styles: ['helles'], liters: 70, minQ: 70, days: 75, retryDays: 40, paid: true,
    text: 'Zweiter Posten der Handelskette: 70 Liter Helles, Qualität 70. 600 €. Der Einkäufer meint: „Wenn’s läuft, reden wir über das Doppelte.“',
    reward: s => { addCash(s, 600); addRep(s, 2); return '600 €. Der Einkäufer klopft dir auf die Schulter: „Ich ruf an.“ Ruf +2.'; }, fail: s => { addRep(s, -2); } },
  regional_dunkel: { story: true, who: 'toni', title: 'Regionalregal: Dunkles für die Hallertau', kind: 'deliver', styles: ['dunkel'], liters: 50, minQ: 70, days: 75, retryDays: 40, ebc: [32, 55], paid: true,
    text: 'Im Hofladen der Hallertauer Genossen soll dein Dunkel stehen: 50 Liter, Qualität 70, Farbe 32 bis 55 EBC. 480 € und viele Hopfenbauern, die dich kennenlernen.',
    reward: s => { addCash(s, 480); addHonor(s, 3); s.flags.toni_ally = true; return '480 €, Ansehen +3. Toni verkündet am Stammtisch, du seist „einer von uns“.'; }, fail: s => { addHonor(s, -2); } },
  krisenbier: { story: true, who: 'toni', title: 'Krisenbier für die Hopfenbauern', kind: 'deliver', styles: ['pale', 'pils', 'saison', 'helles'], liters: 40, minQ: 72, days: 70, retryDays: 40,
    text: 'Die Ernte ist verhagelt, die Stimmung am Boden. Für den Solidaritätsabend der Hopfenbauern brauche ich 40 Liter von dir – hopfig, ehrlich, ohne Rechnung. Als Beweis, dass man auch in schlechten Jahren gutes Bier braut.',
    reward: s => { s.flags.toni_ally = true; s.flags.bauer_treue = true; addHonor(s, 5); s.inventory.hops.push({ id: 'tettnanger', form: 'whole', g: 500, ageDays: 0 }); return 'Toni weint ein bisschen, trinkt viel und verspricht, dich nie im Stich zu lassen. 500 g Tettnanger-Dolden und Ansehen +5.'; },
    fail: s => { addHonor(s, -3); } },
  wiedergutmachung: { story: true, who: 'lindner', title: 'Wiedergutmachung für den Handel', kind: 'deliver', styles: ['helles', 'pils', 'weizen'], liters: 60, minQ: 75, days: 60, retryDays: 30,
    text: 'Nach dem Rückruf wollen wir Ersatz: 60 Liter einwandfreies Bier in Qualität 75, unentgeltlich. Dann reden wir weiter.',
    reward: s => { addRep(s, 6); addHonor(s, 4); return 'Die Händler nicken. „So geht Verantwortung.“ Ruf +6, Ansehen +4.'; }, fail: s => { addRep(s, -5); addHonor(s, -3); } },
  massiv_probe: { story: true, who: 'dreyer', title: 'Probe für Massivbräu', kind: 'deliver', styles: ['pils', 'helles'], liters: 20, minQ: 82, days: 60, retryDays: 30, paid: true,
    text: 'Herr Dreyer von der Massivbräu AG möchte Ihr bestes Pils oder Helles verkosten: 20 Liter, Qualität 82 oder höher. Wir vergüten das mit 400 € – und sind gespannt.',
    reward: s => { addCash(s, 400); s.flags.massiv_beeindruckt = true; return 'Dreyer verkostet reglos. „Außergewöhnlich.“ Es klingt nach einem Kompliment und nach einem Angebot. 400 €.'; }, fail: s => { s.flags.massiv_enttaeuscht = true; } },
  genossen_fest: { story: true, who: 'klaus', title: 'Genossenschaftsfest', kind: 'deliver', styles: ['helles', 'maerzen', 'pils', 'weizen'], liters: 80, minQ: 68, days: 70, retryDays: 40,
    text: 'Zum ersten Jahresfest der Genossen brauchen wir 80 Liter von dir. Helles, Märzen, Pils oder Weizen – Hauptsache gutes Bier. Als Gegenleistung gibt es Applaus und, wenn du Glück hast, Kuchen.',
    reward: s => { addHonor(s, 5); addRep(s, 4); s.flags.klaus_ally = true; return 'Klaus hält eine Rede, in der dein Name viermal vorkommt. Ansehen +5, Ruf +4.'; }, fail: s => { addHonor(s, -2); } },
});
AUTO_OFFERS.push(
  { id: 'kette_pils', when: s => !!s.flags.handel_kette && s.chapter >= 15 }, { id: 'kette_helles', when: s => !!s.flags.handel_kette && s.chapter >= 15 },
  { id: 'regional_dunkel', when: s => !!s.flags.handel_regional && s.chapter >= 15 },
  { id: 'krisenbier', when: s => s.chapter >= 16 && !!s.flags.done_ernte_schlecht },
  { id: 'wiedergutmachung', when: s => s.flags.skandal === 'rueckruf' },
  { id: 'massiv_probe', when: s => s.chapter >= 18 && s.license },
  { id: 'genossen_fest', when: s => s.chapter >= 18 && !!s.flags.genossen_anteile },
);

export const act5Chapters = [
  {
    id: 'wachstum', title: 'Kapitel 15 – Wachstum',
    intro: 'Das Sudhaus läuft, das Etikett hängt im Regal, und die Anfragen kommen in Paletten statt in Flaschen. Aber Wachstum heißt Entscheidungen: Abfüllanlage, Händler, Lohnbrauerei, vielleicht eine kleine Konkurrenz kaufen. Was man gewinnt, sieht man in Zahlen. Was man verliert, merkt man erst im Dorf.',
    objectives: [
      { id: 'kette', text: 'Entscheide, wie du in den Handel gehst.', done: s => !!s.flags.done_handelskette },
      { id: 'abfueller', text: 'Kaufe die Abfüllanlage mit CO₂-Vorspannung.', done: s => hasTech(s, 'abfueller') },
      { id: 'lohn', text: 'Lass einmal 500 Liter in der Lohnbrauerei brauen und liefern.', done: s => s.beers.some(b => b.industrial) },
    ],
    outro: 'Die erste Palette verlässt den Hof, mit deinem Namen auf jeder Kiste. Es fühlt sich an wie das erste Mal Fahrradfahren ohne Stützräder: erschreckend schnell.',
    events: [
      { id: 'handelskette', when: () => true },
      { id: 'lohnbrauen_angebot', when: s => !!s.flags.done_handelskette },
    ],
  },
  {
    id: 'hopfenkrise', title: 'Kapitel 16 – Die Hopfenkrise',
    intro: 'Ein Hagelsturm in der Hallertau, ein Dürresommer in Böhmen: Die Hopfenernte fällt aus, und die Preise explodieren. Gleichzeitig steigen Gas und Strom. Wer vorgesorgt hat, schläft ruhig. Wer Verträge hat, verflucht oder lobt sie. Und wer stur geradeaus braut, rechnet jeden Abend nach.',
    onEnter: s => { ensureStory(s).shock = { from: s.day, to: s.day + 120, factor: 3 }; },
    objectives: [
      { id: 'ernte', text: 'Entscheide, wie du die schlechte Ernte angehst.', done: s => !!s.flags.done_ernte_schlecht },
      { id: 'energie', text: 'Entscheide, wie du mit den Energiepreisen umgehst.', done: s => !!s.flags.done_energiepreise },
      { id: 'krise', text: 'Überstehe die Krise (120 Tage).', done: s => !!s.flags.krise_vorbei },
      { id: 'toni', text: 'Erledige den Auftrag für die Hopfenbauern.', done: s => questSettled(s, 'krisenbier') },
    ],
    outro: 'Der Hopfenpreis fällt, die Gaspreise beruhigen sich. Du hast gelernt, wie dünn die Linie zwischen Stolz und Unvernunft ist.',
    events: [
      { id: 'ernte_schlecht', when: () => true },
      { id: 'energiepreise', when: s => !!s.flags.done_ernte_schlecht },
    ],
  },
  {
    id: 'skandal', title: 'Kapitel 17 – Der Infektions-Skandal',
    intro: 'Bei einem Getränkehändler explodiert eine Flasche. Dann noch eine. Der „Kesselbacher Bote“ schreibt von „sauren Überraschungen aus Heinrichs Brauerei“. Ein Labor bestätigt: Milchsäurebakterien in einem Sud. Jetzt zählt, wie du reagierst – und was du schon richtig oder falsch gemacht hast.',
    objectives: [
      { id: 'skandal', text: 'Entscheide, wie du mit dem Skandal umgehst.', done: s => !!s.flags.done_skandal },
      { id: 'hyg', text: 'Bring die Hygiene auf ein neues Niveau.', done: s => !!s.flags.done_hygiene_offensive },
      { id: 'altlast', text: 'Stelle dich deinen alten Entscheidungen.', done: s => !s.flags.sabotage || !!s.flags.done_sabotage_entdeckt },
      { id: 'wieder', text: 'Erledige den Wiedergutmachungs-Auftrag (falls nötig).', done: s => s.flags.skandal !== 'rueckruf' || questSettled(s, 'wiedergutmachung') },
      { id: 'rep70', text: 'Erreiche wieder 70 Ruf.', done: s => s.reputation >= 70, progress: s => `Ruf ${Math.floor(s.reputation)} / 70` },
    ],
    outro: 'Die Schlagzeilen werden kleiner, die Kisten bleiben nicht mehr stehen. Du weißt jetzt, wie Vertrauen riecht: nach Sauberkeit und Ehrlichkeit.',
    events: [
      { id: 'skandal', when: () => true },
      { id: 'hygiene_offensive', when: s => !!s.flags.done_skandal },
      { id: 'sabotage_entdeckt', when: s => !!s.flags.sabotage && !!s.flags.done_skandal },
    ],
  },
  {
    id: 'uebernahme', title: 'Kapitel 18 – Ein Angebot, das man nicht ablehnt',
    intro: 'Auf dem Schreibtisch liegt ein Brief mit Wappen: Die Massivbräu AG, der Riese mit der Werbung auf jeder Autobahnbrücke, will sich „über Möglichkeiten einer Zusammenarbeit“ unterhalten. Gleichzeitig tuscheln im Dorf Klaus, Gerda und Toni über eine Genossenschaft. Und Dr. Falk wird ungeduldig.',
    objectives: [
      { id: 'dreyer', text: 'Entscheide über das Angebot von Massivbräu.', done: s => !!s.flags.done_massiv_angebot },
      { id: 'falk', text: 'Klär dein Verhältnis zu Dr. Falk (falls er investiert hat).', done: s => !s.flags.falk_investor || !!s.flags.done_falk_ultimatum },
      { id: 'gen', text: 'Entscheide über den Genossenschaftsplan.', done: s => !!s.flags.done_genossen_plan },
      { id: 'merle', text: 'Triff Merle ein letztes Mal.', done: s => !!s.flags.done_merle_wiedersehen },
      { id: 'probe', text: 'Erledige die Probe für Massivbräu.', done: s => questSettled(s, 'massiv_probe') },
      { id: 'rank', text: 'Steige in der Bierliga unter die Top 8.', done: s => rankOf(s) <= 8, progress: s => `Platz ${rankOf(s)}` },
    ],
    outro: 'Alle Entscheidungen sind getroffen, und doch fühlt sich nichts abgeschlossen an. Denn morgen jährt sich Opas Todestag, und an diesem Tag kommt jeder, der ihm etwas schuldig ist.',
    events: [
      { id: 'massiv_angebot', when: () => true },
      { id: 'falk_ultimatum', when: s => !!s.flags.falk_investor && !!s.flags.done_massiv_angebot },
      { id: 'genossen_plan', when: s => !!s.flags.done_massiv_angebot },
      { id: 'merle_wiedersehen', when: s => !!s.flags.done_genossen_plan },
    ],
  },
];

export const act5Events = {
  handelskette: {
    title: 'Der Einkäufer von der Handelskette', who: 'lindner',
    text: 'Ein Mann im grauen Anzug sitzt im Sudhaus und trinkt Pils, als wäre es Mineralwasser. „Wir würden Sie gern ins Regal nehmen. Rahmenvertrag, feste Mengen, planbarer Preis.“ Er lächelt. „Der Preis ist etwas niedriger, aber die Menge ist höher. Das ist Skalierung.“ Die Alternative: regionale Hofläden und Genossen, kleinere Mengen, bessere Preise.',
    choices: [
      { id: 'kette', label: '🛒 Handelskette: viel Menge, kleiner Preis – zwei große Aufträge (je 70 L).',
        apply: s => { s.flags.handel_kette = true; persona(s, 'bold', 2); persona(s, 'heimat', -1); return 'Du unterschreibst. Die Lieferscheine sind so lang wie der Vertrag. „Skalierung“, denkt dein Kontostand. Dein Herz ist weniger überzeugt.'; } },
      { id: 'regional', label: '🏘️ Regional: Hofläden und Genossen – ein Auftrag (50 L) mit besserem Preis.',
        apply: s => { s.flags.handel_regional = true; persona(s, 'heimat', 2); addHonor(s, 3); return 'Toni lacht, als du sagst, dass du ins Hofregal willst. „Da stehen die ehrlichsten Biere der Welt.“ (Ansehen +3)'; } },
      { id: 'beides', label: '⚖️ Beides vorsichtig versuchen (je ein kleinerer Auftrag).', enabled: s => s.cash >= 300,
        apply: s => { spend(s, 300, 'die Verhandlungskosten'); s.flags.handel_regional = true; s.flags.handel_kette = true; persona(s, 'bold', 1); persona(s, 'heimat', 1); return 'Zwei Verträge, doppelte Arbeit. Dafür wird dir niemand vorwerfen, du hättest dich nur auf eine Seite geschlagen.'; } },
    ],
  },
  lohnbrauen_angebot: {
    title: 'Die Lohnbrauerei', who: 'falk',
    text: 'Die Stahlkessel AG schickt einen Prospekt: „Sie liefern das Rezept, wir die Tanks.“ 500 bis 5000 Liter, drei Wochen Lieferzeit, ein paar Qualitätspunkte weniger – dafür keine Nächte am Kessel. Der Vertreter flüstert: „Viele Craft-Brauer machen das. Keiner spricht darüber.“',
    choices: [
      { id: 'vertrag', label: '🏭 Das Lohnbrauen ausprobieren (Rezept im Sortiment speichern, ≥ 500 L bestellen).',
        apply: s => { s.flags.lohn_probiert = true; persona(s, 'bold', 1); addXp(s, 30, 'Industrielle Produktion'); return 'Du schaust dir die Anlage an: Edelstahl, so weit das Auge reicht. Es ist beeindruckend und ein bisschen kalt. (Erfahrung +30)'; } },
      { id: 'skeptisch', label: '🔍 Skeptisch bleiben, aber testen – zuerst nur die Mindestmenge.',
        apply: s => { s.flags.lohn_probiert = true; persona(s, 'trad', 1); return 'Du bestellst Mindestmenge, Qualitätskontrolle und eine eigene Verkostung. Der Vertreter ist beeindruckt und leicht erschöpft.'; } },
    ],
  },
  ernte_schlecht: {
    title: 'Hagel in der Hallertau', who: 'toni',
    text: 'Toni ruft nachts um halb zwei an. Im Hintergrund hört man Regen und Stimmen. „Der Hagel hat das halbe Feld erwischt. Die Preise werden sich verdoppeln, verdreifachen. Wenn du kannst, sichere dir noch etwas.“ Du schaust auf den Kontostand. Es wird teuer.',
    choices: [
      { id: 'vorrat', label: '📦 Einen Hopfenvorrat kaufen (700 €): Aufschlag halbiert.', enabled: s => s.cash >= 700,
        apply: s => { spend(s, 700, 'den Hopfenvorrat'); s.flags.hopfen_vorrat = true; s.inventory.hops.push({ id: 'tradition', form: 'pellet', g: 4000, ageDays: 0 }, { id: 'saphir', form: 'pellet', g: 2000, ageDays: 0 }); persona(s, 'trad', 1); return 'Zwei Kisten Pellets schlafen im kühlen Lager. Vorsorge ist so langweilig wie wirksam.'; } },
      { id: 'treue', label: '🤝 Tonis Hopfengemeinschaft beitreten (300 € Solidaritätsbeitrag): fester Hofpreis.', enabled: s => s.cash >= 300 && !!s.flags.regional,
        apply: s => { spend(s, 300, 'den Solidaritätsbeitrag'); s.flags.bauer_treue = true; s.flags.toni_ally = true; addHonor(s, 4); persona(s, 'heimat', 1); return 'Toni umarmt dich, bis du keine Luft mehr kriegst. „Ich vergesse das nie.“ (Ansehen +4)'; } },
      { id: 'extrakt', label: '⚗️ Auf Extrakt umstellen – billig, aber ohne Aroma.',
        apply: s => { persona(s, 'bold', 1); addXp(s, 15, 'Extrakt-Rezepte'); return s.flags.extrakt_vertrag ? 'Dein HopfenMax-Vertrag zeigt, was er wert ist: Der Festpreis ist ein Segen in der Krise – auch wenn das Aroma schweigt.' : 'Du kaufst Extrakt, wo es geht. Es schmeckt nach Notlösung, rechnet sich aber.'; } },
      { id: 'aussitzen', label: '🧘 Aussitzen: Das wird schon wieder.',
        apply: s => { persona(s, 'trad', 1); return 'Du atmest ruhig. Die Preise nicht.'; } },
    ],
  },
  energiepreise: {
    title: 'Gas, Strom, Wasser – alles teurer', who: 'jule',
    text: 'Die Abrechnung der Stadtwerke liegt auf dem Tisch wie ein schlechter Witz. „Plus 140 Euro im Monat“, sagt Emre oder Jule oder dein Magen. Vielleicht gibt es eine Möglichkeit, das zu ändern.',
    choices: [
      { id: 'waermerueckgewinnung', label: '♻️ In Wärmerückgewinnung investieren (2500 €, Level 3).', enabled: s => hasTech(s, 'waerme') || (s.cash >= 2500 && lvl(s) >= 3),
        apply: s => { if (!hasTech(s, 'waerme')) buyTech(s, 'waerme'); s.flags.waermerueckgewinnung = true; ensureStory(s).energyUntil = s.day + 90; s.flags.energie_schock = true; return 'Das Abwasser heizt jetzt das Brauwasser. Gerda staunt: „Früher haben wir das einfach in den Bach gekippt.“'; } },
      { id: 'sparen', label: '🧊 Durchhalten und Verbrauch senken.',
        apply: s => { s.flags.energie_schock = true; ensureStory(s).energyUntil = s.day + 90; persona(s, 'trad', 1); return 'Du wickelst Rohre in Decken, kochst nur noch bei voller Last. Es hilft ein wenig. Die Rechnung nicht ganz.'; } },
      { id: 'solar', label: '☀️ Solaranlage aufs Dach (1800 €) – Aufschlag nur 45 Tage.', enabled: s => s.cash >= 1800,
        apply: s => { spend(s, 1800, 'die Solaranlage'); s.flags.energie_schock = true; ensureStory(s).energyUntil = s.day + 45; persona(s, 'heimat', 1); addHonor(s, 2); return 'Das Dach glitzert. Die Nachbarn fragen, ob du jetzt auch Strom verkaufst. (Ansehen +2)'; } },
    ],
  },
  skandal: {
    title: 'Saure Überraschung', who: 'jule',
    text: 'Der Bote titelt: „Heinrichs Hausbrauerei – ein Fall für das Labor?“ Das Labor hat in einem Sud Milchsäurebakterien gefunden. Auf dem Etikett steht deine Brauerei. Die Händler rufen an, die Presse klingelt, Frau Zollinger schickt ein Fax. Es gibt drei Wege – und der einfachste ist nicht der beste.',
    choices: [
      { id: 'rueckruf', label: '📢 Freiwilliger Rückruf (1200 € Kosten), ehrliche Entschuldigung, Ersatzlieferung.', enabled: s => s.cash >= 1200,
        apply: s => { spend(s, 1200, 'den Rückruf'); s.flags.skandal = 'rueckruf'; s.flags.ehrlich = true; addRep(s, -4); addHonor(s, 6); persona(s, 'trad', 2); s.flags.zollinger_ally = true; return 'Du rufst jede Kiste zurück und gibst in der Zeitung zu: „Wir haben einen Fehler gemacht.“ Es tut weh. Aber am Ende des Tages glaubt dir die Straße. (Ruf −4, Ansehen +6)'; } },
      { id: 'vertuschen', label: '🤫 Vertuschen: Charge „verlieren“ und hoffen, dass es keiner merkt.',
        apply: s => { s.flags.skandal = 'vertuscht'; s.flags.vertuscht = true; persona(s, 'bold', 1); persona(s, 'trad', -2); if (rand(s) < 0.5) { addRep(s, -15); addHonor(s, -15); s.flags.vertuscht_aufgeflogen = true; return 'Zwei Wochen später deckt eine Reporterin die Wahrheit auf. „Brauerei vertuscht Infektion“ – die Schlagzeile steht auf allen Titelseiten. (Ruf −15, Ansehen −15)'; } addRep(s, -2); return 'Es bleibt ruhig. Du spürst trotzdem jeden Tag, wie dünn das Eis ist. (Ruf −2)'; } },
      { id: 'schuld', label: '👉 Dem Hopfenlieferanten die Schuld geben.',
        apply: s => { s.flags.skandal = 'schuld'; addRep(s, -6); addHonor(s, -4); s.flags.toni_ally = false; s.flags.bauer_ally = false; persona(s, 'heimat', -2); return 'Der Lieferant bestreitet es lautstark, und Toni hört es im Radio. Die Beziehung kühlt ab. (Ruf −6, Ansehen −4)'; } },
    ],
  },
  hygiene_offensive: {
    title: 'Nie wieder', who: 'zoll',
    text: 'Aus dem Skandal soll ein Lernen werden. Ottokar nickt, Frau Zollinger sammelt Vorschläge, und im Sudhaus hängen plötzlich Laminat-Checklisten. Was machst du?',
    choices: [
      { id: 'labor', label: '🔬 Ein eigenes Mikrobiologie-Labor einrichten (1500 €): Hygiene dauerhaft deutlich höher.', enabled: s => s.cash >= 1500,
        apply: s => { spend(s, 1500, 'das Labor'); s.hygiene = Math.min(0.9, s.hygiene + 0.15); persona(s, 'trad', 1); return 'Mikroskope, Nährböden, ein Autoklav: Die Hygienequote ist jetzt ein Fixpunkt im Kalender. (Hygiene +0,15)'; } },
      { id: 'schulung', label: '🎓 Das ganze Team schulen (400 €).', enabled: s => s.cash >= 400,
        apply: s => { spend(s, 400, 'die Schulung'); s.hygiene = Math.min(0.9, s.hygiene + 0.08); addXp(s, 60, 'Hygieneschulung'); return 'Zwei Tage Seminar, ein Zertifikat und ein neues Bewusstsein. (Hygiene +0,08, Erfahrung +60)'; } },
      { id: 'sparen', label: '🪣 Nur das Nötigste: Putzplan, Eimer, Augenmaß.',
        apply: s => { s.hygiene = Math.min(0.9, s.hygiene + 0.03); return 'Es reicht – vorerst. Die Zukunft entscheidet, ob das klug war. (Hygiene +0,03)'; } },
    ],
  },
  sabotage_entdeckt: {
    title: 'Die Hefe, die niemand vergisst', who: 'jury',
    text: 'Im Zuge des Skandals gräbt eine Journalistin tiefer. „Es gibt Gerüchte, dass Sie vor der Bundesmeisterschaft die Hefe einer Konkurrentin manipuliert haben.“ Merle selbst hat nichts gesagt. Aber jemand hat das Etikett des Hefepäckchens aufgehoben.',
    choices: [
      { id: 'gestehen', label: '😔 Alles gestehen und Merle öffentlich um Verzeihung bitten.',
        apply: s => { addHonor(s, -8); addRep(s, -4); s.flags.sabotage = false; s.flags.sabotage_gebeichtet = true; persona(s, 'trad', 2); s.flags.merle_ally = true; return 'Die Geschichte wird groß – und dann, überraschend, klein. Merle ruft an: „Das war idiotisch. Aber mutig, es zu sagen.“ (Ansehen −8, Ruf −4)'; } },
      { id: 'leugnen', label: '🛑 Alles leugnen und einen Anwalt einschalten.',
        apply: s => { if (rand(s) < 0.5) { addRep(s, -20); addHonor(s, -25); s.flags.sabotage_aufgeflogen = true; return 'Der Anwalt rät dringend ab, die Presse hat das Hefepäckchen. Die Schlagzeile ist unerträglich. (Ruf −20, Ansehen −25)'; } addHonor(s, -3); s.flags.sabotage_unentdeckt = true; return 'Ohne Beweis bleibt es bei Gerüchten. Aber du weißt, was du getan hast. (Ansehen −3)'; } },
      { id: 'wiedergutmachen', label: '🤝 Merle ein Bier ausgeben (500 € für ihre Brauerei-Spende) und reinen Tisch machen.', enabled: s => s.cash >= 500,
        apply: s => { spend(s, 500, 'die Wiedergutmachung'); addHonor(s, -2); s.flags.sabotage = false; s.flags.sabotage_gebeichtet = true; s.flags.merle_ally = true; persona(s, 'trad', 1); return 'Merle nimmt das Geld, „für einen Hefekühlschrank, der nicht ausfällt“. Ihr schweigt, bis das Bier schal wird. (Ansehen −2)'; } },
    ],
  },
  massiv_angebot: {
    title: 'Das Angebot der Massivbräu AG', who: 'dreyer',
    text: 'Herr Dreyer sitzt mit dem Rücken zum Fenster und lächelt wie ein Lehrbuch. „Massivbräu will Ihre Marke. Wir bieten 1,2 Millionen Euro, einen Arbeitsplatz für Sie und die Zusicherung, dass alles bleibt, wie es ist.“ Er hält inne. „Außer den Rezepten, dem Sudhaus und dem Namen.“',
    choices: [
      { id: 'verhandeln', label: '📞 Verhandeln – man hört sich alles an.',
        apply: s => { s.flags.massiv_verhandelt = true; persona(s, 'bold', 2); addXp(s, 60, 'Verhandlungsführung'); return 'Drei Stunden, vierzehn Seiten, ein Bleistift, der nicht mehr schreibt. Am Ende bleibt eine Option, die du jederzeit ziehen kannst.'; } },
      { id: 'ablehnen', label: '🚪 Ablehnen: „Heinrichs Brauerei steht nicht zum Verkauf.“',
        apply: s => { s.flags.massiv_abgelehnt = true; persona(s, 'trad', 2); addHonor(s, 5); return 'Dreyer packt sorgfältig ein. „Sie werden uns vermissen.“ Im Dorf wird dein Auftritt später dreimal besser erzählt. (Ansehen +5)'; } },
      { id: 'praesent', label: '🎁 Ein Fass Bier schenken und freundlich bleiben, ohne Entscheidung.',
        apply: s => { s.flags.massiv_offen = true; addXp(s, 20, 'Diplomatie'); return 'Er nimmt das Fass, schnuppert und zieht die Augenbrauen hoch. „Hm.“ Mehr Lob wirst du von ihm nie bekommen.'; } },
    ],
  },
  falk_ultimatum: {
    title: 'Falks Ultimatum', who: 'falk',
    text: 'Dr. Falk sitzt am Sudhaus-Tisch und blättert eine Präsentation. „Die Zahlen sprechen für Wachstum: Zweites Standbein, Dosenlinie, Export. Wenn Sie nicht folgen, ziehe ich meine Beteiligung ab.“ Er sieht dich an, der Blick ist freundlich und eisern.',
    choices: [
      { id: 'folgen', label: '📈 Falks Plan folgen: Wachstum um jeden Preis.',
        apply: s => { s.flags.falk_wille = true; persona(s, 'bold', 2); persona(s, 'trad', -1); addRep(s, 2); return 'Falk hebt das Glas. „Auf die Zukunft.“ Du fragst dich, wessen Zukunft er meint.'; } },
      { id: 'auszahlen', label: '💶 Falk auszahlen (6000 €): wieder dein eigener Herr.', enabled: s => s.cash >= 6000,
        apply: s => { spend(s, 6000, 'Falks Abfindung'); s.flags.falk_investor = false; s.flags.falk_ausgezahlt = true; persona(s, 'trad', 2); addHonor(s, 4); return 'Falk prüft die Überweisung, nickt, steht auf. „Ich hätte gern mehr aus Ihnen gemacht.“ Du hörst die Tür, und die Brauerei gehört wieder dir. (Ansehen +4)'; } },
      { id: 'hinhalten', label: '⏳ Hinhalten und auf bessere Zeiten hoffen.',
        apply: s => { s.flags.falk_gereizt = true; addHonor(s, -1); return 'Falk lächelt mit den Zähnen. „Dann in einem Jahr.“ Seine Aktentasche klappt zu wie eine Falle.'; } },
    ],
  },
  genossen_plan: {
    title: 'Klaus, Gerda und Toni haben eine Idee', who: 'klaus',
    text: 'Im Hinterzimmer des Wirtshauses: Klaus, Gerda, Toni, Kalle und Frau Kowalski, alle mit Schnapsgläsern und ernsten Gesichtern. „Wir haben nachgedacht. Wir würden die Brauerei gern gemeinsam tragen – als Genossenschaft. Dann kann niemand mehr kommen und sie uns wegkaufen.“',
    choices: [
      { id: 'ja', label: '🏘️ Ja – die Brauerei gehört dem Dorf.', enabled: s => allies(s) >= 2,
        apply: s => { s.flags.genossen_plan = true; persona(s, 'heimat', 3); addHonor(s, 5); return 'Ihr stoßt an. Gerda weint, Klaus hält eine Rede, Toni singt falsch. Eine Genossenschaft ist geboren – zumindest als Plan. (Ansehen +5)'; } },
      { id: 'vielleicht', label: '🤔 Erst darüber nachdenken – die Idee ist schön, aber riskant.',
        apply: s => { persona(s, 'trad', 1); return 'Die Runde nickt höflich, aber ein bisschen enttäuscht. „Wir warten“, sagt Klaus.'; } },
      { id: 'nein', label: '✋ Nein – die Brauerei bleibt allein in deiner Hand.',
        apply: s => { s.flags.genossen_abgelehnt = true; addHonor(s, -2); persona(s, 'bold', 1); return 'Es wird still. Gerda sieht in ihr Glas. „Es ist dein Bier“, sagt sie nur. (Ansehen −2)'; } },
    ],
  },
  merle_wiedersehen: {
    title: 'Merle zum Abschied', who: 'jury',
    text: 'Merle Trübsal steht im Sudhaus. Sie hat graue Strähnen bekommen, das Lächeln wie ein Schraubenschlüssel ist geblieben. „Ich habe gehört, was bei dir los ist. Dreyer hat mich auch besucht.“ Sie sieht dich an. „Ich weiß, was ich mache. Und du?“',
    choices: [
      { id: 'bund', label: '🤝 Ein Bündnis vorschlagen: gemeinsam brauen, gemeinsam gegen die Konzerne.', enabled: s => !s.flags.sabotage && !s.flags.sabotage_aufgeflogen,
        apply: s => { s.flags.merle_ally = true; s.flags.merle_bund = true; persona(s, 'heimat', 1); persona(s, 'trad', 1); addHonor(s, 4); return 'Ihr schreibt auf einen Bierdeckel: „Trübsal x Heinrich – Pale Ale“. Er wird später als Gründungsurkunde ausgestellt. (Ansehen +4)'; } },
      { id: 'respekt', label: '🥂 Auf eine gute Rivalität trinken – nichts weiter.',
        apply: s => { addHonor(s, 2); return 'Ihr trinkt aus einer Flasche, die ihr zu zweit nicht austrinken könnt. Sie nickt zum Abschied. (Ansehen +2)'; } },
      { id: 'kuehl', label: '😶 Kühl bleiben – Geschäft ist Geschäft.',
        apply: s => { persona(s, 'bold', 1); return 'Sie nickt kurz, wie eine Verkäuferin. Der Raum ist kälter, als er sein sollte.'; } },
    ],
  },
};
