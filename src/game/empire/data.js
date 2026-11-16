// Braukonzern: Länder, Zielbrauereien, Rivalen, Ereignisse. Alle Firmen sind erfunden; Zahlen sind vereinfachte Spielwerte.

// marketKhl: Jahresmarkt in Tausend hl · price: Erlös €/hl ab Brauerei · excise: Biersteuer in % vom Erlös · tax: Gewinnsteuer %
// growth: Marktwachstum %/Jahr · comp: Konkurrenzdruck 0–1 · cost: Kostenniveau · entry: Kosten für ein Büro (€)
// open: wie offen für Übernahmen · risk: politisches Risiko 0–1 · styles: beliebte Stile (Passung 0–1, sonst 0,4)
export const COUNTRIES = [
  { id: 'DE', name: 'Deutschland', flag: '🇩🇪', region: 'Europa', marketKhl: 85000, price: 88, excise: 9, tax: 30, growth: -1, comp: 0.85, cost: 1.0, entry: 0, open: 0.8, risk: 0.05,
    styles: { pils: 1, helles: 0.95, weizen: 0.9, maerzen: 0.8, bock: 0.7, dunkel: 0.7, koelsch: 0.6, alt: 0.6, rauch: 0.5 },
    note: 'Heimatmarkt: riesig, aber gesättigt und hart umkämpft. Pils und Helles regieren, die Leute sind markentreu und preisbewusst.',
    targets: ['Kaiserquell Brauerei', 'Hopfenhain Privatbrauerei', 'Rotbach Bräu', 'Deutsche Fürstenbräu AG'] },
  { id: 'AT', name: 'Österreich', flag: '🇦🇹', region: 'Europa', marketKhl: 8500, price: 98, excise: 11, tax: 25, growth: 0, comp: 0.8, cost: 1.0, entry: 300000, open: 0.8, risk: 0.05,
    styles: { helles: 1, maerzen: 0.9, pils: 0.8, weizen: 0.7, dunkel: 0.6 },
    note: 'Hoher Bierkonsum, starke Regionalmarken und Gasthauskultur. Märzen und Helles sind Kulturgut.',
    targets: ['Alpenkrone Brauerei', 'Donauperle Bräu', 'Stiegenhof Brauhaus', 'Austria Krone Brauunion'] },
  { id: 'CH', name: 'Schweiz', flag: '🇨🇭', region: 'Europa', marketKhl: 4500, price: 140, excise: 6, tax: 15, growth: 0, comp: 0.8, cost: 1.4, entry: 500000, open: 0.6, risk: 0.04,
    styles: { helles: 1, pils: 0.8, weizen: 0.6, maerzen: 0.7, ipa: 0.5 },
    note: 'Kleiner, sehr reicher Markt mit hohen Preisen, aber auch hohen Löhnen. Craft-Beer boomt in den Städten.',
    targets: ['Rheinfels Bier', 'Säntis Brauerei', 'Matterhorn Craft', 'Schweizer Edelbräu Holding'] },
  { id: 'CZ', name: 'Tschechien', flag: '🇨🇿', region: 'Europa', marketKhl: 18000, price: 62, excise: 12, tax: 19, growth: 0, comp: 0.85, cost: 0.7, entry: 300000, open: 0.8, risk: 0.1,
    styles: { pils: 1, helles: 0.9, dunkel: 0.8, schwarzbier: 0.7 },
    note: 'Weltrekord beim Pro-Kopf-Konsum und Heimat des Pilsners. Billig, qualitätsbewusst und äußerst stolz auf die eigene Biertradition.',
    targets: ['Zlatá Koruna', 'Vltava Pivovar', 'Černá Hora Pivovar', 'Česká Pivovarská Unie'] },
  { id: 'PL', name: 'Polen', flag: '🇵🇱', region: 'Europa', marketKhl: 38000, price: 58, excise: 14, tax: 19, growth: 2, comp: 0.7, cost: 0.65, entry: 350000, open: 0.8, risk: 0.15,
    styles: { pils: 1, helles: 0.8, porter: 0.8, weizen: 0.6, ipa: 0.6 },
    note: 'Wachsender Markt mit niedrigen Kosten und lebendiger Craft-Szene. Baltic Porter ist eine Spezialität.',
    targets: ['Złoty Chmiel', 'Wisła Browar', 'Mazury Browar', 'Polskie Browary Zjednoczone'] },
  { id: 'NL', name: 'Niederlande', flag: '🇳🇱', region: 'Europa', marketKhl: 12000, price: 85, excise: 12, tax: 25, growth: 0, comp: 0.85, cost: 1.05, entry: 300000, open: 0.8, risk: 0.05,
    styles: { pils: 1, witbier: 0.8, ipa: 0.7, tripel: 0.6, weizen: 0.6 },
    note: 'Offener Handelsmarkt und Drehscheibe für den Export. Pils dominiert, Craft wächst.',
    targets: ['Grachtengold Brouwerij', 'Delta Bier', 'Tulpenbrouwerij', 'Hollandse Bierunie'] },
  { id: 'BE', name: 'Belgien', flag: '🇧🇪', region: 'Europa', marketKhl: 8000, price: 95, excise: 10, tax: 25, growth: -1, comp: 0.85, cost: 1.05, entry: 300000, open: 0.7, risk: 0.05,
    styles: { tripel: 1, dubbel: 1, witbier: 0.9, saison: 0.9, pils: 0.7, berliner: 0.4 },
    note: 'Das Land der Vielfalt: Abteibiere, Saison, Lambic. Wer hier besteht, hat ein exzellentes Handwerk.',
    targets: ['Abdij Sint-Gaudric', 'Lambiek Huis Mertens', 'Scheldebrouwerij', 'Belgische Brouwersgroep'] },
  { id: 'FR', name: 'Frankreich', flag: '🇫🇷', region: 'Europa', marketKhl: 20000, price: 92, excise: 11, tax: 25, growth: 0, comp: 0.8, cost: 1.1, entry: 400000, open: 0.7, risk: 0.08,
    styles: { pils: 0.8, saison: 0.8, ipa: 0.7, witbier: 0.7, helles: 0.6 },
    note: 'Wein ist König, Bier ist im Aufwind. Wachsende Craft-Szene, Handelsmarken dominieren die Supermärkte.',
    targets: ['Brasserie des Vignes', 'Brasserie Lumière', 'Brasserie du Coq Doré', 'Grande Brasserie de France'] },
  { id: 'UK', name: 'Vereinigtes Königreich', flag: '🇬🇧', region: 'Europa', marketKhl: 40000, price: 95, excise: 24, tax: 25, growth: -1, comp: 0.85, cost: 1.0, entry: 400000, open: 0.8, risk: 0.08,
    styles: { pale: 1, porter: 0.9, stout: 0.9, ipa: 0.9, helles: 0.5 },
    note: 'Pub-Kultur, Cask Ale und eine der höchsten Biersteuern Europas. Craft-IPA ist massiv.',
    targets: ['Ironbridge Brewery', 'Highland Cask Brewing', 'Thames Anchor Brewery', 'British Isles Brewing PLC'] },
  { id: 'IE', name: 'Irland', flag: '🇮🇪', region: 'Europa', marketKhl: 4000, price: 105, excise: 20, tax: 12.5, growth: 0, comp: 0.8, cost: 1.05, entry: 300000, open: 0.7, risk: 0.05,
    styles: { stout: 1, porter: 0.8, pale: 0.6, helles: 0.5 },
    note: 'Stout-Land mit niedriger Unternehmenssteuer. Ein Heimspiel für dunkle Biere.',
    targets: ['Emerald Cask Brewery', 'Shannon Stout Co.', 'Burren Ale Works', 'Hibernia Brewing Group'] },
  { id: 'ES', name: 'Spanien', flag: '🇪🇸', region: 'Europa', marketKhl: 38000, price: 72, excise: 8, tax: 25, growth: 1, comp: 0.8, cost: 0.85, entry: 350000, open: 0.8, risk: 0.1,
    styles: { pils: 1, helles: 0.9, weizen: 0.5, ipa: 0.5 },
    note: 'Großer Markt für leichte, kühle Lager – besonders im Sommer und an der Küste.',
    targets: ['Cervezas Sol de Triana', 'Cervecera del Ebro', 'Cervezas Costa Dorada', 'Cervezas Reunidas de España'] },
  { id: 'IT', name: 'Italien', flag: '🇮🇹', region: 'Europa', marketKhl: 18000, price: 78, excise: 9, tax: 24, growth: 1, comp: 0.75, cost: 0.95, entry: 350000, open: 0.7, risk: 0.12,
    styles: { pils: 0.9, helles: 0.8, ipa: 0.7, saison: 0.6, weizen: 0.6 },
    note: 'Wein gegen Bier – Bier gewinnt Boden. Lebendige Craft-Brauereien und starke Gastronomie.',
    targets: ['Birrificio Colle Verde', 'Birrificio Lago Azzurro', 'Birra Vesuvio', 'Birra Nazionale Italiana'] },
  { id: 'TR', name: 'Türkei', flag: '🇹🇷', region: 'Europa/Asien', marketKhl: 8000, price: 70, excise: 40, tax: 25, growth: 3, comp: 0.6, cost: 0.6, entry: 400000, open: 0.4, risk: 0.35,
    styles: { pils: 1, helles: 0.7 },
    note: 'Sehr hohe Alkoholsteuern und politische Risiken, dafür junge Bevölkerung und Wachstum.',
    targets: ['Bosporus Bira', 'Anadolu Maya Bira', 'Kızılırmak Bira', 'Anadolu Bira A.Ş.'] },
  { id: 'US', name: 'USA', flag: '🇺🇸', region: 'Amerika', marketKhl: 240000, price: 82, excise: 7, tax: 21, growth: 1, comp: 0.9, cost: 1.0, entry: 1000000, open: 0.8, risk: 0.1,
    styles: { ipa: 1, pale: 0.9, neipa: 0.9, stout: 0.7, pils: 0.7, helles: 0.6 },
    note: 'Der größte Craft-Markt der Welt und riesige Marken. Alles ist möglich – gegen entsprechend harte Konkurrenz.',
    targets: ['Redwood Craft Collective', 'Midwest Lager Co.', 'Liberty Bell Brewing', 'American Heritage Brewing Co.'] },
  { id: 'CA', name: 'Kanada', flag: '🇨🇦', region: 'Amerika', marketKhl: 22000, price: 90, excise: 11, tax: 26, growth: 0, comp: 0.8, cost: 1.0, entry: 600000, open: 0.7, risk: 0.06,
    styles: { pils: 0.8, pale: 0.8, ipa: 0.8, stout: 0.6 },
    note: 'Stabil, offen und eng mit den USA verflochten. Craft-Beer ist gut etabliert.',
    targets: ['Maple Ridge Brewing', 'Laurentian Lager Co.', 'Pacific Rim Ales', 'Dominion Brewing Corp.'] },
  { id: 'MX', name: 'Mexiko', flag: '🇲🇽', region: 'Amerika', marketKhl: 85000, price: 60, excise: 12, tax: 30, growth: 2, comp: 0.85, cost: 0.6, entry: 800000, open: 0.6, risk: 0.25,
    styles: { pils: 1, helles: 0.9, dunkel: 0.7 },
    note: 'Riesiger Lager-Markt mit zwei dominanten Konzernen. Heißes Klima, hoher Durst, aber auch Sicherheits- und Währungsrisiken.',
    targets: ['Cervecería Sol Azteca', 'Cervecería del Valle', 'Cervecería Pacífico Sur', 'Grupo Cervecero Azteca'] },
  { id: 'BR', name: 'Brasilien', flag: '🇧🇷', region: 'Amerika', marketKhl: 135000, price: 55, excise: 18, tax: 34, growth: 2.5, comp: 0.85, cost: 0.6, entry: 900000, open: 0.6, risk: 0.3,
    styles: { pils: 1, helles: 0.8, weizen: 0.5 },
    note: 'Gigantischer, heißer Markt mit sehr kaltem Pils. Hohe Steuern, starke Platzhirsche und schwankende Währung.',
    targets: ['Cervejaria Praia Dourada', 'Cervejaria Serra Verde', 'Cervejaria Amazônia Nova', 'Companhia Cervejeira do Brasil'] },
  { id: 'AR', name: 'Argentinien', flag: '🇦🇷', region: 'Amerika', marketKhl: 18000, price: 45, excise: 12, tax: 30, growth: 1, comp: 0.65, cost: 0.55, entry: 500000, open: 0.5, risk: 0.45,
    styles: { pils: 0.9, helles: 0.8, ipa: 0.6 },
    note: 'Bierfreudig, aber mit Inflation und Währungschaos. Hohe Chancen, hohes Risiko.',
    targets: ['Cervecería Pampa', 'Cervecería Andes del Sur', 'Cervecería Río de la Plata', 'Cervecería Nacional Argentina'] },
  { id: 'CO', name: 'Kolumbien', flag: '🇨🇴', region: 'Amerika', marketKhl: 25000, price: 50, excise: 14, tax: 35, growth: 3, comp: 0.75, cost: 0.55, entry: 500000, open: 0.5, risk: 0.25,
    styles: { pils: 1, helles: 0.7 },
    note: 'Wachsende Mittelschicht und ein Markt, der von einem Branchenriesen dominiert wird.',
    targets: ['Cervecería Andina Café', 'Cervecería del Caribe Sur', 'Cervecería Monserrate', 'Cervecería Nacional de Colombia'] },
  { id: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asien', marketKhl: 45000, price: 120, excise: 22, tax: 30, growth: -2, comp: 0.9, cost: 1.2, entry: 800000, open: 0.4, risk: 0.05,
    styles: { pils: 1, helles: 0.8, ipa: 0.6, stout: 0.5 },
    note: 'Schrumpfender, aber extrem qualitätsbewusster Markt. Präzision wird belohnt, Fehler nicht verziehen.',
    targets: ['Fuji Tennen Brewery', 'Sakura Biru', 'Nagomi Craft Beer', 'Nippon Biiru K.K.'] },
  { id: 'CN', name: 'China', flag: '🇨🇳', region: 'Asien', marketKhl: 360000, price: 45, excise: 8, tax: 25, growth: 2, comp: 0.85, cost: 0.6, entry: 1500000, open: 0.3, risk: 0.3,
    styles: { pils: 1, helles: 0.8, weizen: 0.6, ipa: 0.5 },
    note: 'Der größte Biermarkt der Welt. Riesig, preissensibel, politisch riskant – Übernahmen sind schwer.',
    targets: ['Jade Dragon Brewery', 'Yangtze Beer Group', 'Great Wall Craft', 'China Beer Holdings'] },
  { id: 'IN', name: 'Indien', flag: '🇮🇳', region: 'Asien', marketKhl: 35000, price: 55, excise: 20, tax: 25, growth: 8, comp: 0.6, cost: 0.5, entry: 800000, open: 0.5, risk: 0.25,
    styles: { pils: 0.8, helles: 0.7, weizen: 0.6, ipa: 0.6 },
    note: 'Schnellstes Marktwachstum der Welt, aber komplizierte Länder-Regeln für Alkohol und viel Bürokratie.',
    targets: ['Ganga Ale Works', 'Deccan Lager Ltd.', 'Himalaya Brew Co.', 'Bharat Beverages Ltd.'] },
  { id: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'Asien', marketKhl: 40000, price: 40, excise: 15, tax: 20, growth: 5, comp: 0.7, cost: 0.45, entry: 500000, open: 0.5, risk: 0.2,
    styles: { pils: 1, helles: 0.7 },
    note: 'Junge, durstige Bevölkerung, günstig und schnell wachsend. Leichtes, kühles Lager ist der Standard.',
    targets: ['Mekong Beer', 'Saigon Craft Brew', 'Hạ Long Bia', 'Vietnam Beer Corporation'] },
  { id: 'ZA', name: 'Südafrika', flag: '🇿🇦', region: 'Afrika', marketKhl: 30000, price: 52, excise: 15, tax: 28, growth: 2, comp: 0.85, cost: 0.6, entry: 400000, open: 0.6, risk: 0.25,
    styles: { pils: 1, helles: 0.8, ipa: 0.5 },
    note: 'Der reifste Biermarkt Afrikas mit einem dominanten Platzhirsch und aufstrebender Craft-Szene.',
    targets: ['Cape Winelands Brewing', 'Karoo Lager Co.', 'Table Mountain Brewery', 'Southern Cross Breweries'] },
  { id: 'NG', name: 'Nigeria', flag: '🇳🇬', region: 'Afrika', marketKhl: 22000, price: 48, excise: 18, tax: 30, growth: 6, comp: 0.7, cost: 0.5, entry: 500000, open: 0.5, risk: 0.4,
    styles: { pils: 1, stout: 0.9, helles: 0.6 },
    note: 'Bevölkerungsreichstes Land Afrikas. Stout ist beliebt, doch Energieausfälle und Währung sind große Risiken.',
    targets: ['Lagos Gold Brewery', 'Niger Delta Beer', 'Harmattan Brew', 'Nigerian National Breweries'] },
  { id: 'AU', name: 'Australien', flag: '🇦🇺', region: 'Ozeanien', marketKhl: 17000, price: 110, excise: 18, tax: 30, growth: -1, comp: 0.8, cost: 1.15, entry: 500000, open: 0.7, risk: 0.05,
    styles: { pils: 0.9, pale: 0.9, ipa: 0.8, helles: 0.6 },
    note: 'Hohe Preise, hohe Steuern, heißes Klima. Craft ist etabliert und die Leute zahlen für Qualität.',
    targets: ['Outback Lager Co.', 'Bondi Craft Brewers', 'Tasman Sea Brewing', 'Commonwealth Brewing Ltd.'] },
];
export const HOME = 'DE';
export const countryOf = id => COUNTRIES.find(c => c.id === id);

