// Die Geschichte: Kapitel mit Zielen, Ereignissen und Entscheidungen.
// Alles Text ist Deutsch; Zustand wird nur über `s` verändert (JSON-serialisierbar).
import { EQUIPMENT, TIER_ORDER, CELLAR_RENT } from './config.js';
import { log, rand, need, spend, round2 } from './state.js';
import { addXp } from './progress.js';

const tierAtLeast = (s, slot, tier) => TIER_ORDER[slot].indexOf(s.equipment[slot]) >= TIER_ORDER[slot].indexOf(tier);
const stockOf = s => s.beers.filter(b => b.liters > 0.01);
const bestBeer = s => stockOf(s).sort((a, b) => b.quality - a.quality)[0];

export const CHAPTERS = [
  {
    id: 'garage',
    title: 'Kapitel 1 – Opas Garage',
    intro: 'Opa Heinrich ist gestorben. Er hinterlässt dir seine Garage: Werkbank, Spinnweben, ein 30-Liter-Einkochtopf, ' +
      'ein Plastikeimer – und ein Glas mit uralten Hopfendolden. „Mach was draus“, steht auf dem Zettel. Es ist März.',
    objectives: [
      { id: 'brew1', text: 'Setze deinen ersten Sud an.', done: s => s.stats.batches >= 1 },
      { id: 'q40', text: 'Braue ein Bier, das mindestens Qualität 40 erreicht.', done: s => s.stats.bestQuality >= 40 },
    ],
    outro: 'Der erste Schluck. Nicht perfekt – aber es ist DEIN Bier. Nachbar Klaus hat Wind davon bekommen.',
    events: [
      { id: 'opa_brief', when: () => true },
    ],
  },
  {
    id: 'fest',
    title: 'Kapitel 2 – Das Straßenfest',
    intro: 'Klaus organisiert das Straßenfest und will „dein Garagenbier“ ausschenken. Verschenken ist erlaubt – ' +
      'verkaufen nicht. Dein Ruf in der Straße steht auf dem Spiel.',
    objectives: [
      { id: 'give20', text: 'Verschenke insgesamt 20 Liter Bier.', done: s => s.stats.givenL >= 20 },
      { id: 'rep8', text: 'Erreiche 8 Ruf.', done: s => s.reputation >= 8 },
    ],
    outro: 'Die Leute reden. „Wo kann man das kaufen?“ – diese Frage hörst du den ganzen Abend.',
    events: [{ id: 'fest_einladung', when: () => true }],
  },
  {
    id: 'gewerbe',
    title: 'Kapitel 3 – Ein Gewerbe?',
    intro: 'Die Nachfrage ist da. Aber Verkaufen heißt: Gewerbe, Hauptzollamt, Biersteuer. Oder du riskierst es.',
    objectives: [
      { id: 'legal', text: 'Kläre deinen Status (Gewerbe oder anderer Weg).', done: s => !!s.flags.done_gewerbe },
      { id: 'sell50', text: 'Verkaufe insgesamt 50 Liter.', done: s => s.stats.soldL >= 50 },
    ],
    outro: 'Die ersten Euros klimpern im Einkochtopf. Jetzt wird es ernst.',
    events: [{ id: 'gewerbe', when: () => true }],
  },
  {
    id: 'keller',
    title: 'Kapitel 4 – Aus der Garage in den Keller',
    intro: 'Im Sommer wird die Garage zur Sauna, im Winter zum Kühlschrank – deine Biere leiden. Zeit für Technik.',
    objectives: [
      { id: 'gear', text: 'Kaufe einen 50-L-Kessel und einen Gärkühlschrank.', done: s => tierAtLeast(s, 'kettle', 'kessel50') && tierAtLeast(s, 'cooling', 'kuehlschrank') },
      { id: 'styles3', text: 'Braue drei verschiedene Bierstile.', done: s => s.stats.styles.length >= 3 },
      { id: 'q65', text: 'Braue ein Bier mit Qualität 65 oder mehr.', done: s => s.stats.bestQuality >= 65 },
    ],
    outro: 'Konstante Temperaturen, saubere Gärung. Dein Bier schmeckt plötzlich nach Absicht statt nach Zufall.',
    onEnter: s => { s.stage = 'keller'; },
    events: [{ id: 'keller_angebot', when: () => true }],
  },
  {
    id: 'wettbewerb',
    title: 'Kapitel 5 – Die Landesmeisterschaft',
    intro: 'Die Landesmeisterschaft der Heim- und Craftbrauer steht an. Ein Medaillenplatz würde dir Türen öffnen.',
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
    outro: 'Du kündigst deinen Job. Über dem Tor steht in Opas Handschrift-Schrift: „Heinrichs Hausbrauerei“.',
    onEnter: s => {},
    events: [{ id: 'lieferant', when: () => true }],
    ending: 'brauerei',
  },
];

