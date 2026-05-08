#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { translate } from '@vitalets/google-translate-api';
import { translate as bingTranslate } from 'bing-translate-api';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const learnSourcePath = path.join(rootDir, 'src/app/pages/learn/learn-detail.ts');
const i18nDir = path.join(rootDir, 'public/i18n');
const englishFilePath = path.join(i18nDir, 'en.json');
const syncStatePath = path.join(i18nDir, '.learn-pages-sync-state.json');

const targetLocales = process.env.I18N_LOCALES
  ? process.env.I18N_LOCALES.split(',').map((value) => value.trim()).filter(Boolean)
  : ['de', 'es', 'fr', 'pt', 'ar'];
const targetSlugs = process.env.I18N_SLUGS
  ? process.env.I18N_SLUGS.split(',').map((value) => value.trim()).filter(Boolean)
  : null;
const hosts = [
  'translate.google.com',
  'translate.google.de',
  'translate.google.es',
  'translate.google.fr',
  'translate.googleapis.com',
];

const providers = process.env.I18N_TRANSLATE_PROVIDERS
  ? process.env.I18N_TRANSLATE_PROVIDERS.split(',').map((value) => value.trim()).filter(Boolean)
  : ['google', 'bing'];

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function flattenStringLeaves(input, prefix = '', out = {}) {
  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      flattenStringLeaves(item, `${prefix}.${index}`, out);
    });
    return out;
  }

  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenStringLeaves(value, nextPrefix, out);
    }
    return out;
  }

  if (typeof input === 'string') {
    out[prefix] = input;
  }

  return out;
}

function setNested(target, dottedPath, value) {
  const keys = dottedPath.split('.');
  let cursor = target;

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const isLast = index === keys.length - 1;
    const nextKey = keys[index + 1];
    const nextIsIndex = Number.isInteger(Number(nextKey));

    if (isLast) {
      cursor[key] = value;
      return;
    }

    if (!(key in cursor)) {
      cursor[key] = nextIsIndex ? [] : {};
    }

    cursor = cursor[key];
  }
}

function getNested(target, dottedPath) {
  return dottedPath
    .split('.')
    .reduce((cursor, segment) => (cursor && segment in cursor ? cursor[segment] : undefined), target);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitLongText(text, maxLength = 850) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  const paragraphs = text.split('\n\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let buffer = '';

    for (const sentence of sentences) {
      if (!sentence) {
        continue;
      }

      if ((buffer ? `${buffer} ${sentence}` : sentence).length <= maxLength) {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
        continue;
      }

      if (buffer) {
        chunks.push(buffer);
      }

      if (sentence.length <= maxLength) {
        buffer = sentence;
        continue;
      }

      for (let index = 0; index < sentence.length; index += maxLength) {
        chunks.push(sentence.slice(index, index + maxLength));
      }
      buffer = '';
    }

    if (buffer) {
      chunks.push(buffer);
    }
  }

  return chunks;
}

function buildLearnPagesPayload(pages) {
  const result = {};

  for (const [slug, page] of Object.entries(pages)) {
    result[slug] = {
      title: page.title,
      tagline: page.tagline,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      overview: page.overview,
      howItWorks: page.howItWorks,
      externalLinks: page.externalLinks.map((link) => ({
        label: link.label,
        description: link.description,
      })),
    };
  }

  return result;
}

async function readJson(filePath, fallback = {}) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function loadLearnPagesFromSource() {
  const source = await fs.readFile(learnSourcePath, 'utf8');
  const match = source.match(/export const LEARN_PAGES[^=]*=\s*(\{[\s\S]*?\n\});\s*\n\n@Component/);
  if (!match) {
    throw new Error('Could not locate LEARN_PAGES object in learn-detail.ts');
  }

  return vm.runInNewContext(`(${match[1]})`);
}

async function translateTextWithGoogle(text, locale) {
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const host = hosts[attempt % hosts.length];
    try {
      const response = await translate(text, { from: 'en', to: locale, host });
      return response.text;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const retryable = message.includes('too many requests') || message.includes('429');

      if (!retryable || attempt === maxAttempts - 1) {
        throw error;
      }

      await sleep(5000 * (attempt + 1));
    }
  }

  throw new Error(`Google translation failed for ${locale}`);
}

async function translateTextWithBing(text, locale) {
  const chunks = splitLongText(text, 850);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const result = await bingTranslate(chunk, 'en', locale);
    translatedChunks.push(result.translation);
    await sleep(150);
  }

  return translatedChunks.join('\n\n');
}

async function translateText(text, locale) {
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === 'google') {
        return await translateTextWithGoogle(text, locale);
      }

      if (provider === 'bing') {
        return await translateTextWithBing(text, locale);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
    }
  }

  throw new Error(`Failed to translate text for ${locale}. ${errors.join(' | ')}`);
}

async function main() {
  const learnPages = await loadLearnPagesFromSource();
  const learnPagesPayload = buildLearnPagesPayload(learnPages);
  const englishCatalog = await readJson(englishFilePath, {});

  englishCatalog.learnPages = learnPagesPayload;
  await writeJson(englishFilePath, englishCatalog);

  const syncState = await readJson(syncStatePath, { locales: {} });

  for (const locale of targetLocales) {
    const localePath = path.join(i18nDir, `${locale}.json`);
    const localeCatalog = await readJson(localePath, {});
    const localeState = syncState.locales[locale] ?? {};
    let translatedCount = 0;
    let checkpointCounter = 0;

    for (const [slug, slugValue] of Object.entries(learnPagesPayload)) {
      if (targetSlugs && !targetSlugs.includes(slug)) {
        continue;
      }

      const slugLeaves = flattenStringLeaves(slugValue, `learnPages.${slug}`);
      const pending = [];

      for (const [key, sourceText] of Object.entries(slugLeaves)) {
        const sourceHash = sha256(sourceText);
        const existingValue = getNested(localeCatalog, key);
        const needsTranslate = typeof existingValue !== 'string' || localeState[key] !== sourceHash;

        if (!needsTranslate) {
          continue;
        }

        pending.push({
          key,
          sourceText,
          sourceHash,
        });
      }

      if (pending.length === 0) {
        continue;
      }

      for (const item of pending) {
        let translated;
        try {
          translated = await translateText(item.sourceText, locale);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Translation failed for ${locale} at ${item.key}: ${message}`);
        }

        setNested(localeCatalog, item.key, translated);
        localeState[item.key] = item.sourceHash;
        translatedCount += 1;
        checkpointCounter += 1;
      }

      if (checkpointCounter >= 10) {
        syncState.locales[locale] = localeState;
        await writeJson(localePath, localeCatalog);
        await writeJson(syncStatePath, syncState);
        checkpointCounter = 0;
      }
    }

    syncState.locales[locale] = localeState;
    await writeJson(localePath, localeCatalog);
    console.log(`[${locale}] translated ${translatedCount} changed strings.`);
  }

  await writeJson(syncStatePath, syncState);
  console.log('Learn pages i18n sync completed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
