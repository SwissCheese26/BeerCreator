// Akt VI – Finale (Kapitel 19), Enden und Zufallsereignisse.
import { rand, spend } from '../state.js';
import { addXp } from '../progress.js';
import { STYLES, byId } from '../../core/data.js';
import { ensureStory, addRep, addHonor, addCash, fine, persona, lvl, allies, offerQuest, questSettled, questDone, QUESTS, stockL, stockOf, fermenting,
  fragments, employees } from './common.js';
import { AUTO_OFFERS } from './tick.js';
import { rankOf } from './helpers.js';
import { takeBeer } from './early.js';

Object.assign(QUESTS, {
  opas_festbier: { story: true, who: 'opa', title: 'Heinrichs Festbier', kind: 'deliver', styles: ['maerzen'], liters: 40, minQ: 85, days: 90, retryDays: 50, abv: [5.6, 6.4], ebc: [18, 30],
    text: 'Auf der letzten Seite steht kein Rezept, sondern eine Bitte: „Brau mir mein Festbier, so wie ich es im Kopf hatte: ein Märzen, bernsteinfarben (18 bis 30 EBC), stark genug (5,6 bis 6,4 % vol), rund wie ein Handschlag. Qualität mindestens 85.“ 40 Liter.',
    reward: s => { s.flags.opas_rezept = true; addHonor(s, 10); addRep(s, 5); addXp(s, 300, 'Heinrichs Festbier'); return 'Du hebst das Glas gegen das Licht. Es schmeckt wie Samstagnachmittag in der Garage, wie Gerdas Marmelade, wie Opas Hände. Ansehen +10, Ruf +5, 300 Erfahrung.'; },
    fail: s => { s.flags.opas_verpasst = true; } },
});
AUTO_OFFERS.push();

export const act6Chapters = [
  {
    id: 'finale', title: 'Kapitel 19 – Heinrichs Vermächtnis',
    intro: 'Ein Jahr nach der Eröffnung. Im Sudhaus hängen Fahnen, vor dem Tor stehen Bierbänke, und aus der Küche duftet Gerdas Zwiebelkuchen. Heute ist Opas Todestag – und der Tag, an dem alle zusammenkommen, die ihm und dir etwas bedeuten. Du weißt, was du erreicht hast. Du weißt nur noch nicht, wofür.',
    objectives: [
      { id: 'jub', text: 'Feiere Opas Todestag mit allen, die kommen.', done: s => !!s.flags.done_jubilaeum },
      { id: 'festbier', text: 'Brau Heinrichs Festbier (falls du alle sechs Seiten hast).', done: s => !s.flags.offered_festbier || questSettled(s, 'opas_festbier') },
      { id: 'weg', text: 'Entscheide, wie die Geschichte der Brauerei weitergeht.', done: s => !!s.flags.done_vermaechtnis },
    ],
    outro: 'Die Lampions leuchten, die Gläser klingen. Irgendwo im Hintergrund summt jemand Opas Lieblingslied.',
    ending: s => s.flags.final_path || 'handwerk',
    events: [
      { id: 'jubilaeum', when: () => true },
      { id: 'vermaechtnis', when: s => !!s.flags.done_jubilaeum && (!s.flags.offered_festbier || questSettled(s, 'opas_festbier')) },
    ],
  },
];

const PATHS = {
  handwerk: s => true,
  industrie: s => !!s.flags.falk_investor || (s.owned || []).length >= 1,
  genossenschaft: s => !!s.flags.genossen_plan && allies(s) >= 2,
  uebernahme: s => !!s.flags.massiv_verhandelt,
};
export const pathOpen = (s, id) => PATHS[id](s);

