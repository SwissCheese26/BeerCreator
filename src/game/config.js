// Spiel-Konstanten. Alle Preise in €. Steuer- und Rechtsregeln sind für das Spiel vereinfacht.

export const START_DAY = 60;           // 1. März
export const YEAR_DAYS = 365;
// Steuerfreie Hausbrauer-Menge pro Kalenderjahr (ohne Verkauf). Rechtsstand prüfen (zoll.de):
// lange 200 L; eine Anhebung auf 500 L war im Gespräch – der Wert ist bewusst hier zentral einstellbar.
export const HOBBY_LIMIT_L = 200;
export const LAW_STAND = '2026 (vereinfacht)';
export const TAX_PER_HL_PLATO = 0.787; // Biersteuer € je hl und °P (Regelsatz, § 2 BierStG)
export const TAX_SMALL_FACTOR = 0.5;   // Kleinbrauerei-Satz bis 5.000 hl/Jahr
export const YEAST_PACK_CELLS = 160;   // Mrd. Zellen je Trockenhefe-Päckchen (11,5 g)
export const BOTTLING_LOSS = 0.92;     // Anteil des Gärvolumens, der als Fertigbier übrig bleibt
export const CELLAR_RENT = 40;         // € pro 30 Tage
export const ENERGY_PER_L = 0.35;      // € Gas/Strom/Wasser/Abwasser je Liter Ausschlag
export const PACKAGING_PER_L = 0.15;   // € je Liter: wiederverwendete Bügelflaschen, Kronkorken, Etiketten
export const LICENSE_COST = 300;       // Gewerbe, Steuerlager-Erlaubnis, Lebensmittel-Registrierung, Etiketten-Check
export const INSURANCE_MONTH = 15;     // Betriebshaftpflicht, sobald ein Gewerbe läuft (€ pro 30 Tage)
export const MALT_BULK_KG = 25;        // ab einem Sack Malz gibt es Rabatt
export const MALT_BULK_FACTOR = 0.75;

/** Mengenstaffel (§ 2 BierStG): Anteil des Regelsatzes nach Jahresausstoß in hl. */
export function taxFactor(hlYear) {
  if (hlYear > 200000) return 1;
  const pts = [[5000, 0.5], [10000, 0.6], [20000, 0.7], [40000, 0.75]];
  if (hlYear <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [h0, f0] = pts[i - 1], [h1, f1] = pts[i];
    if (hlYear <= h1) return f0 + (f1 - f0) * Math.floor((hlYear - h0) / 1000) * 1000 / (h1 - h0);
  }
  return 0.75;
}
export const beerTax = (liters, plato, hlYear = 0) => liters / 100 * plato * TAX_PER_HL_PLATO * taxFactor(hlYear);

/** Nachfrage-Saison: Sommer stark, Oktoberfest- und Bockbierzeit mit Extra-Schub. */
export function season(day) {
  const d = ((day - 1) % YEAR_DAYS) + 1;
  let f = 1 + 0.25 * Math.sin(2 * Math.PI * (d - 110) / YEAR_DAYS);
  if (d >= 258 && d <= 288) f += 0.2;   // Mitte Sept. – Mitte Okt.
  if (d >= 335) f += 0.1;               // Dezember
  return f;
}

// Absatzwege. ref = Referenzpreis €/L ab Brauerei, base = Liter pro Woche bei Ruf 50 und normaler Saison.
export const CHANNELS = {
  hof:      { name: 'Hofverkauf & Wochenmarkt', icon: '🧺', ref: 6.0, base: 25, minRep: 0,  legal: true,
              text: 'Direkt an Nachbarn und auf dem Markt. Guter Preis, aber wenig Menge.' },
  gastro:   { name: 'Gastronomie (Fass)',       icon: '🍻', ref: 4.5, base: 60, minRep: 15, legal: true,
              text: 'Kneipen kaufen mehr, zahlen aber weniger pro Liter.' },
  festival: { name: 'Festival-Stand',           icon: '🎪', ref: 9.0, base: 80, minRep: 25, legal: true, fee: 120, summer: true,
              text: 'Mai bis September. Top-Preis, aber 120 € Standgebühr pro Woche, in der du dort verkaufst.' },
  schwarz:  { name: 'Unter der Hand',           icon: '🕶️', ref: 4.0, base: 30, minRep: 0,  legal: false,
              text: 'Bar auf die Hand, ohne Steuer – mit oder ohne Gewerbe. Das ist Steuerhinterziehung: Mit Gewerbe prüft der Zoll deine Bücher, das Risiko und die Strafen sind höher.' },
};

// Spenden bringen Ansehen (und etwas Ruf). mult = wie stark die Spende wahrgenommen wird.
export const DONATION_TARGETS = {
  kirche:    { name: 'Kirchengemeinde St. Martin', icon: '🔔', mult: 1.2, text: 'Für die neue Orgel und den Seniorenkreis.' },
  tafel:     { name: 'Tafel e. V.',               icon: '🥫', mult: 1.0, text: 'Lebensmittel für Menschen mit wenig Geld.' },
  kinder:    { name: 'Kindergarten Pusteblume',    icon: '🧸', mult: 1.0, text: 'Neue Spielgeräte für den Garten.' },
  feuerwehr: { name: 'Freiwillige Feuerwehr',      icon: '🚒', mult: 1.1, beer: true, text: 'Geld – oder Freibier fürs Feuerwehrfest.' },
  abtei:     { name: 'Abtei St. Gambrin (Dach)',   icon: '⛪', mult: 1.6, needs: 'abtei', text: 'Das Dach der alten Abtei, gegründet 1253, ist undicht.' },
};
// „Bunte“ Experimente: zählen nicht als stabile, klassische Bierkultur
export const BUNT_STYLES = ['neipa', 'berliner', 'ipa'];

