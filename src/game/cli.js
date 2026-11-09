#!/usr/bin/env node
// Text-Oberfläche zum Spielen der Logik (Design folgt später). Start: npm run game [-- sandbox]
import readline from 'node:readline';
import fs from 'node:fs';
import * as g from './index.js';
import { HOPS, HOP_FORMS, STYLES, YEASTS, byId } from '../core/data.js';
import { newRecipeFromStyle, compute } from '../core/brew.js';

const SAVE = process.env.BEER_SAVE || 'beercreator-save.json';
const mode = process.argv.includes('sandbox') ? 'sandbox' : 'story';
let s = fs.existsSync(SAVE) && !process.argv.includes('neu') ? JSON.parse(fs.readFileSync(SAVE, 'utf8')) : g.newGame({ mode, seed: Date.now() % 100000 });
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
  out(`${g.dayLabel(x.day)} | ${s.mode === 'sandbox' ? 'Sandbox' : x.chapter} | Geld ${s.mode === 'sandbox' ? '∞' : x.cash.toFixed(2) + ' €'} | Ruf ${s.reputation.toFixed(0)} | Ort: ${x.stage}`);
  if (s.mode === 'story') g.objectives(s).forEach(o => out(`  ${o.done ? '✔' : '○'} ${o.text}`));
  out(`Ausrüstung: ${Object.entries(s.equipment).map(([k, v]) => g.EQUIPMENT[k][v].name).join(' · ')}`);
  const inv = s.inventory;
  out(`Lager: Malz ${Object.entries(inv.malts).map(([k, v]) => `${k} ${v}kg`).join(', ') || '–'} | Hopfen ${inv.hops.map(h => `${h.id}/${h.form} ${Math.round(h.g)}g (${h.ageDays}d)`).join(', ') || '–'} | Hefe ${Object.entries(inv.yeast).map(([k, v]) => `${k}×${v}`).join(', ') || '–'} | Desinfektion ${inv.sanitizer}`);
  s.batches.filter(b => b.status === 'gaerend').forEach(b => out(`  🍺 gärt: #${b.id} ${b.name} – fertig ${g.dayLabel(b.readyDay)}`));
  s.beers.filter(b => b.liters > 0.01).forEach(b => out(`  🍻 Lager: #${b.id} ${b.name} ${b.liters} L, Qualität ${b.quality} (${g.qualityLabel(b.quality)}), ${b.abv.toFixed(1)} %, ${b.ibu.toFixed(0)} IBU`));
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
  verschenken <id> <liter> | verkaufen <id> <liter>
  entscheiden <option-id>       – bei einer Story-Entscheidung (oder Zahl 1,2,…)
  setup <kettle|fermenter|cooling> <stufe>  – nur Sandbox: Ausrüstung frei setzen`;
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
      case 'verkaufen': g.sell(s, +a[0], +a[1]); break;
      case 'entscheiden': { const c = s.event?.choices; g.resolveEvent(s, c?.[+a[0] - 1]?.id || a[0]); break; }
      case 'setup': g.setEquipment(s, a[0], a[1]); break;
      case 'speichern': fs.writeFileSync(SAVE, JSON.stringify(s)); out('Gespeichert.'); break;
      case 'beenden': fs.writeFileSync(SAVE, JSON.stringify(s)); process.exit(0);
      case '': break;
      default: out('Unbekannter Befehl. „hilfe“ zeigt alle Befehle.');
    }
  } catch (e) { if (e instanceof g.GameError) out(`  ✗ ${e.message}`); else throw e; }
  flushLog();
}

out(`Beer Creator – ${s.mode === 'sandbox' ? 'Sandbox' : 'Story'}-Modus. „hilfe“ für Befehle.`);
flushLog(); status();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', l => { run(l); rl.prompt(); }).on('close', () => process.exit(0));