function epilog(s, path) {
  const n = fragments(s).length, out = [];
  if (s.flags.opas_rezept) out.push('Auf dem Etikett von Heinrichs Festbier steht der Satz aus dem Rezeptbuch: „Geduld ist die einzige Zutat, die man nicht kaufen kann.“ Die Flaschen sind innerhalb einer Woche ausverkauft.');
  else if (n >= 6) out.push('Das Rezeptbuch ist vollständig, nur das Festbier fehlt. Gerda sagt, das sei in Ordnung: „Ein Buch muss nicht fertig sein, um gut zu sein.“');
  else out.push(`Opas Rezeptbuch ist ${n === 0 ? 'ein leerer Einband' : `mit ${n} von 6 Seiten ein Fragment`} geblieben. Gerda meint, vielleicht sei das Absicht gewesen.`);
  if (s.flags.merle_bund) out.push('Trübsal x Heinrich ist inzwischen ein Gemeinschafts-Pale-Ale, das in beiden Regalen steht.');
  else if (s.flags.merle_ally) out.push('Merle schickt jedes Jahr zum Todestag eine Flasche ihres besten Biers und eine Karte: „Weiter so, Heinrichs Enkel.“');
  else if (s.flags.sabotage || s.flags.sabotage_aufgeflogen) out.push('Die Sache mit der Hefe wird nie ganz vergessen. In stillen Momenten denkst du daran.');
  if (s.flags.vertuscht_aufgeflogen) out.push('Die Schlagzeile von damals hängt noch im Netz. Manche Fehler wachsen mit.');
  else if (s.flags.ehrlich) out.push('Der Rückruf ist inzwischen eine Legende: „Die Brauerei, die zugegeben hat, dass sie Fehler macht.“');
  if (s.flags.zollinger_ally) out.push('Frau Zollinger hat inzwischen einen eigenen Barhocker im Sudhaus – dienstlich selbstverständlich nur für Kontrollen.');
  if (s.flags.klaus_ally && path !== 'uebernahme') out.push('Klaus hat ein Buch über die Brauerei angefangen. Er ist bei Seite 3 und nennt es „vorläufig“.');
  return out.join(' ');
}

export const act6Events = {
  jubilaeum: {
    title: 'Opas Todestag', who: 'gerda',
    text: 'Gerda sitzt im Sudhaus auf einem Hocker und hält ein Päckchen. „Das gab mir dein Opa für diesen Tag. Er sagte, du wüsstest, was drin ist.“ Es sind die letzte Seite des Rezeptbuchs und ein Zettel: „Wenn du alle Seiten hast, kennst du mein Geheimnis. Wenn nicht, auch.“ Die Gäste kommen langsam herein, eine Kapelle stimmt Instrumente ab. Wie verbringst du den Tag?',
    choices: [
      { id: 'friedhof', label: '🕯️ Erst still am Grab, dann im Sudhaus – nur Familie und enge Freunde.',
        apply: s => { addHonor(s, 3); persona(s, 'trad', 1); return finalePage(s); } },
      { id: 'wirtshaus', label: '🍻 Das ganze Dorf einladen und ausschenken, was du hast.',
        apply: s => { addRep(s, 3); persona(s, 'heimat', 1); return finalePage(s); } },
      { id: 'sudhaus', label: '⚙️ Am Kessel stehen und Opas Rezept ausprobieren.',
        apply: s => { addXp(s, 60, 'Festtagssud'); persona(s, 'trad', 1); return finalePage(s); } },
    ],
  },
  vermaechtnis: {
    title: 'Wofür das alles?', who: 'opa',
    text: 'Es ist spät, die Gäste sind gegangen, nur Gerda wischt Tische, und im Sudhaus summt die Kühlung. Du hältst das Rezeptbuch in der Hand und weißt: Die nächsten Jahre prägen alles. Kleine Handwerksbrauerei, Industrie-Maßstab, Genossenschaft – oder doch das Angebot von Massivbräu? Was du jetzt wählst, entscheidet, wie dein Name in fünfzig Jahren klingt.',
    choices: [
      { id: 'handwerk', label: '🍺 Handwerk: klein, unabhängig, ehrlich – jedes Fass ein Gesicht.',
        apply: s => { s.flags.final_path = 'handwerk'; return epilog(s, 'handwerk'); } },
      { id: 'industrie', label: '🏭 Industrie: Dosenlinie, Export, Tanks – Opas Bier um die Welt. (nur mit Investor oder Tochterbrauerei)',
        enabled: s => pathOpen(s, 'industrie'),
        apply: s => { s.flags.final_path = 'industrie'; return epilog(s, 'industrie'); } },
      { id: 'genossenschaft', label: '🏘️ Genossenschaft: das Dorf trägt die Brauerei gemeinsam. (nur mit Plan und mindestens zwei Verbündeten)',
        enabled: s => pathOpen(s, 'genossenschaft'),
        apply: s => { s.flags.final_path = 'genossenschaft'; return epilog(s, 'genossenschaft'); } },
      { id: 'uebernahme', label: '🤝 Übernahme: das Angebot von Massivbräu annehmen. (nur nach Verhandlungen)',
        enabled: s => pathOpen(s, 'uebernahme'),
        apply: s => { s.flags.final_path = 'uebernahme'; return epilog(s, 'uebernahme'); } },
    ],
  },
};

