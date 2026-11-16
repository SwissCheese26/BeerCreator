// Terminal-Befehle des Braukonzern-Modus.
import { STYLES, byId } from '../../core/data.js';
import * as E from './index.js';

const pct = x => `${x.toFixed(1)} %`;
export function overview(s, out) {
  const r = E.empireReport(s);
  out(`🏢 ${r.name} – Jahr ${r.year}${r.years ? '/' + r.years : ''} (${r.hq.name}, bis ${r.hq.maxBreweries} Brauereien / ${r.hq.maxCountries} Länder)`);
  out(`   Umsatz ${E.fmt(r.revenueYear)} · EBITDA ${E.fmt(r.ebitdaYear)} · ${r.volMhl} Mio. hl · Platz ${r.rank} der Welt · Punkte ${r.score}`);
  out(`   Kapital ${E.fmt(r.cash)} · Schulden ${E.fmt(r.debt)} (max. ${E.fmt(r.maxDebt)}) · Nettoverschuldung ${r.leverage}× EBITDA · Rating ${r.rating} (Zins ${r.interestPct} %) · Unternehmenswert ${E.fmt(r.equity)}`);
  for (const b of r.breweries) out(`   🏭 #${b.id} ${b.name} [${b.country}] ${b.status === 'bau' ? `im Bau bis Monat ${b.readyMonth}` : b.status === 'ausfall' ? 'AUSFALL' : `${b.capKhl} Tsd. hl, Q${b.quality}, Technik ${b.tech}, Marke ${b.brand}, ${byId(STYLES, b.style).name}, EBITDA ${E.fmt(b.ebitdaYear)}`}${b.integration ? ` (Integration noch ${b.integration} Mon.)` : ''}`);
  if (r.countries.length) out('   Länder: ' + r.countries.map(c => `${E.countryOf(c.id).flag} ${c.name} (${c.share} % Marktanteil, Werbung ${E.MARKETING[c.marketing].name})`).join(' · '));
  if (r.brands.length) out('   Marken: ' + r.brands.map(b => `${b.name} (${Math.round(b.power)})`).join(', '));
  if (r.mods.length) out('   Lage: ' + r.mods.join(' | '));
}

export const EMPIRE_HELP = `Konzern-Befehle:
  konzern                         – Übersicht (Zahlen, Brauereien, Länder)
  laender                         – alle 26 Märkte mit Größe, Preis, Steuer, Risiko
  land <kürzel>                   – Land im Detail und Zielbrauereien (z. B. land CZ)
  buero <land>                    – Büro eröffnen (nötig zum Bauen/Übernehmen)
  uebernehmen <ziel-id>           – Brauerei kaufen (z. B. uebernehmen CZ-2)
  bauen <land> <tsd-hl> <stil>    – Neubau (z. B. bauen PL 150 pils)
  ausbau <brauerei-nr> kapazitaet|technik|qualitaet
  fokus <brauerei-nr> <stil>      – anderer Haupt-Bierstil
  werbung <land> <0-3>            – Marketing-Stufe im Land
  marke <stil> [name]             – neue Konzernmarke
  zentrale                        – Konzernzentrale ausbauen
  kredit <€> | tilgen <€>         – Schulden aufnehmen/zurückzahlen
  verkaufbrauerei <nr>            – Brauerei verkaufen
  rangliste                       – Weltrangliste
  monate [n]                      – n Monate vorspulen (Standard 1)`;

/** Liefert true, wenn der Befehl ein Konzern-Befehl war. */
export function empireCommand(s, cmd, a, out, advance) {
  if (!s.empire) return false;
  const num = x => Number(String(x).replace(/[_.,]/g, m => (m === ',' ? '.' : m === '_' ? '' : '')));
  switch (cmd) {
    case 'konzern': overview(s, out); return true;
    case 'laender': out(E.COUNTRIES.map(c => `  ${c.flag} ${c.id} ${c.name.padEnd(22)} Markt ${String(Math.round(c.marketKhl / 1000)).padStart(4)} Mio. hl · ${String(c.price).padStart(3)} €/hl · Steuer ${String(c.excise).padStart(2)} % · Wachstum ${String(c.growth).padStart(2)} % · Risiko ${'●'.repeat(Math.round(c.risk * 10) || 1)} · Büro ${c.entry ? E.fmt(c.entry) : 'Heimat'}${s.empire.offices[c.id] ? '  ✔ Büro' : ''}`).join('\n')); return true;
    case 'land': {
      const c = E.countryOf(String(a[0]).toUpperCase()); if (!c) { out('  Unbekanntes Land – „laender“ zeigt die Kürzel.'); return true; }
      out(`  ${c.flag} ${c.name} – ${c.note}\n  Markt ${Math.round(s.empire.mkt[c.id] / 1000)} Mio. hl, Konkurrenz ${c.comp}, Kosten ×${c.cost}, Gewinnsteuer ${c.tax} %, Beliebt: ${Object.entries(c.styles).sort((x, y) => y[1] - x[1]).map(([id, v]) => `${byId(STYLES, id).name} ${Math.round(v * 100)} %`).join(', ')}`);
      for (const t of E.listTargets(s, c.id)) out(`  ${t.sold ? '✔ gehört dir' : t.antitrust ? '⛔ Kartell' : '   '} ${t.id}  ${t.name.padEnd(28)} ${String(t.volKhl).padStart(5)} Tsd. hl · Q${t.quality} · ${byId(STYLES, t.style).name.padEnd(9)} · EBITDA ${E.fmt(t.ebitda).padStart(10)} · Preis ${E.fmt(t.price)}`);
      return true;
    }
    case 'buero': E.enterCountry(s, String(a[0]).toUpperCase()); return true;
    case 'uebernehmen': E.acquireBrewery(s, String(a[0]).toUpperCase()); return true;
    case 'bauen': E.buildBrewery(s, String(a[0]).toUpperCase(), num(a[1]), a[2]); return true;
    case 'ausbau': E.upgradeBrewery(s, +a[0], a[1]); return true;
    case 'fokus': E.setFocus(s, +a[0], a[1]); return true;
    case 'werbung': E.setMarketing(s, String(a[0]).toUpperCase(), +a[1]); return true;
    case 'marke': E.launchBrand(s, a[0], a.slice(1).join(' ') || undefined); return true;
    case 'zentrale': E.upgradeHq(s); return true;
    case 'kredit': E.takeLoan(s, num(a[0])); return true;
    case 'tilgen': E.repayLoan(s, num(a[0])); return true;
    case 'verkaufbrauerei': E.sellBrewery(s, +a[0]); return true;
    case 'rangliste': out(E.ranking(s).map(x => `  ${String(x.rank).padStart(2)}. ${x.you ? '👉 ' : '   '}${x.name.padEnd(28)} ${String(x.mhl).padStart(7)} Mio. hl`).join('\n')); return true;
    case 'monate': advance(30 * (+a[0] || 1)); return true;
    default: return false;
  }
}