// Deterministische Pseudo-Zufallszahl (0–1) aus Text, damit die Welt in jedem Spiel gleich ist.
const hash = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const frac = (str, k) => ((Math.imul(hash(str), 2654435761 + k * 40503) >>> 7) % 1000) / 1000;

/** Zielbrauereien: je Land 4 (klein, mittel, groß und der nationale Marktführer). */
export const TARGETS = COUNTRIES.flatMap(c => c.targets.map((name, i) => {
  const size = [0.0016, 0.006, 0.022, 0.15][i] * (0.8 + frac(c.id + name, 1) * 0.5);
  const topStyles = Object.entries(c.styles).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return {
    id: `${c.id}-${i + 1}`, country: c.id, name, tier: ['klein', 'mittel', 'groß', 'Marktführer'][i],
    capKhl: Math.max(8, Math.round(c.marketKhl * size / 5) * 5),
    quality: Math.round((i === 3 ? 58 : 46) + frac(c.id + name, 2) * (i === 3 ? 27 : 34)), brand: Math.round((i === 3 ? 55 : 22) + frac(c.id + name, 3) * (i === 3 ? 25 : 48)),
    tech: 1 + Math.floor(frac(c.id + name, 4) * 3), style: topStyles[i % Math.min(3, topStyles.length)],
  };
}));
export const targetOf = id => TARGETS.find(t => t.id === id);

