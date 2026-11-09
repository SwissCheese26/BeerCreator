import test from 'node:test';
import assert from 'node:assert/strict';
import { playStory } from './bot.js';

test('Die Story ist von Anfang bis Ende durchspielbar (mehrere Seeds)', () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = playStory({ seed });
    assert.ok(s.ended, `Seed ${seed}: nicht fertig – Kapitel ${s.chapter}, Tag ${s.day}, Ruf ${s.reputation}, Geld ${s.cash}`);
    assert.equal(s.stage, 'brauerei');
    assert.ok(s.stats.medals.length >= 1);
    assert.ok(s.day - 60 < 1500);
  }
});
