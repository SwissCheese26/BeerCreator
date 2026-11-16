import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { playEmpire } from './empirebot.js';
const E = g.empire;
const start = (seed = 1) => g.newGame({ mode: 'konzern', seed });

test('Welt: 26 Länder, 104 Zielbrauereien, eindeutige IDs, gültige Stile', async () => {
  const { STYLES } = await import('../src/core/data.js');
  assert.equal(E.COUNTRIES.length, 26); assert.equal(E.TARGETS.length, 104);
  assert.equal(new Set(E.TARGETS.map(t => t.id)).size, 104);
  const ids = new Set(STYLES.map(x => x.id));
  for (const c of E.COUNTRIES) { assert.ok(c.price > 0 && c.marketKhl > 0 && c.note.length > 40); Object.keys(c.styles).forEach(x => assert.ok(ids.has(x), c.id + x)); }
  for (const t of E.TARGETS) assert.ok(ids.has(t.style) && t.capKhl >= 8 && t.quality >= 40, t.id);
});

test('Start: Regionalbrauerei, 5 Mio. €, Platz 11, positives EBITDA', () => {
  const s = start(); const r = E.empireReport(s);
  assert.equal(s.mode, 'konzern'); assert.equal(s.cash, 5000000);
  assert.equal(r.rank, 11); assert.ok(r.ebitdaYear > 1e6 && r.ebitdaYear < 8e6, r.ebitdaYear);
  assert.equal(r.breweries.length, 1);
});

test('Büro, Zentrale-Limit, Kosten', () => {
  const s = start(); s.cash = 20e6;
  E.enterCountry(s, 'CZ'); assert.equal(s.cash, 20e6 - 300000);
  assert.throws(() => E.enterCountry(s, 'CZ'), /schon/);
  assert.throws(() => E.enterCountry(s, 'AT'), /höchstens 2 Länder/);
  E.upgradeHq(s); E.enterCountry(s, 'AT'); assert.equal(s.empire.hqLevel, 2);
});

test('Übernahme: Büro nötig, Preis wird bezahlt, Integration und Synergien', () => {
  const s = start(); s.cash = 30e6;
  assert.throws(() => E.acquireBrewery(s, 'CZ-1'), /Büro/);
  E.enterCountry(s, 'CZ');
  const price = E.listTargets(s, 'CZ')[0].price, cash = s.cash;
  E.acquireBrewery(s, 'CZ-1');
  assert.equal(s.cash, cash - price);
  assert.throws(() => E.acquireBrewery(s, 'CZ-1'), /schon dir/);
  const b = s.empire.breweries.find(x => x.targetId === 'CZ-1');
  assert.equal(b.integration, 6);
  const during = E.figures(s, b).varCost / E.figures(s, b).volKhl;
  b.integration = 0;
  assert.ok(E.figures(s, b).varCost / E.figures(s, b).volKhl < during);
});

test('Kartellamt untersagt Übernahmen über 35 % Marktanteil', () => {
  const s = start(); s.cash = 5e9; s.empire.hqLevel = 4; E.enterCountry(s, 'AT');
  s.empire.breweries.push({ id: 99, country: 'AT', name: 'Testbrauerei', capKhl: 8000, tech: 5, quality: 95, brand: 90, style: 'helles', status: 'betrieb', readyMonth: 0, integration: 0 });
  const champ = E.listTargets(s, 'AT').find(t => t.tier === 'Marktführer');
  assert.ok(champ.antitrust && champ.shareAfter > 0.35);
  assert.throws(() => E.acquireBrewery(s, champ.id), /Kartellamt/);
});

test('Marktführer: riesig und teuer, ohne Konkurrenz im Land übernehmbar', () => {
  const s = start(); const champs = E.TARGETS.filter(t => t.tier === 'Marktführer');
  assert.equal(champs.length, 26);
  const de = E.listTargets(s, 'DE').find(t => t.tier === 'Marktführer');
  assert.ok(de.volKhl > 8000 && de.price > 1e9, `${de.volKhl} khl, ${de.price}`);
  assert.equal(de.antitrust, false);
});

test('Neubau braucht Monate, produziert danach, kostet nach Land', () => {
  const s = start(); s.cash = 40e6; E.enterCountry(s, 'PL');
  const cash = s.cash; E.buildBrewery(s, 'PL', 100, 'pils');
  const spent = cash - s.cash; assert.equal(spent, Math.round(100 * 1000 * 95 * 0.65));
  const b = s.empire.breweries.at(-1); assert.equal(b.status, 'bau'); assert.equal(E.figures(s, b).volKhl, 0);
  g.advanceDays(s, 30 * 8);
  assert.equal(b.status, 'betrieb'); assert.ok(E.figures(s, b).volKhl > 0);
});

test('Wirkung: Qualität, Werbung und Technik verbessern das Ergebnis', () => {
  const s = start(); const b = s.empire.breweries[0], base = E.figures(s, b);
  const q = { ...b, quality: b.quality + 15 }; assert.ok(E.figures(s, q).ebitda > base.ebitda);
  const t = { ...b, tech: 5 }; assert.ok(E.figures(s, t).varCost < base.varCost);
  assert.ok(E.figures(s, b, { marketing: 3 }).demandKhl > E.figures(s, b, { marketing: 0 }).demandKhl);
  const wrong = { ...b, style: 'imperial' }; assert.ok(E.figures(s, wrong).demandKhl < base.demandKhl); // falscher Stil fürs Land
});