export const HQ_LEVELS = [
  { lvl: 1, name: 'Hinterzimmer',            maxBreweries: 3,  maxCountries: 2,  cost: 0,          monthly: 15000 },
  { lvl: 2, name: 'Firmensitz',              maxBreweries: 6,  maxCountries: 4,  cost: 1500000,    monthly: 40000 },
  { lvl: 3, name: 'Regionalzentrale',        maxBreweries: 10, maxCountries: 7,  cost: 6000000,    monthly: 100000 },
  { lvl: 4, name: 'Konzernzentrale',         maxBreweries: 16, maxCountries: 11, cost: 25000000,   monthly: 250000 },
  { lvl: 5, name: 'Internationale Holding',  maxBreweries: 24, maxCountries: 16, cost: 80000000,   monthly: 600000 },
  { lvl: 6, name: 'Weltkonzern',             maxBreweries: 40, maxCountries: 26, cost: 250000000,  monthly: 1500000 },
];

// Weltrangliste: erfundene Konkurrenten (Startvolumen in Mio. hl/Jahr, Wachstum %/Jahr)
export const RIVALS = [
  { name: 'Omega Global Beverages',   mhl: 60,  growth: 2.5 }, { name: 'Nordstern Brauunion',      mhl: 38,  growth: 2.0 },
  { name: 'Pacific Crown Breweries',  mhl: 26,  growth: 3.0 }, { name: 'Lion & Laurel Group',       mhl: 16,  growth: 2.5 },
  { name: 'Alpenglanz Holding',       mhl: 10,  growth: 2.0 }, { name: 'Sol y Cebada S.A.',         mhl: 8,   growth: 3.0 },
  { name: 'Kaiserkrone Brauerei AG',  mhl: 5,   growth: 1.5 }, { name: 'Tigerquelle Breweries',     mhl: 3.5, growth: 3.5 },
  { name: 'Hansa Fass & Fein',        mhl: 2,   growth: 2.0 }, { name: 'Bergmann Bräu Gruppe',      mhl: 1.2, growth: 1.5 },
];

