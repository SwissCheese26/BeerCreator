// Nebenquests („Aufträge“): Leute aus dem Dorf wünschen sich Bier – mit Frist, Belohnung und kleinen Geschichten.
// Laufen neben der Story, halten die Zeit nicht an und können abgelehnt werden.
import { STYLES, byId } from '../core/data.js';
import { beerTax } from './config.js';
import { need, log, rand, round2, clamp } from './state.js';
import { addXp } from './progress.js';
import { styleView } from './styles.js';

export const QUEST_PEOPLE = {
  gerda: ['👵', 'Gerda'], klaus: ['🧔', 'Klaus'], ottokar: ['👨‍🍳', 'Ottokar Würzig'], toni: ['🌿', 'Toni Dolde'],
  anselm: ['📿', 'Bruder Anselm'], jury: ['🏅', 'Dr. Sabine Stammwürze'], opa: ['📜', 'Opa Heinrich'],
  feuerwehr: ['🚒', 'Kommandantin Brandt'], verein: ['⚽', 'Vereinswirt Kalle'], imker: ['🐝', 'Imkerin Hanne'],
};
const lic = s => s.license;
const ch = n => s => s.chapter >= n || s.ended;

// kind 'deliver': Bier abliefern (Stil-Liste optional). kind 'goal': Ziel erreichen (check). paid: Geld fließt → nur mit Gewerbe.
export const QUESTS = {
  gerda80: { who: 'gerda', title: 'Gerdas 80. Geburtstag', kind: 'deliver', liters: 10, minQ: 55, days: 30,
    text: 'Ich werde achtzig, mein Junge! Die ganze Kegelgruppe kommt. Hättest du 10 Liter von deinem Bier für uns? Es muss nichts Besonderes sein – nur gut.',
    when: s => ch(2)(s), reward: s => { s.honor = clamp(s.honor + 4, 0, 100); s.reputation = clamp(s.reputation + 2, 0, 100); s.hygiene = Math.min(0.9, s.hygiene + 0.05);
      return 'Gerda strahlt. Als Dank schenkt sie dir Opas alte Spülbürsten-Sammlung und ein Fläschchen Desinfektion (Hygiene +). Ansehen +4, Ruf +2.'; } },
  feuerwehr150: { who: 'feuerwehr', title: '150 Jahre Freiwillige Feuerwehr', kind: 'deliver', liters: 40, minQ: 55, days: 55, paid: true,
    text: 'Unsere Wehr wird 150! Zum Festabend brauchen wir 40 Liter Bier aus dem Ort. Wir zahlen 220 € – und jeder im Dorf wird wissen, von wem das Bier ist.',
    when: s => ch(3)(s) && lic(s), reward: s => { s.cash = round2(s.cash + 220); s.honor = clamp(s.honor + 4, 0, 100); s.reputation = clamp(s.reputation + 3, 0, 100);
      return '220 € und ein Ehrenhelm für die Vitrine. Ansehen +4, Ruf +3.'; } },
  hochzeit: { who: 'klaus', title: 'Klaus heiratet', kind: 'deliver', styles: ['helles', 'maerzen', 'pils', 'koelsch'], liters: 30, minQ: 62, days: 55, paid: true,
    text: 'Ich heirate! Meine Verlobte will ein helles, süffiges Bier für die Feier – Helles, Märzen, Pils oder Kölsch. 30 Liter, ich zahl dir 320 €.',
    when: s => ch(3)(s) && lic(s), reward: s => { s.cash = round2(s.cash + 320); s.reputation = clamp(s.reputation + 3, 0, 100);
      return 'Die Hochzeit war legendär – das Fass war um Mitternacht leer. 320 €, Ruf +3.'; } },
  sportfest: { who: 'verein', title: 'Aufstiegsfeier beim SV Kesselbach', kind: 'deliver', styles: ['weizen', 'dunkelweizen', 'witbier'], liters: 25, minQ: 60, days: 40, paid: true,
    text: 'Wir sind aufgestiegen! Die Jungs wollen Weißbier aus dem Ort. 25 Liter Weizen, Dunkelweizen oder Witbier – 240 € in bar, ganz offiziell mit Quittung.',
    when: s => ch(3)(s) && lic(s), reward: s => { s.cash = round2(s.cash + 240); s.regulars = Math.min(60, (s.regulars || 0) + 6);
      return '240 € und sechs neue Stammkunden aus dem Verein für deinen Hofverkauf.'; } },
  wildmenue: { who: 'ottokar', title: 'Ottokars Wildmenü', kind: 'deliver', styles: ['dunkel', 'bock', 'doppelbock', 'schwarzbier', 'rauch', 'porter'], liters: 15, minQ: 66, days: 45, paid: true,
    text: 'Herbst, Hirsch, Wildschwein! Zu meinem Wildmenü brauche ich ein dunkles, malziges Bier – Dunkel, Bock, Schwarzbier, Rauchbier oder Porter. 15 Liter, 280 €, und dein Name kommt auf die Karte.',
    when: s => ch(4)(s) && lic(s), reward: s => { s.cash = round2(s.cash + 280); s.reputation = clamp(s.reputation + 3, 0, 100);
      return 'Das Menü ist ausgebucht, dein Bier steht auf der Karte. 280 €, Ruf +3.'; } },
  hopfengarten: { who: 'toni', title: 'Tonis Hopfengarten', kind: 'deliver', styles: ['pale', 'ipa', 'neipa', 'pils', 'saison'], liters: 10, minQ: 62, days: 35,
    text: 'Ich will meinen Bauern zeigen, was aus unserem Hopfen werden kann. Brau mir ein hopfiges Bier – Pale Ale, IPA, NEIPA, Pils oder Saison. 10 Liter. Ich zahle in Naturalien.',
    when: s => ch(4)(s), reward: s => { s.inventory.hops.push({ id: 'citra', form: 'whole', g: 300, ageDays: 0 }, { id: 'saphir', form: 'whole', g: 300, ageDays: 0 });
      return 'Toni schenkt dir je 300 g frisch gepflückten Citra und Saphir (Dolden).'; } },
  honigbock: { who: 'imker', title: 'Bier für die Imkerei', kind: 'deliver', styles: ['bock', 'doppelbock', 'tripel', 'maerzen'], liters: 12, minQ: 64, days: 40,
    text: 'Zum Tag der offenen Imkerei möchte ich ein kräftiges, honigfarbenes Bier ausschenken – Bock, Doppelbock, Tripel oder Märzen. Ich tausche gegen Honig und gute Worte.',
    when: s => ch(4)(s), reward: s => { s.honor = clamp(s.honor + 3, 0, 100); s.reputation = clamp(s.reputation + 2, 0, 100); s.cash = round2(s.cash + 60);
      return 'Hanne verkauft deinen Honig-Bock-Abend als Erfolg. Sie gibt dir 60 € aus der Spendenkasse, Ansehen +3, Ruf +2.'; } },
  fastenbier: { who: 'anselm', title: 'Flüssiges Brot für die Fastenzeit', kind: 'deliver', styles: ['doppelbock', 'dubbel'], liters: 20, minQ: 68, days: 50,
    text: 'In der Fastenzeit tranken die Mönche früher starkes Bier – flüssiges Brot. Bruder Prior wünscht sich das zurück: 20 Liter Doppelbock oder Dubbel. Wir beten für dich und zahlen, was wir können.',
    when: s => !!s.flags.abtei, reward: s => { s.honor = clamp(s.honor + 6, 0, 100); s.cash = round2(s.cash + 150);
      return 'Die Mönche sind gerührt. 150 € aus der Klosterkasse und Ansehen +6.'; } },
  blindprobe: { who: 'jury', title: 'Die Blindprobe der Jury', kind: 'deliver', liters: 5, minQ: 80, days: 40,
    text: 'Ich schule neue Juroren und brauche ein wirklich herausragendes Bier als Referenz – Qualität 80 oder mehr. 5 Liter. Wenn es gut ist, erzähle ich es weiter.',
    when: s => ch(5)(s), reward: s => { s.reputation = clamp(s.reputation + 6, 0, 100); addXp(s, 150, 'Blindprobe');
      return 'Dr. Stammwürze nennt dein Bier „lehrbuchhaft“. Ruf +6, 150 Erfahrung.'; } },
  opas_seiten: { who: 'opa', title: 'Opas verlorene Seiten', kind: 'goal', days: 99999,
    text: 'Im Sudbuch fehlen drei Seiten. Auf einem Zettel steht in Opas Schrift: „Das Holz, die Kenner, die Vielfalt – dann findest du mein Jubiläumsbier.“',
    steps: [
      { text: 'Das Holz: ein Bier im Fass reifen lassen', done: s => (s.stats.barrelAged || 0) >= 1 },
      { text: 'Die Kenner: eine Kritik mit 75 Punkten oder mehr', done: s => (s.stats.bestReview || 0) >= 75 },
      { text: 'Die Vielfalt: sechs verschiedene Bierstile gebraut', done: s => s.stats.styles.length >= 6 },
    ],
    when: s => ch(4)(s), reward: s => {
      s.customStyles ||= [];
      if (!s.customStyles.some(x => x.id === 'opa_jubilaeum')) s.customStyles.push({ id: 'opa_jubilaeum', name: 'Heinrichs Jubiläumsbier', base: 'maerzen',
        ranges: { plato: [13.5, 15], abv: [5.6, 6.4], ibu: [20, 28], ebc: [16, 26] }, yeastId: 'lager', desc: 'Opas Festbier – bernsteinfarben, kräftig, rund.',
        fame: 40, bunt: false, createdDay: s.day });
      addXp(s, 300, 'Opas Seiten');
      return 'Die letzte Seite steckte hinter dem Foto in der Garage. Opas „Jubiläumsbier“ ist jetzt dein eigener Stil im Stil-Labor – schon bekannt im Dorf (Bekanntheit 40). 300 Erfahrung.';
    } },
};
export const OFFER_DAYS = 10;
const MAX_OPEN = 2;