function finalePage(s) {
  const n = fragments(s).length;
  if (n >= 6) {
    s.flags.offered_festbier = true; offerQuest(s, 'opas_festbier');
    return 'Du legst die letzte Seite neben die anderen. Sechs Blätter, ein Rezept: Es ist ein Märzen, kein Geheimnis, nur Handwerk – und auf der Rückseite steht, mit Opas Bleistift: „Brau mir mein Festbier.“ (Neuer Auftrag: Heinrichs Festbier)';
  }
  return `Du legst die letzte Seite zu ${n === 0 ? 'keiner' : n === 1 ? 'der einen' : `den ${n}`} anderen. Es fehlen noch ${6 - n}. Opa hat es wohl so gewollt: Ein Geheimnis, das man nicht ganz zusammensetzt, bleibt lebendig.`;
}

// ----- Zufallsereignisse (deterministisch über rand(s), mit Abklingzeit) -----
const R = (id, o) => { randomEvents[id] = { random: true, cooldown: 160, ...o }; };
export const randomEvents = {};
R('wasserrohr', { title: 'Rohrbruch im Sudhaus', who: 'klaus', when: s => s.chapter >= 2 && s.cash >= 100,
  text: 'Klaus’ Telefonnummer blinkt auf: „Dein Wasserhahn spritzt wie ein Springbrunnen!“ Ein Anschluss ist geplatzt, der Boden steht unter Wasser.',
  choices: [
    { id: 'klempner', label: '🔧 Den Klempner rufen (80 €).', enabled: s => s.cash >= 80, apply: s => { spend(s, 80, 'den Klempner'); return 'Er schafft es in 20 Minuten und erzählt dir in 40 von seiner Bandscheibe. Alles dicht.'; } },
    { id: 'selbst', label: '🪛 Selbst flicken.', apply: s => { if (rand(s) < 0.6) { addXp(s, 15, 'Klempnern'); return 'Es hält, mit Dichtband und Fluchen. (Erfahrung +15)'; } fine(s, 150); return 'Es hält zehn Minuten. Danach kommt der Klempner doch – mit Wochenendzuschlag. (150 €)'; } },
  ] });
R('blogger', { title: 'Der Bierblogger', who: 'jule', when: s => s.chapter >= 3 && stockL(s) >= 5,
  text: 'Ein Typ mit Kamera und Rauschebart steht im Hof: „Ich teste regionale Biere. Darf ich zwei Flaschen mitnehmen?“ Es ist niemand, den du kennst – aber seine Videos haben 30.000 Aufrufe.',
  choices: [
    { id: 'geben', label: '🎥 Zwei Flaschen mitgeben (2 L).', enabled: s => stockL(s) >= 2, apply: s => { takeBeer(s, 2); const q = Math.max(...stockOf(s).map(b => b.quality), 0); if (q >= 70) { addRep(s, 4); return 'Das Video ist freundlich-begeistert: „Ein echter Geheimtipp!“ (Ruf +4)'; } addRep(s, 1); return 'Das Video ist okay. „Nicht schlecht, nicht legendär.“ (Ruf +1)'; } },
    { id: 'ablehnen', label: '🙅 Nein danke – Werbung machst du selbst.', apply: s => { persona(s, 'trad', 1); return 'Er zuckt mit den Schultern, dreht die Kamera ab und geht. Vielleicht hat er einen Kollegen.'; } },
  ] });
