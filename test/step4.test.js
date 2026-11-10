import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

function game({ location = 'kesselbach', beers = [], cash = 50000, xp = 99999 } = {}) {
  const s = g.newGame({ skipTutorial: true, seed: 5, location });
  s.event = null; s.ended = true; s.license = true; s.reputation = 50; s.cash = cash; s.day = 200; s.skill.xp = xp;
  g.unlock(s, 'verkauf', 'marke', 'technik', 'industrie', 'webseite');
  for (const b of beers) s.beers.push({ flaws: [], notes: [], plato: 12, abv: 5, ibu: 25, ebc: 10, finishedDay: s.day, ...b, id: s.nextId++ });
  return s;
}
const beer = (styleId, quality = 75) => ({ name: styleId, styleId, liters: 100, quality });

test('Standort: Stadt, Dorf, Berge und Unistadt verändern Nachfrage, Preise und Malzkosten', () => {
  const dorf = game(), stadt = game({ location: 'nordhafen' }), uni = game({ location: 'lindenberg' }), berg = game({ location: 'gipfelbrunn' });
  assert.ok(g.channelDemand(stadt, 'gastro') > g.channelDemand(dorf, 'gastro'));
  assert.ok(g.channelDemand(stadt, 'hof') < g.channelDemand(dorf, 'hof'));
  assert.ok(g.channelDemand(berg, 'festival') > g.channelDemand(dorf, 'festival'));
  const b = beer('pale');
  assert.ok(g.priceFor(uni, b, 'gastro') < g.priceFor(stadt, b, 'gastro'), 'Studis zahlen weniger, die Stadt liebt Pale Ale');
  const c0 = dorf.cash, c1 = stadt.cash;
  g.buyMalt(dorf, 'pilsner', 10); g.buyMalt(stadt, 'pilsner', 10);
  assert.ok(c0 - dorf.cash < c1 - stadt.cash, 'Malz im Dorf günstiger');
  assert.equal(g.newGame({ location: 'gibtsnicht' }).location, 'kesselbach');
});

test('Technik: Level und Geld nötig; Filter macht Pils besser und Weizen schlechter; Wärmerückgewinnung spart Energie', () => {
  const low = game({ xp: 0 });
  assert.throws(() => g.buyTech(low, 'abfueller'), /Level/);
  const s = game();
  const pils = newRecipeFromStyle('pils'); pils.filter = true;
  assert.throws(() => { g.buyForRecipe(s, pils); g.startBatch(s, pils); }, /Plattenfilter/);
  assert.throws(() => g.buyTech(s, 'zentrifuge'), /zuerst/);
  g.buyTech(s, 'filter');
  const plain = newRecipeFromStyle('pils');
  assert.ok(g.forecast(s, pils).high > g.forecast(s, plain).high, 'filtriertes Pils');
  const weizen = newRecipeFromStyle('weizen'), wf = { ...newRecipeFromStyle('weizen'), filter: true };
  assert.ok(g.forecast(s, wf).high < g.forecast(s, weizen).high, 'filtriertes Weizen ist falsch');
  const before = g.runCostFor(s, 100);
  g.buyTech(s, 'waerme');
  assert.ok(g.runCostFor(s, 100) < before);
  g.buyForRecipe(s, pils);
  const b = g.startBatch(s, pils);
  assert.ok(b.filtered && b.liters < plain.batchL * 0.92, 'Filter kostet Volumen');
});

