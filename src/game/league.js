// Die Bierliga: Rangliste mit erfundenen Konkurrenz-Brauereien (bewusst Fantasienamen, keine echten Marken).
import { START_DAY } from './config.js';

export const COMPETITORS = [
  { name: 'Massivbräu AG',               icon: '🏭', pts: 9400, text: 'Der Riese: billig, überall, mit Werbung auf jeder Autobahnbrücke.' },
  { name: 'Kronkorken-Kartell',          icon: '🏭', pts: 8100, text: 'Drei Großbrauereien, die zufällig immer gleich teuer sind.' },
  { name: 'Brauhaus Schaumschläger',     icon: '📣', pts: 6200, text: 'Viel Werbung, wenig dahinter.' },
  { name: 'Ex & Hopp Getränke',          icon: '🥫', pts: 4800, text: 'Billigbier im Einwegpack. Hauptsache weg.' },
  { name: 'Trübsal Brewing',             icon: '🎨', pts: 3600, text: 'Trübe NEIPAs, beste Laune – mal Rivale, mal Freund.' },
  { name: 'Zapfenstreich-Bräu',          icon: '🕙', pts: 2900, text: 'Traditionshaus. Macht pünktlich um 22 Uhr zu.' },
  { name: 'Klosterschänke Pater Noster', icon: '🍽️', pts: 2300, text: 'Gemütlich, mit „Klosterflair“ – aber ohne Kloster.' },
  { name: 'Sudoku Brewing',              icon: '🧩', pts: 1800, text: 'Bier wie Rätsel. Keiner versteht die Etiketten, alle kaufen sie.' },
  { name: 'Gerstensaft & Söhne',         icon: '🌾', pts: 1400, text: 'Familienbetrieb in fünfter Generation.' },
  { name: 'Krugwerk Knödelbach',         icon: '🍺', pts: 1100, text: 'Bierkrüge so groß wie Blumenvasen.' },
  { name: 'Malzmühle Moosgrund',         icon: '⚙️', pts: 850,  text: 'Mälzt selbst, braut gemütlich.' },
  { name: 'Bierbaron von Bügelstein',    icon: '🎩', pts: 650,  text: 'Adelig, eitel, aber das Bier ist ordentlich.' },
  { name: 'Hopfenhain Hinterwald',       icon: '🌲', pts: 480,  text: 'Braut mitten im Wald. Der Lieferwagen findet selten hin.' },
  { name: 'Kessel & Kumpel',             icon: '🤝', pts: 340,  text: 'Zwei Kumpel, ein Kessel, viele Ideen.' },
  { name: 'Schluckspecht-Bräu',          icon: '🐦', pts: 230,  text: 'Kleine Gasthausbrauerei am Dorfplatz.' },
  { name: 'Gärgenuss Gänsefurt',         icon: '🪿', pts: 150,  text: 'Die Gänse im Hof bewachen den Gärkeller.' },
  { name: 'Zum Goldenen Kessel',         icon: '🥇', pts: 95,   text: 'Hat den goldenen Kessel nur gemietet.' },
  { name: 'Bräustüberl Bröselbach',      icon: '🥨', pts: 55,   text: 'Mehr Brezen als Bier.' },
  { name: 'Hopfen & Malz Verloren GmbH', icon: '😅', pts: 25,   text: 'Der ewige Tabellenletzte vor dir. Sehr sympathisch.' },
];

const MEDAL_PTS = { Gold: 400, Silber: 250, Bronze: 150 };

/** Punkte der eigenen Brauerei: Ruf, Ansehen, Medaillen, Absatz. */
export function playerPoints(s) {
  const medals = (s.stats.medals || []).reduce((a, m) => a + (MEDAL_PTS[m.medal] || 0), 0);
  return Math.round(s.reputation * 20 + (s.honor || 0) * 10 + medals + s.stats.soldL * 0.5 + s.stats.givenL * 0.3 + s.stats.bestQuality);
}

/** Konkurrenten wachsen über die Jahre langsam mit (große schneller). */
const compPoints = (c, day) => Math.round(c.pts * (1 + Math.max(0, day - START_DAY) / 365 * 0.04));

export function ranking(s) {
  const list = COMPETITORS.map(c => ({ name: c.name, icon: c.icon, text: c.text, points: compPoints(c, s.day), me: false }));
  list.push({ name: s.breweryName, icon: '⭐', text: 'Das bist du!', points: playerPoints(s), me: true });
  list.sort((a, b) => b.points - a.points || (a.me ? 1 : -1));
  return { list, myRank: list.findIndex(x => x.me) + 1 };
}
