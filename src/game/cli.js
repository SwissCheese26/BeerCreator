#!/usr/bin/env node
// Text-Oberfläche zum Spielen der Logik (Design folgt später). Start: npm run game [-- sandbox]
import readline from 'node:readline';
import fs from 'node:fs';
import * as g from './index.js';
import { HOPS, HOP_FORMS, STYLES, YEASTS, byId } from '../core/data.js';
import { newRecipeFromStyle, compute } from '../core/brew.js';

const SAVE = process.env.BEER_SAVE || 'beercreator-save.json';
const argv = process.argv.slice(2);
const mode = ['sandbox', 'karriere', 'challenge', 'daily'].find(m => argv.includes(m)) || 'story';
const difficulty = ['entspannt', 'normal', 'hardcore'].find(d => argv.includes(d)) || 'normal';
const seed = Date.now() % 100000;
function fresh() {
  if (mode === 'daily') { const d = new Date().toISOString().slice(0, 10); const sc = g.dailyScenario(d); return g.newGame({ mode: 'challenge', scenario: sc, seed: sc.seed, difficulty }); }
  if (mode === 'challenge') {
    const id = argv[argv.indexOf('challenge') + 1];
    if (!g.SCENARIOS[id]) { console.log('Challenges:\n' + g.challengeList().map(c => `  ${c.id.padEnd(18)} ${c.title} (Schwierigkeit ${'★'.repeat(c.difficulty)}, ${c.deadline} Tage) – ${c.goal}`).join('\n') + '\nStart: npm run game -- challenge <id>   oder   npm run game -- daily'); process.exit(0); }
    return g.newGame({ mode: 'challenge', challengeId: id, seed, difficulty });
  }
  return g.newGame({ mode, seed, difficulty, years: 5 });
}
const resume = fs.existsSync(SAVE) && !argv.includes('neu') && mode === 'story' && !argv.includes('sandbox');
let s = resume ? JSON.parse(fs.readFileSync(SAVE, 'utf8')) : fresh();
let shown = 0;
const out = (...a) => console.log(...a);

