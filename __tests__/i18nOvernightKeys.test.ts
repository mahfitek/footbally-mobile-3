/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, type TranslationKey } from '../lib/i18n';

// Bu turda eklenen anahtarlar: her biri İngilizce ve Türkçe için çevrilmiş olmalı.
const KEYS: TranslationKey[] = [
  'profile_scoreRefreshFailed',
  'profile_addVideo',
  'profile_videoAlertTitle',
  'profile_howToAddVideo',
  'profile_videoAdded',
  'profile_videoUploadFailed',
  'aiCv_title',
  'aiCv_createButton',
  'aiCv_saved',
  'aiCv_failed',
  'aiCv_position',
  'aiCv_age',
  'aiCv_height',
  'aiCv_weight',
  'aiCv_foot',
  'aiCv_location',
  'aiCv_club',
  'aiCv_profileScore',
  'aiCv_aiRating',
  'aiCv_strengths',
  'aiCv_about',
  'home_taskAiCvTitle',
  'home_taskAiCvDesc',
  'home_taskAiAnalysisTitle',
  'home_taskAiAnalysisDesc',
  'home_taskVideoTitle',
  'home_taskVideoDesc',
  'badges_autoGranted',
];

test('every key added in this round has a translation in English and Turkish', () => {
  for (const key of KEYS) {
    assert.notEqual(t(key, 'en'), key, `missing en: ${key}`);
    assert.notEqual(t(key, 'tr'), key, `missing tr: ${key}`);
  }
});
