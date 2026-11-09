// Zutaten- und Stil-Datenbank. Alle Werte sind Näherungswerte für die Berechnung.

// ebc: Farbe, extract: Extraktausbeute (% der Trockensubstanz, Feinschrot), maxPct: empfohlener Maximalanteil
export const MALTS = [
  { id: 'pilsner',   name: 'Pilsner Malz',        ebc: 3.5,  extract: 80.5, maxPct: 100 },
  { id: 'pale',      name: 'Pale Ale Malz',       ebc: 6,    extract: 80,   maxPct: 100 },
  { id: 'wiener',    name: 'Wiener Malz',         ebc: 9,    extract: 79.5, maxPct: 100 },
  { id: 'muenchner', name: 'Münchner Malz',       ebc: 17,   extract: 79,   maxPct: 100 },
  { id: 'weizen',    name: 'Weizenmalz hell',     ebc: 4,    extract: 81,   maxPct: 100 },
  { id: 'rauch',     name: 'Rauchmalz',           ebc: 6,    extract: 80,   maxPct: 100 },
  { id: 'carapils',  name: 'Carapils / Dextrin',  ebc: 4,    extract: 75,   maxPct: 10 },
  { id: 'carahell',  name: 'Caramel hell',        ebc: 25,   extract: 75,   maxPct: 20 },
  { id: 'caramuench',name: 'Caramünch II',        ebc: 120,  extract: 74,   maxPct: 15 },
  { id: 'carafa',    name: 'Carafa Spezial II',   ebc: 850,  extract: 70,   maxPct: 5 },
  { id: 'roest',     name: 'Röstgerste',          ebc: 1000, extract: 65,   maxPct: 8 },
];

// alpha: Alphasäure %
export const HOPS = [
  { id: 'hallertauer', name: 'Hallertauer Mittelfrüh', alpha: 4.0,  note: 'edel, würzig' },
  { id: 'tettnanger',  name: 'Tettnanger',             alpha: 4.5,  note: 'blumig, fein' },
  { id: 'saphir',      name: 'Saphir',                 alpha: 4.0,  note: 'zitrus, fruchtig' },
  { id: 'tradition',   name: 'Hallertauer Tradition',  alpha: 6.0,  note: 'mild-würzig' },
  { id: 'perle',       name: 'Perle',                  alpha: 8.0,  note: 'würzig, minzig' },
  { id: 'magnum',      name: 'Magnum',                 alpha: 13.0, note: 'sauber bitter' },
  { id: 'cascade',     name: 'Cascade',                alpha: 5.5,  note: 'grapefruit, blumig' },
  { id: 'citra',       name: 'Citra',                  alpha: 12.0, note: 'tropisch, zitrus' },
  { id: 'mosaic',      name: 'Mosaic',                 alpha: 11.5, note: 'beerig, tropisch' },
];

// attenuation: scheinbarer Endvergärungsgrad (Basis), rate: Mio. Zellen / ml / °P, temp: Gärtemperatur °C
export const YEASTS = [
  { id: 'lager',  name: 'Untergärige Lagerhefe (W-34/70)', attenuation: 80, rate: 1.5,  temp: '9–13 °C',  type: 'Lager' },
  { id: 'weizen', name: 'Weizenhefe (W-68)',               attenuation: 78, rate: 0.75, temp: '18–23 °C', type: 'Ale' },
  { id: 'ale',    name: 'Amerikanische Ale-Hefe (US-05)',  attenuation: 79, rate: 0.75, temp: '16–20 °C', type: 'Ale' },
  { id: 'koelsch',name: 'Kölsch-Hefe (K-97)',              attenuation: 81, rate: 0.75, temp: '15–19 °C', type: 'Ale' },
  { id: 'stout',  name: 'Englische Ale-Hefe (S-04)',       attenuation: 74, rate: 0.75, temp: '15–20 °C', type: 'Ale' },
];

