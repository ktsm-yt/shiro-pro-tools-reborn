/*
 * Batch-fetch and parse multiple Wiki pages.
 * Usage:
 *   node --loader ts-node/esm scripts/batch-wiki.ts https://scre.swiki.jp/index.php?江戸城 ...
 *   or: cat urls.txt | xargs node --loader ts-node/esm scripts/batch-wiki.ts
 * Output: JSON lines to stdout (one per URL) with parsed character and buff info.
 */

import { JSDOM } from 'jsdom';
import { parseWikiHtml } from '../src/core/wiki/parser';
import { analyzeCharacter } from '../src/core/wiki/analyzer';

// Polyfill DOMParser for parseWikiHtml
if (typeof (global as any).DOMParser === 'undefined') {
  (global as any).DOMParser = new JSDOM().window.DOMParser;
}

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('Usage: node --loader ts-node/esm scripts/batch-wiki.ts <url1> <url2> ...');
  process.exit(1);
}

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

async function run() {
  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const raw = parseWikiHtml(html, url);
      const character = analyzeCharacter(raw);

      const payload = {
        url,
        name: character.name,
        weapon: character.weapon,
        attributes: character.attributes,
        skillTexts: character.rawSkillTexts,
        strategyTexts: character.rawStrategyTexts,
        specialTexts: character.rawSpecialTexts,
        buffs: [...character.skills, ...character.strategies, ...(character.specialAbilities ?? [])]
          .map(b => ({ stat: b.stat, mode: b.mode, value: b.value, target: b.target, source: b.source })),
      };

      console.log(JSON.stringify(payload));
    } catch (err) {
      console.error(JSON.stringify({ url, error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

run();
