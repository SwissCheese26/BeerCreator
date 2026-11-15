// Ergänzungen zu den Kapiteln 1–6: Nachbarn, Straßenfest, Amt, Markt, Gerdas Keller, Merle, Toni – und Opas Rezeptbuch (Seite 1–3).
import { LICENSE_COST } from '../config.js';
import { spend } from '../state.js';
import { addXp } from '../progress.js';
import { addRep, addHonor, addCash, giveFragment, persona, stockL, stockOf, lvl, jury, medalFor, offerQuest, QUESTS, QUEST_PEOPLE } from './common.js';
import { rand } from '../state.js';

Object.assign(QUEST_PEOPLE, {
  kowalski: ['🧓', 'Frau Kowalski'], zollinger: ['📋', 'Frau Zollinger'], merle: ['🧪', 'Merle Trübsal'], presse: ['📰', 'Der Kesselbacher Bote'],
  falk: ['💼', 'Dr. Konrad Falk'], dreyer: ['🏭', 'Herr Dreyer'], jule: ['🧑‍🎤', 'Jule'], lindner: ['🛒', 'Getränkemarkt Lindner'],
});

/** Take liters from the stock, worst beers first (für Geschenke und Proben). */
export function takeBeer(s, liters) {
  let left = liters;
  for (const b of [...stockOf(s)].sort((a, c) => a.quality - c.quality)) {
    const t = Math.min(b.liters, left); b.liters = Math.round((b.liters - t) * 100) / 100; left -= t;
    if (left <= 0.001) break;
  }
  s.stats.givenL = Math.round((s.stats.givenL + liters - Math.max(0, left)) * 100) / 100;
}

// ----- Story-Aufträge (Fristen mit zweiter Chance, Konsequenzen bei Scheitern) -----
Object.assign(QUESTS, {
  kowalski_garten: { story: true, who: 'kowalski', title: 'Frau Kowalskis Goldene Hochzeit', kind: 'deliver', liters: 12, minQ: 45, days: 40, retryDays: 25,
    text: 'Fünfzig Jahre verheiratet, und mein Karl behauptet, er habe nur wegen des Biers „ja“ gesagt. Hättest du 12 Liter für den Garten? Irgendein trinkbares Bier – aber bitte kein saures!',
    reward: s => { addRep(s, 2); addHonor(s, 2); s.flags.kowalski_freund = true; return 'Karl hebt das Glas: „Auf Heinrichs Enkel!“ Frau Kowalski wird nie wieder über den Maischegeruch klagen. Ruf +2, Ansehen +2.'; },
    fail: s => { addHonor(s, -1); s.flags.kowalski_grollt = true; } },
  fest_fass: { story: true, who: 'klaus', title: 'Zwei Fässer für das Straßenfest', kind: 'deliver', liters: 30, minQ: 52, days: 50, retryDays: 30,
    text: 'Das Fest rückt näher, und die Straße fragt schon nach „dem Garagenbier“. Ich brauche 30 Liter, die man herzeigen kann – Qualität mindestens 52. Verschenkt, versteht sich.',
    reward: s => { addRep(s, 3); addHonor(s, 2); s.flags.klaus_ally = true; return 'Klaus stellt dich auf eine Bierkiste und lässt dich hochleben. Die Straße kennt jetzt deinen Namen. Ruf +3, Ansehen +2.'; },
    fail: s => { addRep(s, -2); s.flags.fest_blamage = true; } },
  baeckerei: { story: true, who: 'lindner', title: 'Bier zum Frühlingsbrot', kind: 'deliver', styles: ['helles', 'pils', 'weizen'], liters: 20, minQ: 58, days: 45, retryDays: 30, paid: true,
    text: 'Die Bäckerei Schröder zeigt zum Frühlingsfest ein „Brot-und-Bier-Menü“. Wir brauchen 20 Liter Helles, Pils oder Weizen. 150 € – und deine Rechnung wird nicht beanstandet.',
    reward: s => { addCash(s, 150); addRep(s, 2); return '150 € und der Hinweis, dass das Bierbrot jetzt „Heinrichs Kruste“ heißt. Ruf +2.'; },
    fail: s => { addRep(s, -1); } },
  gerda_maerzen: { story: true, who: 'gerda', title: 'Gerdas Märzen-Probe', kind: 'deliver', styles: ['maerzen'], liters: 20, minQ: 62, days: 70, retryDays: 40,
    text: 'Dein Opa hat jedes Jahr ein Märzen gebraut, bernsteinfarben und rund. Ich habe sein Hefebuch noch – aber ich gebe es nur dem, der ein ordentliches Märzen hinbekommt. 20 Liter, Qualität 62.',
    reward: s => { s.flags.gerda_ally = true; addHonor(s, 3); return 'Gerda kostet, schweigt, und holt dann ein in Wachstuch gewickeltes Heft aus der Kommode.' + giveFragment(s, 'hefe'); },
    fail: s => { s.flags.gerda_enttaeuscht = true; addHonor(s, -2); } },
  kalle_pils: { story: true, who: 'verein', title: 'Kalles Fassbier-Premiere', kind: 'deliver', styles: ['pils'], liters: 40, minQ: 60, days: 60, retryDays: 30, ibu: [30, 42], paid: true,
    text: 'Mein Vereinsheim bekommt eine Zapfanlage! Dafür brauche ich 40 Liter Pils aus dem Ort – knackig, mit 30 bis 42 IBU, sonst murren die Stammgäste. 260 € Festpreis.',
    reward: s => { addCash(s, 260); addRep(s, 3); s.regulars = Math.min(60, (s.regulars || 0) + 4); return 'Die Zapfanlage zischt, die Stammgäste nicken. 260 €, Ruf +3 und vier neue Stammkunden.'; },
    fail: s => { addRep(s, -2); s.flags.kalle_sauer = true; } },
});