// ----- Ereignisse mit Entscheidungen -----
// `choices[].enabled(s)` darf Optionen sperren; `apply(s)` liefert den Ergebnistext.
export const EVENTS = {
  opa_brief: {
    title: 'Opas Brief',
    text: 'Im Hopfenglas liegt ein Brief: „Hopfen muss frisch sein, Junge. Aber ich habe nie was weggeworfen.“ ' +
      'Daneben ein verstaubtes Hygiene-Buch von der Brauerei-Fachschule. Womit fängst du an?',
    choices: [
      { id: 'tradition', label: 'Opas Weg: Nimm den alten Hopfen und probier’s einfach.',
        apply: s => { s.flags.tradition = true; return 'Du nimmst die Dolden aus dem Glas. Sie riechen … nach Heu und Käse. Mal sehen.'; } },
      { id: 'buch', label: 'Erst das Hygiene-Buch lesen (Hygiene +).',
        apply: s => { s.hygiene = Math.min(0.6, s.hygiene + 0.1); return 'Zwei Abende Lektüre: Sauberkeit ist 90 % des Brauens. Deine Hygiene steigt.'; } },
    ],
  },
  fest_einladung: {
    title: 'Klaus und das Straßenfest',
    text: 'Klaus steht grinsend am Gartentor: „Zwei Fässer für das Fest, ja? Alle sind gespannt.“',
    choices: [
      { id: 'zusagen', label: 'Zusagen – das Fest ist deine Bühne (Ruf-Bonus beim Verschenken).',
        apply: s => { s.flags.fest = true; return 'Klaus klopft dir auf die Schulter. „Dann bring was Gutes mit!“'; } },
      { id: 'absagen', label: 'Absagen – du bist noch nicht bereit (Ruf −2, Klaus fragt in 7 Tagen erneut).',
        done: false,
        apply: s => { s.reputation = Math.max(0, s.reputation - 2); s.flags.retry_fest_einladung = s.day + 7; return 'Klaus zuckt mit den Schultern. Du verschenkst dein Bier eben nach und nach.'; } },
    ],
  },
  gewerbe: {
    title: 'Gewerbe, Zoll und Biersteuer',
    text: 'Das Hauptzollamt erklärt am Telefon: Hobbybrauen bis 200 Liter im Jahr ist steuerfrei – aber ohne Verkauf. ' +
      'Wer verkauft, braucht Gewerbe und zahlt Biersteuer. Was tust du?',
    repeatable: true,
    choices: [
      { id: 'anmelden', label: 'Gewerbe anmelden (150 €). Verkauf legal, Biersteuer fällig.',
        enabled: s => s.cash >= 150,
        apply: s => { spend(s, 150, 'Gewerbeanmeldung'); s.license = true; s.flags.done_gewerbe = true; return 'Der Stempel ist drauf. Ab jetzt zahlst du Biersteuer – dafür schläfst du ruhig.'; } },
      { id: 'schwarz', label: 'Heimlich verkaufen. Riskant: Kontrollen und Strafen drohen.',
        apply: s => { s.license = false; s.flags.schwarz = true; s.flags.done_gewerbe = true; return 'Du verkaufst „unter der Hand“. Bei jedem Verkauf lauert die Kontrolle.'; } },
      { id: 'hobby', label: 'Vorerst Hobby bleiben (Ruf +2, kein Verkauf; die Frage kommt in 14 Tagen wieder).',
        done: false,
        apply: s => { s.reputation += 2; s.flags.retry_gewerbe = s.day + 14; return 'Du bleibst Hobbybrauer. Die Leute bewundern dein Prinzip – bis die Nachfrage wieder drängt.'; } },
    ],
  },
  keller_angebot: {
    title: 'Tante Gerdas Keller',
    text: 'Tante Gerda bietet dir ihren kühlen Gewölbekeller an – stabile 12 °C ganzjährig, Platz für einen weiteren Gärtank. ' +
      `Miete: ${CELLAR_RENT} € pro 30 Tage.`,
    choices: [
      { id: 'annehmen', label: 'Annehmen: +1 Gärplatz, kühler Keller, laufende Miete.',
        apply: s => { s.flags.keller = true; s.flags.miete = true; return 'Gerda drückt dir den Schlüssel in die Hand. „Aber keine Schlammschlachten im Treppenhaus.“'; } },
      { id: 'ablehnen', label: 'Ablehnen: in der Garage bleiben, keine Miete.',
        apply: s => 'Du bleibst in der Garage. Dafür bleibt das Geld in der Kasse.' },
    ],
  },
  wettbewerb: {
    title: 'Landesmeisterschaft',
    text: 'Die Anmeldegebühr beträgt 40 €. Du stellst dein bestes Bier im Lager vor. Die Jury probiert blind.',
    repeatable: true,
    choices: [
      { id: 'teilnehmen', label: 'Teilnehmen (40 €) mit deinem besten Bier.',
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
      { id: 'verzichten', label: 'Dieses Mal verzichten (Frage kommt in 30 Tagen wieder).',
        done: false,
        apply: s => { s.flags.retry_wettbewerb = s.day + 30; return 'Du schaust lieber erst mal von der Seitenlinie zu.'; } },
    ],
  },
  lieferant: {
    title: 'Der Hopfen-Deal',
    text: 'Zwei Angebote liegen auf dem Tisch. Der Großhändler „HopfenMax“ bietet 3000 € Startkapital und Extrakt zum halben Preis – ' +
      'aber exklusiv: nur noch Hopfenextrakt, kein Aroma-Hopfen mehr. Der Hallertauer Hopfenbauer liefert 15 % günstiger echten ' +
      'Hopfen und lädt dich zur Ernte ein (Ruf +5), gibt aber kein Geld im Voraus.',
    choices: [
      { id: 'extrakt', label: 'HopfenMax: 3000 € sofort, Extrakt halber Preis – aber nur Extrakt erlaubt.',
        apply: s => { s.cash += 3000; s.flags.extrakt_vertrag = true; s.flags.done_lieferant = true; return 'Unterschrieben. Dein Konto wächst – dein Hopfenaroma schrumpft. Ein Vertrag ist ein Vertrag.'; } },
      { id: 'bauer', label: 'Hopfenbauer: echter Hopfen 15 % günstiger, Ruf +5.',
        apply: s => { s.flags.regional = true; s.reputation += 5; s.flags.done_lieferant = true; return 'Handschlag auf dem Hopfenfeld. Der Duft der Ernte bleibt dir tagelang in der Nase.'; } },
      { id: 'unabhaengig', label: 'Unabhängig bleiben: keine Bindung, Normalpreise.',
        apply: s => { s.flags.done_lieferant = true; return 'Du behältst die Freiheit – und zahlst Listenpreise.'; } },
    ],
  },
};

export const ENDINGS = {
  brauerei: 'ENDE: Heinrichs Hausbrauerei eröffnet. Du hast aus Opas Garage ein echtes Unternehmen gemacht. ' +
    'Du kannst weiterspielen – der Sandbox-Modus steht dir jederzeit offen.',
};
