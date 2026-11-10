import test from 'node:test';
import { fuzz } from './fuzzer.js';

test('Zufalls-Bot: Story übersteht tausende wilde Aktionen ohne Absturz und mit gültigen Werten', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) fuzz('story', seed, 2500);
});
test('Zufalls-Bot: Sandbox übersteht wilde Aktionen', () => {
  for (const seed of [7, 8]) fuzz('sandbox', seed, 1500);
});