// Stile: Zielbereiche + Startrezept. hops: [id, Gewichtung, Kochzeit min]; Mengen werden auf `ibu` skaliert.
export const STYLES = [
  {
    id: 'pils', name: 'Pils', desc: 'Hell, herb, knackig',
    ranges: { plato: [11, 12.5], ibu: [25, 45], ebc: [4, 8], abv: [4.4, 5.2] },
    start: { plato: 11.8, ibu: 35, yeast: 'lager', boilMin: 90,
      malts: [['pilsner', 95], ['carapils', 5]],
      hops: [['tradition', 60, 60], ['saphir', 25, 20], ['tettnanger', 15, 5]],
      mash: [[63, 45, 'Maltoserast'], [72, 30, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'helles', name: 'Helles', desc: 'Malzig, mild, süffig',
    ranges: { plato: [11, 12.5], ibu: [16, 24], ebc: [6, 12], abv: [4.7, 5.4] },
    start: { plato: 11.8, ibu: 19, yeast: 'lager', boilMin: 75,
      malts: [['pilsner', 80], ['wiener', 15], ['carapils', 5]],
      hops: [['tradition', 70, 60], ['hallertauer', 30, 10]],
      mash: [[63, 40, 'Maltoserast'], [72, 30, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'maerzen', name: 'Märzen', desc: 'Bernsteinfarben, rund',
    ranges: { plato: [12.5, 14], ibu: [18, 28], ebc: [18, 32], abv: [5.2, 6] },
    start: { plato: 13.2, ibu: 23, yeast: 'lager', boilMin: 75,
      malts: [['muenchner', 55], ['pilsner', 35], ['caramuench', 10]],
      hops: [['tradition', 75, 60], ['hallertauer', 25, 10]],
      mash: [[62, 45, 'Maltoserast'], [72, 35, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'weizen', name: 'Weizen', desc: 'Fruchtig, Banane & Nelke',
    ranges: { plato: [11, 13], ibu: [10, 16], ebc: [6, 20], abv: [4.9, 5.6] },
    start: { plato: 12.3, ibu: 13, yeast: 'weizen', boilMin: 60,
      malts: [['weizen', 55], ['pilsner', 45]],
      hops: [['tettnanger', 100, 60]],
      mash: [[45, 15, 'Ferulasäurerast'], [63, 35, 'Maltoserast'], [72, 30, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'pale', name: 'Pale Ale', desc: 'Fruchtig-hopfig, ausgewogen',
    ranges: { plato: [11, 14], ibu: [30, 50], ebc: [10, 25], abv: [4.5, 5.6] },
    start: { plato: 12.5, ibu: 38, yeast: 'ale', boilMin: 60,
      malts: [['pale', 85], ['carahell', 10], ['muenchner', 5]],
      hops: [['magnum', 40, 60], ['cascade', 35, 10], ['citra', 25, 0]],
      mash: [[66, 60, 'Kombirast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'ipa', name: 'IPA', desc: 'Kräftig, bitter, tropisch',
    ranges: { plato: [14, 17], ibu: [40, 70], ebc: [10, 30], abv: [5.5, 7.5] },
    start: { plato: 15.5, ibu: 60, yeast: 'ale', boilMin: 60,
      malts: [['pale', 88], ['carahell', 8], ['carapils', 4]],
      hops: [['magnum', 35, 60], ['cascade', 20, 15], ['citra', 25, 5], ['mosaic', 20, 0]],
      mash: [[65, 70, 'Kombirast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'stout', name: 'Stout', desc: 'Dunkel, geröstet, cremig',
    ranges: { plato: [12, 16], ibu: [25, 45], ebc: [60, 150], abv: [4, 6.2] },
    start: { plato: 13.5, ibu: 35, yeast: 'stout', boilMin: 60,
      malts: [['pale', 75], ['roest', 8], ['caramuench', 7], ['carafa', 3], ['muenchner', 7]],
      hops: [['perle', 75, 60], ['hallertauer', 25, 15]],
      mash: [[67, 60, 'Kombirast'], [78, 5, 'Abmaischen']] },
  },
  {
    id: 'doppelbock', name: 'Doppelbock', desc: 'Stark, malzig, dunkel',
    ranges: { plato: [18, 21], ibu: [20, 30], ebc: [30, 60], abv: [7, 8.5] },
    start: { plato: 18.5, ibu: 25, yeast: 'lager', boilMin: 90,
      malts: [['muenchner', 60], ['pilsner', 30], ['caramuench', 10]],
      hops: [['tradition', 80, 60], ['hallertauer', 20, 15]],
      mash: [[62, 60, 'Maltoserast'], [72, 40, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']] },
  },
];

export const byId = (list, id) => list.find(x => x.id === id);
