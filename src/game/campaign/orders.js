// Story-Aufträge: Bestellungen mit Frist (in Spieltagen), konkreten Anforderungen, Belohnung und Strafe.
// Zustand: s.orders (Array einfacher Objekte, JSON-serialisierbar). Definitionen (mit Hooks) liegen in ORDER_DEFS.
import { STYLES, byId } from '../../core/data.js';
import { GameError, need, rand, round2 } from '../state.js';
import { addXp } from '../progress.js';
import { ensureStory, addRep, addCash, fine, say, stockOf, lvl } from './common.js';

/** key -> { client, title, text, styles|styleId, liters, minQuality, ibu?, ebc?, abv?, days, reward, rep, xp, penaltyRep, penaltyCash, chances, gift?, onDone?, onFail? } */
export const ORDER_DEFS = {};

const FIELDS = ['client', 'title', 'text', 'liters', 'minQuality', 'ibu', 'ebc', 'abv', 'reward', 'rep', 'xp', 'penaltyRep', 'penaltyCash', 'gift'];
const KEY = 'order_';

export const orderState = (s, key) => s.flags[KEY + key]; // 'done' | 'failed' | 'open' | 'declined' | undefined
export const orderResolved = (s, key) => ['done', 'failed'].includes(orderState(s, key));
export const orderDone = (s, key) => orderState(s, key) === 'done';
export const openOrders = s => (s.orders || []).filter(o => o.status === 'offen');
export const stylesOf = o => o.styles || [o.styleId];

/** Neuen Auftrag aus einer Definition anlegen (oder aus einem fertigen Objekt für Zufallsaufträge). */
export function createOrder(s, key, over = {}) {
  const st = ensureStory(s);
  const def = ORDER_DEFS[key];
  need(def || over.client, `Unbekannter Auftrag ${key}.`);
  const src = { ...(def || {}), ...over };
  const o = {
    id: st.orderSeq++, key, styles: src.styles || [src.styleId], status: 'offen', createdDay: s.day,
    deadline: s.day + (src.days ?? 45), chances: src.chances ?? 1, deliveredL: src.deliveredL || 0,
  };
  for (const f of FIELDS) if (src[f] !== undefined) o[f] = src[f];
  o.xp ??= 0; o.rep ??= 0; o.penaltyRep ??= 0; o.penaltyCash ??= 0; o.reward ??= 0;
  s.orders.push(o);
  s.flags[KEY + key] = 'open';
  say(s, `NEUER AUFTRAG – ${o.title} (${o.client})\n${o.text}\nGefordert: ${describe(o)}. Frist: Tag ${o.deadline} (in ${o.deadline - s.day} Tagen). ` +
    `Lohn: ${o.reward} €, Ruf +${o.rep}.`, 'order');
  return o;
}

export function describe(o) {
  const parts = [`${o.liters - o.deliveredL > 0 ? round2(o.liters - o.deliveredL) : o.liters} L ${stylesOf(o).map(id => byId(STYLES, id).name).join(' / ')}`, `Qualität ≥ ${o.minQuality}`];
  if (o.ibu) parts.push(`${o.ibu[0]}–${o.ibu[1]} IBU`);
  if (o.ebc) parts.push(`${o.ebc[0]}–${o.ebc[1]} EBC`);
  if (o.abv) parts.push(`${o.abv[0]}–${o.abv[1]} % vol`);
  return parts.join(', ');
}

const inRange = (v, r) => !r || (v >= r[0] - 1e-9 && v <= r[1] + 1e-9);
export const beerFits = (o, b) => stylesOf(o).includes(b.styleId) && b.quality >= o.minQuality &&
  inRange(b.ibu, o.ibu) && inRange(b.ebc, o.ebc) && inRange(b.abv, o.abv);
export const fittingBeers = (s, o) => stockOf(s).filter(b => beerFits(o, b)).sort((a, b) => a.quality - b.quality);

/** Auftrag beliefern: nimmt passende Biere aus dem Lager (schlechteste passende zuerst). Zahlung erst bei voller Menge. */
export function deliverOrder(s, orderId, beerId = null) {
  const o = (s.orders || []).find(x => x.id === orderId);
  need(o && o.status === 'offen', 'Diesen Auftrag gibt es nicht (mehr).');
  need(o.gift || s.license || s.flags.schwarz || s.mode === 'sandbox', 'Ohne Gewerbe darfst du nichts verkaufen – dieser Auftrag braucht ein Gewerbe.');
  let beers = fittingBeers(s, o);
  if (beerId != null) beers = beers.filter(b => b.id === beerId);
  need(beers.length, `Kein passendes Bier im Lager. Gefordert: ${describe(o)}.`);
  let left = round2(o.liters - o.deliveredL), taken = 0;
  for (const b of beers) {
    if (left <= 1e-9) break;
    const t = Math.min(b.liters, left);
    b.liters = round2(b.liters - t); left = round2(left - t); taken = round2(taken + t);
  }
  o.deliveredL = round2(o.deliveredL + taken);
  if (left > 1e-9) {
    say(s, `${taken} L für „${o.title}“ geliefert – es fehlen noch ${left} L (Frist Tag ${o.deadline}).`, 'good');
    return { delivered: taken, done: false, left };
  }
  o.status = 'erfuellt';
  s.flags[KEY + o.key] = 'done';
  const bonus = s.flags.emp_jule && !o.gift ? 1.1 : 1;
  const cash = round2(o.reward * bonus);
  addCash(s, cash); addRep(s, o.rep); if (o.xp) addXp(s, o.xp, 'Auftrag ' + o.title);
  s.stats.orders = (s.stats.orders || 0) + 1;
  say(s, `AUFTRAG ERFÜLLT – ${o.title}: ${cash} € ${o.gift ? 'Zuschuss' : 'Lohn'}, Ruf +${o.rep}.${bonus > 1 ? ' (Jule hat gut verhandelt: +10 %)' : ''}`, 'good');
  ORDER_DEFS[o.key]?.onDone?.(s, o);
  return { delivered: taken, done: true, left: 0, cash };
}