R('stromausfall', { title: 'Stromausfall', who: 'klaus', when: s => fermenting(s).length > 0 && s.chapter >= 2,
  text: 'Im ganzen Viertel geht das Licht aus. Dein Gärkühlschrank schweigt, die Thermostate blinken nicht mehr, und im Eimer blubbert es nur noch müde.',
  choices: [
    { id: 'aggregat', label: '🔌 Ein Notstromaggregat mieten (60 €).', enabled: s => s.cash >= 60, apply: s => { spend(s, 60, 'das Aggregat'); return 'Es knattert den ganzen Abend. Die Nachbarn beschweren sich, die Hefe nicht.'; } },
    { id: 'decken', label: '🧣 Mit Decken und Hoffnung isolieren.', apply: s => { fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 3); }); return 'Es geht gut aus – bis auf kleine Aromaschäden. (Qualität −3 für alle gärenden Sude)'; } },
  ] });
R('reklamation', { title: 'Reklamation', who: 'jule', when: s => s.chapter >= 3 && s.license && s.stats.soldL >= 40,
  text: 'Ein Kunde steht vor der Tür, in der Hand eine aufgeplatzte Flasche. „Das Zeug ist explodiert – mitten im Wohnzimmer!“ Ob das nun zu viel Kohlensäure oder ein sehr kräftiger Nachgärer war, lässt sich nicht mehr klären.',
  choices: [
    { id: 'erstatten', label: '💶 Erstatten (30 €) und höflich bleiben.', enabled: s => s.cash >= 30, apply: s => { spend(s, 30, 'die Erstattung'); addHonor(s, 1); return 'Der Kunde geht kopfschüttelnd, aber zufrieden. Er erzählt es später als Anekdote – freundlich. (Ansehen +1)'; } },
    { id: 'streiten', label: '😤 Streiten: „Das kann nicht an meinem Bier liegen.“', apply: s => { addRep(s, -2); return 'Er wird laut, du wirst lauter. Beim Hinausgehen sagt er: „Heinrichs Enkel – von wegen.“ (Ruf −2)'; } },
  ] });
R('foerderung', { title: 'Förderprogramm', who: 'zoll', when: s => s.chapter >= 9 && s.license,
  text: 'Frau Zollinger lässt einen Flyer auf den Tisch fallen: „Das Land fördert Investitionen in handwerkliche Betriebe. Antrag lohnt sich, aber nur, wenn Sie bis Freitag fertig sind.“',
  choices: [
    { id: 'antrag', label: '📄 Den Antrag stellen (Aufwand 100 €, Chance auf 1500 €).', enabled: s => s.cash >= 100, apply: s => { spend(s, 100, 'den Antrag'); if (rand(s) < 0.65) { addCash(s, 1500); return 'Zwei Wochen später kommt die Bewilligung: 1500 €! Frau Zollinger lächelt unauffällig.'; } return 'Absage – „zu viele Anträge“. Der Papierkram bleibt als Erinnerung. (−100 €)'; } },
    { id: 'verzichten', label: '🙅 Verzichten – dir fehlt die Zeit.', apply: () => 'Du legst den Flyer auf den Stapel mit den guten Vorsätzen.' },
  ] });
