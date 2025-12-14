import { describe, it, expect } from 'vitest';
import { calcBuffMatrix, isBuffApplicable } from './buffs';
import type { Character, Formation, Buff } from '../types';

// テスト用ダミーデータ作成ヘルパー
const createMockBuff = (
    id: string,
    stat: 'attack' | 'defense',
    mode: 'percent_max' | 'flat_sum',
    value: number,
    target: 'self' | 'range' | 'all' = 'self'
): Buff => ({
    id,
    stat,
    mode,
    value,
    source: 'self_skill',
    target,
    isActive: true,
});

const createMockChar = (id: string, name: string, buffs: Buff[] = []): Character => ({
    id,
    name,
    weapon: '刀',
    attributes: ['平'],
    baseStats: {
        hp: 1000,
        attack: 100,
        defense: 50,
        range: 200,
        recovery: 0,
        cooldown: 30,
        cost: 10,
        damage_dealt: 0,
        damage_taken: 0,
        attack_speed: 0,
        attack_gap: 0,
        movement_speed: 0,
        retreat: 0,
        target_count: 0,
        ki_gain: 0,
        damage_drain: 0,
        ignore_defense: 0,
    },
    skills: buffs,
    strategies: [],
    specialAbilities: [],
});

describe('calcBuffMatrix', () => {
    it('should calculate self buffs correctly', () => {
        const buff1 = createMockBuff('b1', 'attack', 'percent_max', 20, 'self'); // 攻撃+20%
        const char1 = createMockChar('c1', 'TestChar', [buff1]);
        const formation: Formation = { slots: [char1, null, null, null, null, null, null, null] };

        const result = calcBuffMatrix(formation);

        expect(result['c1']).toBeDefined();
        // 20% 上昇 -> 100 * 1.2 = 120
        expect(result['c1'].stats.attack).toBe(120);
    });

    it('should apply max rule for percent buffs', () => {
        const buff1 = createMockBuff('b1', 'attack', 'percent_max', 20, 'self');
        const buff2 = createMockBuff('b2', 'attack', 'percent_max', 30, 'self'); // こちらが優先されるべき
        const char1 = createMockChar('c1', 'TestChar', [buff1, buff2]);
        const formation: Formation = { slots: [char1] };

        const result = calcBuffMatrix(formation);

        // 最大の30%のみ適用: 100 * 1.3 = 130
        expect(result['c1'].stats.attack).toBe(130);
    });

    it('should apply sum rule for flat buffs', () => {
        const buff1 = createMockBuff('b1', 'attack', 'flat_sum', 50, 'self');
        const buff2 = createMockBuff('b2', 'attack', 'flat_sum', 30, 'self');
        const char1 = createMockChar('c1', 'TestChar', [buff1, buff2]);
        const formation: Formation = { slots: [char1] };

        const result = calcBuffMatrix(formation);

        // 基礎100 + 50 + 30 = 180
        expect(result['c1'].stats.attack).toBe(180);
    });
});

describe('isBuffApplicable', () => {
    it('should return true for self target on same char', () => {
        const buff = createMockBuff('b1', 'attack', 'percent_max', 10, 'self');
        const char1 = createMockChar('c1', 'TestChar');
        expect(isBuffApplicable(buff, char1, char1)).toBe(true);
    });

    it('should return false for self target on different char', () => {
        const buff = createMockBuff('b1', 'attack', 'percent_max', 10, 'self');
        const char1 = createMockChar('c1', 'TestChar');
        const char2 = createMockChar('c2', 'OtherChar');
        expect(isBuffApplicable(buff, char1, char2)).toBe(false);
    });
});