function flushLog() {
  for (; shown < s.log.length; shown++) out(`  ${s.log[shown].kind === 'story' ? '★ ' : '· '}${s.log[shown].text}`);
  if (s.event) {
    out(`\n═ ${s.event.title} ═\n${s.event.text}`);
    s.event.choices.forEach((c, i) => out(`  [${i + 1}] ${c.label}   → event ${c.id}`));
  }
}
function status() {
  const x = g.summary(s);
  out(`\nLevel ${x.level.lvl} ${x.level.name} (${x.level.xp} XP${x.level.nextXp ? `, noch ${x.level.toNext} bis Level ${x.level.lvl + 1}` : ', Maximum'})`);
  if (s.mode === 'karriere') {
    out(`Karriere Jahr ${s.career.year}${s.career.years ? '/' + s.career.years : ''} | Schwierigkeit ${g.DIFFICULTY[s.difficulty].label} | Punkte ${g.careerScore(s)}`);
    g.careerGoals(s).forEach(o => out(`  ${o.done ? '✔' : '○'} ${o.text}`));
    g.openContracts(s).forEach(c => out(`  📦 Auftrag #${c.id} ${c.customer}: ${c.liters} L ${c.styleId} (Q≥${c.minQuality}) ${c.pricePerL} €/L – noch ${c.deadline - s.day} Tage, geliefert ${c.delivered} L`));
  }
  if (s.challenge) { const c = g.challengeStatus(s); out(`Challenge „${c.title}“: ${c.goal}\n  Ziel-Sterne bei ${c.thresholds.join(' / ')} ${c.unit} (${c.better === 'lower' ? 'weniger ist besser' : 'mehr ist besser'}) | bisher ${c.best ?? '–'} | ${'⭐'.repeat(c.stars) || 'noch kein Stern'} | noch ${c.daysLeft} Tage`); }
  if (s.gameOver) out(`\n=== SPIELENDE: ${s.gameOver.reason}${s.gameOver.rank ? ' – Rang ' + s.gameOver.rank : ''}${s.gameOver.stars != null ? ' – ' + s.gameOver.stars + ' ⭐' : ''} | Punkte ${s.gameOver.score} ===`);
  out(`${s.breweryName} | ${g.dayLabel(x.day)} | ${s.mode === 'sandbox' ? 'Sandbox' : x.chapter} | Geld ${s.mode === 'sandbox' ? '∞' : x.cash.toFixed(2) + ' €'} | Ruf ${s.reputation.toFixed(0)} | Ansehen ${s.honor.toFixed(0)} | Bierliga Platz ${x.rank}/${x.rankOf} | Ort: ${x.stage}`);
  if (s.mode === 'story') g.objectives(s).forEach(o => out(`  ${o.done ? '✔' : '○'} ${o.text}`));
  out(`Ausrüstung: ${Object.entries(s.equipment).map(([k, v]) => g.EQUIPMENT[k][v].name).join(' · ')}`);
  const inv = s.inventory;
  out(`Lager: Malz ${Object.entries(inv.malts).map(([k, v]) => `${k} ${v}kg`).join(', ') || '–'} | Hopfen ${inv.hops.map(h => `${h.id}/${h.form} ${Math.round(h.g)}g (${h.ageDays}d)`).join(', ') || '–'} | Hefe ${Object.entries(inv.yeast).map(([k, v]) => `${k}×${v}`).join(', ') || '–'} | Desinfektion ${inv.sanitizer}`);
  s.batches.filter(b => b.status === 'gaerend').forEach(b => out(`  🍺 gärt: #${b.id} ${b.name} – fertig ${g.dayLabel(b.readyDay)}`));
  s.beers.filter(b => b.liters > 0.01).forEach(b => out(`  🍻 Lager: #${b.id} ${b.name} ${b.liters} L, Qualität ${b.quality} (${g.qualityLabel(b.quality)}), ${b.abv.toFixed(1)} %, ${b.ibu.toFixed(0)} IBU`));
}
function tut() {
  const t = g.tutorialView(s); if (!t) return;
  out(`\n${t.icon} Tutorial ${t.index + 1}/${t.total}: ${t.title}`);
  t.lines.forEach(([who, text]) => out(`  ${who === 'opa' ? '📜 Opa' : '👵 Gerda'}: ${text}`));
  out(t.kind === 'mash' ? '  → weiter <Temperatur in °C>' : t.kind === 'choice' ? `  → weiter <${t.choices.map(c => c.id).join('|')}>` : `  → weiter   (${t.button})`);
}
const HELP = `Befehle:
  status | hilfe | speichern | beenden
  stile                         – alle Bierstile mit Level, Kursgebühr, Schwierigkeit
  kurs <stil>                   – Kurs belegen (schaltet den Stil frei)
  info <id>                     – Info-Text zu Zutat, Stil, Technik, Kennwert … (z. B. info citra, info ipa, info ibu, info extract)
  level <1-8>                   – nur Sandbox: Können einstellen
  kaufen malz <id> <kg> | hopfen <id> <dolde|pellet|extrakt> <g> | hefe <id> [n] | desinfektion [n] | technik <kettle|fermenter|cooling> <stufe>
  brauen <stil> [dolde|pellet|extrakt] [liter]   – kauft fehlende Zutaten automatisch und setzt an
  warten [tage]                 – Zeit vergehen lassen (Standard 7)
  verschenken <id> <liter> | verkaufen <id> <liter> [hof|gastro|festival|schwarz]
  spenden <kirche|tafel|kinder|feuerwehr|abtei> <euro> | freibier <id> <liter>
  bierliga                      – Rangliste
  gewerbe                       – Gewerbe (nach-)anmelden, z. B. nach dem Schwarzverkauf
  weiter [eingabe]              – nächster Tutorial-Schritt (Maischen: Temperatur, Gärplatz: warm/tor) | ueberspringen
  entscheiden <option-id>       – bei einer Story-Entscheidung (oder Zahl 1,2,…)
  setup <kettle|fermenter|cooling> <stufe>  – nur Sandbox: Ausrüstung frei setzen
  markt                         – (Karriere) Preisfaktoren je Stil, Hopfenpreis, Trends, Ereignisse
  liefern <auftrag> <bier>      – (Karriere) Auftrag beliefern, auch in Teillieferungen
  fertig                        – (Challenge) abgeben und Sterne kassieren
Modi beim Start:  npm run game | sandbox | karriere [entspannt|normal|hardcore] | challenge <id> | daily`;
const FORM = { dolde: 'whole', pellet: 'pellet', extrakt: 'extract' };

