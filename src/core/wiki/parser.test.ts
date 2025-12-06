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

  it('should extract attributes from images (alt text)', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><th>城属性</th><td><img alt="平山.png" src="hirayama.png"></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.attributes).toContain('平山');
  });

  it('should extract skills and strategies with complex headers', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><th>[無印]特技</th><td>攻撃強化</td><td>自身の攻撃が20%上昇</td></tr>
            <tr><th>[改壱]特技</th><td>真・攻撃強化</td><td>自身の攻撃が30%上昇</td></tr>
            <tr><th>[無印]計略</th><td>気:10 秒:40</td><td>火計</td><td>範囲内の敵にダメージ</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.skillTexts).toContain('自身の攻撃が30%上昇');
    expect(result.strategyTexts).toContain('範囲内の敵にダメージ');
  });

  it('should handle irregular tables (missing headers)', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><td><a href="武器/槍">槍</a></td><td><a href="属性/山">山</a></td></tr>
          </table>
          <table>
            <tr><td>耐久</td><td>2000</td></tr>
            <tr><td>攻撃</td><td>400</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.weapon).toBe('槍');
    expect(result.attributes).toContain('山');
    expect(result.baseStats.hp).toBe(2000);
    expect(result.baseStats.attack).toBe(400);
  });

  it('should extract weapon and attributes from images', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr><th>武器属性</th><td><img alt="鉄砲" src="gun.png"></td></tr>
            <tr><th>城属性</th><td><img alt="平山属性" src="hirayama.png"><img alt="水属性" src="water.png"></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.weapon).toBe('鉄砲');
    expect(result.attributes).toContain('平山');
    expect(result.attributes).toContain('水');
  });

  it('should extract skill description from complex row structure', () => {
    const mockHtml = `
      <html>
        <head><title>テストキャラ - Wiki</title></head>
        <body>
          <table>
            <tr>
              <th>[無印]特技</th>
              <td><b>攻撃強化</b><br>自身の攻撃が25%上昇</td>
              <td>自身の攻撃が25%上昇</td>
            </tr>
             <tr>
              <th>[改壱]特技</th>
              <td><b>真・攻撃強化</b></td>
              <td>自身の攻撃が35%上昇。射程が20上昇。</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.skillTexts).toContain('自身の攻撃が35%上昇。射程が20上昇。');
  });

  it('should extract period, weapon range, type and placement', () => {
    const mockHtml = `
      <html>
        <head><title>［絢爛］江戸城 - 御城プロジェクトRE Wiki</title></head>
        <body>
          <table>
            <tr><td><a href="武器/刀">刀</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.name).toBe('江戸城');
    expect(result.period).toBe('絢爛');
    expect(result.weapon).toBe('刀');
    expect(result.weaponRange).toBe('近');
    expect(result.weaponType).toBe('物');
    expect(result.placement).toBe('近');
  });

  it('should prefer giant stats and keep correct attribute/weapon for ［天化］志波城', () => {
    const mockHtml = `
      <html>
        <head><title>［天化］志波城 - 御城プロジェクトRE Wiki</title></head>
        <body>
          <table>
            <tr><td>城属性</td><td><img alt="平.png" src="hei.png"></td></tr>
            <tr><td>武器属性</td><td><a href="/法術">法術</a>(毘錫)</td></tr>
            <tr><td colspan="2"><strong>初期配置/最大値</strong></td><td colspan="2"><strong>巨大化5回/最大値</strong></td></tr>
            <tr><td>耐久</td><td>1068/<span>2205</span></td><td>耐久</td><td>2242/<span>4630</span></td></tr>
            <tr><td>攻撃</td><td>98/<span>432</span></td><td>攻撃</td><td>186/<span>820</span></td></tr>
            <tr><td>防御</td><td>38/<span>163</span></td><td>防御</td><td>79/<span>342</span></td></tr>
            <tr><td>射程</td><td>270/<span>270</span></td><td>射程</td><td>486/<span>486</span></td></tr>
            <tr><td>回復</td><td>10/<span>34</span></td><td>回復</td><td>16/<span>54</span></td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');

    expect(result.name).toBe('志波城');
    expect(result.weapon).toBe('法術');
    expect(result.attributes).toEqual(['平']);
    expect(result.baseStats.hp).toBe(2242);
    expect(result.baseStats.attack).toBe(186);
    expect(result.baseStats.defense).toBe(79);
    expect(result.baseStats.range).toBe(486);
    expect(result.baseStats.recovery).toBe(16);
  });

  it('should ignore sidebar tables and read weapon/attr from main table', () => {
    const mockHtml = `
      <html>
        <head><title>テスト城 - Wiki</title></head>
        <body>
          <!-- サイドバー相当の外側テーブル（誤検出してほしくない） -->
          <table>
            <tr><td>
              <table>
                <tr><td>武器属性</td><td>刀</td></tr>
                <tr><td>城属性</td><td>平山</td></tr>
              </table>
            </td></tr>
          </table>

          <!-- 正しいメインテーブル（子テーブルを持たない） -->
          <table>
            <tr><th>武器属性</th><td><img alt="法術" src="hou.png" /></td></tr>
            <tr><th>城属性</th><td><img alt="平.png" src="hei.png" /></td></tr>
            <tr><th>特殊能力</th><td>スペシャル効果</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.weapon).toBe('法術');
    expect(result.attributes).toEqual(['平']);
    expect(result.specialTexts?.length).toBe(1);
  });

  it('maps 法術 to weapon info (range/type/placement)', () => {
    const mockHtml = `
      <html>
        <head><title>法術城 - Wiki</title></head>
        <body>
          <table>
            <tr><th>武器属性</th><td>法術</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseWikiHtml(mockHtml, 'http://example.com');
    expect(result.weapon).toBe('法術');
    expect(result.weaponRange).toBe('遠');
    expect(result.weaponType).toBe('術');
    expect(result.placement).toBe('遠');
  });
});