test('Kredit: Grenze, Zinsen, Rating, Tilgung', () => {
  const s = start();
  const max = E.groupFigures(s).maxDebt;
  assert.throws(() => E.takeLoan(s, max + 1e6), /höchstens/);
  const cash = s.cash; E.takeLoan(s, 10e6);
  assert.equal(s.cash, cash + 10e6); assert.equal(s.empire.debt, 10e6);
  E.repayLoan(s, 4e6); assert.equal(s.empire.debt, 6e6);
  s.empire.debt = max; s.cash = 0; s.empire.last.ebitda = 1e5;
  assert.ok(['BB', 'B'].includes(E.groupFigures(s).rating));
});

test('Monatslauf: Zeit, Cashflow, Historie, Marktwachstum und Ereignisse; JSON-stabil', () => {
  const s = start(3); const c0 = s.cash;
  g.advanceDays(s, 30 * 24);
  assert.equal(s.empire.month, 24); assert.equal(s.empire.history.length, 24);
  assert.ok(s.cash > c0);
  assert.ok(s.log.some(l => /^📰/.test(l.text)), 'In zwei Jahren passiert ein Ereignis');
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
  const t = start(3); g.advanceDays(t, 30 * 24); assert.equal(t.cash, s.cash); // deterministisch
});

test('Insolvenz und Spielende blockieren die Zeit', () => {
  const s = start(); s.cash = -5e6; s.empire.breweries[0].status = 'ausfall'; s.empire.breweries[0].readyMonth = 99;
  g.advanceDays(s, 30 * 4);
  assert.equal(s.gameOver.reason, 'insolvenz');
  assert.throws(() => g.advanceDays(s, 1), /beendet/);
});

test('Ein guter Konzern-Spieler (Bot) steigt auf: Top 6 nach 30 Jahren, Rating bleibt tragbar', () => {
  for (const seed of [1, 2, 3]) {
    const { s } = playEmpire({ seed });
    assert.equal(s.gameOver.reason, 'zeit', `Seed ${seed}: ${s.gameOver.reason}`);
    assert.ok(s.gameOver.place <= 6, `Seed ${seed}: Platz ${s.gameOver.place}`);
    assert.ok(s.gameOver.place >= 2, 'Platz 1 soll schwer bleiben');
    assert.ok(Object.keys(s.empire.offices).length >= 8);
  }
});

test('Nichtstun bringt keinen Aufstieg', () => {
  const s = start(); while (!s.gameOver) g.advanceDays(s, 30);
  assert.ok(s.gameOver.place >= 9);
  assert.ok(s.gameOver.score < 2000);
});

test('Info-Texte: jedes Land und jeder Konzern-Begriff hat einen Text', () => {
  for (const c of E.COUNTRIES) assert.ok(g.getInfo('land', c.id)?.text.length > 60, c.id);
  for (const k of ['ebitda', 'verschuldung', 'rating', 'kartell', 'integration', 'zentrale', 'neubau', 'uebernahme', 'werbung', 'marke', 'rangliste', 'bewertung']) assert.ok(g.getInfo('konzern', k), k);
});

test('Andere Modi bleiben unberührt: kein Konzern-State im Story-Spiel', () => {
  assert.equal(g.newGame({ mode: 'story' }).empire, undefined);
  assert.equal(g.newGame({ mode: 'karriere' }).empire, undefined);
});

test('Story-Ende → Konzern: jedes Ende erzeugt einen spielbaren Start, der Weg prägt ihn', async () => {
  const { playCampaign } = await import('./bot.js').catch(() => ({}));
  const endings = ['handwerk', 'industrie', 'genossenschaft', 'uebernahme'];
  const starts = {};
  for (const e of endings) {
    const story = g.newGame({ mode: 'story', seed: 9 });
    story.ended = true; story.ending = e; story.cash = 3200; story.reputation = 60; story.stats.bestQuality = 90; story.stats.medals = [{ medal: 'Gold' }];
    story.beers.push({ id: 1, styleId: 'helles', quality: 90, liters: 10 });
    const k = g.empireFromStory(story);
    starts[e] = k;
    assert.equal(k.mode, 'konzern'); assert.equal(k.legacy.ending, e); assert.equal(k.stats.medals.length, 1);
    assert.ok(k.empire.name.includes(story.breweryName));
    g.advanceDays(k, 30 * 24);
    assert.ok(Number.isFinite(k.cash) && k.empire.history.length === 24, e);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(k))), JSON.stringify(k));
  }
  assert.ok(starts.industrie.empire.hqLevel > starts.handwerk.empire.hqLevel);
  assert.ok(starts.uebernahme.cash > starts.genossenschaft.cash);
  assert.ok(starts.handwerk.empire.breweries[0].quality > starts.industrie.empire.breweries[0].quality);
});

test('Kosten-Helfer stimmen mit den echten Abbuchungen überein', () => {
  const s = start(); s.cash = 100e6; const b = s.empire.breweries[0];
  for (const what of ['kapazitaet', 'technik', 'qualitaet']) {
    const c0 = s.cash, { cost } = E.upgradeCost(b, what);
    E.upgradeBrewery(s, b.id, what); assert.equal(c0 - s.cash, cost, what);
  }
  E.enterCountry(s, 'PL'); const c1 = s.cash; E.buildBrewery(s, 'PL', 120, 'pils'); assert.equal(c1 - s.cash, E.buildCost('PL', 120));
});
