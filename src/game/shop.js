import { MALTS, HOPS, HOP_FORMS, YEASTS, byId } from '../core/data.js';
import { EQUIPMENT, TIER_ORDER, MALT_PRICE, HOP_PRICE_PELLET, HOP_EXTRACT_PRICE, YEAST_PRICE, SANITIZER_PRICE, MALT_BULK_KG, MALT_BULK_FACTOR } from './config.js';
import { need, spend, log, round2 } from './state.js';

/** Malzpreis €/kg – ab einem ganzen Sack (25 kg) günstiger. */
export const maltPrice = (id, kg) => MALT_PRICE[id] * (kg >= MALT_BULK_KG ? MALT_BULK_FACTOR : 1);

export function hopPrice(s, id, form) {
  const base = form === 'extract' ? HOP_EXTRACT_PRICE : HOP_PRICE_PELLET[id] * HOP_FORMS[form].priceMul;
  let m = 1;
  if (s.flags.regional) m *= 0.85;                      // Vertrag mit dem Hopfenbauern
  if (s.flags.extrakt_vertrag && form === 'extract') m *= 0.5; // Großhändler-Rabatt
  return base * m;
}
export const hopKey = (id, form) => form === 'extract' ? 'extract' : `${id}:${form}`;

export function buyMalt(s, id, kg) {
  need(byId(MALTS, id) && kg > 0, 'Unbekanntes Malz oder Menge.');
  spend(s, maltPrice(id, kg) * kg, 'Malz');
  s.inventory.malts[id] = round2((s.inventory.malts[id] || 0) + kg);
  log(s, `${kg} kg ${byId(MALTS, id).name} gekauft${kg >= MALT_BULK_KG ? ' (Sackpreis −25 %)' : ''}.`);
}

export function buyHop(s, id, form, g) {
  need(byId(HOPS, id) && HOP_FORMS[form] && g > 0, 'Unbekannter Hopfen, Form oder Menge.');
  need(!(s.flags.extrakt_vertrag && form !== 'extract'),
    'Dein Liefervertrag mit dem Großhändler erlaubt nur Hopfenextrakt.');
  spend(s, hopPrice(s, id, form) * g, 'Hopfen');
  const key = hopKey(id, form);
  const item = s.inventory.hops.find(h => hopKey(h.id, h.form) === key && h.ageDays === 0);
  if (item) item.g += g; else s.inventory.hops.push({ id, form, g, ageDays: 0 });
  log(s, `${g} g ${HOP_FORMS[form].name} (${byId(HOPS, id).name}) gekauft.`);
}

export function buyYeast(s, id, packs = 1) {
  need(byId(YEASTS, id) && packs > 0, 'Unbekannte Hefe.');
  spend(s, YEAST_PRICE[id] * packs, 'Hefe');
  s.inventory.yeast[id] = (s.inventory.yeast[id] || 0) + packs;
  log(s, `${packs}× ${byId(YEASTS, id).name} gekauft.`);
}

export function buySanitizer(s, doses = 1) {
  spend(s, SANITIZER_PRICE * doses, 'Desinfektionsmittel');
  s.inventory.sanitizer += doses;
  log(s, `${doses}× Desinfektionsmittel gekauft.`);
}

export function buyGear(s, slot, tier) {
  const tiers = TIER_ORDER[slot];
  need(tiers && EQUIPMENT[slot][tier], 'Unbekannte Ausrüstung.');
  need(tiers.indexOf(tier) > tiers.indexOf(s.equipment[slot]), 'Das hast du schon (oder besser).');
  spend(s, EQUIPMENT[slot][tier].cost, EQUIPMENT[slot][tier].name);
  s.equipment[slot] = tier;
  log(s, `Neu in der Brauerei: ${EQUIPMENT[slot][tier].name}.`, 'good');
}
