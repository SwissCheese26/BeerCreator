import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';
import { playTutorial } from './bot.js';

/** Story-Spielstand nach dem Tutorial, Story-Ereignisse ausgeblendet, mit einem fertigen Bier gewünschter Qualität. */
function withBeer({ quality = 75, liters = 100, license = true, rep = 20, styleId = 'helles' } = {}) {
  const s = g.newGame({ skipTutorial: true, seed: 3 });
  s.event = null; s.ended = true; s.license = license; s.reputation = rep; s.cash = 1000; s.day = 150;
  g.unlock(s, 'verkauf', 'spenden');
  s.beers.push({ id: 99, name: 'Testbier', styleId, liters, quality, flaws: [], notes: [], plato: 12, abv: 5, ibu: 25, ebc: 8, finishedDay: s.day });
  return s;
}

test('Tutorial: fast alles gesperrt, geführtes erstes Bier gelingt, danach Kapitel 1', () => {
  const s = g.newGame({ seed: 9 });
  assert.equal(s.tutorial.done, false);
  assert.equal(s.event, null);
  assert.ok(!g.hasFeature(s, 'einkauf') && !g.hasFeature(s, 'verkauf'));
  assert.equal(g.tutorialView(s).id, 'start');
  // falsche Eingaben werden mit Erklärung abgelehnt und halten das Tutorial an
  while (g.TUTORIAL_STEPS[s.tutorial.step].id !== 'maischen') g.tutorialAct(s);
  assert.throws(() => g.tutorialAct(s, 75), /zu heiß/);
  assert.throws(() => g.tutorialAct(s, 55), /zu kalt/);
  g.tutorialAct(s, 66);
  while (g.TUTORIAL_STEPS[s.tutorial.step].id !== 'gaeren') g.tutorialAct(s);
  assert.throws(() => g.tutorialAct(s, 'tor'), /warme Ecke/);
  playTutorial(s);
  assert.ok(s.tutorial.done);
  assert.equal(s.beers.length, 1);
  assert.ok(s.beers[0].quality >= 45, `Qualität ${s.beers[0].quality}`);
  assert.equal(s.chapter, 1);
  assert.equal(s.event?.id, 'opa_brief');
  assert.ok(g.hasFeature(s, 'brauen') && g.hasFeature(s, 'einkauf') && g.hasFeature(s, 'lager'));
  assert.ok(!g.hasFeature(s, 'verkauf') && !g.hasFeature(s, 'kurse'));
});

test('Biersteuer: Regelsatz, Kleinbrauer-Staffel nach BierStG', () => {
  assert.equal(g.taxFactor(100), 0.5);
  assert.equal(g.taxFactor(5000), 0.5);
  assert.ok(Math.abs(g.taxFactor(10000) - 0.6) < 1e-9);
  assert.ok(Math.abs(g.taxFactor(20000) - 0.7) < 1e-9);
  assert.equal(g.taxFactor(250000), 1);
  // 100 L Bier mit 12 °P: 1 hl × 12 × 0,787 € × 0,5
  assert.ok(Math.abs(g.beerTax(100, 12) - 4.722) < 1e-9);
});

test('Absatzwege: eigene Wochen-Nachfrage, Ruf-Schwellen, Festival nur im Sommer mit Standgebühr', () => {
  const s = withBeer({ rep: 0 });
  assert.equal(g.channelState(s, 'gastro').open, false);
  assert.ok(g.channelState(s, 'hof').open);
  const room = g.channelRoom(s, 'hof');
  assert.ok(room > 5 && room < 40, `room ${room}`);
  g.sell(s, 99, room, 'hof');
  assert.throws(() => g.sell(s, 99, 1, 'hof'), /höchstens noch 0 L/);
  s.reputation = 30; s.day = 200; // Juli
  const cash = s.cash;
  g.sell(s, 99, 10, 'festival');
  assert.ok(s.cash < cash + 10 * g.priceFor(s, s.beers[0], 'festival'), 'Standgebühr wird abgezogen');
  s.day = 20; s.week = { sold: {}, rep: 0, donated: 0, festival: false };
  assert.match(g.channelState(s, 'festival').reason, /Mai bis September/);
  // mehr Ruf = mehr Nachfrage
  const s2 = withBeer({ rep: 80 });
  assert.ok(g.channelDemand(s2, 'hof') > g.channelDemand(withBeer({ rep: 0 }), 'hof') * 1.8);
});

test('Ruf entsteht durch Qualität, nicht durch Masse', () => {
  const good = withBeer({ quality: 90, rep: 20 }), bad = withBeer({ quality: 35, rep: 20 });
  g.sell(good, 99, 15, 'hof'); g.sell(bad, 99, 15, 'hof');
  assert.ok(good.reputation > 20 && good.reputation <= 21.5);
  assert.ok(bad.reputation < 20);
  // Wochen-Deckel: auch viel Verkauf bringt höchstens +1,5 Ruf pro Woche
  const big = withBeer({ quality: 95, rep: 40, liters: 500 });
  g.sell(big, 99, g.channelRoom(big, 'gastro'), 'gastro'); g.sell(big, 99, g.channelRoom(big, 'hof'), 'hof');
  assert.ok(big.reputation <= 41.5 + 1e-9, `${big.reputation}`);
});