export const questsOf = s => (s.quests ||= { offered: [], active: [], done: [], failed: [], declined: [] });
const seen = (q, id) => [...q.offered, ...q.active].some(x => x.id === id) || q.done.includes(id) || q.failed.includes(id) || q.declined.includes(id);

/** Täglich: neue Aufträge anbieten, Fristen prüfen, Ziel-Quests abschließen. */
export function questsDaily(s) {
  if (s.mode !== 'story' || !s.tutorial?.done || !s.features?.includes('verschenken')) return;
  const q = questsOf(s);
  q.offered = q.offered.filter(o => {
    if (o.until >= s.day) return true;
    log(s, `📮 Das Angebot „${QUESTS[o.id].title}“ ist verfallen.`);
    q.declined.push(o.id);
    return false;
  });
  for (const a of [...q.active]) {
    const d = QUESTS[a.id];
    if (d.kind === 'goal' && d.steps.every(st => st.done(s))) { finish(s, a, d); continue; }
    if (a.due < s.day) {
      q.active = q.active.filter(x => x !== a); q.failed.push(a.id);
      const pen = d.kind === 'goal' ? 0 : 2;
      s.honor = round2(clamp(s.honor - pen, 0, 100)); s.reputation = round2(clamp(s.reputation - pen, 0, 100));
      log(s, `📮 Frist verpasst: „${d.title}“. ${QUEST_PEOPLE[d.who][1]} ist enttäuscht.${pen ? ` Ansehen −${pen}, Ruf −${pen}.` : ''}`, 'bad');
    }
  }
  if (q.offered.length + q.active.length >= MAX_OPEN || rand(s) > 0.06) return;
  const cand = Object.entries(QUESTS).filter(([id, d]) => !seen(q, id) && d.when(s));
  if (!cand.length) return;
  const [id, d] = cand[Math.floor(rand(s) * cand.length)];
  q.offered.push({ id, until: s.day + OFFER_DAYS });
  log(s, `📮 Neuer Auftrag von ${QUEST_PEOPLE[d.who][1]}: „${d.title}“. Schau unter „Aufträge“.`, 'good');
}

