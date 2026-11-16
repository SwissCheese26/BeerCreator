import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';
import { REFS, playCareer, brew, runUntilOver, rec } from './refs.js';

test('Modi sind definiert: Story, Karriere, Konzern, Challenge, Sandbox', () => {
  assert.deepEqual(Object.keys(g.MODES).sort(), ['challenge', 'karriere', 'konzern', 'sandbox', 'story']);
});

test('Jede Challenge ist lösbar (Referenzlösung ≥ 1 Stern) und der Zustand bleibt JSON', () => {
  for (const id of Object.keys(g.SCENARIOS)) {
    const s = g.newGame({ mode: 'challenge', challengeId: id, seed: 2 });
    REFS[id](s);
    if (!s.gameOver) g.finishChallenge(s);
    assert.ok(s.gameOver.stars >= 1, `${id}: ${s.gameOver.best}`);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
  }
});

test('Challenge: Frist beendet die Challenge, ohne Sud gibt es keinen Stern', () => {
  const s = g.newGame({ mode: 'challenge', challengeId: 'erster_sud' });
  runUntilOver(s, 200);
  assert.equal(s.gameOver.stars, 0);
  assert.equal(s.challenge.status, 'gescheitert');
  assert.throws(() => g.advanceDays(s, 1), /beendet/);
});

test('Challenge: Extrakt-Vertrag verbietet Pellets/Dolden-Kauf', () => {
  const s = g.newGame({ mode: 'challenge', challengeId: 'extrakt_dilemma' });
  assert.throws(() => g.buyHop(s, 'saphir', 'pellet', 10), /extrakt/i);
  g.buyHop(s, 'saphir', 'extract', 10);
});

test('Tagesaufgabe: gleiches Datum = gleiche Aufgabe, lösbar', () => {
  const a = g.dailyScenario('2026-11-15'), b = g.dailyScenario('2026-11-15'), c = g.dailyScenario('2026-11-16');
  assert.equal(a.title, b.title);
  assert.ok(a.title !== c.title || a.intro !== c.intro);
  const s = g.newGame({ mode: 'challenge', scenario: a, seed: a.seed });
  const style = a.title.match(/: (.+)$/)[1];
  const st = g.STYLES_BY_NAME?.[style];
  assert.ok(s.challenge.daily);
  assert.ok(s.cash > 0);
});

test('Markt: Saison – Weizen im Sommer, Doppelbock im Winter teurer', () => {
  const s = g.newGame({ mode: 'karriere' });
  s.day = 200; const wS = g.marketMultiplier(s, 'weizen'), dS = g.marketMultiplier(s, 'doppelbock');
  s.day = 20; const wW = g.marketMultiplier(s, 'weizen'), dW = g.marketMultiplier(s, 'doppelbock');
  assert.ok(wS > wW && dW > dS);
  assert.equal(g.marketMultiplier(g.newGame({ mode: 'story' }), 'weizen'), 1); // nur Karriere hat Markt
});

test('Karriere: ein effizienter Spieler überlebt 5 Jahre, Punktzahl und Rang', () => {
  const s = playCareer({ seed: 1 });
  assert.equal(s.gameOver.reason, 'zeit');
  assert.ok(s.gameOver.score > 1500, `Score ${s.gameOver.score}`);
  assert.ok(s.stats.commissionsDone >= 5, `Aufträge ${s.stats.commissionsDone}`);
  assert.ok(g.rankOf(s.gameOver.score).title);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
});

test('Karriere: Nichtstun endet in der Insolvenz', () => {
  const s = playCareer({ seed: 1, idle: true });
  assert.equal(s.gameOver.reason, 'insolvenz');
});

test('Karriere: Aufträge verfallen mit Strafe', () => {
  const s = g.newGame({ mode: 'karriere', seed: 4 });
  for (let i = 0; i < 40 && !g.openContracts(s).length; i++) g.advanceDays(s, 7);
  assert.ok(g.openContracts(s).length > 0);
  const cash = s.cash, rep = s.reputation = 20;
  g.advanceDays(s, 120);
  assert.ok(s.stats.commissionsFailed >= 1);
  assert.ok(s.reputation < rep);
});

test('Karriere: Auftrag mit Teillieferungen erfüllen', () => {
  const s = g.newGame({ mode: 'karriere', seed: 5 });
  s.commissions.push({ id: 900, customer: 'Test', styleId: 'helles', liters: 30, minQuality: 55, pricePerL: 5, deadline: s.day + 120, delivered: 0, status: 'offen' });
  for (let k = 0; k < 2; k++) { s.day += 0; brew(s, rec('helles')); if (k === 0) { s.equipment.fermenter = 'edelstahl'; } }
  g.advanceDays(s, 75);
  const beers = s.beers.filter(b => b.styleId === 'helles');
  assert.equal(beers.length, 2);
  const cash = s.cash;
  g.fulfillContract(s, 900, beers[0].id);
  assert.equal(s.commissions.find(c => c.id === 900).status, 'offen');
  const res = g.fulfillContract(s, 900, beers[1].id);
  assert.ok(res.done && s.cash > cash + 100);
});

test('Schwierigkeit: Hardcore hat weniger Startgeld und mehr Infektionen als Entspannt', () => {
  const rate = diff => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = g.newGame({ mode: 'sandbox', seed, difficulty: diff });
      g.setEquipment(s, 'fermenter', 'eimer'); s.hygiene = 0.2; g.setSandboxLevel(s, 1);
      if (g.startBatch(s, newRecipeFromStyle('helles')).flaws.includes('infektion')) n++;
    }
    return n;
  };
  assert.ok(rate('hardcore') > rate('entspannt') * 1.5);
  assert.ok(g.newGame({ mode: 'karriere', difficulty: 'hardcore' }).cash < g.newGame({ mode: 'karriere', difficulty: 'entspannt' }).cash);
  assert.equal(g.diffOf({ difficulty: 'hardcore' }).ironman, true);
});

test('Story-Modus bleibt unberührt: kein Markt, keine Aufträge, Standard-Schwierigkeit', () => {
  const s = g.newGame({ mode: 'story' });
  assert.equal(s.market, undefined); assert.equal(s.commissions, undefined); assert.equal(s.difficulty, 'normal');
});
