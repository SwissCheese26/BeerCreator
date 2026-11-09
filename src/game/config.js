// Spiel-Konstanten. Alle Preise in €. Steuer- und Rechtsregeln sind für das Spiel vereinfacht.

export const START_DAY = 60;           // 1. März
export const YEAR_DAYS = 365;
export const HOBBY_LIMIT_L = 200;      // steuerfreie Hobbymenge pro Jahr (ohne Verkauf)
export const TAX_PER_HL_PLATO = 0.787; // Biersteuer € je hl und °P
export const TAX_SMALL_FACTOR = 0.5;   // vereinfachte Mengenstaffel für Kleinbrauereien
export const YEAST_PACK_CELLS = 160;   // Mrd. Zellen je Trockenhefe-Päckchen (11,5 g)
export const BOTTLING_LOSS = 0.92;     // Anteil des Gärvolumens, der als Fertigbier übrig bleibt
export const CELLAR_RENT = 40;         // € pro 30 Tage

export const EQUIPMENT = {
  kettle: {
    topf:      { name: 'Einkochtopf 30 L',      maxBatchL: 20, cost: 0 },
    kessel50:  { name: 'Edelstahlkessel 50 L',  maxBatchL: 40, cost: 450 },
    kessel100: { name: 'Sudkessel 100 L',       maxBatchL: 80, cost: 1800 },
  },
  fermenter: {
    eimer:     { name: 'Gäreimer (Plastik)',    slots: 1, hygiene: 0,    cost: 0 },
    edelstahl: { name: 'Edelstahl-Gärtank',     slots: 2, hygiene: 0.15, cost: 260 },
    konisch:   { name: 'Konischer Gärtank',     slots: 4, hygiene: 0.3,  cost: 1100 },
  },
  cooling: {
    keine:        { name: 'Keine Kühlung (Garage)',           control: 0, cost: 0 },
    kuehlschrank: { name: 'Gärkühlschrank + Thermostat',      control: 1, cost: 280 },
    profi:        { name: 'Glykol-Kühlung',                   control: 2, cost: 1200 },
  },
};
export const TIER_ORDER = {
  kettle: ['topf', 'kessel50', 'kessel100'],
  fermenter: ['eimer', 'edelstahl', 'konisch'],
  cooling: ['keine', 'kuehlschrank', 'profi'],
};

export const MALT_PRICE = { pilsner: 1.9, pale: 2.0, wiener: 2.2, muenchner: 2.3, weizen: 2.2, rauch: 3.2,
  carapils: 3.0, carahell: 3.0, caramuench: 3.2, carafa: 4.2, roest: 3.8 };      // € / kg
export const HOP_PRICE_PELLET = { hallertauer: 0.035, tettnanger: 0.04, saphir: 0.04, tradition: 0.03, perle: 0.028,
  magnum: 0.026, cascade: 0.045, citra: 0.08, mosaic: 0.085 };                   // € / g
export const HOP_EXTRACT_PRICE = 0.06;                                           // € / g (30 % α)
export const YEAST_PRICE = { lager: 4.5, weizen: 3.8, ale: 3.8, koelsch: 4.2, stout: 3.8 }; // € / Päckchen
export const SANITIZER_PRICE = 6;

// Wie viel Hopfenaroma (g/L aus Gaben ≤ 15 min, gewichtet) ein Stil erwartet
export const STYLE_AROMA = { pils: 0.15, helles: 0.1, maerzen: 0.08, weizen: 0.02, pale: 0.5, ipa: 1.0, stout: 0.08, doppelbock: 0.06 };

export const FERMENT_DAYS = { lager: 28, weizen: 12, ale: 14, koelsch: 18, stout: 16 };

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