export function acceptQuest(s, id) {
  const q = questsOf(s), o = q.offered.find(x => x.id === id);
  need(o, 'Dieses Angebot gibt es nicht (mehr).');
  const d = QUESTS[id];
  q.offered = q.offered.filter(x => x !== o);
  q.active.push({ id, start: s.day, due: s.day + d.days });
  log(s, `📮 Auftrag angenommen: „${d.title}“ – bis ${d.days} Tage.`);
}
export function declineQuest(s, id) {
  const q = questsOf(s);
  need(q.offered.some(x => x.id === id), 'Dieses Angebot gibt es nicht (mehr).');
  q.offered = q.offered.filter(x => x.id !== id); q.declined.push(id);
  log(s, `📮 Auftrag „${QUESTS[id].title}“ abgelehnt.`);
}

/** Passt dieses Bier zum Liefer-Auftrag? Liefert { ok, reason }. */
export function questFits(s, id, beer) {
  const d = QUESTS[id];
  if (d.styles && !d.styles.includes(beer.styleId)) return { ok: false, reason: `Gewünscht: ${d.styles.map(x => byId(STYLES, x).name).join(', ')} – „${beer.name}“ ist ${styleView(beer).name}.` };
  if (beer.quality < d.minQ) return { ok: false, reason: `Qualität ${d.minQ} nötig, „${beer.name}“ hat ${beer.quality}.` };
  if ((beer.flaws || []).includes('infektion')) return { ok: false, reason: 'Ein infiziertes Bier kannst du nicht abgeben.' };
  if (beer.liters < d.liters - 1e-9) return { ok: false, reason: `${d.liters} L nötig, nur ${beer.liters} L im Lager.` };
  return { ok: true };
}

