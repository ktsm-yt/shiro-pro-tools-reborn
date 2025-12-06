import { describe, it, expect } from 'vitest';
import { analyzeBuffText, analyzeCharacter } from './analyzer';
import type { RawCharacterData } from './types';

describe('analyzeBuffText', () => {
    describe('基本的なパーセントバフ', () => {
        it('should parse "攻撃力+30%" correctly', () => {
            const result = analyzeBuffText('攻撃力+30%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 30,
                target: 'self',
            });
        });

        it('should parse "防御力+20%" correctly', () => {
            const result = analyzeBuffText('防御力+20%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: 20,
                target: 'self',
            });
        });

        it('should parse "射程+15%" correctly', () => {
            const result = analyzeBuffText('射程+15%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'range',
                mode: 'percent_max',
                value: 15,
                target: 'self',
            });
        });
    });

    describe('固定値バフ', () => {
        it('should parse "攻撃力+50" as flat buff', () => {
            const result = analyzeBuffText('攻撃力+50');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'flat_sum',
                value: 50,
            });
        });
    });

    describe('範囲バフ', () => {
        it('should parse "範囲内の味方の攻撃力+20%"', () => {
            const result = analyzeBuffText('範囲内の味方の攻撃力+20%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 20,
                target: 'range',
            });
        });

        it('should parse "範囲内の味方の防御力+15%"', () => {
            const result = analyzeBuffText('範囲内の味方の防御力+15%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: 15,
                target: 'range',
            });
        });
    });

    describe('全体バフ', () => {
        it('should parse "味方全体の攻撃力+10%"', () => {
            const result = analyzeBuffText('味方全体の攻撃力+10%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 10,
                target: 'all',
            });
        });
    });

    describe('複数バフ', () => {
        it('should parse multiple buffs in one text', () => {
            const result = analyzeBuffText('攻撃力+30%、防御力+20%');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                value: 30,
            });
            expect(result[1]).toMatchObject({
                stat: 'defense',
                value: 20,
            });
        });
    });

    describe('バフが無い場合', () => {
        it('should return empty array for non-buff text', () => {
            const result = analyzeBuffText('通常攻撃');
            expect(result).toHaveLength(0);
        });

        it('should return empty array for empty string', () => {
            const result = analyzeBuffText('');
            expect(result).toHaveLength(0);
        });
    });
    describe('新しいバフパターン', () => {
        it('should parse "攻撃が1.5倍" correctly', () => {
            const result = analyzeBuffText('攻撃が1.5倍');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 50, // (1.5 - 1) * 100
            });
        });

        it('should parse "敵の防御が20%低下" correctly', () => {
            const result = analyzeBuffText('敵の防御が20%低下');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: -20,
            });
        });

        it('should parse "与ダメージが30%上昇" correctly', () => {
            const result = analyzeBuffText('与ダメージが30%上昇');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'damage_dealt',
                mode: 'percent_max',
                value: 30,
            });
        });

        it('should parse "被ダメージを25%軽減" correctly', () => {
            const result = analyzeBuffText('被ダメージを25%軽減');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'damage_taken',
                mode: 'percent_max',
                value: -25,
            });
        });

        it('should parse "射程+20" correctly', () => {
            const result = analyzeBuffText('射程+20');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'range',
                mode: 'flat_sum',
                value: 20,
            });
        });
    });
});

describe('analyzeCharacter', () => {
    it('should convert RawCharacterData to Character', () => {
        const rawData: RawCharacterData = {
            name: '江戸城',
            url: 'http://example.com',
            weapon: '刀',
            attributes: ['平'],
            baseStats: {
                attack: 150,
                defense: 100,
                range: 200,
            },
            skillTexts: ['攻撃力+30%'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        expect(character.name).toBe('江戸城');
        expect(character.weapon).toBe('刀');
        expect(character.attributes).toEqual(['平']);
        expect(character.skills).toHaveLength(1);
        expect(character.skills[0]).toMatchObject({
            stat: 'attack',
            mode: 'percent_max',
            value: 30,
            source: 'self_skill',
        });
    });

    it('should handle multiple skills', () => {
        const rawData: RawCharacterData = {
            name: 'テストキャラ',
            url: 'http://example.com',
            weapon: '槍',
            attributes: ['水'],
            baseStats: {},
            skillTexts: ['攻撃力+20%', '範囲内の味方の防御力+15%'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        expect(character.skills).toHaveLength(2);
        expect(character.skills[0].stat).toBe('attack');
        expect(character.skills[1].stat).toBe('defense');
        expect(character.skills[1].target).toBe('range');
    });

    it('should handle cooldown reduction', () => {
        const rawData: RawCharacterData = {
            name: 'テストキャラ',
            url: 'http://example.com',
            weapon: '鈴',
            attributes: ['平'],
            baseStats: {},
            skillTexts: ['再配置時間が30%短縮'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);
        expect(character.skills[0]).toMatchObject({
            stat: 'cooldown',
            mode: 'percent_max',
            value: -30,
        });
    });

    it('should handle recovery boost', () => {
        const rawData: RawCharacterData = {
            name: 'テストキャラ',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: ['回復が50上昇'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);
        expect(character.skills[0]).toMatchObject({
            stat: 'recovery',
            mode: 'flat_sum',
            value: 50,
        });
    });
});
