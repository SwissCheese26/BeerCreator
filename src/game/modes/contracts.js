// Brauaufträge (Karriere): Kunden bestellen konkrete Biere mit Frist und Mindestqualität.
import { STYLES, byId } from '../../core/data.js';
import { FERMENT_DAYS, TAX_PER_HL_PLATO, TAX_SMALL_FACTOR, basePrice, diffOf } from '../config.js';
import { levelOf, STYLE_META } from '../progress.js';
import { rand, log, need, clamp, round2 } from '../state.js';

const CUSTOMERS = [
  { name: 'Familienfeier Meier', tier: 1, styles: ['helles', 'pils', 'weizen'], size: [20, 40] },
  { name: 'Biergarten „Zur Linde“', tier: 1, styles: ['helles', 'pils', 'maerzen', 'weizen'], size: [30, 60] },
  { name: 'Schützenverein', tier: 2, styles: ['pils', 'maerzen', 'dunkel', 'koelsch'], size: [40, 80] },
  { name: 'Gasthaus Adler', tier: 2, styles: ['dunkel', 'bock', 'alt', 'schwarzbier', 'rauch', 'pale'], size: [30, 60] },
  { name: 'Craft-Bar „Hopfenhimmel“', tier: 3, styles: ['ipa', 'pale', 'stout', 'porter', 'saison', 'witbier'], size: [20, 50] },
  { name: 'Hochzeit Schneider', tier: 3, styles: ['helles', 'weizen', 'koelsch', 'dunkelweizen'], size: [60, 100] },
  { name: 'Feinkostladen Gourmet', tier: 4, styles: ['dubbel', 'tripel', 'imperial', 'doppelbock', 'neipa'], size: [20, 40] },
  { name: 'Sauerbar „Berliner Luft“', tier: 5, styles: ['berliner', 'saison', 'witbier', 'neipa'], size: [20, 40] },
];
export const MAX_OPEN_CONTRACTS = 3;

export const openContracts = s => (s.commissions || []).filter(c => c.status === 'offen');

export function maybeSpawnContract(s) {
  if (!s.commissions) s.commissions = [];
  if (openContracts(s).length >= MAX_OPEN_CONTRACTS || rand(s) > 0.55) return null;
  const lvl = levelOf(s.skill.xp).lvl;
  const pool = CUSTOMERS.filter(c => c.tier <= lvl).map(c => ({ ...c, styles: c.styles.filter(x => s.unlocked.includes(x)) })).filter(c => c.styles.length);
  if (!pool.length) return null;
  const cust = pool[Math.floor(rand(s) * pool.length)];
  const styleId = cust.styles[Math.floor(rand(s) * cust.styles.length)];
  const [lo, hi] = cust.size;
  const liters = Math.round((lo + rand(s) * (hi - lo)) / 5) * 5;
  const diff = STYLE_META[styleId].difficulty;
  const minQuality = Math.round(clamp(50 + diff * 5 + rand(s) * 12, 55, 90));
  const yeastDays = { koelsch: 18, berliner: 28, tripel: 21, dubbel: 21, saison: 16 }[styleId] ?? 18;
  const deadline = s.day + yeastDays + 21 + Math.floor(rand(s) * 25);
  const pricePerL = round2(basePrice(minQuality, s.reputation) * (1.3 + rand(s) * 0.5) * diffOf(s).price);
  const c = { id: s.nextId++, customer: cust.name, styleId, liters, minQuality, pricePerL, deadline, delivered: 0, status: 'offen' };
  s.commissions.push(c);
  log(s, `Neuer Auftrag #${c.id}: ${cust.name} bestellt ${liters} L ${byId(STYLES, styleId).name} (mind. Qualität ${minQuality}) bis ${deadline - s.day} Tage. Preis ${pricePerL} €/L.`, 'story');
  return c;
}

export function fulfillContract(s, contractId, beerId) {
  const c = (s.commissions || []).find(x => x.id === contractId && x.status === 'offen');
  need(c, 'Diesen offenen Auftrag gibt es nicht.');
  const b = s.beers.find(x => x.id === beerId);
  need(b && b.liters > 0.01, 'Dieses Bier gibt es nicht im Lager.');
  need(b.styleId === c.styleId, `Der Kunde will ${byId(STYLES, c.styleId).name}, nicht ${byId(STYLES, b.styleId).name}.`);
  need(b.quality >= c.minQuality, `Qualität ${b.quality} reicht nicht (verlangt ${c.minQuality}).`);
  const amount = round2(Math.min(b.liters, c.liters - c.delivered)); // Teillieferungen aus mehreren Suden sind erlaubt
  b.liters = round2(b.liters - amount); c.delivered = round2(c.delivered + amount);
  const revenue = round2(c.pricePerL * amount);
  const tax = s.license ? round2(amount * b.plato * TAX_PER_HL_PLATO / 100 * TAX_SMALL_FACTOR) : 0;
  s.cash = round2(s.cash + revenue - tax);
  s.stats.soldL = round2(s.stats.soldL + amount); s.stats.revenue = round2(s.stats.revenue + revenue);
  if (c.delivered + 1e-9 >= c.liters) {
    const bonus = clamp((b.quality - c.minQuality) / 10, 0, 3);
    s.reputation = round2(clamp(s.reputation + 2 + bonus, 0, 100));
    c.status = 'erledigt';
    s.stats.commissionsDone = (s.stats.commissionsDone || 0) + 1;
    log(s, `Auftrag #${c.id} (${c.customer}) vollständig geliefert: Ruf +${(2 + bonus).toFixed(1)}.`, 'good');
  }
  log(s, `${amount} L an ${c.customer} geliefert: ${revenue} € (Steuer ${tax} €). Noch offen: ${round2(c.liters - c.delivered)} L.`, 'good');
  return { revenue, tax, delivered: c.delivered, done: c.status === 'erledigt' };
}

export function expireContracts(s) {
  for (const c of s.commissions || []) {
    if (c.status !== 'offen' || s.day <= c.deadline) continue;
    c.status = 'verfallen';
    const fine = Math.min(s.cash, round2(c.pricePerL * c.liters * 0.1 * (diffOf(s).price < 1 ? 1.5 : 1)));
    s.cash = round2(s.cash - fine); s.reputation = Math.max(0, round2(s.reputation - 3));
    s.stats.commissionsFailed = (s.stats.commissionsFailed || 0) + 1;
    log(s, `Auftrag #${c.id} (${c.customer}) verfallen: Vertragsstrafe ${fine} €, Ruf −3.`, 'bad');
  }
}
