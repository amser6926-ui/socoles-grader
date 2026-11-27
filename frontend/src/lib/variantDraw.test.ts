import assert from 'node:assert/strict';
import test from 'node:test';
import { drawDistinct, resolveDraw, selectedPoints } from './variantDraw.ts';

const ten = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);

test('draws exactly five distinct ids from that variant', () => {
    let n = 0;
    const drawn = drawDistinct(ten, 5, () => (n++ % 3));
    assert.equal(drawn.length, 5);
    assert.equal(new Set(drawn).size, 5);
    for (const id of drawn) assert.ok(ten.includes(id));
});

test('refuses a short bank and duplicates', () => {
    assert.throws(() => drawDistinct(ten.slice(0, 4), 5, () => 0));
    assert.throws(() => drawDistinct([...ten, ten[0]], 5, () => 0));
});

test('refresh and a second variant choice keep the first draw', () => {
    const first = { variantId: 'A', questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'] };
    const again = resolveDraw(first, { variantId: 'B', questionIds: ['q6', 'q7', 'q8', 'q9', 'q10'] });
    assert.equal(again.created, false);
    assert.deepEqual(again.draw, first);
});

test('two students can receive overlapping sets', () => {
    const a = drawDistinct(ten, 5, () => 0);
    const b = drawDistinct(ten, 5, () => 0);
    assert.deepEqual(a, b);
});

test('points use only the selected questions', () => {
    const questions = ten.map((id) => ({ id, points: 2 }));
    assert.equal(selectedPoints(questions, ['q1', 'q3', 'q5', 'q7', 'q9']), 10);
});