R('zoll_stichprobe', { title: 'Zoll-Stichprobe', who: 'zoll', when: s => s.license && s.chapter >= 4,
  text: 'Ein unauffälliger Kombi parkt vor dem Hof. Zwei Zöllner mit Klemmbrett steigen aus: „Routinekontrolle des Steuerlagers.“',
  choices: [
    { id: 'offen', label: '📋 Alles offenlegen.', apply: s => { if (s.flags.vorbestraft) { addHonor(s, -1); return 'Sie blättern lange. „Ihre Akte kennen wir.“ Es bleibt bei einer Mahnung zur Dokumentation. (Ansehen −1)'; } addHonor(s, 2); return 'Alles stimmt, jedes Fass ist gebucht. Die Zöllner verabschieden sich fast herzlich. (Ansehen +2)'; } },
    { id: 'verspaetet', label: '⏱️ Um Aufschub bitten.', apply: s => { addHonor(s, -1); fine(s, 50); return 'Es wird ein Termin gemacht, ein Bußgeld von 50 € ist trotzdem dabei. (Ansehen −1)'; } },
  ] });
R('hitzewelle', { title: 'Hitzewelle', who: 'klaus', when: s => s.chapter >= 2 && fermenting(s).length > 0 && (() => { const d = ((s.day - 1) % 365) + 1; return d >= 170 && d <= 250; })() && s.equipment.cooling === 'keine',
  text: '38 Grad im Schatten, und deine Gärung hat keinen. Der Gäreimer dampft fast.',
  choices: [
    { id: 'eis', label: '🧊 Eisblöcke und nasse Tücher (20 €).', enabled: s => s.cash >= 20, apply: s => { spend(s, 20, 'Eis'); return 'Es riecht nach Waschküche, aber die Hefe bleibt gnädig.'; } },
    { id: 'ignorieren', label: '🤷 Aushalten.', apply: s => { fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 4); }); return 'Die Gärung geht zu schnell. Das Bier schmeckt nach Banane. (Qualität −4)'; } },
  ] });
R('malz_engpass', { title: 'Malz-Engpass', who: 'ottokar', when: s => s.chapter >= 4,
  text: 'Die Mälzerei meldet Lieferverzug: „Pilsner Malz gibt es erst in drei Wochen.“ Oder du kaufst beim Großhändler zum doppelten Preis.',
  choices: [
    { id: 'zahlen', label: '💶 Beim Großhändler kaufen (+120 €).', enabled: s => s.cash >= 120, apply: s => { spend(s, 120, 'Malz'); s.inventory.malts.pilsner = Math.round(((s.inventory.malts.pilsner || 0) + 25) * 100) / 100; return '25 kg Pilsner Malz kommen im Kleintransporter. Teuer, aber schnell.'; } },
    { id: 'warten', label: '⏳ Warten und Rezepte umplanen.', apply: s => { addXp(s, 20, 'Improvisation'); return 'Du brauest mit Münchner statt Pilsner. Es schmeckt besser als gedacht. (Erfahrung +20)'; } },
  ] });
R('spendenaufruf', { title: 'Der Kindergarten braucht Bier?', who: 'klaus', when: s => s.chapter >= 3 && stockL(s) >= 15,
  text: 'Die Leiterin des Kindergartens steht verlegen im Hof. „Wir feiern Sommerfest, die Eltern wünschen sich Bier, aber wir haben kein Budget. Hast du eine Spende?“',
  choices: [
    { id: 'spenden', label: '🎁 15 L spenden.', enabled: s => stockL(s) >= 15, apply: s => { takeBeer(s, 15); addHonor(s, 3); addRep(s, 1); return 'Die Eltern jubeln, die Kinder bekommen Eis. Du bekommst ein selbstgemaltes Plakat. (Ansehen +3, Ruf +1)'; } },
    { id: 'rabatt', label: '💶 Zum Einkaufspreis verkaufen (kein Gewinn).', apply: s => { addHonor(s, 1); return 'Die Leiterin ist dankbar, aber ein Gefühl von „knapp“ bleibt. (Ansehen +1)'; } },
  ] });
