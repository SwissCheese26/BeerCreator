// Akt IV – Brauerei gründen, Teil 2 (Kapitel 11–14): Halle, Team, Marke, Eröffnung.
import { spend, rand } from '../state.js';
import { addXp } from '../progress.js';
import { addRep, addHonor, addCash, fine, giveFragment, persona, lvl, offerQuest, questSettled, QUESTS } from './common.js';
import { AUTO_OFFERS } from './tick.js';
import { rankOf } from './helpers.js';
import { brandOf } from '../business.js';

Object.assign(QUESTS, {
  eroeff_helles: { story: true, who: 'klaus', title: 'Eröffnung: das Helle für alle', kind: 'deliver', styles: ['helles'], liters: 50, minQ: 70, days: 60, retryDays: 30, paid: true,
    text: 'Zur Eröffnung wird ausgeschenkt, was die Leute lieben: Helles. 50 Liter in Qualität 70, bezahlt aus der Festkasse mit 520 €. Teilen darfst du die Lieferung auf mehrere Sude.',
    reward: s => { addCash(s, 520); addRep(s, 2); return 'Das Helle fließt in Strömen. 520 €, Ruf +2.'; }, fail: s => { addRep(s, -2); } },
  eroeff_weizen: { story: true, who: 'verein', title: 'Eröffnung: Weißbier für den Vorgarten', kind: 'deliver', styles: ['weizen'], liters: 40, minQ: 68, days: 60, retryDays: 30, paid: true,
    text: 'Kalle will die Terrasse mit Weizen bespielen: 40 Liter, Qualität 68, 390 €. Ohne Weizen kein Sommer.',
    reward: s => { addCash(s, 390); s.regulars = Math.min(60, (s.regulars || 0) + 4); return '390 € und vier neue Stammgäste. Kalle verspricht, dich auf der Tafel gleich hinter dem Schnitzel zu führen.'; }, fail: s => { addRep(s, -2); } },
  eroeff_maerzen: { story: true, who: 'gerda', title: 'Eröffnung: Gerdas Märzen', kind: 'deliver', styles: ['maerzen'], liters: 40, minQ: 70, days: 60, retryDays: 30, ebc: [18, 32], paid: true,
    text: 'Für die Ehrengäste soll es ein Märzen sein, bernsteinfarben (18 bis 32 EBC), Qualität 70. 40 Liter, 430 €. „Und wenn es nach Opas schmeckt, weine ich vor allen Leuten.“',
    reward: s => { addCash(s, 430); addHonor(s, 3); return 'Gerda hat feuchte Augen. „Es schmeckt nach ihm.“ 430 €, Ansehen +3.'; }, fail: s => { addHonor(s, -2); } },
});
Object.assign(QUESTS, {
  hallenfest: { story: true, who: 'klaus', title: 'Richtfest im Sudhaus', kind: 'deliver', styles: ['helles', 'maerzen', 'pils'], liters: 40, minQ: 66, days: 55, retryDays: 30, paid: true,
    text: 'Das Dach ist drauf, die Zimmerleute wollen ihren Richtspruch halten – und danach trinken. 40 Liter Helles, Märzen oder Pils, Qualität 66, 280 € aus der Baukasse.',
    reward: s => { addCash(s, 280); addRep(s, 2); return 'Der Zimmermann klettert auf den First, sagt seinen Spruch und wirft das Glas hinunter. „Das bringt Glück!“ 280 €, Ruf +2.'; }, fail: s => { addRep(s, -1); } },
  ottokar_pruefung: { story: true, who: 'ottokar', title: 'Ottokars Gesellenprüfung', kind: 'deliver', styles: ['dunkel', 'schwarzbier', 'bock'], liters: 20, minQ: 75, days: 60, retryDays: 30,
    text: 'Ich habe vierzig Jahre lang junge Brauer geprüft. Du wirst keine Ausnahme sein: 20 Liter Dunkel, Schwarzbier oder Bock, Qualität 75, und ich schmecke jeden Fehler.',
    reward: s => { addHonor(s, 3); addXp(s, 80, 'Ottokars Prüfung'); s.flags.ottokar_ally = true; return 'Ottokar riecht, kostet, schweigt – und nickt. „Gesellenprüfung bestanden.“ Mehr Lob gibt es nicht. Ansehen +3, Erfahrung +80.'; }, fail: s => { addHonor(s, -2); } },
  jule_mitbrautag: { story: true, who: 'jule', title: 'Jules Mitbrau-Tag', kind: 'deliver', styles: ['pale', 'weizen', 'koelsch'], liters: 30, minQ: 68, days: 55, retryDays: 30, paid: true,
    text: 'Ich habe zwanzig Leute für einen „Mitbrau-Tag“ gewonnen. Sie brauchen frisches Bier zum Probieren: 30 Liter Pale Ale, Weizen oder Kölsch, Qualität 68, 240 € – und jede Menge Posts.',
    reward: s => { addCash(s, 240); addRep(s, 3); return 'Die Fotos sind gut, die Stimmung besser. 240 €, Ruf +3.'; }, fail: s => { addRep(s, -1); } },
});
AUTO_OFFERS.push(
  { id: 'hallenfest', when: s => s.chapter >= 11 && s.license && !!s.flags.done_halle },
  { id: 'ottokar_pruefung', when: s => s.chapter >= 12 && !!s.flags.ottokar_ally },
  { id: 'jule_mitbrautag', when: s => s.chapter >= 13 && !!s.flags.emp_jule },
);
AUTO_OFFERS.push(
  { id: 'eroeff_helles', when: s => s.chapter >= 14 && s.license }, { id: 'eroeff_weizen', when: s => s.chapter >= 14 && s.license },
  { id: 'eroeff_maerzen', when: s => s.chapter >= 14 && s.license },
);