export const EQUIPMENT = {
  kettle: {
    topf:      { name: 'Einkochtopf 30 L',      maxBatchL: 20,  cost: 0 },
    kessel50:  { name: 'Edelstahlkessel 50 L',  maxBatchL: 40,  cost: 450 },
    kessel100: { name: 'Sudkessel 100 L',       maxBatchL: 80,  cost: 1800 },
    anlage2hl: { name: 'Brauanlage 2 hl',       maxBatchL: 200, cost: 6500 },
  },
  fermenter: {
    eimer:     { name: 'Gäreimer (Plastik)',    slots: 1, hygiene: 0,    cost: 0 },
    edelstahl: { name: 'Edelstahl-Gärtank',     slots: 2, hygiene: 0.15, cost: 260 },
    konisch:   { name: 'Konischer Gärtank',     slots: 4, hygiene: 0.3,  cost: 1100 },
    tankraum:  { name: 'Gärtankraum (6 Tanks)', slots: 6, hygiene: 0.35, cost: 9000 },
  },
  cooling: {
    keine:        { name: 'Keine Kühlung (Garage)',           control: 0, cost: 0 },
    kuehlschrank: { name: 'Gärkühlschrank + Thermostat',      control: 1, cost: 280 },
    profi:        { name: 'Glykol-Kühlung',                   control: 2, cost: 1200 },
  },
};
export const TIER_ORDER = {
  kettle: ['topf', 'kessel50', 'kessel100', 'anlage2hl'],
  fermenter: ['eimer', 'edelstahl', 'konisch', 'tankraum'],
  cooling: ['keine', 'kuehlschrank', 'profi'],
};

export const MALT_PRICE = { pilsner: 1.9, pale: 2.0, wiener: 2.2, muenchner: 2.3, weizen: 2.2, rauch: 3.2,
  carapils: 3.0, carahell: 3.0, caramuench: 3.2, carafa: 4.2, roest: 3.8,
  melanoidin: 3.4, weizendunkel: 2.5, roggen: 2.6, hafer: 2.4, sauermalz: 3.5, kandis: 4.5 };      // € / kg
export const HOP_PRICE_PELLET = { hallertauer: 0.035, tettnanger: 0.04, saphir: 0.04, tradition: 0.03, perle: 0.028,
  magnum: 0.026, cascade: 0.045, citra: 0.08, mosaic: 0.085,
  saaz: 0.05, hersbruck: 0.036, northern: 0.03, fuggles: 0.04, goldings: 0.055 };                   // € / g
export const HOP_EXTRACT_PRICE = 0.06;                                           // € / g (30 % α)
export const YEAST_PRICE = { lager: 4.5, weizen: 3.8, ale: 3.8, koelsch: 4.2, stout: 3.8,
  belgisch: 4.8, saison: 5.0, sauer: 6.5 }; // € / Päckchen
export const SANITIZER_PRICE = 6;

// Wie viel Hopfenaroma (g/L aus Gaben ≤ 15 min, gewichtet) ein Stil erwartet
export const STYLE_AROMA = { pils: 0.15, helles: 0.1, maerzen: 0.08, weizen: 0.02, pale: 0.5, ipa: 1.0, stout: 0.08, doppelbock: 0.06,
  koelsch: 0.1, dunkel: 0.08, schwarzbier: 0.08, bock: 0.06, alt: 0.12, rauch: 0.08, porter: 0.1, imperial: 0.15, dubbel: 0.08,
  tripel: 0.15, saison: 0.2, witbier: 0.03, dunkelweizen: 0.02, neipa: 1.5, berliner: 0.02 };

export const FERMENT_DAYS = { lager: 28, weizen: 12, ale: 14, koelsch: 18, stout: 16, belgisch: 21, saison: 16, sauer: 28 };

export const MONTHS = [['Jan', 31], ['Feb', 28], ['Mär', 31], ['Apr', 30], ['Mai', 31], ['Jun', 30],
  ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Okt', 31], ['Nov', 30], ['Dez', 31]];

export function dayLabel(day) {
  let d = ((day - 1) % YEAR_DAYS), year = Math.floor((day - 1) / YEAR_DAYS) + 1;
  for (const [name, len] of MONTHS) { if (d < len) return `${d + 1}. ${name}, Jahr ${year}`; d -= len; }
  return `Tag ${day}`;
}

/** Umgebungstemperatur (Garage/Keller ohne Kühlung): Winter kalt, Sommer warm. */
export function ambientTemp(day, cellar = false) {
  const base = cellar ? 12 : 11, amp = cellar ? 5 : 12;
  return base + amp * Math.sin(2 * Math.PI * (day - 110) / YEAR_DAYS);
}