R('messe', { title: 'Einladung zur Craft-Messe', who: 'jule', when: s => s.chapter >= 10 && s.license,
  text: 'In der Landeshauptstadt findet eine Craft-Beer-Messe statt. Standgebühr 250 €, Fahrt und Verkostungsmuster inklusive. Jule sagt: „Da trifft sich alles, was in der Szene zählt.“',
  choices: [
    { id: 'hin', label: '🎪 Hinfahren (250 €).', enabled: s => s.cash >= 250 && stockL(s) >= 10, apply: s => { spend(s, 250, 'die Messe'); takeBeer(s, 8); addRep(s, 3); addXp(s, 40, 'Messekontakte'); persona(s, 'bold', 1); return 'Drei Tage, vierzig neue Visitenkarten, ein halber Bart voller Schaum. Du kommst müde heim, aber gut vernetzt. (Ruf +3, Erfahrung +40)'; } },
    { id: 'daheim', label: '🏠 Zuhause bleiben.', apply: s => 'Du schickst eine Kiste mit Jule. Sie kommt mit sechs Anfragen zurück.' },
  ] });
R('mitarbeiter_krank', { title: 'Grippewelle im Sudhaus', who: 'ottokar', when: s => employees(s) >= 1,
  text: 'Die Hälfte des Teams liegt flach. Ottokar hustet in die Armbeuge: „Ich arbeite trotzdem.“ Auf keinen Fall.',
  choices: [
    { id: 'heim', label: '🛏️ Alle heimschicken, Sude verschieben (Qualität −2 gärend).', apply: s => { fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 2); }); addHonor(s, 2); return 'Eine Woche Ruhe. Du kümmerst dich selbst um die Sude und lernst, wie viel Arbeit das ist. (Ansehen +2)'; } },
    { id: 'durchhalten', label: '💪 Durchhalten mit Medikamenten und Tee.', apply: s => { addHonor(s, -2); s.hygiene = Math.max(0, s.hygiene - 0.02); return 'Es geht, aber die Stimmung kippt. Und die Hygiene leidet. (Ansehen −2)'; } },
  ] });
R('hefe_mutation', { title: 'Die Hefe wird seltsam', who: 'ottokar', when: s => s.chapter >= 5,
  text: 'Die Anstellhefe riecht nach Äpfeln und Lösungsmittel. Entweder hat sie mutiert, oder du hast sie zu oft weitergeführt.',
  choices: [
    { id: 'verwerfen', label: '🗑️ Verwerfen und frisch anstellen (50 €).', enabled: s => s.cash >= 50, apply: s => { spend(s, 50, 'neue Hefe'); s.hygiene = Math.min(0.8, s.hygiene + 0.02); return 'Ein sauberer Neuanfang. Es riecht wieder nach Brot und Heimat. (Hygiene +)'; } },
    { id: 'weiterfuehren', label: '🧪 Weiterführen und beobachten.', apply: s => { if (rand(s) < 0.5) { addXp(s, 40, 'Hefe-Experimente'); return 'Es entsteht ein Aroma, das keiner kennt – im besten Sinne. (Erfahrung +40)'; } fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 5); }); return 'Der Sud schmeckt wie Nagellackentferner. (Qualität −5)'; } },
  ] });
R('kneipentour', { title: 'Nachtschicht im Wirtshaus', who: 'verein', when: s => s.chapter >= 4 && s.license,
  text: 'Der Stammtisch fragt, ob du am Samstag mit einem Fass vorbeischauen willst. Es gibt Schweinebraten und Skat – und viele Meinungen zu Hopfen.',
  choices: [
    { id: 'hin', label: '🍻 Fass mitbringen (10 L).', enabled: s => stockL(s) >= 10, apply: s => { takeBeer(s, 10); addRep(s, 2); s.regulars = Math.min(60, (s.regulars || 0) + 3); return 'Um Mitternacht wird gesungen. Drei neue Stammkunden. (Ruf +2)'; } },
    { id: 'nein', label: '🙅 Diesmal nicht.', apply: () => 'Der Stammtisch trinkt eben ein anderes Bier. Es schmeckt, behauptet Kalle, „nach Ersatz“.' },
  ] });