export const act4Chapters = [
  {
    id: 'halle', title: 'Kapitel 11 – Eine Halle für Opas Traum',
    intro: 'Aus der Garage wird eine Brauerei – oder wenigstens das, was die Garage nicht mehr aushält: Sudhaus, Gärkeller, Lager. Es gibt Hallen, Mühlen und Gewerbeflächen. Aber ein Haus braucht mehr als Wände: Anschlüsse, Statik, Abwasser, und einen Platz für Opas Foto.',
    objectives: [
      { id: 'halle', text: 'Entscheide dich für einen Standort der Brauerei.', done: s => !!s.flags.done_halle },
      { id: 'tank', text: 'Baue einen konischen Gärtank ein.', done: s => ['konisch', 'tankraum'].includes(s.equipment.fermenter) },
      { id: 'kuehl', text: 'Installiere die Glykol-Kühlung.', done: s => s.equipment.cooling === 'profi' },
      { id: 'tech2', text: 'Investiere in zwei Technik-Bausteine.', done: s => (s.tech || []).length >= 2, progress: s => `${(s.tech || []).length} / 2` },
    ],
    outro: 'Der erste richtige Sud im neuen Sudhaus. Der Dampf steigt in die Halle, und für einen Moment riecht es wie in Opas Garage – nur größer.',
    events: [
      { id: 'halle', when: () => true },
      { id: 'umbau_panne', when: s => !!s.flags.done_halle && s.stats.batches >= 3 },
      { id: 'klaus_dachboden', when: s => !!s.flags.done_halle },
    ],
  },
  {
    id: 'team', title: 'Kapitel 12 – Das Team',
    intro: 'Allein kann man eine Garage betreiben, aber keine Brauerei. Drei Menschen stehen vor deiner Tür: ein pensionierter Braumeister, der nicht ruhen kann, eine Jungunternehmerin mit Instagram-Kanal und ein Buchhalter, der „Bilanzen mag wie andere Krimis“.',
    objectives: [
      { id: 'otto', text: 'Sprich mit Ottokar Würzig über seine Zukunft.', done: s => !!s.flags.done_ottokar_bewerbung },
      { id: 'jule', text: 'Sprich mit Jule über den Vertrieb.', done: s => !!s.flags.done_jule_bewerbung },
      { id: 'emre', text: 'Sprich mit Emre über die Zahlen.', done: s => !!s.flags.done_emre_bewerbung },
      { id: 'helfer', text: 'Stelle einen Brauhelfer ein.', done: s => !!s.auto?.helper },
    ],
    outro: 'Zum ersten Mal brennt abends noch Licht, obwohl du nicht da bist. Es ist ein gutes Gefühl – und ein bisschen unheimlich.',
    events: [
      { id: 'ottokar_bewerbung', when: () => true },
      { id: 'jule_bewerbung', when: s => !!s.flags.done_ottokar_bewerbung },
      { id: 'emre_bewerbung', when: s => !!s.flags.done_jule_bewerbung },
    ],
  },
  {
    id: 'marke', title: 'Kapitel 13 – Name & Etikett',
    intro: 'Bier ist Geschmack, aber im Regal ist es erst einmal ein Gesicht. Dein Logo soll Opas Garage atmen und trotzdem im Supermarkt bestehen. Dafür brauchst du einen Namen mit Haltung und ein Etikett, das nicht nach Praktikum aussieht.',
    objectives: [
      { id: 'name', text: 'Entscheide, wofür deine Marke steht.', done: s => !!s.flags.done_markenname },
      { id: 'etikett', text: 'Entscheide dich für ein Etikett.', done: s => !!s.flags.done_etikett },
      { id: 'logo', text: 'Gestalte dein Logo im Icon-Creator.', done: s => !!s.brand?.designed },
      { id: 'kritik', text: 'Erhalte eine Kritik mit 70 Punkten oder mehr.', done: s => (s.stats.bestReview || 0) >= 70, progress: s => `bisher ${Math.round(s.stats.bestReview || 0)}` },
      { id: 'rep65', text: 'Erreiche 65 Ruf.', done: s => s.reputation >= 65, progress: s => `Ruf ${Math.floor(s.reputation)} / 65` },
    ],
    outro: 'Das Etikett hängt im Regal des Dorfladens, ordentlich zwischen zwei Industrie-Pilsen. Es sieht aus, als hätte es dort immer gehangen.',
    events: [
      { id: 'markenname', when: () => true },
      { id: 'etikett', when: s => !!s.flags.done_markenname },
    ],
  },
  {
    id: 'eroeffnung', title: 'Kapitel 14 – Tag der offenen Tür',
    intro: 'Das Sudhaus ist geputzt, das Logo hängt über dem Tor, die Fässer stehen Spalier. Heute kommt das ganze Dorf – und mit ihm die Presse, der Bürgermeister und, ganz hinten, Frau Zollinger mit Klemmbrett. Wenn die Eröffnung gelingt, bist du nicht mehr „der Enkel von Heinrich“. Dann bist du der Brauer.',
    objectives: [
      { id: 'fest', text: 'Feiere die Eröffnung.', done: s => !!s.flags.done_eroeffnungsfest },
      { id: 'q1', text: 'Liefere das Helle für das Fest.', done: s => questSettled(s, 'eroeff_helles') },
      { id: 'q2', text: 'Liefere das Weizen für die Terrasse.', done: s => questSettled(s, 'eroeff_weizen') },
      { id: 'q3', text: 'Liefere das Märzen für die Ehrengäste.', done: s => questSettled(s, 'eroeff_maerzen') },
      { id: 'rep70', text: 'Erreiche 70 Ruf.', done: s => s.reputation >= 70, progress: s => `Ruf ${Math.floor(s.reputation)} / 70` },
      { id: 'rank', text: 'Steige in der Bierliga unter die Top 12.', done: s => rankOf(s) <= 12, progress: s => `Platz ${rankOf(s)}` },
    ],
    outro: 'Um Mitternacht liegen sich Klaus und Gerda in den Armen, Frau Zollinger hat die Schuhe ausgezogen, und die Kinder schlafen auf den Bierbänken. Dein Bier hat Menschen zusammengebracht. Dafür hat es Opa gebraut.',
    events: [
      { id: 'eroeffnungsfest', when: () => true },
      { id: 'zollinger_besuch', when: s => !!s.flags.done_eroeffnungsfest },
    ],
  },
];