export const earlyEvents = {
  seite_wasser: {
    title: 'Hinter dem Foto', who: 'opa',
    text: 'Beim Aufräumen fällt dir Opas gerahmtes Foto von der Garagenwand. Dahinter klebt ein vergilbtes Blatt: „Rezeptbuch, Seite 1 – das Wasser“. Die restlichen Seiten fehlen. Auf der Rückseite steht: „Wer sie alle findet, kennt mein Geheimnis.“',
    choices: [
      { id: 'teilen', label: '🧔 Klaus das Blatt zeigen – er sammelt alte Brauer-Geschichten.',
        apply: s => { s.flags.klaus_ally = true; return 'Klaus liest zwei Mal, pfeift durch die Zähne und verspricht, im Heimatverein nach den anderen Seiten zu fragen.' + giveFragment(s, 'wasser'); } },
      { id: 'still', label: '🤫 Das Blatt für dich behalten und heimlich ausprobieren.',
        apply: s => { addXp(s, 20, 'Wasser-Experimente'); persona(s, 'trad', 1); return 'Du kochst abends Wasser ab, misst Härte mit dem Teststreifen aus dem Aquarienladen und schreibst alles ins Sudbuch.' + giveFragment(s, 'wasser'); } },
    ],
  },
  nachbarin: {
    title: 'Beschwerde über den Maischegeruch', who: 'klaus',
    text: 'Frau Kowalski von gegenüber steht am Gartenzaun, die Hände in die Hüften gestemmt. „Es riecht seit Wochen wie ein Brotkasten im Sommer! Was treiben Sie da in Heinrichs Garage?“',
    choices: [
      { id: 'probe', label: '🍺 Ihr 5 Liter von deinem Bier anbieten (kostet 5 L aus dem Lager).', enabled: s => stockL(s) >= 5,
        apply: s => { takeBeer(s, 5); addRep(s, 2); s.flags.kowalski_freund = true; return 'Sie nippt, verzieht den Mund – und fragt, ob es auch eine mildere Variante gibt. Ab da winkt sie dir zu. (Ruf +2)'; } },
      { id: 'erklaeren', label: '🗣️ Geduldig erklären, was Maischen ist.',
        apply: s => { addHonor(s, 1); addXp(s, 10, 'Nachbarschaftsgespräch'); return 'Nach zehn Minuten kennt sie den Unterschied zwischen Würze und Wasser. Sie bleibt skeptisch, aber höflich. (Ansehen +1)'; } },
      { id: 'abtun', label: '🙄 „Das ist Hobby, da müssen Sie durch.“',
        apply: s => { addRep(s, -2); s.flags.kowalski_grollt = true; return 'Frau Kowalski rauscht ab. Am nächsten Tag liegt ein Zettel im Briefkasten: „Ich beobachte Sie.“ (Ruf −2)'; } },
    ],
  },
  fest_abend: {
    title: 'Das Straßenfest', who: 'klaus',
    text: 'Lampions zwischen den Gartenzäunen, Biertischgarnituren auf dem Asphalt, die Kinder jagen sich mit Wasserpistolen. Klaus drückt dir einen Holzschlegel in die Hand: „Dein Fass, dein Anstich!“ Drei Dutzend Nachbarn halten die Krüge hoch.',
    choices: [
      { id: 'anstich', label: '🔨 Das Fass mit dem Schlegel anstechen – am besten in einem Schlag.',
        apply: s => { if (rand(s) < 0.5) { addRep(s, 4); return 'Zwei Schläge, ein Zischen, kaum ein Spritzer. Die Straße jubelt. (Ruf +4)'; } addRep(s, 2); return 'Der Zapfhahn springt, und Klaus bekommt eine Dusche. Die Straße liegt vor Lachen am Boden – und mag dich dafür umso mehr. (Ruf +2)'; } },
      { id: 'verkostung', label: '🥂 Eine kleine Verkostung mit Erklärungen anbieten (10 L).', enabled: s => stockL(s) >= 10,
        apply: s => { takeBeer(s, 10); addRep(s, 3); addXp(s, 25, 'Verkostung'); persona(s, 'trad', 1); return 'Du erklärst Malz, Hopfen, Hefe an Pappbechern. Frau Kowalski fragt, ob sie das nächste Mal helfen darf. (Ruf +3, Erfahrung +25)'; } },
      { id: 'ruhig', label: '🧑‍🍳 Im Hintergrund bleiben und nur zapfen.',
        apply: s => { addHonor(s, 1); return 'Du zapfst, grinst, hörst zu. Zwischen Bratwurst und Kartoffelsalat sammelst du die ehrlichsten Urteile. (Ansehen +1)'; } },
    ],
  },
  amt_hinweis: {
    title: 'Ein Brief vom Hauptzollamt', who: 'zoll',
    text: 'Der Brief ist freundlich formuliert, was ihn noch bedrohlicher macht: „Uns ist zu Ohren gekommen, dass in Ihrer Garage Bier gebraut und abgegeben wird. Wir laden Sie zu einem unverbindlichen Gespräch ein.“ Unterschrieben: Frau Zollinger.',
    choices: [
      { id: 'nachmelden', label: `📋 Zum Gespräch gehen und alles nachmelden (${LICENSE_COST} €).`, enabled: s => s.cash >= LICENSE_COST,
        apply: s => { spend(s, LICENSE_COST, 'die Anmeldungen'); s.license = true; s.flags.schwarz = false; s.flags.zollinger_ally = true; addHonor(s, 3); return 'Frau Zollinger lächelt dünn: „Selbstanzeige ist immer besser als Ertapptwerden.“ Sie stempelt, ohne Fragen zur Vergangenheit zu stellen. (Ansehen +3)'; } },
      { id: 'abwimmeln', label: '🫥 Das Gespräch „verschieben“ und weiter heimlich verkaufen.', done: false,
        apply: s => { s.flags.retry_amt_hinweis = s.day + 40; s.flags.zoll_misstrauen = true; addHonor(s, -2); return 'Die Terminvereinbarung versandet. Der Zoll vergisst nichts. (Ansehen −2, das Amt fragt in 40 Tagen wieder)'; } },
    ],
  },
  markt_stand: {
    title: 'Ein Platz auf dem Wochenmarkt', who: 'gerda',
    text: 'Gerda kennt die Marktmeisterin seit der Schulzeit. „Samstags ist am Brunnen ein Standplatz frei. Nicht groß, aber die Leute kaufen dort mit dem Herzen.“',
    choices: [
      { id: 'festerplatz', label: '🧺 Den festen Platz nehmen (40 € Gebühr, +10 Stammkunden).', enabled: s => s.cash >= 40,
        apply: s => { spend(s, 40, 'die Standgebühr'); s.regulars = Math.min(60, (s.regulars || 0) + 10); s.flags.markt_stand = true; persona(s, 'heimat', 1); return 'Samstag früh, 6 Uhr: Du klappst die Bierbank aus. Bis mittags kennst du die Hälfte der Kundschaft beim Vornamen.'; } },
      { id: 'mit_gerda', label: '👵 Gerda helfen lassen – sie verkauft am Stand ihre Marmelade zu deinem Bier.',
        apply: s => { s.flags.gerda_ally = true; s.regulars = Math.min(60, (s.regulars || 0) + 6); addHonor(s, 1); return 'Gerda kassiert mit Argusaugen und flirtet unverschämt mit den Stammkunden. Bier und Marmelade verkaufen sich im Doppelpack. (+6 Stammkunden)'; } },
      { id: 'verzichten', label: '🚲 Verzichten – dir ist der Aufwand zu groß.',
        apply: () => 'Du bleibst bei der Hoftür. Den Platz bekommt ein Käsehändler.' },
    ],
  },
  gerda_buch: {
    title: 'Gerdas Kommode', who: 'gerda',
    text: 'Gerda führt dich durch den Gewölbekeller zu einer verschlossenen Truhe. „Dein Opa hat mir einmal ein Heft anvertraut, ‚Seite 2 vom Rezeptbuch‘. Aber wenn du es willst, will ich vorher wissen, dass du Opas Märzen kannst.“ Ihre Augen blitzen.',
    choices: [
      { id: 'versprechen', label: '🤝 Versprechen: ein ordentliches Märzen für Gerda.',
        apply: s => { offerQuest(s, 'gerda_maerzen'); addCash(s, 250); return 'Gerda nickt zufrieden und steckt dir einen Umschlag zu: „Für den Kessel. Dein Opa hätte nicht gewollt, dass du in der Garage versauerst.“ (250 € Starthilfe, neuer Auftrag: Gerdas Märzen-Probe)'; } },
      { id: 'drängeln', label: '😤 Drängeln – das Heft gehört schließlich deiner Familie.',
        apply: s => { offerQuest(s, 'gerda_maerzen'); s.flags.gerda_enttaeuscht = true; addHonor(s, -1); return 'Gerda zieht die Truhe zu. „Familie heißt Geduld, mein Junge.“ Sie gibt dir trotzdem die Chance – aber ihr Ton ist kühler. (Ansehen −1)'; } },
    ],
  },
  kalle_wirt: {
    title: 'Vereinswirt Kalle will Fassbier', who: 'verein',
    text: 'Kalle wischt sich die Hände an der Schürze ab. „Dein Bier ist das einzige, nach dem meine Jungs fragen. Mach mir einen Preis – und am besten ausschließlich für mich, dann zahle ich mehr.“',
    choices: [
      { id: 'exklusiv', label: '🔒 Exklusiv liefern: Kalle zahlt 10 % mehr, andere Wirte sind pikiert.',
        apply: s => { s.flags.kalle_exklusiv = true; addCash(s, 120); addRep(s, 1); persona(s, 'heimat', 1); offerQuest(s, 'kalle_pils'); return 'Handschlag und eine Anzahlung von 120 €. In den anderen Wirtschaften wird man künftig mit spitzer Zunge über „Heinrichs Hofbrauer“ reden. (Ruf +1)'; } },
      { id: 'offen', label: '🔓 Für alle Wirte offen bleiben.',
        apply: s => { s.flags.kalle_offen = true; addHonor(s, 1); offerQuest(s, 'kalle_pils'); return 'Kalle schnauft, nickt dann. „Freiheit ist auch was wert.“ Du bleibst Lieferant für alle. (Ansehen +1)'; } },
    ],
  },
  merle_trifft: {
    title: 'Die Frau vom Nachbartisch', who: 'jury',
    text: 'Nach der Anmeldung zur Landesmeisterschaft stellt sich eine Brauerin neben dich: Merle Trübsal, Gründerin von „Trübsal Brewing“. Sie trägt eine Lederschürze und ein Lächeln wie ein Schraubenschlüssel. „Du bist Heinrichs Enkel. Mein Großvater hat mit deinem gebraut – und sich mit ihm zerstritten. Ich bin gespannt, ob du Opas Sturheit geerbt hast.“',
    choices: [
      { id: 'freundlich', label: '🤝 Die Hand reichen: „Vielleicht schreiben wir die Geschichte um.“',
        apply: s => { s.flags.merle_respekt = true; persona(s, 'trad', 1); addHonor(s, 2); return 'Sie zögert einen Wimpernschlag, dann drückt sie fest zu. „Gut. Dann gewinne ich eben fair.“ (Ansehen +2)'; } },
      { id: 'stichelnd', label: '😏 Kontern: „Sturheit habe ich, Talent auch – was hast du?“',
        apply: s => { s.flags.merle_rivalin = true; persona(s, 'bold', 1); return 'Sie lacht kurz auf. „Das wird lustig.“ Von da an steht ihr Stand immer genau gegenüber von deinem.'; } },
      { id: 'ausweichen', label: '🙈 Nichts sagen und zur Anmeldung gehen.',
        apply: () => 'Du spürst ihren Blick im Rücken, bis du um die Ecke bist.' },
    ],
  },
  toni_ernte: {
    title: 'Erntedank in der Hallertau', who: 'toni',
    text: 'Toni Dolde schickt eine Postkarte: „Hopfenernte! Komm vorbei, wenn du echten Duft in der Nase willst. Und bring Hunger mit.“ Das Feld ist ein grünes Meer; die Pflücker sitzen mit schwarzen Händen an langen Tischen.',
    choices: [
      { id: 'pfluecken', label: '🌿 Einen ganzen Tag mitpflücken und Tonis Familie kennenlernen.',
        apply: s => { s.flags.toni_ally = true; persona(s, 'heimat', 2); addHonor(s, 2); return 'Du hast Blasen an den Händen und Dolden in den Haaren. Am Abend legt Toni dir eine Seite auf den Tisch: „Das lag bei Opas Hopfenlieferung. Er wollte, dass du sie hier findest.“' + giveFragment(s, 'hopfen'); } },
      { id: 'kurz', label: '⏱️ Nur kurz vorbeischauen – die Sude warten.',
        apply: s => { addRep(s, 1); return 'Toni nimmt es sportlich: „Hopfen wartet nicht – aber ich warte auf nächstes Jahr.“ (Ruf +1)'; } },
    ],
    when: s => !!s.flags.regional,
  },
  max_vertreter: {
    title: 'Der Vertreter von HopfenMax', who: 'toni',
    text: 'Herr Pfeiffer von HopfenMax erscheint mit Aktenkoffer und Probierset. „Unser Extrakt entwickelt sich prächtig! Sie bemerken sicher den günstigen Preis. Und wir haben ein Upgrade: Premium-Extrakt mit ‚Aromaversprechen‘.“ Er blinzelt, als wäre das ein Scherz.',
    choices: [
      { id: 'probieren', label: '🧪 Das Premium-Extrakt probieren – man kann nie wissen.',
        apply: s => { addXp(s, 15, 'Extrakt-Vergleich'); return 'Es riecht nach Hustenbonbon. Dein Gaumen vermisst die Dolde. Aber du hast etwas gelernt. (Erfahrung +15)'; } },
      { id: 'abwimmeln', label: '🚪 Höflich ablehnen – der Vertrag reicht.',
        apply: s => { persona(s, 'bold', 1); return 'Pfeiffer klappt den Koffer zu: „Sie werden uns noch brauchen!“ – mit einem Unterton, der kein Scherz mehr ist.'; } },
      { id: 'kuendigen', label: '✂️ Den Vertrag kündigen (800 € Vertragsstrafe) – du willst wieder echten Hopfen.', enabled: s => s.cash >= 800,
        apply: s => { spend(s, 800, 'die Vertragsstrafe'); s.flags.extrakt_vertrag = false; s.flags.extrakt_gekuendigt = true; persona(s, 'trad', 1); addHonor(s, 1); return 'Pfeiffer rechnet mit spitzem Bleistift. Du zahlst, er quittiert – und du darfst wieder Dolden und Pellets bestellen.'; } },
    ],
    when: s => !!s.flags.extrakt_vertrag,
  },
};

// Nebengeschichten, die kapitelunabhängig auftauchen (zusätzlich zu Abtei und Co.)
export const earlyGlobals = [
  { id: 'seite_wasser', when: s => !s.ended && s.chapter === 1 && s.stats.batches >= 3 },
  { id: 'nachbarin', when: s => !s.ended && s.chapter >= 1 && s.chapter <= 2 && s.stats.batches >= 2 && stockL(s) > 0 },
  { id: 'amt_hinweis', when: s => !s.ended && s.chapter >= 3 && s.flags.schwarz && !s.license && s.stats.soldL >= 30 },
  { id: 'markt_stand', when: s => !s.ended && s.chapter >= 3 && s.license && s.stats.soldL >= 20 },
  { id: 'kalle_wirt', when: s => !s.ended && s.chapter >= 4 && s.license && s.reputation >= 12 },
  { id: 'toni_ernte', when: s => !s.ended && s.chapter >= 6 && !!s.flags.regional },
  { id: 'max_vertreter', when: s => !s.ended && s.chapter >= 6 && !!s.flags.extrakt_vertrag },
];
