import { describe, it, expect } from 'vitest';
import { parseWikiHtml } from './parser';

describe('parseWikiHtml', () => {
  it('should extract character info from mock HTML', () => {
    const mockHtml = `
      <html>
        <head><title>江戸城 - 御城プロジェクトRE Wiki</title></head>
        <body>
          <table>
            <tr><td><a href="武器/刀">刀</a></td></tr>
            <tr><td><a href="属性/平">平</a></td></tr>
          </table>
          
          <table>
            <tr><th>特技</th><td>将軍の威光</td><td>自身の攻撃が30%上昇。全ての城娘の攻撃が20%上昇。</td></tr>
          </table>

          <table>
            <tr><th>計略</th><td>天下泰平</td><td>30秒間、対象の攻撃が2倍。</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');

    expect(result.name).toBe('江戸城');
    expect(result.weapon).toBe('刀');
    expect(result.attributes).toContain('平');
    expect(result.skillTexts).toContain('自身の攻撃が30%上昇。全ての城娘の攻撃が20%上昇。');
    expect(result.strategyTexts).toContain('30秒間、対象の攻撃が2倍。');
  });

  it('should extract baseStats from HTML table', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><th>耐久</th><td>1500</td></tr>
            <tr><th>攻撃</th><td>320</td></tr>
            <tr><th>防御</th><td>180</td></tr>
            <tr><th>射程</th><td>200</td></tr>
            <tr><th>回復</th><td>10</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');

    expect(result.baseStats.hp).toBe(1500);
    expect(result.baseStats.attack).toBe(320);
    expect(result.baseStats.defense).toBe(180);
    expect(result.baseStats.range).toBe(200);
    expect(result.baseStats.recovery).toBe(10);
  });

  it('should handle stats with multiple values in parentheses', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><th>耐久</th><td>1000(2000)</td></tr>
            <tr><th>攻撃</th><td>250(500)</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');

    // 最初の数値（レベル1の値）を抽出
    expect(result.baseStats.hp).toBe(1000);
    expect(result.baseStats.attack).toBe(250);
  });
});
