import { describe, it, expect } from 'vitest';
import { calculateDamage } from './damage';
import type { Character, DamageCalculationContext } from '../types';

describe('calculateDamage', () => {
    const baseChar: Character = {
        id: 'test_char',
        name: 'Test Char',
        weapon: '刀',
        attributes: ['平'],
        baseStats: {
            attack: 100,
            defense: 50,
            range: 200,
            cooldown: 30,
            cost: 10,
            damage_dealt: 0,
            damage_taken: 0,
        },
        skills: [],
        strategies: [],
    };

    const defaultContext: DamageCalculationContext = {
        enemyDefense: 0,
        enemyHpPercent: 100,
        allyHpPercent: 100,
        hitCount: 1,
        isStrategyActive: false,
    };

    it('should calculate basic damage correctly (no buffs, no defense)', () => {
        const result = calculateDamage(baseChar, defaultContext);
        expect(result.finalAttack).toBe(100);
        expect(result.damagePerHit).toBe(100);
        expect(result.totalDamage).toBe(100);
    });

    it('should apply enemy defense correctly', () => {
        const context = { ...defaultContext, enemyDefense: 30 };
        const result = calculateDamage(baseChar, context);
        expect(result.damagePerHit).toBe(70); // 100 - 30
    });

    it('should handle damage not dropping below 0', () => {
        const context = { ...defaultContext, enemyDefense: 150 };
        const result = calculateDamage(baseChar, context);
        expect(result.damagePerHit).toBe(0);
    });

    it('should apply hit count', () => {
        const context = { ...defaultContext, hitCount: 2 };
        const result = calculateDamage(baseChar, context);
        expect(result.totalDamage).toBe(200); // 100 * 2
    });

    it('should calculate damage with buffs', () => {
        const charWithBuffs: Character = {
            ...baseChar,
            skills: [
                {
                    id: 'buff1',
                    stat: 'attack',
                    mode: 'percent_max',
                    value: 30,
                    source: 'self_skill',
                    target: 'self',
                    isActive: true,
                },
                {
                    id: 'buff2',
                    stat: 'attack',
                    mode: 'flat_sum',
                    value: 50,
                    source: 'self_skill',
                    target: 'self',
                    isActive: true,
                }
            ]
        };

        // 基礎100 + 固定50 = 150
        // 割合+30% = 1.3倍
        // 最終攻撃力 = 150 * 1.3 = 195
        const result = calculateDamage(charWithBuffs, defaultContext);
        expect(result.finalAttack).toBe(195);
        expect(result.damagePerHit).toBe(195);
    });

    it('should calculate damage with defense debuff', () => {
        const charWithDebuffs: Character = {
            ...baseChar,
            skills: [
                {
                    id: 'debuff1',
                    stat: 'defense',
                    mode: 'percent_max',
                    value: -20, // 敵防御20%ダウン
                    source: 'self_skill',
                    target: 'range',
                    isActive: true,
                }
            ]
        };

        const context = { ...defaultContext, enemyDefense: 100 };
        // 敵防御100 * (1 - 0.2) = 80
        // ダメージ = 100 - 80 = 20
        const result = calculateDamage(charWithDebuffs, context);
        expect(result.effectiveDefense).toBe(80);
        expect(result.damagePerHit).toBe(20);
    });
});
