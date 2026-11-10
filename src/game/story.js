// Die Geschichte: Kapitel mit Zielen, Ereignissen und Entscheidungen.
// Alles Text ist Deutsch; Zustand wird nur über `s` verändert (JSON-serialisierbar).
// Alle Brauereien, Personen und die Abtei St. Gambrin sind erfunden.
import { TIER_ORDER, CELLAR_RENT, LICENSE_COST, HOBBY_LIMIT_L, BUNT_STYLES } from './config.js';
import { log, rand, need, spend, round2, unlock, clamp } from './state.js';
import { addXp, levelOf } from './progress.js';

const tierAtLeast = (s, slot, tier) => TIER_ORDER[slot].indexOf(s.equipment[slot]) >= TIER_ORDER[slot].indexOf(tier);
const stockOf = s => s.beers.filter(b => b.liters > 0.01);
const bestBeer = s => stockOf(s).sort((a, b) => b.quality - a.quality)[0];
const fermenting = s => s.batches.filter(b => b.status === 'gaerend');

/** Klassische, gleichmäßig gute Bierkultur – die Voraussetzung, damit die Abtei auf dich aufmerksam wird. */
export function abbeyProgress(s) {
  const q = (s.stats.recentQ || []).slice(-5);
  const mean = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0;
  const sd = q.length ? Math.sqrt(q.reduce((a, b) => a + (b - mean) ** 2, 0) / q.length) : 99;
  const recentStyles = (s.stats.recentStyles || []).slice(-5);
  return [
    { id: 'honor', text: 'Ansehen mindestens 30', done: s.honor >= 30, have: `${Math.floor(s.honor)} / 30` },
    { id: 'donated', text: 'Insgesamt 300 € gespendet', done: s.stats.donated >= 300, have: `${Math.floor(s.stats.donated)} / 300 €` },
    { id: 'stable', text: '4 der letzten Sude gleichmäßig gut (Ø ≥ 65, kaum Schwankung)', done: q.length >= 4 && mean >= 65 && sd <= 6,
      have: q.length >= 4 ? `Ø ${Math.round(mean)}, Schwankung ±${sd.toFixed(1)}` : `${q.length} / 4 Sude` },
    { id: 'classic', text: 'Keine bunten Experimente (NEIPA, IPA, Berliner Weisse) unter den letzten Suden', done: !recentStyles.some(x => BUNT_STYLES.includes(x) || x === 'bunt'), have: '' },
    { id: 'clean', text: 'Kein Ärger mit dem Zoll', done: !s.flags.vorbestraft, have: '' },
  ];
}
export const abbeyReady = s => abbeyProgress(s).every(x => x.done);

