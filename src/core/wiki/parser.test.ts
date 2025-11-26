import { describe, it, expect } from 'vitest';
import { parseWikiHTML } from './parser';
import type { RawCharacterData } from './types';

describe('parseWikiHTML', () => {
    describe('基本情報の抽出', () => {
        it('should parse character name correctly', () => {
            const html = `
                <html>
                <body>
                    <h1 id="firstHeading">江戸城</h1>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.name).toBe('江戸城');
        });

        it('should parse weapon type correctly', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>武器種</th><td>刀</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.weapon).toBe('刀');
        });

        it('should parse attributes correctly', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>属性</th><td>平</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.attributes).toEqual(['平']);
        });

        it('should handle multiple attributes', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>属性</th><td>平/水</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.attributes).toEqual(['平', '水']);
        });
    });

    describe('ステータスの抽出', () => {
        it('should parse attack stat', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>攻撃力</th><td>150</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.baseStats.attack).toBe(150);
        });

        it('should parse defense stat', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>防御力</th><td>100</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.baseStats.defense).toBe(100);
        });

        it('should parse range stat', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr><th>射程</th><td>200</td></tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.baseStats.range).toBe(200);
        });
    });

    describe('特技テキストの抽出', () => {
        it('should extract skill text', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr>
                            <th>特技</th>
                            <td>攻撃力+30%</td>
                        </tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.skillTexts).toHaveLength(1);
            expect(result.skillTexts[0]).toBe('攻撃力+30%');
        });

        it('should extract multiple skills', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr>
                            <th>特技1</th>
                            <td>攻撃力+30%</td>
                        </tr>
                        <tr>
                            <th>特技2</th>
                            <td>範囲内の味方の防御力+20%</td>
                        </tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.skillTexts).toHaveLength(2);
            expect(result.skillTexts[0]).toBe('攻撃力+30%');
            expect(result.skillTexts[1]).toBe('範囲内の味方の防御力+20%');
        });
    });

    describe('計略テキストの抽出', () => {
        it('should extract strategy text', () => {
            const html = `
                <html>
                <body>
                    <table class="wikitable">
                        <tr>
                            <th>計略</th>
                            <td>範囲内の敵の攻撃を20秒間停止</td>
                        </tr>
                    </table>
                </body>
                </html>
            `;
            const result = parseWikiHTML(html);
            expect(result.strategyTexts).toHaveLength(1);
            expect(result.strategyTexts[0]).toBe('範囲内の敵の攻撃を20秒間停止');
        });
    });

    describe('統合テスト', () => {
        it('should parse complete character data', () => {
            const html = `
                <html>
                <body>
                    <h1 id="firstHeading">江戸城</h1>
                    <table class="wikitable">
                        <tr><th>武器種</th><td>刀</td></tr>
                        <tr><th>属性</th><td>平</td></tr>
                        <tr><th>攻撃力</th><td>150</td></tr>
                        <tr><th>防御力</th><td>100</td></tr>
                        <tr><th>射程</th><td>200</td></tr>
                        <tr><th>特技</th><td>攻撃力+30%</td></tr>
                        <tr><th>計略</th><td>味方全体の攻撃力+20%</td></tr>
                    </table>
                </body>
                </html>
            `;

            const result = parseWikiHTML(html);

            expect(result.name).toBe('江戸城');
            expect(result.weapon).toBe('刀');
            expect(result.attributes).toEqual(['平']);
            expect(result.baseStats.attack).toBe(150);
            expect(result.baseStats.defense).toBe(100);
            expect(result.baseStats.range).toBe(200);
            expect(result.skillTexts).toHaveLength(1);
            expect(result.strategyTexts).toHaveLength(1);
        });
    });
});
