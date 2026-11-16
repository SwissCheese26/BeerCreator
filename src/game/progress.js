// Skill-Level-System: Erfahrung (XP), Level, Kurse (Rezeptbücher) und ihre Kosten.
import { STYLES, byId } from '../core/data.js';
import { need, spend, log } from './state.js';

export const LEVELS = [
  { lvl: 1, name: 'Anfänger',          xp: 0 },
  { lvl: 2, name: 'Hobbybrauer',       xp: 100 },
  { lvl: 3, name: 'Fortgeschrittener', xp: 300 },
  { lvl: 4, name: 'Sudmeister',        xp: 650 },
  { lvl: 5, name: 'Brauergeselle',     xp: 1200 },
  { lvl: 6, name: 'Braumeister',       xp: 2000 },
  { lvl: 7, name: 'Biersommelier',     xp: 3200 },
  { lvl: 8, name: 'Braulegende',       xp: 5000 },
];

// difficulty 1–5: Aufwand/Fehleranfälligkeit; minLevel: ab wann der Kurs buchbar ist; cost: Kursgebühr (€)
export const STYLE_META = {
  pils:         { difficulty: 1, minLevel: 1, cost: 0 },
  helles:       { difficulty: 1, minLevel: 1, cost: 0 },
  weizen:       { difficulty: 1, minLevel: 1, cost: 0 },
  pale:         { difficulty: 2, minLevel: 1, cost: 0 },
  maerzen:      { difficulty: 2, minLevel: 2, cost: 60 },
  dunkel:       { difficulty: 2, minLevel: 2, cost: 60 },
  koelsch:      { difficulty: 2, minLevel: 2, cost: 80 },
  alt:          { difficulty: 3, minLevel: 3, cost: 100 },
  dunkelweizen: { difficulty: 3, minLevel: 3, cost: 100 },
  schwarzbier:  { difficulty: 3, minLevel: 3, cost: 120 },
  bock:         { difficulty: 3, minLevel: 3, cost: 120 },
  porter:       { difficulty: 3, minLevel: 3, cost: 120 },
  stout:        { difficulty: 3, minLevel: 3, cost: 120 },
  ipa:          { difficulty: 3, minLevel: 3, cost: 150 },
  rauch:        { difficulty: 4, minLevel: 4, cost: 180 },
  witbier:      { difficulty: 4, minLevel: 4, cost: 200 },
  doppelbock:   { difficulty: 4, minLevel: 5, cost: 250 },
  dubbel:       { difficulty: 4, minLevel: 5, cost: 250 },
  saison:       { difficulty: 4, minLevel: 5, cost: 250 },
  neipa:        { difficulty: 5, minLevel: 5, cost: 300 },
  tripel:       { difficulty: 5, minLevel: 6, cost: 350 },
  imperial:     { difficulty: 5, minLevel: 6, cost: 400 },
  berliner:     { difficulty: 5, minLevel: 6, cost: 450 },
};

export const freeStyles = () => STYLES.filter(x => STYLE_META[x.id].cost === 0 && STYLE_META[x.id].minLevel === 1).map(x => x.id);
export const levelOf = xp => [...LEVELS].reverse().find(l => xp >= l.xp);
export const levelInfo = s => {
  const cur = levelOf(s.skill.xp), next = LEVELS.find(l => l.lvl === cur.lvl + 1);
  return { ...cur, xp: s.skill.xp, nextXp: next?.xp ?? null, toNext: next ? next.xp - s.skill.xp : 0 };
};
export const isUnlocked = (s, styleId) => s.mode === 'sandbox' || s.unlocked.includes(styleId);

export function addXp(s, amount, why = '') {
  if (amount <= 0 || s.mode === 'sandbox') return;
  const before = levelOf(s.skill.xp).lvl;
  s.skill.xp += Math.round(amount);
  const after = levelOf(s.skill.xp);
  log(s, `+${Math.round(amount)} Erfahrung${why ? ' (' + why + ')' : ''}.`);
  if (after.lvl > before) log(s, `LEVEL UP! Du bist jetzt „${after.name}“ (Level ${after.lvl}). Neue Kurse sind freigeschaltet.`, 'good');
}

/** Kurs/Rezeptbuch für einen Bierstil kaufen. */
export function buyStyle(s, styleId) {
  const meta = STYLE_META[styleId];
  need(meta && byId(STYLES, styleId), 'Unbekannter Bierstil.');
  need(!isUnlocked(s, styleId), 'Diesen Stil beherrschst du schon.');
  const lvl = levelOf(s.skill.xp).lvl;
  need(lvl >= meta.minLevel, `Für ${byId(STYLES, styleId).name} brauchst du Level ${meta.minLevel} (${LEVELS[meta.minLevel - 1].name}). Du bist Level ${lvl}.`);
  spend(s, meta.cost, `den Kurs „${byId(STYLES, styleId).name}“`);
  s.unlocked.push(styleId);
  log(s, `Kurs belegt: Du kannst jetzt ${byId(STYLES, styleId).name} brauen.`, 'good');
}

/** Sandbox: Level frei einstellen (zum Ausprobieren der Fehleranfälligkeit). */
export function setSandboxLevel(s, lvl) {
  need(s.mode === 'sandbox', 'Nur im Sandbox-Modus möglich.');
  need(lvl >= 1 && lvl <= LEVELS.length, 'Level 1–8.');
  s.skill.xp = LEVELS[lvl - 1].xp;
}

/** XP für einen fertigen Sud: höher bei schwierigen Stilen und guter Qualität; Bonus fürs erste Mal. */
export function brewXp(s, batch) {
  const d = STYLE_META[batch.styleId].difficulty;
  let xp = Math.round(15 * d * batch.quality / 100);
  if (batch.flaws.includes('infektion')) xp = 3;
  if (!s.stats.completedStyles.includes(batch.styleId)) xp += 25 * d;
  return xp;
}