export function deliverQuest(s, id, beerId) {
  const q = questsOf(s), a = q.active.find(x => x.id === id);
  need(a, 'Diesen Auftrag hast du nicht angenommen.');
  const d = QUESTS[id];
  need(d.kind === 'deliver', 'Dieser Auftrag wird nicht beliefert.');
  const b = s.beers.find(x => x.id === beerId);
  need(b, 'Dieses Bier gibt es nicht im Lager.');
  const fit = questFits(s, id, b);
  need(fit.ok, fit.reason);
  const tax = s.license ? round2(beerTax(d.liters, b.plato, s.taxedLYear / 100)) : 0;
  need(s.cash >= tax - 1e-9, `Für ${d.liters} L fallen ${tax} € Biersteuer an – so viel Geld hast du nicht.`);
  b.liters = round2(b.liters - d.liters);
  if (tax) { s.cash = round2(s.cash - tax); s.taxedLYear += d.liters; s.stats.taxPaid = round2(s.stats.taxPaid + tax); }
  if (d.paid) s.stats.soldL = round2(s.stats.soldL + d.liters); else s.stats.givenL = round2(s.stats.givenL + d.liters);
  finish(s, a, d, tax);
}

function finish(s, a, d, tax = 0) {
  const q = questsOf(s);
  q.active = q.active.filter(x => x !== a); q.done.push(a.id);
  s.stats.quests = (s.stats.quests || 0) + 1;
  const text = d.reward(s);
  s.honor = round2(s.honor); s.reputation = round2(s.reputation);
  log(s, `✅ Auftrag erledigt: „${d.title}“. ${text}${tax ? ` (Biersteuer ${tax} €)` : ''}`, 'good');
  return text;
}

/** Übersicht für die Oberfläche. */
export function questView(s) {
  const q = questsOf(s);
  const view = (x, state) => {
    const d = QUESTS[x.id];
    return { id: x.id, state, title: d.title, text: d.text, who: d.who, kind: d.kind, liters: d.liters, minQ: d.minQ, styles: d.styles,
      until: x.until, due: x.due, steps: d.steps?.map(st => ({ text: st.text, done: st.done(s) })) };
  };
  return { offered: q.offered.map(x => view(x, 'offered')), active: q.active.map(x => view(x, 'active')),
    done: q.done.map(id => QUESTS[id]?.title).filter(Boolean), failed: q.failed.map(id => QUESTS[id]?.title).filter(Boolean),
    total: Object.keys(QUESTS).length };
}
