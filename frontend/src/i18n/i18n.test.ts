import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { uiError } from './apiErrors.ts';
import { displayFeedback, protocolLabel, statusLabel } from './labels.ts';
import { formatDateTimeDDMMYYYYHHmm, formatNumber } from '../lib/format.ts';
import { UI_LOCALE } from './locale.ts';

const root = path.resolve(import.meta.dirname, '../..');
const src = path.join(root, 'src');

function read(rel: string) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('html lang is Russian', () => {
    assert.match(read('src/app/layout.tsx'), /<html lang="ru">/);
});

test('status display does not rewrite stored values', () => {
    assert.equal(statusLabel('Submitted'), 'Отправлено');
    assert.equal(statusLabel('Auto-graded'), 'Проверено автоматически');
    assert.equal(statusLabel('Needs review'), 'Нужна проверка');
    assert.equal(statusLabel('In Progress'), 'В процессе');
    assert.equal(statusLabel('SELECT * FROM t'), 'SELECT * FROM t');
    assert.match(read('src/lib/types.ts'), /export type RosterStatus = 'Pending' \| 'Invited' \| 'Active' \| 'Dropped' \| 'Removed'/);
    assert.match(read('src/features/student/StudentAssignmentPlayer.tsx'), /s\.status === 'Submitted'/);
    assert.match(read('src/features/student/StudentAssignmentPlayer.tsx'), /includes\('unavailable or timed out'\)/);
});

test('grading protocol values stay in the control and only labels change', () => {
    const srcText = read('src/features/instructor/GradingOptions.tsx');
    for (const value of ['0 Absent', '2 Levels', '3 Levels', '8 Levels', '1 - Syntax, Semantics, Results', '5 - Semantics, Results, Syntax']) {
        assert.match(srcText, new RegExp(`value="${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
        assert.notEqual(protocolLabel(value), value);
        assert.match(protocolLabel(value), /^\d/);
    }
    assert.equal(protocolLabel('custom-user-text'), 'custom-user-text');
});

test('api errors are mapped for display and unknown sentences pass through', () => {
    assert.equal(uiError('unauthorized', 'запасной'), 'Нужно войти в систему');
    assert.equal(uiError('Not found', 'запасной'), 'Не найдено');
    assert.equal(uiError({ error: 'forbidden' }, 'запасной'), 'Недостаточно прав');
    assert.equal(uiError('relation "roster" does not exist', 'запасной'), 'relation "roster" does not exist');
    assert.equal(uiError('some_unknown_code', 'запасной'), 'запасной');
    assert.match(read('src/app/api/assignments/route.ts'), /error: 'unauthorized'/);
    assert.match(read('src/app/api/submissions/route.ts'), /status !== 'In Progress'/);
});

test('known grader feedback is translated without eating SQL', () => {
    assert.match(displayFeedback(' SYNTAX: Correct! Well done. '), /СИНТАКСИС/);
    const sql = "SELECT name FROM students";
    const line = `SYNTAX MINOR ERROR: To make the query parseable, it was changed to, '${sql}'.`;
    const shown = displayFeedback(line);
    assert.match(shown, /СИНТАКСИСА/);
    assert.ok(shown.includes(sql));
    assert.equal(displayFeedback('student wrote: keep this comment'), 'student wrote: keep this comment');
    assert.match(displayFeedback('Autograder unavailable or timed out.'), /Автопроверка/);
});

test('dates and numbers use the Russian locale', () => {
    const formatted = formatDateTimeDDMMYYYYHHmm('2026-11-24T15:04:00');
    assert.match(formatted, /24/);
    assert.match(formatted, /11/);
    assert.match(formatted, /2026/);
    assert.match(formatted, /15/);
    assert.doesNotMatch(formatted, /24-11-2026/);
    const n = formatNumber(1234.5, 2);
    assert.match(n, /1/);
    assert.match(n, /234/);
    assert.match(n, /50/);
    assert.ok(n.includes(',') || n.includes('\u00a0') || n.includes(' '));
    assert.equal(UI_LOCALE, 'ru-RU');
    assert.match(read('src/lib/format.ts'), /const UI_LOCALE = 'ru-RU'/);
});

test('visible shell copy is not leftover English', () => {
    const files = [
        'src/app/page.tsx',
        'src/components/AppShell.tsx',
        'src/features/instructor/GradingOptions.tsx',
        'src/features/student/StudentProfile.tsx',
    ];
    const banned = ['Sign in with Keycloak', "I'm a Student", 'Making grading easier', 'Batch Grader', 'Syntax Sensitivity'];
    for (const file of files) {
        const text = read(file);
        for (const phrase of banned) {
            assert.equal(text.includes(phrase), false, `${file} still contains ${phrase}`);
        }
    }
    assert.equal(fs.existsSync(path.join(src, 'i18n/messages.ts')), true);
});