// Monatliche Ereignisse. scope: 'global' | 'land'; wirken über Mods mit Laufzeit in Monaten.
export const EVENTS = [
  { id: 'rezession',  scope: 'global', label: 'Weltweite Rezession: Die Leute sparen, die Nachfrage sinkt.', months: 8,  demand: 0.88 },
  { id: 'aufschwung', scope: 'global', label: 'Wirtschaftsboom: Mehr Geld im Portemonnaie, mehr Bier im Glas.', months: 8, demand: 1.08 },
  { id: 'pandemie',   scope: 'global', label: 'Pandemie: Gaststätten schließen, der Markt bricht ein.', months: 6, demand: 0.7, rare: true },
  { id: 'hopfen',     scope: 'global', label: 'Hopfen- und Gerstenpreise ziehen an: Die Herstellkosten steigen.', months: 10, cost: 1.1 },
  { id: 'energie',    scope: 'global', label: 'Energiekrise: Brauen wird teuer.', months: 10, cost: 1.15, rare: true },
  { id: 'rabatt',     scope: 'global', label: 'Gerstenüberschuss: Die Rohstoffe werden günstiger.', months: 8, cost: 0.93 },
  { id: 'waehrung',   scope: 'land',   label: 'Währungsschock: Die Erlöse in {land} schmelzen.', months: 8, price: 0.88 },
  { id: 'aufwertung', scope: 'land',   label: 'Starke Währung in {land}: Die Erlöse steigen.', months: 8, price: 1.08 },
  { id: 'hitze',      scope: 'land',   label: 'Hitzesommer in {land}: Der Durst ist riesig.', months: 3, demand: 1.15 },
  { id: 'boom',       scope: 'land',   label: 'Craft-Beer-Boom in {land}: Das Interesse an Spezialbieren steigt.', months: 12, demand: 1.1 },
  { id: 'handel',     scope: 'land',   label: 'Handelsstreit mit {land}: Zölle verteuern deine Erlöse und Lieferungen.', months: 10, price: 0.92, cost: 1.04 },
  { id: 'steuer',     scope: 'land',   label: 'Biersteuer in {land} steigt.', months: 18, price: 0.95 },
];