test('Schwarzverkauf: ohne Steuer, aber Kontrollen kosten Nachzahlung + Strafe + Ansehen', () => {
  const s = withBeer({ license: false, liters: 2000 }); s.honor = 40;
  let raided = null;
  for (let i = 0; i < 200 && !raided; i++) {
    s.week = { sold: {}, rep: 0, donated: 0, festival: false };
    const r = g.sell(s, 99, 10, 'schwarz');
    assert.equal(r.tax, 0);
    if (r.raided) raided = r;
  }
  assert.ok(raided, 'irgendwann wird kontrolliert');
  assert.ok(s.flags.vorbestraft && s.honor <= 20);
  assert.ok(s.log.some(l => /Strafe \d+/.test(l.text)));
  assert.throws(() => g.sell(withBeer({ license: true }), 99, 5, 'schwarz'), /offiziell/);
});

test('Biersteuer auch auf verschenktes Bier, sobald ein Gewerbe läuft', () => {
  const lic = withBeer({ license: true }), hob = withBeer({ license: false });
  g.give(lic, 99, 10); g.give(hob, 99, 10);
  assert.ok(lic.stats.taxPaid > 0);
  assert.equal(hob.stats.taxPaid, 0);
});

test('Hobbygrenze: zu viel gebraut → Steuer-Nachzahlung am Jahresende', () => {
  const s = withBeer({ license: false }); s.ended = true;
  s.litersYear = g.HOBBY_LIMIT_L + 100; const cash = s.cash;
  g.advanceDays(s, 366);
  assert.ok(s.cash < cash - 100, `${cash} → ${s.cash}`);
  assert.ok(s.log.some(l => /Hauptzollamt/.test(l.text)));
});

test('Laufende Kosten: Energie und Flaschen werden beim Ansetzen bezahlt; Malz im Sack günstiger', () => {
  const s = g.newGame({ skipTutorial: true }); s.event = null; s.cash = 1000;
  const r = newRecipeFromStyle('helles'); g.buyForRecipe(s, r);
  const before = s.cash;
  const b = g.startBatch(s, r);
  assert.ok(Math.abs(before - s.cash - g.runCost(r.batchL)) < 0.01);
  assert.ok(b.cost.packaging > 0);
  assert.ok(g.maltPrice('pilsner', 25) < g.maltPrice('pilsner', 5));
});

test('Spenden: bringen Ansehen, wirken abnehmend, Freibier schlechter Qualität schadet', () => {
  const s = withBeer({ quality: 80 });
  const a = g.donate(s, 'kirche', 50), b = g.donate(s, 'kirche', 50);
  assert.ok(a > 0 && b > 0 && b < a, `${a} ${b}`);
  assert.ok(s.honor > 0 && s.stats.donated === 100);
  assert.throws(() => g.donate(s, 'abtei', 50), /nicht möglich/);
  assert.ok(g.donateBeer(s, 99, 10, 'feuerwehr') > 0);
  const bad = withBeer({ quality: 30 });
  assert.ok(g.donateBeer(bad, 99, 10, 'feuerwehr') < 0);
});

test('Abtei St. Gambrin: kommt erst bei Ansehen, Spenden und stabil gutem, klassischem Bier', () => {
  const s = withBeer({ quality: 80, styleId: 'dubbel' }); s.ended = false; s.chapter = 3; s.chapterStarted = true; s.flags.done_gewerbe = true;
  s.flags.done_zollinger = true;
  g.checkStory(s);
  assert.notEqual(s.event?.id, 'abtei_besuch');
  s.honor = 35; s.stats.donated = 400;
  s.stats.recentQ = [70, 72, 69, 71]; s.stats.recentStyles = ['helles', 'pils', 'helles', 'neipa'];
  g.checkStory(s);
  assert.notEqual(s.event?.id, 'abtei_besuch', 'NEIPA ist zu bunt');
  s.stats.recentStyles = ['helles', 'pils', 'helles', 'maerzen'];
  s.stats.recentQ = [50, 90, 60, 85];
  g.checkStory(s);
  assert.notEqual(s.event?.id, 'abtei_besuch', 'zu schwankend');
  s.stats.recentQ = [70, 72, 69, 71];
  g.checkStory(s);
  assert.equal(s.event?.id, 'abtei_besuch');
  g.resolveEvent(s, 'zusagen');
  assert.ok(s.unlocked.includes('dubbel') && g.donationOpen(s, 'abtei'));
  // Das Dubbel im Lager (Qualität 80) überzeugt Bruder Anselm
  assert.equal(s.event?.id, 'abtei_sud');
  g.resolveEvent(s, 'siegel');
  const plain = withBeer({ quality: 80, styleId: 'dubbel' });
  assert.ok(g.priceFor(s, s.beers[0], 'hof') > g.priceFor(plain, plain.beers[0], 'hof') * 1.3);
  s.license = true; const res = g.sell(s, 99, 10, 'hof');
  assert.ok(res.toAbbey > 0 && s.stats.donatedAbtei > 0);
});

test('Bierliga: erfundene Konkurrenz, man startet unten und steigt auf', () => {
  const s = g.newGame({ breweryName: 'Garagengold' });
  const r0 = g.ranking(s);
  assert.equal(r0.myRank, r0.list.length);
  assert.ok(r0.list.some(x => x.me && x.name === 'Garagengold'));
  s.reputation = 40; s.honor = 30; s.stats.medals.push({ medal: 'Silber' }); s.stats.soldL = 800; s.stats.bestQuality = 80;
  assert.ok(g.ranking(s).myRank < r0.myRank - 5);
});
