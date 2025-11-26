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
});
