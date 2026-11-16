// Dynamischer Markt (Karriere): Saison, Trends, Preisdrift, Hopfenernte, Wetter und Marktereignisse.
import { STYLES } from '../../core/data.js';
import { STYLE_SEASON, YEAR_DAYS, START_DAY } from '../config.js';
import { rand, log, clamp } from '../state.js';

const EVENT_DEFS = [
  { id: 'hitzewelle',  label: 'Hitzewelle: Die Gärkeller schwitzen (+6 °C), die Leute dürsten.', days: 20, weather: 6, demand: 1.15 },
  { id: 'kaelte',      label: 'Kältewelle: Die Garage friert (−6 °C), Winterbiere sind gefragt.', days: 20, weather: -6, demand: 0.95 },
  { id: 'craftboom',   label: 'Craft-Beer-Boom in der Region: Die Nachfrage steigt.', days: 60, demand: 1.25 },
  { id: 'supermarkt',  label: 'Supermarkt-Aktion drückt die Nachfrage nach Bier.', days: 45, demand: 0.8 },
  { id: 'engpass',     label: 'Lieferengpass bei Hopfen: Die Preise ziehen an.', days: 30, hop: 1.3 },
  { id: 'rabatt',      label: 'Großhandelsrabatt auf Hopfen – die Preise sinken kurz.', days: 20, hop: 0.8 },
];

export function initMarket(s) {
  s.market = { drift: Object.fromEntries(STYLES.map(x => [x.id, 1])), hopYear: 1, maltMul: 1, trend: null, mods: [], lastMonth: -1, year: 1 };
  s.weather = 0;
}

const seasonT = day => Math.sin(2 * Math.PI * (day - 110) / YEAR_DAYS); // +1 Hochsommer, −1 Winter
export const seasonFactor = (day, styleId) => 1 + seasonT(day) * (STYLE_SEASON[styleId] || 0);

const activeMods = s => s.market.mods.filter(m => m.until >= s.day);
export const hopMul = s => s.market ? s.market.hopYear * activeMods(s).reduce((a, m) => a * (m.hop || 1), 1) : 1;
export const maltMul = s => s.market ? s.market.maltMul : 1;
export const demandMul = s => s.market ? activeMods(s).reduce((a, m) => a * (m.demand || 1), 1) : 1;

/** Preisfaktor für einen Bierstil: Saison × Drift × Trend. 1 ohne Markt. */
export function marketMultiplier(s, styleId) {
  if (!s.market) return 1;
  const trend = s.market.trend && s.market.trend.until >= s.day && s.market.trend.styleId === styleId ? 1.4 : 1;
  return clamp(seasonFactor(s.day, styleId) * (s.market.drift[styleId] ?? 1) * trend, 0.5, 1.9);
}

/** Täglich aufrufen: aktualisiert Wetter und – einmal pro Monat – Drift, Trends und Ereignisse. */
export function marketTick(s) {
  if (!s.market) return;
  s.weather = activeMods(s).reduce((a, m) => a + (m.weather || 0), 0);
  const month = Math.floor((s.day - START_DAY) / 30);
  if (month === s.market.lastMonth) return;
  s.market.lastMonth = month;
  for (const id of Object.keys(s.market.drift)) { // Zufallsbewegung mit Rückkehr zum Mittelwert
    s.market.drift[id] = clamp(s.market.drift[id] + (rand(s) - 0.5) * 0.12 + (1 - s.market.drift[id]) * 0.1, 0.75, 1.3);
  }
  if ((!s.market.trend || s.market.trend.until < s.day) && rand(s) < 0.3) {
    const st = STYLES[Math.floor(rand(s) * STYLES.length)];
    s.market.trend = { styleId: st.id, until: s.day + 60 };
    log(s, `Trend: ${st.name} ist gerade in Mode (+40 % Preis für 60 Tage).`, 'story');
  }
  if (rand(s) < 0.3) {
    const ev = EVENT_DEFS[Math.floor(rand(s) * EVENT_DEFS.length)];
    s.market.mods.push({ id: ev.id, until: s.day + ev.days, ...(ev.weather && { weather: ev.weather }), ...(ev.demand && { demand: ev.demand }), ...(ev.hop && { hop: ev.hop }) });
    log(s, ev.label, ev.demand && ev.demand < 1 || ev.hop > 1 ? 'bad' : 'story');
  }
  s.market.mods = s.market.mods.filter(m => m.until >= s.day);
  const doy = (s.day - 1) % YEAR_DAYS; // Ernte im September: Hopfenpreis für das nächste Jahr
  if (doy >= 250 && doy < 280 && s.market.lastHarvest !== Math.floor((s.day - 1) / YEAR_DAYS)) {
    s.market.lastHarvest = Math.floor((s.day - 1) / YEAR_DAYS);
    s.market.hopYear = Math.round((0.8 + rand(s) * 0.8) * 100) / 100;
    log(s, s.market.hopYear > 1.2 ? 'Schlechte Hopfenernte: Der Hopfen wird teuer.' : s.market.hopYear < 0.9 ? 'Rekordernte: Hopfen ist günstig!' : 'Normale Hopfenernte.', s.market.hopYear > 1.2 ? 'bad' : 'story');
  }
}

/** Marktbericht für die Anzeige. */
export function marketReport(s) {
  if (!s.market) return null;
  return {
    styles: STYLES.map(x => ({ id: x.id, name: x.name, mult: Math.round(marketMultiplier(s, x.id) * 100) / 100 })).sort((a, b) => b.mult - a.mult),
    hop: Math.round(hopMul(s) * 100) / 100, malt: Math.round(maltMul(s) * 100) / 100, demand: Math.round(demandMul(s) * 100) / 100,
    trend: s.market.trend && s.market.trend.until >= s.day ? s.market.trend : null,
    events: activeMods(s).map(m => m.id),
  };
}