export const CHAPTERS = [
  {
    id: 'tutorial',
    title: 'Prolog – Opas Sudbuch',
    intro: 'Opa Heinrich ist gestorben. Er hinterlässt dir seine Garage: Werkbank, Spinnweben, einen 30-Liter-Einkochtopf, ' +
      'einen Plastikeimer, ein Glas mit uralten Hopfendolden – und ein fleckiges Notizbuch: sein Sudbuch.',
    objectives: [
      { id: 'tut', text: 'Braue mit Opas Sudbuch dein allererstes Bier.', done: s => !!s.tutorial?.done },
    ],
    outro: 'Dein erstes eigenes Bier. Gerda wischt sich verstohlen eine Träne weg. „Das hätte ihm gefallen.“',
    events: [],
  },
  {
    id: 'garage',
    title: 'Kapitel 1 – Opas Garage',
    intro: 'Das erste Bier war gut. Jetzt willst du wissen, ob es Glück war. Diesmal hält Opa nur noch die Zettel hin – das Rezept machst du.',
    onEnter: s => unlock(s, 'brauen', 'einkauf'),
    objectives: [
      { id: 'brew2', text: 'Setze einen Sud ganz ohne Anleitung an.', done: s => s.stats.batches >= 2 },
      { id: 'q50', text: 'Bring diesen eigenen Sud mit Qualität 50 oder mehr zur Reife.', done: s => s.batches.some(b => !b.tutorial && b.status === 'fertig' && b.quality >= 50) },
    ],
    outro: 'Kein Glück – Können. Nachbar Klaus hat Wind davon bekommen.',
    events: [
      { id: 'opa_brief', when: () => true },
      { id: 'heizluefter', when: s => fermenting(s).some(b => !b.tutorial) && (s.day % 365 < 90 || s.day % 365 > 300) },
    ],
  },
  {
    id: 'fest',
    title: 'Kapitel 2 – Das Straßenfest',
    intro: 'Klaus hat probiert. Klaus hat es erzählt. Jetzt weiß es die ganze Straße – und er will „dein Garagenbier“ beim Straßenfest ausschenken. ' +
      'Verschenken ist erlaubt, verkaufen nicht.',
    onEnter: s => unlock(s, 'verschenken', 'bierliga'),
    objectives: [
      { id: 'give20', text: 'Verschenke insgesamt 20 Liter Bier.', done: s => s.stats.givenL >= 20 },
      { id: 'rep8', text: 'Erreiche 8 Ruf.', done: s => s.reputation >= 8 },
    ],
    outro: 'Die Leute reden. „Wo kann man das kaufen?“ – diese Frage hörst du den ganzen Abend.',
    events: [
      { id: 'fest_einladung', when: () => true },
      { id: 'kenner', when: s => s.stats.givenL >= 8 },
    ],
  },
  {
    id: 'gewerbe',
    title: 'Kapitel 3 – Ein Gewerbe?',
    intro: '„Wo kann man das kaufen?“ Gute Frage. Die Antwort führt leider über ein Amt. Und über dein Gewissen: Man kann es auch heimlich versuchen.',
    onEnter: s => unlock(s, 'verkauf', 'spenden'),
    objectives: [
      { id: 'legal', text: 'Kläre deinen Status (Gewerbe oder anderer Weg).', done: s => !!s.flags.done_gewerbe },
      { id: 'sell50', text: 'Verkaufe insgesamt 50 Liter.', done: s => s.stats.soldL >= 50 },
    ],
    outro: 'Die ersten Euros klimpern in Opas Umschlag. Jetzt wird es ernst.',
    events: [
      { id: 'gewerbe', when: () => true },
      { id: 'zollinger', when: s => s.license && s.stats.soldL > 0 },
    ],
  },
  {
    id: 'keller',
    title: 'Kapitel 4 – Gerdas Keller',
    intro: 'Im Sommer ist die Garage eine Sauna, im Winter eine Gefriertruhe – deine Biere leiden. Zeit für Technik. Und Gerda hat da eine Idee.',
    onEnter: s => { s.stage = 'keller'; unlock(s, 'ausruestung', 'kurse', 'fasskeller'); },
    objectives: [
      { id: 'gear', text: 'Kaufe einen 50-L-Kessel und einen Gärkühlschrank.', done: s => tierAtLeast(s, 'kettle', 'kessel50') && tierAtLeast(s, 'cooling', 'kuehlschrank') },
      { id: 'styles3', text: 'Braue drei verschiedene Bierstile.', done: s => s.stats.styles.length >= 3 },
      { id: 'q65', text: 'Braue ein Bier mit Qualität 65 oder mehr.', done: s => s.stats.bestQuality >= 65 },
    ],
    outro: 'Konstante Temperaturen, saubere Gärung. Dein Bier schmeckt plötzlich nach Absicht statt nach Zufall.',
    events: [
      { id: 'keller_angebot', when: () => true },
      { id: 'kursleiter', when: s => levelOf(s.skill.xp).lvl >= 2 && !s.unlocked.includes('maerzen') },
    ],
  },
  {
    id: 'wettbewerb',
    title: 'Kapitel 5 – Die Landesmeisterschaft',
    intro: 'Die Landesmeisterschaft der Heim- und Craftbrauer. Die Jury trinkt blind und gnadenlos. Ein Medaillenplatz würde dir Türen öffnen.',
    onEnter: s => unlock(s, 'produktion', 'stilwerkstatt'),
    objectives: [
      { id: 'medal', text: 'Gewinne eine Medaille.', done: s => s.stats.medals.length >= 1 },
    ],
    outro: 'Eine Medaille an der Garagenwand. Opa wäre stolz gewesen.',
    events: [{ id: 'wettbewerb', when: s => stockOf(s).some(b => b.quality >= 55) }],
  },
  {
    id: 'brauerei',
    title: 'Kapitel 6 – Die eigene Brauerei',
    intro: 'Ein Großhändler und ein Hopfenbauer buhlen um dich. Jede Entscheidung hat Folgen für Preis, Qualität und Ruf.',
    objectives: [
      { id: 'rep50', text: 'Erreiche 50 Ruf.', done: s => s.reputation >= 50 },
      { id: 'cash4000', text: 'Sammle 4000 € Kapital.', done: s => s.cash >= 4000 },
      { id: 'vendor', text: 'Entscheide dich für einen Hopfen-Lieferanten.', done: s => !!s.flags.done_lieferant },
    ],
    outro: 'Du kündigst deinen Job. Über dem Tor steht in Opas Handschrift: „{name}“.',
    events: [{ id: 'lieferant', when: () => true }],
    ending: 'brauerei',
  },
];

