// Hauptmenü: Story, Sandbox, Rezept-Rechner, Beenden.
import { openGame, loadGame, initGameUi } from './game.js';
import { dayLabel, levelInfo, CHAPTERS, LOCATIONS } from '../game/index.js';

const $ = id => document.getElementById(id);
const VIEWS = ['menuView', 'gameView', 'calcView'];

function show(view) {
  VIEWS.forEach(v => { $(v).hidden = v !== view; });
  if (view !== 'gameView') $('gModal').hidden = true;
  $('toast').hidden = true;
  if (view === 'menuView') refreshMenu();
}

function describe(save) {
  const lv = levelInfo(save);
  const where = save.mode === 'sandbox' ? 'Sandbox' : !save.tutorial?.done ? 'Prolog' : save.ended ? 'Story abgeschlossen' : (CHAPTERS[save.chapter]?.title ?? '');
  return `„${save.breweryName}“ · ${dayLabel(save.day)} · Level ${lv.lvl} · ${where}`;
}

function refreshMenu() {
  for (const mode of ['story', 'sandbox']) {
    const save = loadGame(mode);
    const cont = $(mode === 'story' ? 'btnStoryContinue' : 'btnSandboxContinue');
    const info = $(mode === 'story' ? 'storyInfo' : 'sandboxInfo');
    cont.hidden = !save;
    if (!info.dataset.base) info.dataset.base = info.textContent;
    info.textContent = save ? describe(save) : info.dataset.base;
  }
}

let pendingMode = null;
function startNew(mode) {
  if (loadGame(mode) && !confirm(`Der gespeicherte ${mode === 'story' ? 'Story' : 'Sandbox'}-Spielstand wird überschrieben. Neu beginnen?`)) return;
  pendingMode = mode;
  $('locPick').hidden = mode !== 'story';
  $('locPick').innerHTML = Object.entries(LOCATIONS).map(([id, l], i) => `<label class="loc-card"><input type="radio" name="loc" value="${id}" ${i === 0 ? 'checked' : ''}>
    <span class="loc-icon">${l.icon}</span><b>${l.name}</b><small class="loc-kind">${l.kind}</small><small>${l.text}</small></label>`).join('');
  $('nameModal').hidden = false;
  $('nameInput').select();
}
function resume(mode) {
  openGame(mode, false, () => show('menuView'));
  show('gameView');
}

initGameUi();
$('nameForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  if (name.length < 2) return;
  $('nameModal').hidden = true;
  const loc = document.querySelector('#locPick input[name="loc"]:checked')?.value;
  openGame(pendingMode, true, () => show('menuView'), name, pendingMode === 'story' ? loc : undefined);
  show('gameView');
});
$('nameCancel').addEventListener('click', () => { $('nameModal').hidden = true; });
$('btnStoryNew').addEventListener('click', () => startNew('story'));
$('btnSandboxNew').addEventListener('click', () => startNew('sandbox'));
$('btnStoryContinue').addEventListener('click', () => resume('story'));
$('btnSandboxContinue').addEventListener('click', () => resume('sandbox'));
$('btnCalc').addEventListener('click', () => show('calcView'));
$('calcBack').addEventListener('click', () => show('menuView'));
$('btnQuit').addEventListener('click', () => window.close());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('nameModal').hidden) { $('nameModal').hidden = true; return; }
  if (e.key === 'Escape' && $('gModal').hidden && $('menuView').hidden) show('menuView');
});
show('menuView');