/** Fristen prüfen: faire Wiederholung (verlängerte Frist, bereits gelieferte Menge zählt), danach Konsequenz. */
export function expireOrders(s) {
  for (const o of [...s.orders]) {
    if (o.status !== 'offen' || s.day <= o.deadline) continue;
    o.status = 'verfallen';
    const def = ORDER_DEFS[o.key];
    if (o.chances > 0) {
      const second = createOrderRaw(s, o);
      say(s, `FRIST VERPASST – „${o.title}“. ${o.client} gibt dir eine zweite Chance: neue Frist Tag ${second.deadline} (Lohn ${second.reward} €).`, 'bad');
      continue;
    }
    addRep(s, -o.penaltyRep); const lost = fine(s, o.penaltyCash);
    s.flags[KEY + o.key] = 'failed';
    say(s, `AUFTRAG GESCHEITERT – ${o.title}. ${o.client} wendet sich ab (Ruf −${o.penaltyRep}${lost ? `, Vertragsstrafe ${lost} €` : ''}).`, 'bad');
    def?.onFail?.(s, o);
  }
  s.orders = s.orders.filter(o => o.status === 'offen' || s.day - o.deadline < 400); // alte Einträge aufräumen
}

function createOrderRaw(s, old) {
  const st = ensureStory(s);
  const n = { ...old, id: st.orderSeq++, status: 'offen', createdDay: s.day, deadline: s.day + 35, chances: old.chances - 1,
    reward: round2(old.reward * 0.85), rep: Math.max(0, old.rep - 1), second: true };
  s.orders.push(n);
  return n;
}

// ---- Zufallsaufträge (optional, Gelegenheitsgeschäft) ----
const CLIENTS = [
  { name: 'Gasthaus „Zur Linde“', styles: ['pils', 'helles', 'dunkel', 'maerzen'] },
  { name: 'Biergarten am Fluss', styles: ['helles', 'weizen', 'pils', 'koelsch'] },
  { name: 'Getränkemarkt Brandt', styles: ['pils', 'weizen', 'pale', 'maerzen', 'alt'] },
  { name: 'Craft-Bar „Hopfenfunk“', styles: ['pale', 'ipa', 'stout', 'porter', 'saison', 'neipa', 'witbier'] },
  { name: 'Vereinsheim FC Eintracht', styles: ['helles', 'pils', 'weizen', 'koelsch'] },
  { name: 'Hotel Seeblick', styles: ['weizen', 'helles', 'dunkel', 'bock', 'dunkelweizen', 'maerzen'] },
  { name: 'Weinstube Engel', styles: ['tripel', 'dubbel', 'saison', 'witbier', 'doppelbock'] },
];
export const GEN_MAX_OPEN = 2;

/** Zufallsauftrag passend zu den freigeschalteten Stilen; Anforderungen liegen im Stilbereich. */
export function generateOrder(s) {
  if (openOrders(s).filter(o => o.generated).length >= GEN_MAX_OPEN) return null;
  const l = lvl(s);
  const client = CLIENTS[Math.floor(rand(s) * CLIENTS.length)];
  const opts = client.styles.filter(id => s.unlocked.includes(id));
  if (!opts.length) return null;
  const styleId = opts[Math.floor(rand(s) * opts.length)];
  const st = byId(STYLES, styleId);
  const maxL = { topf: 20, kessel50: 40, kessel100: 80 }[s.equipment.kettle] * 0.92;
  const liters = Math.max(15, Math.round(maxL * (0.4 + rand(s) * 0.6) / 5) * 5);
  const [lo, hi] = st.ranges.ibu, w = hi - lo;
  const ibu = [Math.round(lo + w * 0.3), Math.round(lo + w * 0.7)];
  const minQuality = Math.min(72, 50 + l * 3);
  const pricePerL = 2.6 + minQuality / 100 * 3.2;
  const o = createOrder(s, 'zufall', {
    client: client.name, title: `${st.name} für ${client.name.replace(/[„“]/g, '')}`,
    text: `${client.name} braucht kurzfristig ${liters} Liter ${st.name} – mit einer Bittere, die zur Hausküche passt.`,
    styles: [styleId], liters, minQuality, ibu, days: 50, reward: Math.round(liters * pricePerL), rep: 2, xp: 12 + 6 * l,
    penaltyRep: 1, penaltyCash: 0, chances: 0,
  });
  o.generated = true;
  delete s.flags[KEY + 'zufall'];
  return o;
}
