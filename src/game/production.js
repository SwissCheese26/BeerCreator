// Produktion: Ein Brauhelfer setzt deine Sortiments-Rezepte automatisch an, sobald ein Gärtank frei wird,
// und verkauft fertiges Bier nach deinen Regeln.
import { EQUIPMENT } from './config.js';
import { GameError, need, log, hasFeature } from './state.js';
import { slotsOf, startBatch, buyForRecipe } from './batch.js';
import { isUnlocked } from './progress.js';
import { sell, channelState, channelRoom } from './engine.js';

export const HELPER_WAGE = 150; // € pro 30 Tage (Minijob)
export const SELL_RULES = {
  selbst: 'Ich verkaufe selbst',
  markt:  'Hof, Gastro, Festival',
  alles:  'Markt + Rest an den Händler',
};

export const autoOf = s => (s.auto ||= { helper: false, plan: [], sell: {}, next: 0, lastWarn: -99 });

export function hireHelper(s) {
  need(hasFeature(s, 'produktion'), 'Die Produktion ist noch gesperrt.');
  const a = autoOf(s);
  need(!a.helper, 'Du hast schon einen Brauhelfer.');
  a.helper = true;
  log(s, s.mode === 'story' ? `👷 Brauhelfer eingestellt (${HELPER_WAGE} € im Monat). Er braut deinen Produktionsplan und verkauft nach deinen Regeln.` : '👷 Automatik eingeschaltet.', 'good');
}
export function fireHelper(s) {
  const a = autoOf(s);
  need(a.helper, 'Du hast keinen Brauhelfer.');
  a.helper = false;
  log(s, s.mode === 'story' ? '👷 Der Brauhelfer hat seinen letzten Tag.' : '👷 Automatik ausgeschaltet.');
}
export function setPlan(s, name, on) {
  const a = autoOf(s);
  need((s.recipes || []).some(r => r.name === name), 'Dieses Rezept ist nicht im Sortiment.');
  a.plan = a.plan.filter(n => n !== name);
  if (on) a.plan.push(name);
}
export function setSellRule(s, name, rule) {
  need(SELL_RULES[rule], 'Unbekannte Verkaufsregel.');
  autoOf(s).sell[name] = rule;
}

function warn(s, text) {
  const a = autoOf(s);
  if (s.day - a.lastWarn < 7) return;
  a.lastWarn = s.day;
  log(s, `👷 ${text}`, 'bad');
}

/** Freie Gärtanks mit den Rezepten aus dem Plan füllen (reihum). */
export function autoBrew(s) {
  const a = autoOf(s);
  const plan = a.plan.map(n => (s.recipes || []).find(r => r.name === n)).filter(r => r && isUnlocked(s, r.styleId));
  if (!plan.length) return 0;
  const maxL = EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  let brewed = 0, fails = 0;
  while (slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length > 0 && fails < plan.length) {
    const r = structuredClone(plan[a.next % plan.length]);
    a.next = (a.next + 1) % 1e6;
    r.batchL = Math.min(r.batchL, maxL);
    try {
      if (s.mode !== 'sandbox') buyForRecipe(s, r);
      startBatch(s, r);
      brewed++;
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      fails++;
      warn(s, `Brauhelfer: „${r.name}“ konnte nicht angesetzt werden – ${e.message}`);
    }
  }
  return brewed;
}

/** Fertiges Bier nach den Verkaufsregeln abgeben (nie unter der Hand). */
export function autoSell(s) {
  const a = autoOf(s);
  for (const beer of s.beers) {
    const rule = a.sell[beer.name];
    if (!rule || rule === 'selbst' || beer.liters < 1) continue;
    const order = ['festival', 'gastro', 'hof', ...(rule === 'alles' ? ['abholen'] : [])];
    for (const ch of order) {
      if (beer.liters < 1 || s.event) break;
      if (!channelState(s, ch).open) continue;
      if (ch === 'festival' && !s.week.festival && beer.liters < 30) continue; // Standgebühr lohnt sich erst ab etwas Menge
      const l = Math.floor(Math.min(beer.liters, channelRoom(s, ch)));
      if (l < 1) continue;
      try { sell(s, beer.id, l, ch); } catch (e) { if (!(e instanceof GameError)) throw e; }
    }
    if (s.event) return;
  }
}

export function runAutomation(s) {
  const a = s.auto;
  if (!a?.helper || s.event) return;
  autoBrew(s);
  autoSell(s);
}