function run(line) {
  const [cmd, ...a] = line.trim().split(/\s+/);
  try {
    switch (cmd) {
      case 'status': status(); break;
      case 'hilfe': out(HELP); break;
      case 'stile': STYLES.forEach(x => {
        const m = g.STYLE_META[x.id]; const ok = g.isUnlocked(s, x.id);
        out(`  ${ok ? '✔' : '🔒'} ${x.id.padEnd(13)} ${x.name.padEnd(16)} Schwierigkeit ${'★'.repeat(m.difficulty).padEnd(5)} ${ok ? 'freigeschaltet' : `Level ${m.minLevel}, Kurs ${m.cost} €`}`);
      }); break;
      case 'kurs': g.buyStyle(s, a[0]); break;
      case 'level': g.setSandboxLevel(s, +a[0]); out(`  Level ${a[0]}`); break;
      case 'info': {
        const hit = g.findInfo(a[0] === 'extrakt' ? 'extract' : a[0] === 'dolde' ? 'whole' : a[0]);
        if (hit) out(`\n  ${hit.title} [${hit.kind}]\n  ${hit.text}`); else out('  Dazu gibt es keinen Eintrag. Probiere z. B. citra, ipa, pellet, ibu, hygiene, pitch, infektion.'); break;
      }
      case 'kaufen': {
        const [what, id, p3, p4] = a;
        if (what === 'malz') g.buyMalt(s, id, +p3);
        else if (what === 'hopfen') g.buyHop(s, id, FORM[p3] || p3, +p4);
        else if (what === 'hefe') g.buyYeast(s, id, +p3 || 1);
        else if (what === 'desinfektion') g.buySanitizer(s, +id || 1);
        else if (what === 'technik') g.buyGear(s, id, p3);
        else out('Was kaufen? malz | hopfen | hefe | desinfektion | technik'); break;
      }
      case 'brauen': {
        const [style, f, l] = a;
        const r = newRecipeFromStyle(style); if (l) r.batchL = +l;
        if (f) g.setHopForm(r, FORM[f] || f);
        g.buyForRecipe(s, r);
        const pv = g.previewBatch(s, r);
        out(`  Erwartet: ${pv.calc.abv.toFixed(1)} % vol, ${pv.calc.ibu.toFixed(0)} IBU (mit Hopfenalter), ${pv.calc.ebc.toFixed(0)} EBC, Hefe-Füllstand ${(pv.pitchRatio * 100).toFixed(0)} %`);
        const batch = g.startBatch(s, r);
        out(`  Kosten: ${batch.cost.total.toFixed(2)} € (Malz ${batch.cost.malt}, Hopfen ${batch.cost.hops}, Hefe ${batch.cost.yeast}, Energie/Desinfektion ${batch.cost.energy}) = ${batch.costPerLiter.toFixed(2)} €/L`);
        break;
      }
      case 'warten': g.advanceDays(s, +a[0] || 7); break;
      case 'verschenken': g.give(s, +a[0], +a[1]); break;
      case 'verkaufen': g.sell(s, +a[0], +a[1], a[2] || g.defaultChannel(s)); break;
      case 'spenden': g.donate(s, a[0], +a[1]); break;
      case 'gewerbe': g.registerBusiness(s); break;
      case 'freibier': g.donateBeer(s, +a[0], +a[1], 'feuerwehr'); break;
      case 'bierliga': g.ranking(s).list.forEach((x, i) => out(`  ${String(i + 1).padStart(2)}. ${x.icon} ${x.name}${x.me ? '  ← du' : ''}  (${x.points} Punkte)`)); break;
      case 'weiter': out('  ' + (g.tutorialAct(s, a[0]) || 'OK')); tut(); break;
      case 'ueberspringen': g.skipTutorial(s); break;
      case 'entscheiden': { const c = s.event?.choices; g.resolveEvent(s, c?.[+a[0] - 1]?.id || a[0]); break; }
      case 'markt': {
        const m = g.marketReport(s); if (!m) { out('  Nur im Karriere-Modus gibt es einen dynamischen Markt.'); break; }
        out(`  Hopfenpreis ×${m.hop}, Malzpreis ×${m.malt}, Nachfrage ×${m.demand}${m.trend ? `, Trend: ${m.trend.styleId} (noch ${m.trend.until - s.day} Tage)` : ''}${m.events.length ? ', Ereignisse: ' + m.events.join(', ') : ''}`);
        out('  Preisfaktor je Stil:  ' + m.styles.map(x => `${x.id} ×${x.mult}`).join(' · ')); break;
      }
      case 'liefern': g.fulfillContract(s, +a[0], +a[1]); break;
      case 'fertig': g.finishChallenge(s); break;
      case 'setup': g.setEquipment(s, a[0], a[1]); break;
      case 'speichern': if (g.diffOf(s).ironman) out('Ironman: Es gibt nur den automatischen Spielstand.'); else { fs.writeFileSync(SAVE, JSON.stringify(s)); out('Gespeichert.'); } break;
      case 'beenden': fs.writeFileSync(SAVE, JSON.stringify(s)); process.exit(0);
      case '': break;
      default: out('Unbekannter Befehl. „hilfe“ zeigt alle Befehle.');
    }
  } catch (e) { if (e instanceof g.GameError) out(`  ✗ ${e.message}`); else throw e; }
  if (s.mode === 'story' || g.diffOf(s).ironman) fs.writeFileSync(SAVE, JSON.stringify(s)); // Autosave (Ironman: immer)
  flushLog();
}

out(`Beer Creator – ${g.MODES[s.mode].label}-Modus. „hilfe“ für Befehle.`);
flushLog(); status(); tut();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', l => { run(l); rl.prompt(); }).on('close', () => process.exit(0));
