// Stil-Labor: eigene Bierstile mit eigenen Zielwerten. Sie bauen auf einem gelernten Stil auf
// (Zutaten-Passung, Maischverfahren, Reifung) und werden mit der Zeit bekannt – oder bleiben eine Nische.
import { STYLES, YEASTS, byId } from '../core/data.js';
import { newRecipeFromStyle, setIbu } from '../core/brew.js';
import { need, spend, log, round2, clamp } from './state.js';
import { isUnlocked, levelOf } from './progress.js';

export const CUSTOM_STYLE_COST = 150;  // Probesude, Etiketten-Entwurf, Verkostung
export const CUSTOM_STYLE_LEVEL = 3;
// [Bezeichnung, Einheit, kleinste Spanne, Minimum, Maximum]
export const RANGE_KEYS = {
  plato: ['Stammwürze', '°P', 1, 4, 30],
  abv:   ['Alkohol', '%', 0.6, 1, 16],
  ibu:   ['Bittere', 'IBU', 6, 0, 150],
  ebc:   ['Farbe', 'EBC', 3, 2, 300],
};

export const customOf = (s, id) => (s.customStyles || []).find(x => x.id === id);

/** „Bunt“ (experimentell), wenn mindestens zwei Zielwerte deutlich außerhalb des Basis-Stils liegen. */
export function isExperimental(baseId, ranges) {
  const base = byId(STYLES, baseId);
  return Object.keys(RANGE_KEYS).filter(k => {
    const [lo, hi] = ranges[k], [blo, bhi] = base.ranges[k], mid = (lo + hi) / 2;
    return mid < blo || mid > bhi;
  }).length >= 2;
}

export function createStyle(s, { name, base, ranges, yeastId, desc = '' }) {
  const story = s.mode === 'story';
  if (story) need(levelOf(s.skill.xp).lvl >= CUSTOM_STYLE_LEVEL, `Eigene Stile entwickelst du ab Level ${CUSTOM_STYLE_LEVEL}.`);
  const n = String(name || '').trim().slice(0, 40);
  need(n.length >= 2, 'Gib deinem Stil einen Namen (mind. 2 Zeichen).');
  need(byId(STYLES, base), 'Unbekannter Basis-Stil.');
  need(isUnlocked(s, base), 'Den Basis-Stil musst du zuerst selbst beherrschen (Kurs).');
  const taken = [...STYLES.map(x => x.name), ...(s.customStyles || []).map(x => x.name)].map(x => x.toLowerCase());
  need(!taken.includes(n.toLowerCase()), 'Diesen Namen gibt es schon.');
  need(byId(YEASTS, yeastId), 'Unbekannte Hefe.');
  const clean = {};
  for (const [k, [label, unit, width, min, max]] of Object.entries(RANGE_KEYS)) {
    const [lo, hi] = (ranges?.[k] || []).map(Number);
    need(Number.isFinite(lo) && Number.isFinite(hi) && lo < hi, `${label}: Der untere Wert muss kleiner als der obere sein.`);
    need(lo >= min && hi <= max, `${label}: erlaubt sind ${min}–${max} ${unit}.`);
    need(hi - lo >= width - 1e-9, `${label}: Der Bereich muss mindestens ${width} ${unit} breit sein – so genau braut niemand.`);
    clean[k] = [round2(lo), round2(hi)];
  }
  spend(s, story ? CUSTOM_STYLE_COST : 0, 'die Entwicklung des Stils');
  s.customStyles ||= [];
  const cs = { id: 'haus' + s.nextId++, name: n, base, ranges: clean, yeastId, desc: String(desc).slice(0, 120), fame: 0,
    bunt: isExperimental(base, clean), createdDay: s.day };
  s.customStyles.push(cs);
  log(s, `🧪 Neuer eigener Stil „${n}“ (auf Basis ${byId(STYLES, base).name})${cs.bunt ? ' – ziemlich experimentell' : ''}.` +
    (story ? ` Entwicklung ${CUSTOM_STYLE_COST} €.` : ''), 'good');
  return cs;
}

export function deleteStyle(s, id) {
  s.customStyles = (s.customStyles || []).filter(x => x.id !== id);
}

/** Startrezept für einen eigenen Stil: Basis-Rezept, auf die Mitte der eigenen Zielwerte gezogen. */
export function recipeFromCustom(cs) {
  const r = newRecipeFromStyle(cs.base);
  r.custom = { id: cs.id, name: cs.name, ranges: structuredClone(cs.ranges), yeastId: cs.yeastId, bunt: cs.bunt };
  r.yeastId = cs.yeastId;
  r.plato = round2((cs.ranges.plato[0] + cs.ranges.plato[1]) / 2);
  setIbu(r, (cs.ranges.ibu[0] + cs.ranges.ibu[1]) / 2);
  r.name = `Mein ${cs.name}`;
  return r;
}

/** Name, Beschreibung und Zielwerte des Stils eines Rezepts oder Biers (eigene Stile überschreiben die Basis). */
export function styleView(x) {
  const base = byId(STYLES, x.styleId);
  if (!x.custom) return base;
  return { ...base, name: x.custom.name, desc: `Eigener Stil auf Basis ${base.name}`, ranges: x.custom.ranges ?? base.ranges, custom: true };
}

/** Preisfaktor: Unbekannte eigene Stile verkaufen sich schwerer, bekannte werden zur Marke. */
export const customPriceFactor = cs => (cs ? 0.85 + clamp(cs.fame, 0, 100) / 100 * 0.45 : 1);
export function addFame(s, beer, liters) {
  const cs = beer.custom && customOf(s, beer.custom.id);
  if (!cs) return;
  const gain = liters / 20 * (beer.quality - 60) / 20;
  cs.fame = round2(clamp(cs.fame + gain * (gain > 0 && s.location === 'lindenberg' ? 1.5 : 1), 0, 100));
}