export const act4Events = {
  halle: {
    title: 'Der Standort', who: 'klaus',
    text: 'Drei Möglichkeiten: Die alte Wassermühle am Dorfrand – wunderschön, feucht, mit eigenem Bach (Ausbau 1200 €, Miete 220 €/Monat). Eine Halle im Gewerbepark – nüchtern, günstig, mit Gabelstaplerzufahrt (600 €, Miete 220 €/Monat). Oder du baust Garage und Gerdas Keller aus und bleibst, wo du bist (900 €, keine Miete).',
    choices: [
      { id: 'muehle', label: '🏚️ Alte Wassermühle: Atmosphäre, Heimat – und Feuchtigkeit.', enabled: s => s.cash >= 1200,
        apply: s => { spend(s, 1200, 'den Mühlenausbau'); s.flags.halle = true; s.flags.halle_art = 'muehle'; persona(s, 'heimat', 2); addRep(s, 4); return 'Das Mühlrad dreht sich wieder, und Frau Kowalski bringt Kuchen. Der Keller riecht nach Stein und Hefe. (Ruf +4)'; } },
      { id: 'gewerbepark', label: '🏭 Gewerbepark: pragmatisch, günstig, anschlussfreudig.', enabled: s => s.cash >= 600,
        apply: s => { spend(s, 600, 'den Gewerbeausbau'); s.flags.halle = true; s.flags.halle_art = 'park'; persona(s, 'bold', 1); s.hygiene = Math.min(0.8, s.hygiene + 0.05); return 'Weißer Estrich, Bodenablauf, Starkstrom: Hygiene wie aus dem Lehrbuch. Nicht gemütlich, aber kolossal praktisch. (Hygiene +)'; } },
      { id: 'garage', label: '🏠 In Garage und Keller bleiben und ausbauen – keine Miete (bis 900 €, was du hast – den Rest packt Klaus mit an).',
        apply: s => { fine(s, 900); s.flags.halle_art = 'garage'; persona(s, 'trad', 2); addHonor(s, 2); return 'Opa hätte nichts anderes gewollt. Du stemmst Wände, ziehst Leitungen, und Klaus hilft mit Bohrmaschine und Redseligkeit. (Ansehen +2)'; } },
    ],
  },
  umbau_panne: {
    title: 'Wasserschaden im Neubau', who: 'klaus',
    text: 'Mitten im ersten Dauerbetrieb platzt ein Anschluss. Ein Finger breit Wasser steht auf dem Boden, die Gärtanks schwimmen fast. Klaus rennt mit Eimern herein, der Hausmeister mit Telefon.',
    choices: [
      { id: 'fachfirma', label: '🔧 Die Fachfirma holen (700 €) – sauber und gewährleistet.', enabled: s => s.cash >= 700,
        apply: s => { spend(s, 700, 'die Fachfirma'); s.hygiene = Math.min(0.8, s.hygiene + 0.03); return 'In zwei Stunden ist alles trocken, in zwei Tagen gibt es einen Prüfbericht. Teuer, aber ruhig. (Hygiene +)'; } },
      { id: 'selbst', label: '🛠️ Selbst reparieren: Klaus kennt einen Kumpel.',
        apply: s => { if (rand(s) < 0.55) { addXp(s, 40, 'Improvisieren'); addHonor(s, 1); return 'Klaus und sein Kumpel schaffen es mit Dichtband, Humor und viel Kaffee. Es hält. (Erfahrung +40, Ansehen +1)'; } const c = fine(s, 1400); return `Die Reparatur hält zwei Tage. Dann wird es richtig teuer: Die Fachfirma holt aus, du zahlst ${c} €. Ein Lehrstück in Demut.`; } },
      { id: 'versicherung', label: '📄 Die Betriebshaftpflicht ins Spiel bringen.', enabled: s => s.license,
        apply: s => { const c = fine(s, 300); addRep(s, -1); return `Die Versicherung zahlt – bis auf eine Selbstbeteiligung (${c} €) und viel Papier. Das Gerücht, du hättest den Schaden „bestellt“, verbreitet sich schneller als die Rechnung. (Ruf −1)`; } },
    ],
  },
  klaus_dachboden: {
    title: 'Klaus’ Dachboden', who: 'klaus',
    text: 'Klaus winkt dich zu sich, mit Staub im Haar. „Ich habe beim Aufräumen eine Kiste von meinem Vater gefunden: Fotos, Etiketten, Sudprotokolle. Dein Opa und mein Vater haben sich jeden Samstag getroffen. Da ist noch eine Seite von eurem Rezeptbuch dabei.“',
    choices: [
      { id: 'abholen', label: '📦 Sofort mit Klaus auf den Dachboden und die Kiste durchsehen.',
        apply: s => { s.flags.klaus_ally = true; addHonor(s, 2); persona(s, 'heimat', 1); return 'Ihr sitzt bis Mitternacht zwischen Etiketten und Staub. Klaus erzählt Geschichten, die selbst Gerda nicht kennt.' + giveFragment(s, 'malz'); } },
      { id: 'spaeter', label: '⏳ Sagen, du schaust am Wochenende vorbei.', done: false,
        apply: s => { s.flags.retry_klaus_dachboden = s.day + 14; return 'Klaus zuckt mit den Schultern: „Staub wartet gern.“ (Frage kommt in 14 Tagen wieder)'; } },
    ],
  },
  ottokar_bewerbung: {
    title: 'Ottokar Würzig will noch einmal', who: 'ottokar',
    text: 'Ottokar steht im Türrahmen, den Hut in den Händen. „Vierzig Jahre Brauerei, und seit meiner Pensionierung koche ich Bohnen. Ich habe etwas, das ich dir zeigen will: die sechste Seite von Heinrichs Buch, über die Reifung. Und ich würde gern noch einmal etwas Großes mitbauen.“',
    choices: [
      { id: 'einstellen', label: '🧑‍🏭 Ottokar als Braumeister einstellen (380 € im Monat): Hygiene steigt, jeder Sud bringt Erfahrung.',
        apply: s => { s.flags.emp_ottokar = true; s.flags.ottokar_ally = true; persona(s, 'trad', 2); return 'Ottokar krempelt die Ärmel hoch: „Als Erstes schrubben wir den Kessel. Dann reden wir.“' + giveFragment(s, 'reifung'); } },
      { id: 'beraten', label: '📝 Ihn einmalig als Berater bezahlen (300 €).', enabled: s => s.cash >= 300,
        apply: s => { spend(s, 300, 'Ottokars Beratung'); s.flags.ottokar_ally = true; addXp(s, 100, 'Beratung von Ottokar'); return 'Er verbringt zwei Wochen im Sudhaus, trinkt vierzehn Liter Tee und hinterlässt ein Notizbuch mit Verbesserungsvorschlägen. (Erfahrung +100)' + giveFragment(s, 'reifung'); } },
      { id: 'absagen', label: '🚪 Höflich absagen – du willst es allein schaffen.',
        apply: s => { persona(s, 'bold', 1); return 'Er nickt, setzt den Hut auf und geht. Von der Seite hast du nie wieder gehört.'; } },
    ],
  },
  jule_bewerbung: {
    title: 'Jule und die Vertriebsidee', who: 'jule',
    text: 'Jule ist 24, hat einen Marketing-Abschluss und ein Smartphone, das ständig vibriert. „Ich kann Bier verkaufen, bevor es gebraut ist. Und ich weiß, wie man aus einem Garagenbier eine Marke macht.“ Sie sieht dich an, als wäre das die einzige Option.',
    choices: [
      { id: 'einstellen', label: '📱 Jule in Teilzeit einstellen (260 € im Monat): monatlich Ruf +0,5 und mehr Reichweite.',
        apply: s => { s.flags.emp_jule = true; persona(s, 'bold', 1); return 'Zwei Wochen später haben deine Biere eigene Hashtags. Der erste Post: „Heinrichs Hopfen – Heimat, die man trinken kann.“'; } },
      { id: 'projekt', label: '🧪 Zuerst ein Projekt zusammen testen (100 €).', enabled: s => s.cash >= 100,
        apply: s => { spend(s, 100, 'das Projekt'); addRep(s, 3); return 'Ihre erste Aktion – ein „Mitbrau-Tag“ – bringt zwölf Anmeldungen und einen Zeitungsartikel. (Ruf +3)'; } },
      { id: 'absagen', label: '🙅 Absagen – Bier verkauft sich selbst.',
        apply: s => { persona(s, 'trad', 1); return 'Jule schüttelt den Kopf: „Es verkauft sich nicht selbst. Es wird verkauft – oder von anderen vergessen.“'; } },
    ],
  },
  emre_bewerbung: {
    title: 'Emre und die Bilanz', who: 'zoll',
    text: 'Emre ist Buchhalter, trägt Krawatte im Sudhaus und lächelt, wenn er Konten sortiert. „Ihre Biersteuer-Meldungen sind eine Liebeserklärung an das Chaos. Ich kann daraus Ordnung machen – und Ihnen jeden Monat einen Teil der Steuern zurückholen, den Sie sonst verschenken.“',
    choices: [
      { id: 'einstellen', label: '📊 Emre einstellen (240 € im Monat): holt 25 % der Biersteuer zurück.',
        apply: s => { s.flags.emp_emre = true; addHonor(s, 1); return 'Er legt einen Ordner an. Auf dem Rücken steht: „Heinrichs Hausbrauerei – Anfang.“'; } },
      { id: 'steuerberater', label: '📚 Nur einen Steuerberater für die Jahresmeldung (150 €).', enabled: s => s.cash >= 150,
        apply: s => { spend(s, 150, 'den Steuerberater'); addXp(s, 25, 'Steuerlehre'); return 'Der Berater ist freundlich, schnell und teuer – aber das Finanzamt ist beeindruckt. (Erfahrung +25)'; } },
      { id: 'absagen', label: '🙅 Absagen – du machst die Zahlen selbst.',
        apply: s => { persona(s, 'trad', 1); return 'Du behältst die Kontrolle. Und den Papierkram.'; } },
    ],
  },
  markenname: {
    title: 'Wofür steht dein Name?', who: 'jule',
    text: 'Auf dem Tisch drei Entwürfe: „Heinrichs Hausbrauerei – gebraut wie früher“ (Tradition, Fachwerk, Schnörkel), „Hopfenfunk Brauwerk“ (modern, grell, neon) oder „Kesselbacher Gemeinde-Bräu“ (regional, bodenständig, mit Wappen). Jule: „Jeder erzählt eine andere Geschichte. Such dir deine aus.“',
    choices: [
      { id: 'tradition', label: '🏛️ Tradition: „Heinrichs Hausbrauerei – gebraut wie früher“.',
        apply: s => { s.flags.marke = 'tradition'; persona(s, 'trad', 2); addHonor(s, 2); return 'Das Fachwerk-Logo erinnert an Opas Stempel. Gerda bekommt feuchte Augen, die Stammkunden nicken.'; } },
      { id: 'modern', label: '⚡ Modern: „Hopfenfunk Brauwerk“.',
        apply: s => { s.flags.marke = 'modern'; persona(s, 'bold', 2); addRep(s, 3); return 'Neonpink auf mattschwarz. Die Craft-Szene feiert es, die Altgäste fragen, ob das ein Club ist. (Ruf +3)'; } },
      { id: 'regional', label: '🏘️ Regional: „Kesselbacher Gemeinde-Bräu“.',
        apply: s => { s.flags.marke = 'regional'; persona(s, 'heimat', 2); addHonor(s, 2); s.flags.toni_ally = s.flags.toni_ally || !!s.flags.regional; return 'Wappen, Wald, Wasserrad. Wer hier wohnt, fühlt sich gemeint.'; } },
    ],
  },
  etikett: {
    title: 'Das Etikett', who: 'jule',
    text: 'Nun das Etikett: Eine Grafikagentur würde 350 € nehmen und ein Hochglanzergebnis liefern. Jule kennt jemanden, der es günstig macht – mit Stil, aber ohne Garantie. Und Klaus’ achtjährige Enkelin hat bereits einen Bierkrug mit Gesicht gemalt, das du eigentlich nicht ablehnen kannst.',
    choices: [
      { id: 'agentur', label: '🖌️ Die Grafikagentur beauftragen (350 €): alles verkauft sich 4 % besser.', enabled: s => s.cash >= 350,
        apply: s => { spend(s, 350, 'die Grafikagentur'); const b = brandOf(s); if (!b.orders.includes('grafik')) b.orders.push('grafik'); return 'Drei Entwürfe, zwei Korrekturschleifen, ein Etikett, das nach Regal aussieht. Es funktioniert.'; } },
      { id: 'jule', label: '🎨 Jules Kontakt: günstig, mutig, ein bisschen wild.',
        apply: s => { addRep(s, 2); persona(s, 'bold', 1); return 'Das Etikett zeigt einen Hirsch mit Bierglas. Die einen finden es genial, die anderen verwirrend. Beides wird besprochen. (Ruf +2)'; } },
      { id: 'enkelin', label: '🧒 Die Krug-Zeichnung der Enkelin nehmen.',
        apply: s => { addHonor(s, 3); s.flags.klaus_ally = true; persona(s, 'heimat', 1); return 'Der Krug hat Augen, Nase und einen schiefen Henkel. Im Dorfladen lächelt jede Kundin. (Ansehen +3)'; } },
    ],
  },
  eroeffnungsfest: {
    title: 'Die Eröffnung', who: 'klaus',
    text: 'Die Gäste strömen herein, die Blaskapelle stimmt sich ein, Frau Kowalski kontrolliert die Schaumkrone. Jetzt kommt die Frage nach der Art des Fests: groß mit Zelt und Band, klein mit Hausmusik, oder dörflich mit Kuchen von allen.',
    choices: [
      { id: 'gross', label: '🎪 Groß feiern: Zelt, Band, Presse (500 €).', enabled: s => s.cash >= 500,
        apply: s => { spend(s, 500, 'das Fest'); addRep(s, 6); persona(s, 'bold', 1); return 'Tausend Gäste, vierzehn Fässer, zwei Zeitungsartikel, ein Polizeieinsatz wegen zu lauter Zugabe. Ein Fest für die Chronik. (Ruf +6)'; } },
      { id: 'dorf', label: '🥧 Dörflich feiern: Kuchen, Kartoffelsalat, Blasmusik (150 €).', enabled: s => s.cash >= 150,
        apply: s => { spend(s, 150, 'das Fest'); addHonor(s, 4); addRep(s, 2); persona(s, 'heimat', 1); return 'Jeder bringt etwas mit, am Ende ist mehr da als gegessen werden kann. Gerda wirft ein Tuch über den Rest – für morgen. (Ansehen +4, Ruf +2)'; } },
      { id: 'klein', label: '🥂 Klein halten: nur Familie und Freunde, danach Sud.',
        apply: s => { addHonor(s, 1); persona(s, 'trad', 1); return 'Zwölf Leute, ein Fass, ein Toast auf Opa. Es ist still und genau richtig – nur die Presse ist verärgert. (Ansehen +1)'; } },
    ],
  },
  zollinger_besuch: {
    title: 'Frau Zollinger mit Klemmbrett', who: 'zoll',
    text: 'Während das Fest abebbt, kontrolliert Frau Zollinger in aller Ruhe Gärkeller, Steuerlager und Abfüllung. Sie macht Notizen, schweigt, öffnet jede Tür. Am Ende steht sie vor dir. „Ich habe noch eine Frage zu Ihrem Hygienekonzept.“',
    choices: [
      { id: 'zeigen', label: '📋 Alles offenlegen: Reinigungsprotokolle, Sudbuch, Temperaturkurven.',
        apply: s => { if (s.flags.vorbestraft || s.flags.zollinger_beleidigt) { addHonor(s, 1); return 'Sie liest jede Zeile. „Ihre Vergangenheit hat Spuren, Herr Brauer. Aber Ihre Gegenwart gefällt mir.“ Sie stempelt die Betriebserlaubnis mit zusammengekniffenen Lippen. (Ansehen +1)'; } s.flags.zollinger_ally = true; addHonor(s, 4); return 'Sie blättert, nickt, blättert weiter. „Das ist die ordentlichste Dokumentation, die ich in diesem Jahr gesehen habe.“ Ein Lächeln, so selten wie ein trockener Keller im April. (Ansehen +4)'; } },
      { id: 'bewirten', label: '🍺 Ihr zuerst ein Bier einschenken und dann reden.',
        apply: s => { addHonor(s, 1); addXp(s, 20, 'Behördengespräch'); return 'Sie trinkt einen halben Schluck, lässt den Rest stehen und nimmt trotzdem alles ab. „Dienstlich trinke ich nie.“ (Ansehen +1)'; } },
    ],
  },
};
