import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../src/ui/index.html', import.meta.url), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const src = f => fs.readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8');

test('UI: jede feste Element-ID aus menu.js und empire.js existiert in index.html', () => {
  const used = new Set();
  for (const f of ['menu.js', 'empire.js']) for (const m of src(f).matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)) used.add(m[1]);
  for (const mode of ['Story', 'Sandbox', 'Karriere', 'Konzern']) { used.add(`btn${mode}New`); used.add(`btn${mode}Continue`); }
  // IDs, die erst zur Laufzeit im Inhalt entstehen
  const dynamic = new Set(['bCap', 'bStyle', 'loanAmt', 'brandStyle']);
  const missing = [...used].filter(id => !ids.has(id) && !dynamic.has(id));
  assert.deepEqual(missing, []);
});

test('UI: Konzern-Ansicht und Menü-Karten sind verdrahtet', () => {
  for (const id of ['empireView', 'eBack', 'eWait', 'eTabs', 'eBody', 'eStats', 'challModal', 'challList', 'diffPick', 'cardKarriere', 'cardKonzern', 'btnChallenge']) assert.ok(ids.has(id), id);
  assert.ok(src('menu.js').includes("'beercreator:konzern'"), 'Story-Ende → Konzern');
  assert.ok(src('game.js').includes("data-action=\"toKonzern\""), 'Button im Story-Ende');
});

test('UI: Module importieren sauber (keine fehlenden Exporte)', async () => {
  const g = await import('../src/game/index.js');
  for (const name of ['empireFromStory', 'SCENARIOS', 'dailyScenario', 'DIFFICULTY', 'careerScore', 'careerGoals', 'openContracts', 'marketReport', 'fulfillContract', 'challengeStatus', 'finishChallenge', 'MODES', 'ENDINGS']) assert.ok(name in g, name);
  for (const name of ['empireReport', 'listTargets', 'targetPrice', 'buildCost', 'buildMonths', 'upgradeCost', 'enterCountry', 'acquireBrewery', 'buildBrewery', 'upgradeBrewery', 'setFocus', 'setMarketing', 'launchBrand', 'sellBrewery', 'upgradeHq', 'takeLoan', 'repayLoan', 'ranking', 'MARKETING', 'COUNTRIES', 'fmt', 'rankOf', 'targetOf', 'countryOf']) assert.ok(name in g.empire, name);
});
