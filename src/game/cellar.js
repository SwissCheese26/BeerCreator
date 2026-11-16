// Fasskeller & Cuvée: fertiges Bier in Holzfässern reifen lassen und Biere miteinander verschneiden.
import { STYLES, byId } from '../core/data.js';
import { need, spend, log, rand, round2, clamp } from './state.js';

export const BARREL_L = 30;          // kleines Holzfass für Kleinbrauer (eine echte Barrique hat 225 L)
export const BARREL_MIN_DAYS = 30;
export const BARRELS = {
  bourbon: { name: 'Bourbonfass', icon: '🥃', cost: 180, aroma: 'Vanille, Kokos, Karamell',
             suits: ['imperial', 'stout', 'porter', 'doppelbock', 'bock', 'dunkel'] },
  rotwein: { name: 'Rotweinfass', icon: '🍷', cost: 150, aroma: 'Kirsche, Beeren, feines Tannin',
             suits: ['dubbel', 'berliner', 'saison', 'tripel', 'witbier'] },
  whisky:  { name: 'Whiskyfass (rauchig)', icon: '🔥', cost: 220, aroma: 'Torfrauch, Malz, Honig',
             suits: ['imperial', 'rauch', 'porter', 'stout', 'doppelbock'] },
  cognac:  { name: 'Cognacfass', icon: '🍂', cost: 260, aroma: 'Trockenfrucht, Eiche, Wärme',
             suits: ['tripel', 'dubbel', 'doppelbock', 'imperial', 'bock'] },
};
const SOUR_OK = ['berliner', 'saison'];

const barrelOf = (s, id) => { const b = (s.barrels || []).find(x => x.id === id); need(b, 'Dieses Fass gibt es nicht.'); return b; };
const beerOf = (s, id) => { const b = s.beers.find(x => x.id === id); need(b, 'Dieses Bier gibt es nicht im Lager.'); return b; };

export function buyBarrel(s, type) {
  const def = BARRELS[type];
  need(def, 'Unbekanntes Fass.');
  spend(s, def.cost, 'das Fass');
  s.barrels ||= [];
  s.barrels.push({ id: s.nextId++, type, uses: 0, fill: null });
  log(s, `${def.icon} ${def.name} gekauft (${def.cost} €). Platz für ${BARREL_L} L.`);
}

export function fillBarrel(s, barrelId, beerId, liters) {
  const barrel = barrelOf(s, barrelId), beer = beerOf(s, beerId);
  need(!barrel.fill, 'In diesem Fass reift schon ein Bier.');
  need(!beer.barrel, 'Dieses Bier war schon im Fass.');
  need(liters >= 5, 'Mindestens 5 L – sonst schmeckt es nur nach Holz.');
  need(liters <= BARREL_L + 1e-9, `Ins Fass passen höchstens ${BARREL_L} L.`);
  need(liters <= beer.liters + 1e-9, `Nur ${beer.liters} L von „${beer.name}“ im Lager.`);
  beer.liters = round2(beer.liters - liters);
  const { id, ...snap } = beer;
  barrel.fill = { beer: { ...snap, liters }, liters, startDay: s.day };
  log(s, `${BARRELS[barrel.type].icon} ${liters} L „${beer.name}“ ins ${BARRELS[barrel.type].name} gelegt. Frühestens nach ${BARREL_MIN_DAYS} Tagen abfüllen – am besten nach 4–6 Monaten.`);
}

/** Qualitätswirkung des Fasses nach `days` Tagen (ohne Zufall). */
export function barrelGain(barrel, beer, days) {
  const def = BARRELS[barrel.type];
  const fits = def.suits.includes(beer.styleId);
  const base = fits ? 14 : beer.abv >= 7 ? 6 : beer.abv >= 5.5 ? 0 : -8;
  if (base <= 0) return base * Math.min(1, days / 60);
  const wear = Math.max(0.2, 1 - 0.35 * barrel.uses);
  const f = days < 30 ? days / 30 * 0.3 : days <= 120 ? 0.3 + 0.7 * (days - 30) / 90 : days <= 200 ? 1 : Math.max(-0.5, 1 - (days - 200) / 100);
  return base * wear * f;
}
export function barrelStatus(s, barrel) {
  if (!barrel.fill) return null;
  const days = s.day - barrel.fill.startDay;
  const fits = BARRELS[barrel.type].suits.includes(barrel.fill.beer.styleId);
  return { days, gain: round2(barrelGain(barrel, barrel.fill.beer, days)), ready: days >= BARREL_MIN_DAYS, fits,
    peak: days >= 120 && days <= 200, over: days > 200, liters: round2(barrel.fill.liters * Math.max(0.5, 1 - 0.02 * days / 30)) };
}

