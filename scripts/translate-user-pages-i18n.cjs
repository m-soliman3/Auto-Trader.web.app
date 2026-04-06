#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { translate } = require('bing-translate-api');

const ROOT = process.cwd();
const I18N_DIR = path.join(ROOT, 'public', 'i18n');
const EN_PATH = path.join(I18N_DIR, 'en.json');
const LOCALES = ['de', 'es', 'fr', 'pt', 'ar'];
const TARGET_NAMESPACES = [
  'userPages',
  'dashboard',
  'exchanges',
  'bots',
  'strategies',
  'portfolioManagement',
  'backendRunner',
];

const LANG_MAP = { de: 'de', es: 'es', fr: 'fr', pt: 'pt', ar: 'ar' };

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectStrings(obj, prefix = '', out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.push([dotted, value]);
    } else if (isObject(value)) {
      collectStrings(value, dotted, out);
    }
  }
  return out;
}

function getAtPath(obj, dotted) {
  return dotted.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

function setAtPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function shouldTranslate(text) {
  const source = String(text || '').trim();
  if (!source) return false;
  if (/^[\d\s%+\-.,:;!?()\[\]{}'"/\\|<>@#$^&*=~`_]+$/.test(source)) return false;
  if (/^[\u2013\u2014\-—]+$/.test(source)) return false;
  return true;
}

function protectTokens(text) {
  const tokens = [];
  let out = text;
  const patterns = [
    /\{\{\s*[^}]+\s*\}\}/g,
    /\{\d+\}/g,
    /%\{[^}]+\}/g,
  ];

  for (const pattern of patterns) {
    out = out.replace(pattern, (match) => {
      const token = `__PH_${tokens.length}__`;
      tokens.push(match);
      return token;
    });
  }

  return { out, tokens };
}

function restoreTokens(text, tokens) {
  let out = text;
  tokens.forEach((tokenValue, index) => {
    const marker = `__PH_${index}__`;
    out = out.split(marker).join(tokenValue);
  });
  return out;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithRetry(text, to, maxAttempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { out, tokens } = protectTokens(text);
      const result = await Promise.race([
        translate(out, null, to),
        new Promise((_, reject) => setTimeout(() => reject(new Error('translate timeout')), 15000)),
      ]);
      const translated = restoreTokens(result.translation || out, tokens);
      return translated;
    } catch (error) {
      lastError = error;
      await sleep(300 * attempt);
    }
  }
  throw lastError;
}

async function main() {
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  const sourcePairs = [];
  for (const namespace of TARGET_NAMESPACES) {
    if (isObject(en[namespace])) {
      collectStrings(en[namespace], namespace, sourcePairs);
    }
  }

  for (const locale of LOCALES) {
    const localePath = path.join(I18N_DIR, `${locale}.json`);
    const current = JSON.parse(fs.readFileSync(localePath, 'utf8'));

    let translatedCount = 0;
    let copiedCount = 0;
    let processed = 0;

    for (const [key, enValue] of sourcePairs) {
      processed += 1;
      if (processed % 40 === 0) {
        console.log(`${locale}: processed ${processed}/${sourcePairs.length}`);
      }

      const currentValue = getAtPath(current, key);
      const needsUpdate =
        typeof currentValue !== 'string' ||
        currentValue.trim() === '' ||
        currentValue === enValue;

      if (!needsUpdate) continue;

      if (!shouldTranslate(enValue)) {
        setAtPath(current, key, enValue);
        copiedCount += 1;
        continue;
      }

      try {
        const translated = await translateWithRetry(enValue, LANG_MAP[locale]);
        setAtPath(current, key, translated);
        translatedCount += 1;
      } catch (error) {
        setAtPath(current, key, enValue);
        copiedCount += 1;
      }

      await sleep(60);
    }

    fs.writeFileSync(localePath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    console.log(`${locale}: translated ${translatedCount}, copied ${copiedCount}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
