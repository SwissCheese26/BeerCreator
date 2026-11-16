// Hauptmenü: Story, Karriere, Challenges, Braukonzern, Sandbox, Rezept-Rechner, Beenden.
import { openGame, loadGame, initGameUi } from './game.js';
import { openEmpire, loadEmpire, initEmpireUi, showIntro } from './empire.js';
import { dayLabel, levelInfo, CHAPTERS, LOCATIONS, SCENARIOS, dailyScenario, DIFFICULTY, careerScore, empire } from '../game/index.js';

const $ = id => document.getElementById(id);
const VIEWS = ['menuView', 'gameView', 'calcView', 'empireView'];

function show(view) {
  VIEWS.forEach(v => { $(v).hidden = v !== view; });
  if (view !== 'gameView' && view !== 'empireView') $('gModal').hidden = true;
  $('toast').hidden = true;
  if (view === 'menuView') refreshMenu();
}

function describe(save) {
  const lv = levelInfo(save);
  const where = save.mode === 'sandbox' ? 'Sandbox' : save.mode === 'karriere' ? `Karriere Jahr ${save.career?.year ?? 1}` : save.mode === 'challenge' ? (save.challenge?.title ?? 'Challenge')
    : !save.tutorial?.done ? 'Prolog' : save.ended ? 'Story abgeschlossen' : (CHAPTERS[save.chapter]?.title ?? '');
  return `„${save.breweryName}“ · ${dayLabel(save.day)} · Level ${lv.lvl} · ${where}`;
}

const CARDS = { story: ['btnStoryContinue', 'storyInfo'], sandbox: ['btnSandboxContinue', 'sandboxInfo'], karriere: ['btnKarriereContinue', 'karriereInfo'] };
function refreshMenu() {
  for (const [mode, [btn, infoId]] of Object.entries(CARDS)) {
    const save = loadGame(mode), info = $(infoId);
    $(btn).hidden = !save;
    if (!info.dataset.base) info.dataset.base = info.textContent;
    info.textContent = save ? describe(save) : info.dataset.base;
  }
  const k = loadEmpire(), ki = $('konzernInfo');
  $('btnKonzernContinue').hidden = !k;
  if (!ki.dataset.base) ki.dataset.base = ki.textContent;
  ki.textContent = k ? `„${k.empire.name}“ · Jahr ${Math.floor(k.empire.month / 12) + 1} · ${k.empire.breweries.length} Brauereien · Platz ${empire.rankOf(k)} der Welt` : ki.dataset.base;
  const c = loadGame('challenge'), ci = $('challengeInfo');
  if (!ci.dataset.base) ci.dataset.base = ci.textContent;
  ci.textContent = c?.challenge && !c.gameOver ? `Läuft: ${c.challenge.title}` : ci.dataset.base;
}

let pendingMode = null;
function startNew(mode) {
  const exists = mode === 'konzern' ? loadEmpire() : loadGame(mode);
  const label = { story: 'Story', sandbox: 'Sandbox', karriere: 'Karriere', konzern: 'Braukonzern' }[mode];
  if (exists && !confirm(`Der gespeicherte ${label}-Spielstand wird überschrieben. Neu beginnen?`)) return;
  pendingMode = mode;
  $('locPick').hidden = mode !== 'story';
  $('diffRow').hidden = mode === 'sandbox';
  $('locPick').innerHTML = Object.entries(LOCATIONS).map(([id, l], i) => `<label class="loc-card"><input type="radio" name="loc" value="${id}" ${i === 0 ? 'checked' : ''}>
    <span class="loc-icon">${l.icon}</span><b>${l.name}</b><small class="loc-kind">${l.kind}</small><small>${l.text}</small></label>`).join('');
  $('nameInput').value = mode === 'konzern' ? 'Heinrichs Brau-Gruppe' : 'Heinrichs Hausbrauerei';
  $('nameModal').hidden = false;
  $('nameInput').select();
}
function resume(mode) {
  if (mode === 'konzern') { openEmpire(false, () => show('menuView')); show('empireView'); return; }
  openGame(mode, false, () => show('menuView'));
  show('gameView');
}

// ---------- Challenges ----------
function challengeStars(id) { try { return +localStorage.getItem('beercreator.stars.' + id) || 0; } catch { return 0; } }
function openChallenges() {
  const date = new Date().toISOString().slice(0, 10), daily = dailyScenario(date);
  const card = (id, c, tag = '') => `<button class="chall-card" data-chall="${id}"><span class="chall-stars" aria-label="${challengeStars(id)} Sterne">${'⭐'.repeat(challengeStars(id)) || '☆☆☆'}</span>
    <b>${tag}${c.title}</b><small>${'★'.repeat(c.difficulty)} · ${c.deadline} Tage</small><small>${c.goal}</small></button>`;
  $('challList').innerHTML = card('daily', daily, '📅 ') + Object.entries(SCENARIOS).map(([id, c]) => card(id, c)).join('');
  $('challModal').hidden = false;
}
function startChallenge(id) {
  $('challModal').hidden = true;
  const date = new Date().toISOString().slice(0, 10);
  const opts = id === 'daily' ? { scenario: dailyScenario(date), seed: dailyScenario(date).seed } : { challengeId: id };
  openGame('challenge', true, () => show('menuView'), undefined, undefined, opts);
  show('gameView');
}

initGameUi();
initEmpireUi();
$('nameForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  if (name.length < 2) return;
  $('nameModal').hidden = true;
  const difficulty = pendingMode === 'sandbox' ? 'normal' : $('diffPick').value;
  if (pendingMode === 'konzern') { openEmpire(true, () => show('menuView'), name, difficulty); show('empireView'); showIntro(); return; }
  const loc = document.querySelector('#locPick input[name="loc"]:checked')?.value;
  openGame(pendingMode, true, () => show('menuView'), name, pendingMode === 'story' ? loc : undefined, { difficulty });
  show('gameView');
});
$('nameCancel').addEventListener('click', () => { $('nameModal').hidden = true; });
for (const m of ['story', 'sandbox', 'karriere', 'konzern']) {
  $(`btn${m[0].toUpperCase() + m.slice(1)}New`).addEventListener('click', () => startNew(m));
  $(`btn${m[0].toUpperCase() + m.slice(1)}Continue`).addEventListener('click', () => resume(m));
}
$('btnChallenge').addEventListener('click', openChallenges);
$('challCancel').addEventListener('click', () => { $('challModal').hidden = true; });
$('challList').addEventListener('click', e => { const b = e.target.closest('[data-chall]'); if (b) startChallenge(b.dataset.chall); });
$('btnCalc').addEventListener('click', () => show('calcView'));
$('calcBack').addEventListener('click', () => show('menuView'));
$('btnQuit').addEventListener('click', () => window.close());

// Aus der Story-Ansicht: nach dem Ende als Konzern weitermachen
document.addEventListener('beercreator:konzern', e => {
  openEmpire(true, () => show('menuView'), undefined, 'normal', e.detail.state);
  show('empireView');
  showIntro();
});
document.addEventListener('beercreator:stars', e => { try { const k = 'beercreator.stars.' + e.detail.id; if (e.detail.stars > challengeStars(e.detail.id)) localStorage.setItem(k, e.detail.stars); } catch {} });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('nameModal').hidden) { $('nameModal').hidden = true; return; }
    if (!$('challModal').hidden) { $('challModal').hidden = true; return; }
    if ($('gModal').hidden && $('menuView').hidden) show('menuView');
  }
});
show('menuView');