export function emptyBarrel(s, barrelId) {
  const barrel = barrelOf(s, barrelId);
  need(barrel.fill, 'Das Fass ist leer.');
  const st = barrelStatus(s, barrel), def = BARRELS[barrel.type], src = barrel.fill.beer;
  need(st.ready, `Erst nach ${BARREL_MIN_DAYS} Tagen – noch ${BARREL_MIN_DAYS - st.days} Tage.`);
  let gain = st.gain;
  const notes = [`${st.days} Tage im ${def.name}: ${def.aroma}.`];
  const flaws = [...(src.flaws || [])];
  if (rand(s) < 0.04 + st.days / 2000) { // wilde Hefen im Holz
    if (SOUR_OK.includes(src.styleId)) { gain += 4; notes.push('Wilde Hefen aus dem Holz geben eine schöne, säuerliche Tiefe.'); }
    else { gain -= 20; flaws.push('infektion'); notes.push('Wilde Hefen im Holz: Das Bier ist sauer geworden.'); }
  }
  if (!st.fits && gain <= 0) notes.push(`${byId(STYLES, src.styleId)?.name || 'Dieses Bier'} ist zu leicht fürs ${def.name} – das Holz erschlägt es.`);
  if (st.over) notes.push('Zu lange im Fass: Das Holz wird kratzig.');
  const beer = { ...src, id: s.nextId++, name: `${src.name} · ${def.name}`.slice(0, 60), liters: st.liters,
    quality: Math.round(clamp(src.quality + gain, 0, 100)), abv: round2(src.abv + 0.3), ebc: round2(src.ebc * 1.1),
    flaws, notes, barrel: barrel.type, priceMul: round2((src.priceMul ?? 1) * 1.7), finishedDay: s.day };
  s.beers.push(beer);
  barrel.uses++; barrel.fill = null;
  s.stats.bestQuality = Math.max(s.stats.bestQuality, beer.quality);
  s.stats.barrelAged = (s.stats.barrelAged || 0) + 1;
  log(s, `${def.icon} „${beer.name}“ abgefüllt: ${beer.liters} L, Qualität ${src.quality} → ${beer.quality}. ${notes.join(' ')}`, gain >= 0 ? 'good' : 'bad');
  return beer;
}

/** Cuvée-Vorschau: gewichtete Werte und Harmonie der Mischung. parts = [{ beerId, liters }, …] */
export function blendPreview(s, parts) {
  need(parts.length >= 2, 'Eine Cuvée braucht mindestens zwei Biere.');
  need(new Set(parts.map(p => p.beerId)).size === parts.length, 'Zwei verschiedene Biere wählen.');
  const items = parts.map(p => {
    const b = beerOf(s, p.beerId);
    need(p.liters > 0, 'Für jedes Bier eine Menge angeben.');
    need(p.liters <= b.liters + 1e-9, `Nur ${b.liters} L von „${b.name}“ im Lager.`);
    return { b, l: +p.liters };
  });
  const tot = items.reduce((a, x) => a + x.l, 0);
  const avg = k => items.reduce((a, x) => a + (x.b[k] ?? 0) * x.l, 0) / tot;
  let quality = avg('quality');
  const notes = [];
  const barrelShare = items.filter(x => x.b.barrel).reduce((a, x) => a + x.l, 0) / tot;
  const ebcs = items.map(x => Math.max(1, x.b.ebc)), ibus = items.map(x => x.b.ibu);
  const clash = Math.max(...ebcs) / Math.min(...ebcs) > 8 || Math.max(...ibus) - Math.min(...ibus) > 35;
  if (clash) { quality -= 4; notes.push('Die Biere sind sehr verschieden (Farbe oder Bittere) – das beißt sich (−4).'); }
  else if (barrelShare > 0.15 && barrelShare < 0.85) { quality += 4; notes.push('Frisches Bier mit Fassbier verschnitten: eine klassische Cuvée (+4).'); }
  else if (items.every(x => x.b.quality >= 70) && new Set(items.map(x => x.b.styleId)).size > 1) { quality += 2; notes.push('Zwei gute, verschiedene Biere: mehr Komplexität (+2).'); }
  const flaws = [...new Set(items.filter(x => x.l / tot >= 0.25 || x.b.flaws?.includes('infektion')).flatMap(x => x.b.flaws || []))];
  if (flaws.includes('infektion')) notes.push('Ein infiziertes Bier verdirbt die ganze Mischung.');
  const main = items.reduce((a, x) => (x.l > a.l ? x : a));
  return { liters: round2(tot), quality: Math.round(clamp(quality, 0, 100)), plato: round2(avg('plato')), abv: round2(avg('abv')), ibu: round2(avg('ibu')), ebc: round2(avg('ebc')),
    priceMul: round2(items.reduce((a, x) => a + (x.b.priceMul ?? 1) * x.l, 0) / tot * 1.1), flaws, notes, main: main.b, items };
}

export function blendBeers(s, parts, name) {
  const n = String(name || '').trim().slice(0, 60);
  need(n.length >= 2, 'Gib deiner Cuvée einen Namen.');
  const p = blendPreview(s, parts);
  for (const x of p.items) x.b.liters = round2(x.b.liters - x.l);
  const m = p.main;
  const beer = { id: s.nextId++, name: n, styleId: m.styleId, custom: m.custom, liters: p.liters, quality: p.quality, flaws: p.flaws,
    notes: [`Cuvée aus ${p.items.map(x => `${x.l} L „${x.b.name}“`).join(' und ')}.`, ...p.notes],
    plato: p.plato, abv: p.abv, ibu: p.ibu, ebc: p.ebc, priceMul: p.priceMul, blend: true, barrel: p.items.some(x => x.b.barrel) ? 'cuvee' : undefined, finishedDay: s.day };
  s.beers.push(beer);
  s.stats.bestQuality = Math.max(s.stats.bestQuality, beer.quality);
  log(s, `🍷 Cuvée „${n}“ verschnitten: ${beer.liters} L, Qualität ${beer.quality}. ${p.notes.join(' ')}`, 'good');
  return beer;
}