// Nebengeschichten, die unabhängig vom Kapitel auftauchen können.
export const GLOBAL_EVENTS = [
  { id: 'abtei_besuch', when: s => s.chapter >= 3 && abbeyReady(s) },
  { id: 'abtei_sud', when: s => !!s.flags.abtei && stockOf(s).some(b => b.styleId === 'dubbel' && b.quality >= 72) },
];

// ----- Ereignisse mit Entscheidungen -----
// `who` = wer spricht (opa, gerda, klaus, zoll, anselm …). `choices[].enabled(s)` darf Optionen sperren; `apply(s)` liefert den Ergebnistext.
export const EVENTS = {
  opa_brief: {
    title: 'Ein Zettel im Hopfenglas', who: 'opa',
    text: '„Hopfen muss frisch sein. Aber ich hab nie was weggeworfen.“ Daneben liegt ein verstaubtes Hygiene-Buch von der Brauerei-Fachschule. Womit machst du weiter?',
    choices: [
      { id: 'tradition', label: '🫙 Opas Weg: den alten Hopfen einfach mal ausprobieren.',
        apply: s => { s.flags.tradition = true; return 'Du schnupperst am Glas. Riecht … nach Heu und Käse. Mal sehen.'; } },
      { id: 'buch', label: '📕 Erst das Hygiene-Buch lesen (Hygiene +).',
        apply: s => { s.hygiene = Math.min(0.6, s.hygiene + 0.1); return 'Zwei Abende Lektüre: Sauberkeit ist 90 % des Brauens. Deine Hygiene steigt.'; } },
    ],
  },
  heizluefter: {
    title: 'Der Heizlüfter brennt durch', who: 'gerda',
    text: 'Mitten in der Gärung: Puff – der alte Heizlüfter ist hin. Nachts hat es in der Garage nur noch 6 °C.',
    choices: [
      { id: 'decken', label: '🧣 Den Eimer in Decken wickeln.',
        apply: s => { fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 2); }); return 'Sieht aus wie ein Baby. Gärt aber. (Qualität −2)'; } },
      { id: 'kaufen', label: '🔌 Neuen Heizlüfter kaufen (25 €).', enabled: s => s.cash >= 25,
        apply: s => { spend(s, 25, 'einen Heizlüfter'); return 'Der neue Lüfter brummt zufrieden. Die Hefe auch.'; } },
      { id: 'ignorieren', label: '🤷 Ignorieren.',
        apply: s => { fermenting(s).forEach(b => { b.quality = Math.max(0, b.quality - 5); b.readyDay += 4; }); return 'Die Hefe hält Winterschlaf. (Qualität −5, 4 Tage länger)'; } },
    ],
  },
  fest_einladung: {
    title: 'Klaus und das Straßenfest', who: 'klaus',
    text: '„Zwei Fässer für das Fest, ja? Alle sind gespannt!“',
    choices: [
      { id: 'zusagen', label: '🎉 Zusagen – das Fest ist deine Bühne (Ruf-Bonus beim Verschenken).',
        apply: s => { s.flags.fest = true; return 'Klaus klopft dir auf die Schulter. „Dann bring was Gutes mit!“'; } },
      { id: 'absagen', label: '🙅 Absagen – noch nicht bereit (Ruf −2, Klaus fragt in 7 Tagen wieder).',
        done: false,
        apply: s => { s.reputation = Math.max(0, s.reputation - 2); s.flags.retry_fest_einladung = s.day + 7; return 'Klaus zuckt mit den Schultern. Du verschenkst dein Bier eben nach und nach.'; } },
    ],
  },
  kenner: {
    title: 'Der Kenner', who: 'klaus',
    text: 'Ein Herr mit Notizblock nippt an deinem Bier, schließt die Augen und sagt: „Interessant. Leicht nach Banane.“',
    choices: [
      { id: 'fachsimpeln', label: '🤓 Fachsimpeln.', apply: s => { addXp(s, 20, 'Fachgespräch'); s.reputation += 1; return 'Ihr redet eine Stunde über Hefe. Du lernst eine Menge. (Ruf +1)'; } },
      { id: 'absicht', label: '😎 „Das ist Absicht!“', apply: s => { s.reputation += 2; return 'Er nickt anerkennend und notiert etwas. (Ruf +2)'; } },
      { id: 'beleidigt', label: '😤 Beleidigt sein.', apply: s => { s.reputation = Math.max(0, s.reputation - 1); return 'Klaus: „Lass mal, der redet über jedes Bier so.“ (Ruf −1)'; } },
    ],
  },
  gewerbe: {
    title: 'Gewerbe, Zoll und Biersteuer', who: 'zoll',
    text: `Das Hauptzollamt erklärt am Telefon: Hobbybrauen bis ${HOBBY_LIMIT_L} Liter im Jahr ist steuerfrei – aber ohne Verkauf. ` +
      `Wer verkauft, braucht ein Gewerbe, eine Steuerlager-Erlaubnis und die Anmeldung bei der Lebensmittelüberwachung (zusammen ${LICENSE_COST} €). Danach ist Biersteuer fällig.`,
    repeatable: true,
    choices: [
      { id: 'anmelden', label: `✅ Alles anmelden (${LICENSE_COST} €). Verkauf legal, Biersteuer und Versicherung fällig.`,
        enabled: s => s.cash >= LICENSE_COST,
        apply: s => { spend(s, LICENSE_COST, 'die Anmeldungen'); s.license = true; s.flags.done_gewerbe = true; s.honor = Math.min(100, s.honor + 3); return 'Der Stempel ist drauf. Ab jetzt zahlst du Biersteuer – dafür schläfst du ruhig. (Ansehen +3)'; } },
      { id: 'schwarz', label: '🕶️ Heimlich verkaufen. Riskant: Steuerhinterziehung, Kontrollen, hohe Strafen.',
        apply: s => { s.license = false; s.flags.schwarz = true; s.flags.done_gewerbe = true; return 'Du verkaufst „unter der Hand“. Bei jedem Verkauf lauert die Kontrolle. (Anmelden kannst du dich jederzeit unter „Lager & Verkauf“.)'; } },
      { id: 'hobby', label: '🏠 Vorerst Hobby bleiben (Ruf +2; die Frage kommt in 14 Tagen wieder).',
        done: false,
        apply: s => { s.reputation += 2; s.flags.retry_gewerbe = s.day + 14; return 'Du bleibst Hobbybrauer. Die Leute bewundern dein Prinzip – bis die Nachfrage wieder drängt.'; } },
    ],
  },
  zollinger: {
    title: 'Frau Zollinger ruft an', who: 'zoll',
    text: '„Ihre erste Biersteuer-Anmeldung. Keine Panik, ist nur ein Formular. Ein langes.“',
    choices: [
      { id: 'sorgfaeltig', label: '📝 Sorgfältig selbst ausfüllen.', apply: s => { addXp(s, 15, 'Papierkram'); return 'Drei Stunden, zwei Kaffee, alles korrekt. Frau Zollinger ist zufrieden.'; } },
      { id: 'gerda', label: '👵 Gerda fragen – sie war mal Buchhalterin.', apply: s => { s.flags.gerda_kasten = true; return 'Gerda: „Gib her.“ Zehn Minuten später ist alles erledigt. Du schuldest ihr einen Kasten.'; } },
      { id: 'liegen', label: '🗑️ Liegen lassen.', apply: s => { s.cash = Math.max(0, round2(s.cash - 60)); s.honor = Math.max(0, s.honor - 2); return 'Ein Säumniszuschlag von 60 € flattert ins Haus. (Ansehen −2)'; } },
    ],
  },
  keller_angebot: {
    title: 'Gerdas Keller', who: 'gerda',
    text: `„Mein Gewölbekeller hat das ganze Jahr 12 Grad. Platz für einen weiteren Gärtank. ${CELLAR_RENT} € im Monat – und keine Schlammschlachten im Treppenhaus.“`,
    choices: [
      { id: 'annehmen', label: '🔑 Annehmen: +1 Gärplatz, kühler Keller, laufende Miete.',
        apply: s => { s.flags.keller = true; s.flags.miete = true; return 'Gerda drückt dir den Schlüssel in die Hand. Im Keller stehen 300 Marmeladengläser.'; } },
      { id: 'ablehnen', label: '🏚️ Ablehnen: in der Garage bleiben, keine Miete.',
        apply: () => 'Du bleibst in der Garage. Dafür bleibt das Geld in der Kasse.' },
    ],
  },
  kursleiter: {
    title: 'Braumeister Ottokar Würzig', who: 'ottokar',
    text: '„Ich gebe am Wochenende einen Märzen-Kurs. Kleine Gruppe, viel Praxis. 60 Euro. Oder … Sie laden mich auf ein Bier ein, und wir reden.“',
    choices: [
      { id: 'kurs', label: '🎓 Kurs buchen (60 €): Märzen freischalten, Erfahrung +30.', enabled: s => s.cash >= 60,
        apply: s => { spend(s, 60, 'den Kurs'); if (!s.unlocked.includes('maerzen')) s.unlocked.push('maerzen'); addXp(s, 30, 'Kurs'); return 'Ein Wochenende voller Maischepläne. Du kannst jetzt Märzen brauen.'; } },
      { id: 'bier', label: '🍺 Ihn auf ein Bier einladen.',
        apply: s => { s.hygiene = Math.min(0.6, s.hygiene + 0.05); s.reputation += 1; return 'Er verrät dir seinen Hygiene-Trick mit heißem Wasser und Geduld. (Hygiene +, Ruf +1)'; } },
    ],
  },
  wettbewerb: {
    title: 'Landesmeisterschaft', who: 'jury',
    text: 'Die Anmeldegebühr beträgt 40 €. Du stellst dein bestes Bier im Lager vor. Dr. Sabine Stammwürze und ihre Jury probieren blind.',
    repeatable: true,
    choices: [
      { id: 'teilnehmen', label: '🏅 Teilnehmen (40 €) mit deinem besten Bier.',
        enabled: s => s.cash >= 40 && !!bestBeer(s),
        done: false,
        apply: s => {
          spend(s, 40, 'Startgebühr');
          const beer = bestBeer(s);
          const score = beer.quality + (rand(s) * 12 - 6);
          const medal = score >= 85 ? 'Gold' : score >= 75 ? 'Silber' : score >= 65 ? 'Bronze' : null;
          s.flags.retry_wettbewerb = s.day + 30;
          if (!medal) { s.reputation += 1; return `Jury-Wertung ${score.toFixed(0)} – keine Platzierung. „Nächstes Jahr!“`; }
          s.stats.medals.push({ medal, beer: beer.name, day: s.day });
          const bonus = { Gold: [15, 300], Silber: [10, 120], Bronze: [6, 0] }[medal];
          addXp(s, { Gold: 150, Silber: 90, Bronze: 50 }[medal], 'Medaille'); s.reputation += bonus[0]; s.cash = round2(s.cash + bonus[1]); s.flags.done_wettbewerb = true;
          return `${medal}medaille für „${beer.name}“ (Wertung ${score.toFixed(0)})! Ruf +${bonus[0]}${bonus[1] ? `, Preisgeld ${bonus[1]} €` : ''}.`;
        } },
      { id: 'verzichten', label: '⏭️ Dieses Mal verzichten (Frage kommt in 30 Tagen wieder).',
        done: false,
        apply: s => { s.flags.retry_wettbewerb = s.day + 30; return 'Du schaust lieber erst mal von der Seitenlinie zu.'; } },
    ],
  },
  lieferant: {
    title: 'Der Hopfen-Deal', who: 'toni',
    text: 'Zwei Angebote liegen auf dem Tisch. Der Großhändler „HopfenMax“ bietet 3000 € Startkapital und Extrakt zum halben Preis – ' +
      'aber exklusiv: nur noch Hopfenextrakt. Hopfenbauer Toni Dolde liefert echten Hopfen 15 % günstiger und lädt dich zur Ernte ein (Ruf +5).',
    choices: [
      { id: 'extrakt', label: '💰 HopfenMax: 3000 € sofort, Extrakt halber Preis – aber nur Extrakt erlaubt.',
        apply: s => { s.cash += 3000; s.flags.extrakt_vertrag = true; s.flags.done_lieferant = true; return 'Unterschrieben. Dein Konto wächst – dein Hopfenaroma schrumpft.'; } },
      { id: 'bauer', label: '🌿 Hopfenbauer Toni: echter Hopfen 15 % günstiger, Ruf +5.',
        apply: s => { s.flags.regional = true; s.reputation += 5; s.flags.done_lieferant = true; return 'Handschlag auf dem Hopfenfeld. Der Duft der Ernte bleibt dir tagelang in der Nase.'; } },
      { id: 'unabhaengig', label: '🦅 Unabhängig bleiben: keine Bindung, Normalpreise.',
        apply: s => { s.flags.done_lieferant = true; return 'Du behältst die Freiheit – und zahlst Listenpreise.'; } },
    ],
  },
  abtei_besuch: {
    title: 'Besuch aus St. Gambrin', who: 'anselm',
    text: 'Ein Mönch in grauer Kutte steht vor deiner Tür. „Ich bin Bruder Anselm von der Abtei St. Gambrin, gegründet 1253. ' +
      'Man erzählt sich von Ihren Spenden – und von einem Bier, das jedes Mal gleich gut schmeckt. Unser Braubruder ist 84. ' +
      'Würden Sie mit uns ein Abteibier brauen? Ein Teil des Erlöses ginge an das Dach und die Suppenküche.“',
    choices: [
      { id: 'zusagen', label: '🙏 Zusagen: Bruder Anselm zeigt dir das Dubbel-Rezept der Abtei.',
        apply: s => { s.flags.abtei = true; if (!s.unlocked.includes('dubbel')) s.unlocked.push('dubbel'); s.honor = clamp(s.honor + 5, 0, 100); addXp(s, 40, 'Abtei');
          return 'Die schweren Klostertüren öffnen sich. Anselm reicht dir eine Schürze: „Ora et labora – und sauber arbeiten.“ ' +
            'Neu: Dubbel kannst du jetzt brauen, und die Abtei steht bei den Spenden. Braue ein Dubbel mit Qualität 72, dann probiert Anselm.'; } },
      { id: 'spaeter', label: '⏳ Später – du fühlst dich noch nicht bereit (er kommt in 60 Tagen wieder).', done: false,
        apply: s => { s.flags.retry_abtei_besuch = s.day + 60; return 'Anselm lächelt. „Geduld braut das beste Bier.“'; } },
    ],
  },
  abtei_sud: {
    title: 'Der Gemeinschaftssud', who: 'anselm',
    text: 'Bruder Anselm hält dein Dubbel gegen das Licht, riecht, probiert – und schweigt sehr lange. Dann: „Das darf das Siegel der Abtei tragen.“',
    choices: [
      { id: 'siegel', label: '⛪ Gemeinschaftssud „Gebraut mit den Mönchen von St. Gambrin, gegr. 1253“.',
        apply: s => { s.flags.gambrin = true; s.honor = clamp(s.honor + 10, 0, 100); s.reputation += 5; addXp(s, 80, 'Gemeinschaftssud');
          return 'Ab jetzt tragen deine Dubbel und Tripel das Siegel der Abtei: 40 % höherer Preis, 30 % des Erlöses gehen an die Abtei. Ansehen +10, Ruf +5.'; } },
    ],
  },
};

export const ENDINGS = {
  brauerei: 'ENDE: „{name}“ eröffnet. Du hast aus Opas Garage ein echtes Unternehmen gemacht. Du kannst weiterspielen – ' +
    'und die Karrierewege Craft, Großbrauerei und Kloster kommen als Nächstes.',
};