test('Präsentation: Exklusivbier in der Massenflasche wirkt billig, im Kelch und mit Korken edel', () => {
  const s = game({ beers: [beer('tripel', 88), beer('helles', 62)] });
  const [tripel, helles] = s.beers;
  const cheap = g.priceFor(s, tripel, 'hof');
  g.setPackaging(s, tripel.id, { bottle: 'champagner', glass: 'kelch' });
  assert.ok(g.priceFor(s, tripel, 'hof') > cheap * 1.3, `${cheap} → ${g.priceFor(s, tripel, 'hof')}`);
  assert.ok(g.netPriceFor(s, tripel, 'hof') < g.priceFor(s, tripel, 'hof'), 'Korkenflasche kostet');
  g.setPackaging(s, tripel.id, { glass: 'willi' });
  const willi = g.priceFor(s, tripel, 'gastro');
  g.setPackaging(s, tripel.id, { glass: 'kelch' });
  assert.ok(g.priceFor(s, tripel, 'gastro') > willi);
  // Luxusflasche für Durchschnittsbier: Abzug
  const h0 = g.priceFor(s, helles, 'hof');
  g.setPackaging(s, helles.id, { bottle: 'champagner' });
  assert.ok(g.priceFor(s, helles, 'hof') < h0);
  assert.throws(() => g.setPackaging(s, helles.id, { bottle: 'dose' }), /Dosenlinie/);
  assert.throws(() => g.setPackaging(s, helles.id, { bottle: 'designer' }), /Flaschenform/);
  // Kritiker achten auf die Aufmachung
  assert.ok(g.presentationReview(s, tripel) > g.presentationReview(s, { ...tripel, bottle: 'euro', glass: 'willi' }));
});

test('Marke: Icon-Creator, dann Logo-Gläser und Grafikbüro', () => {
  const s = game({ beers: [beer('helles', 75)] });
  assert.throws(() => g.placeOrder(s, 'logoglas'), /Logo/);
  const p0 = g.priceFor(s, s.beers[0], 'hof');
  g.setBrand(s, { symbol: '🦉', color: '#1f4e79', shape: 'schild', text: 'hhb' });
  assert.equal(s.brand.text, 'HHB');
  g.placeOrder(s, 'grafik');
  assert.ok(g.priceFor(s, s.beers[0], 'hof') > p0);
  const gas = g.priceFor(s, s.beers[0], 'gastro');
  g.placeOrder(s, 'logoglas');
  assert.ok(g.priceFor(s, s.beers[0], 'gastro') > gas);
  assert.throws(() => g.placeOrder(s, 'logoglas'), /Schon/);
  assert.throws(() => g.setBrand(s, { symbol: 'X', color: '#000', shape: 'kreis' }), /Symbol/);
});

test('Lohnbrauen: große Menge, etwas weniger Qualität, Lieferung nach drei Wochen', () => {
  const s = game();
  const r = newRecipeFromStyle('helles'); r.name = 'Hausbier';
  g.saveRecipe(s, r);
  assert.throws(() => g.contractBrew(s, 'Hausbier', 100), /500/);
  const cash = s.cash;
  g.contractBrew(s, 'Hausbier', 2000);
  assert.equal(s.cash, cash - 2000 * g.CONTRACT.costPerL);
  assert.throws(() => g.contractBrew(s, 'Hausbier', 1000), /schon/);
  g.advanceDays(s, g.CONTRACT.days);
  const b = s.beers.find(x => x.industrial);
  assert.ok(b && b.liters === 2000);
  assert.ok(b.quality <= g.recipePotential(r).total - g.CONTRACT.loss + 2);
});

test('Brauereien kaufen: Wochengewinn, zählt in der Bierliga, Rückverkauf mit Abschlag', () => {
  const s = game();
  s.mode = 'story';
  const target = g.forSale(s).find(x => x.name === 'Schluckspecht-Bräu');
  const rank0 = g.ranking(s);
  g.buyBrewery(s, target.name);
  assert.ok(!g.ranking(s).list.some(x => x.name === target.name));
  assert.ok(g.playerPoints(s) >= target.pts);
  const cash = s.cash;
  g.advanceDays(s, 14);
  assert.ok(s.stats.breweryIncome > 0 && s.cash > cash - 1);
  assert.ok(g.ranking(s).list.length === rank0.list.length - 1);
  assert.throws(() => g.buyBrewery(s, 'Massivbräu AG'), /nicht zum Verkauf/);
  const c2 = s.cash;
  g.sellBrewery(s, target.name);
  assert.equal(s.cash, c2 + Math.round(target.price * 0.8));
});
