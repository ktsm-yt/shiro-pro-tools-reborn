import { describe, it, expect } from 'vitest';
import { checkCondition, extractConditionTags, getDisplayLevel } from './conditions';
import type { Character, ConditionContext, Stat } from './types';

const createBaseStats = (): Record<Stat, number> => ({
    hp: 0,
    attack: 0,
    defense: 0,
    range: 0,
    recovery: 0,
    cooldown: 0,
    cost: 0,
    damage_dealt: 0,
    damage_taken: 0,
    attack_speed: 0,
    attack_gap: 0,
    movement_speed: 0,
    knockback: 0,
    target_count: 0,
    ki_gain: 0,
    damage_drain: 0,
    ignore_defense: 0,
    enemy_attack: 0,
    enemy_defense: 0,
    enemy_defense_ignore_complete: 0,
    enemy_defense_ignore_percent: 0,
    enemy_movement: 0,
    enemy_knockback: 0,
    strategy_cooldown: 0,
    damage_recovery: 0,
    critical_bonus: 0,
    give_damage: 0,
    inspire: 0,
    attack_count: 0,
    enemy_range: 0,
});

const baseChar: Character = {
    id: 'c1',
    name: 'Test',
    weapon: '刀',
    weaponRange: '近',
    weaponType: '物',
    attributes: ['平'],
    baseStats: createBaseStats(),
    skills: [],
    strategies: [],
    seasonAttributes: [],
};

describe('extractConditionTags', () => {
    it('ignores excluded keywords like 計略中', () => {
        const tags = extractConditionTags('計略中、攻撃が50%上昇');
        expect(tags).toEqual([]);
    });

    it('detects weapon and attribute conditions', () => {
        const tags = extractConditionTags('近接武器の水属性城娘の攻撃が30%上昇');
        expect(tags).toEqual(expect.arrayContaining(['melee', 'water']));
    });

    it('detects new bride season tag', () => {
        const tags = extractConditionTags('花嫁属性の城娘のみ攻撃が20%上昇');
        expect(tags).toContain('bride');
    });
});

describe('checkCondition', () => {
    it('evaluates hp-based conditions using context', () => {
        const context: ConditionContext = { allyHpPercent: 40 };
        expect(checkCondition('hp_below_50', baseChar, context)).toBe(true);
        expect(checkCondition('hp_above_70', baseChar, context)).toBe(false);
    });

    it('matches season attributes populated from period/seasonAttributes', () => {
        const char: Character = {
            ...baseChar,
            id: 'c2',
            seasonAttributes: ['絢爛'],
        };
        expect(checkCondition('kenran', char)).toBe(true);
    });
});

describe('getDisplayLevel', () => {
    it('returns levels based on priority thresholds', () => {
        expect(getDisplayLevel('hp_above_50')).toBe('prominent');
        expect(getDisplayLevel('melee')).toBe('normal');
        expect(getDisplayLevel('night_battle')).toBe('subtle');
    });
});
