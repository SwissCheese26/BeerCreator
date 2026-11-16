// Konzern-Bot: expandiert per Zukauf, Kredit, Zentrale-Ausbau und Marketing (zum Testen von Machbarkeit und Balance).
import * as g from '../src/game/index.js';
const E = g.empire;

export function playEmpire({ seed = 1, years = 30, leverage = 4.5, difficulty = 'normal', verbose = false } = {}) {
  const s = g.newGame({ mode: 'konzern', seed, difficulty, years });
  const marks = {};
  while (!s.gameOver) {
    const e = s.empire, r = E.empireReport(s);
    // Marketing
    for (const c of r.countries) if (c.brewer && c.marketing < 2 && s.cash > 2e6) E.setMarketing(s, c.id, 2);
    // Zentrale
    const full = e.breweries.length >= r.hq.maxBreweries || Object.keys(e.offices).length >= r.hq.maxCountries;
    if (full && r.nextHq && s.cash >= r.nextHq.cost * 1.1) E.upgradeHq(s);
    // Kandidaten: bestes Preis-Leistungs-Ziel in allen Ländern (inkl. Büro-Kosten)
    const capacity = () => s.cash + Math.max(0, E.groupFigures(s).maxDebt * (leverage / 6) - e.debt) - 1.5e6;
    const pool = [];
    for (const c of E.COUNTRIES) {
      const hasOffice = !!e.offices[c.id];
      if (!hasOffice && Object.keys(e.offices).length >= r.hq.maxCountries) continue;
      for (const t of E.listTargets(s, c.id)) if (!t.sold && !t.antitrust && t.ebitda > 0) pool.push({ ...t, extra: hasOffice ? 0 : c.entry, risk: c.risk });
    }
    pool.sort((a, b) => (b.ebitda * (1 - b.risk)) / (b.price + b.extra) - (a.ebitda * (1 - a.risk)) / (a.price + a.extra));
    let bought = false;
    if (e.breweries.length < r.hq.maxBreweries) {
      for (const t of pool) {
        if (t.price + t.extra > capacity()) continue;
        const need = t.price + t.extra - s.cash; if (need > 0) E.takeLoan(s, Math.ceil(need));
        if (t.extra) E.enterCountry(s, t.country);
        E.acquireBrewery(s, t.id); bought = true; break;
      }
    }
    // Technik/Qualität
    if (!bought && s.cash > 25e6) for (const b of e.breweries) if (b.status === 'betrieb') { try { if (b.tech < 4) E.upgradeBrewery(s, b.id, 'technik'); else if (b.quality < 80) E.upgradeBrewery(s, b.id, 'qualitaet'); } catch (x) { if (!(x instanceof g.GameError)) throw x; } break; }
    // Organisches Wachstum: Kapazität ausbauen, wenn die Nachfrage da ist
    if (!bought) for (const x of r.breweries) {
      const b = e.breweries.find(y => y.id === x.id);
      if (b.status === 'betrieb' && x.volKhlYear >= b.capKhl * 0.93 && E.figures(s, b).demandKhl > b.capKhl * 1.1) {
        const cost = Math.round(Math.max(10, Math.round(b.capKhl * 0.25 / 5) * 5) * 1000 * 85 * E.countryOf(b.country).cost);
        if (s.cash > cost * 1.5 + 1e6) { E.upgradeBrewery(s, b.id, 'kapazitaet'); break; }
      }
    }
    // Tilgen
    const gf = E.groupFigures(s); if (gf.leverage > leverage + 0.5 && e.debt > 0 && s.cash > 2e6) E.repayLoan(s, Math.min(e.debt, s.cash - 1.5e6));
    g.advanceDays(s, 30);
    if (e.month % 60 === 0) marks[e.month / 12] = { rank: E.rankOf(s), mhl: E.empireReport(s).volMhl, breweries: e.breweries.length, countries: Object.keys(e.offices).length };
  }
  if (verbose) console.log(marks);
  return { s, marks };
}
