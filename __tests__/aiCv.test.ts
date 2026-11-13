/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_CV_MAX_LENGTH, buildAiCvText, type AiCvInput } from '../lib/aiCv';
import { t } from '../lib/i18n';

const en = (key: Parameters<typeof t>[0]) => t(key, 'en');
const tr = (key: Parameters<typeof t>[0]) => t(key, 'tr');

const full: AiCvInput = {
  fullName: 'Ali Veli',
  position: 'Forvet',
  age: 20,
  height: 180,
  weight: 75,
  city: 'İstanbul',
  district: 'Kadıköy',
  club: 'Örnek FK',
  foot: 'Sağ',
  bio: 'Hızlı ve teknik oyuncu.',
  score: 56,
  overallRating: 70,
  strengths: ['Hız', ' Bitiricilik ', ''],
};

test('the CV is deterministic: the same profile gives the same text', () => {
  assert.equal(buildAiCvText(full, en), buildAiCvText(full, en));
});

test('the English CV shows translated position and foot, and stored values are not changed', () => {
  const text = buildAiCvText(full, en);
  assert.ok(text.startsWith('Ali Veli\nAI CV\n'), text);
  assert.ok(text.includes('Position: Forward'));
  assert.ok(text.includes('Foot: Right'));
  assert.ok(text.includes('Location: İstanbul, Kadıköy'));
  assert.ok(text.includes('Profile score: 56/100'));
  assert.ok(text.includes('AI rating: 70/100'));
  assert.ok(text.includes('Strengths: Hız, Bitiricilik'));
  assert.ok(text.includes('About: Hızlı ve teknik oyuncu.'));
});

test('the Turkish CV keeps the Turkish position and foot values', () => {
  const text = buildAiCvText(full, tr);
  assert.ok(text.includes('Pozisyon: Forvet'));
  assert.ok(text.includes('Ayak: Sağ'));
});

test('empty fields are left out instead of printing placeholders', () => {
  const text = buildAiCvText(
    { ...full, club: null, bio: '   ', overallRating: null, strengths: [], height: null, weight: null },
    en,
  );
  assert.ok(!text.includes('Club:'));
  assert.ok(!text.includes('About:'));
  assert.ok(!text.includes('AI rating:'));
  assert.ok(!text.includes('Strengths:'));
  assert.ok(!text.includes('Height:'));
  assert.ok(!text.includes('undefined'));
  assert.ok(!text.includes('null'));
});

test('a missing name falls back to the CV title', () => {
  const text = buildAiCvText({ ...full, fullName: '  ' }, en);
  assert.ok(text.startsWith('AI CV\nAI CV\n'), text);
});

test('the result never exceeds the save_my_ai_cv length limit', () => {
  const text = buildAiCvText({ ...full, bio: 'x'.repeat(10000) }, en);
  assert.equal(text.length, AI_CV_MAX_LENGTH);
});
