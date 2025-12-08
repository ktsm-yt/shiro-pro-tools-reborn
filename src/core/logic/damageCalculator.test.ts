/**
 * ダメージ計算ロジックのユニットテスト
 */

import { describe, test, expect } from 'vitest';
import { calculateDamage, calculateDamageComparison, formatCompactNumber, truncateName } from './damageCalculator';
import type { Character, EnvironmentSettings } from '../types';

describe('damageCalculator', () => {
    // テスト用の基本的な環境設定
    const defaultEnvironment: EnvironmentSettings = {
        inspireFlat: 0,
        duplicateBuff: 0,
        attackPercent: 0,
        damageDealt: 0,
        damageMultiplier: 1,
        attackSpeed: 0,
        gapReduction: 0,
        enemyDefense: 0,
        defenseDebuffPercent: 0,
        defenseDebuffFlat: 0,
        damageTaken: 0,
        enemyHpPercent: 100,
    };

    // テスト用の基本的なキャラクター
    const createTestCharacter = (overrides?: Partial<Character>): Character => ({
        id: 'test-char',
        name: 'テストキャラ',
        weapon: '刀',
        attributes: [],
        baseStats: {
            hp: 0,
            attack: 1000,
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
            give_damage: 0,
            inspire: 0,
            attack_count: 0,
        },
        skills: [],
        strategies: [],
        selfBuffs: {
            percentBuffs: [],
            flatBuffs: [],
            additiveBuffs: [],
            duplicateBuffs: [],
            damageMultipliers: [],
            defenseIgnore: false,
        },
        ...overrides,
    });

    describe('Phase 1: 攻撃力の確定', () => {
        test('基礎攻撃力のみ', () => {
            const character = createTestCharacter();
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.phase1Attack).toBe(1000);
        });

        test('割合バフの適用', () => {
            const character = createTestCharacter({
                selfBuffs: {
                    percentBuffs: [{ value: 30, type: 'self' }],
                    flatBuffs: [],
                    additiveBuffs: [],
                    duplicateBuffs: [],
                    damageMultipliers: [],
                    defenseIgnore: false,
                },
            });
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.phase1Attack).toBe(1300); // 1000 × 1.3
        });

        test('固定値バフの適用', () => {
            const character = createTestCharacter({
                selfBuffs: {
                    percentBuffs: [],
                    flatBuffs: [100],
                    additiveBuffs: [],
                    duplicateBuffs: [],
                    damageMultipliers: [],
                    defenseIgnore: false,
                },
            });
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.phase1Attack).toBe(1100); // 1000 + 100
        });

        test('効果重複バフの適用', () => {
            const character = createTestCharacter({
                selfBuffs: {
                    percentBuffs: [],
                    flatBuffs: [],
                    additiveBuffs: [],
                    duplicateBuffs: [20],
                    damageMultipliers: [],
                    defenseIgnore: false,
                },
            });
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.phase1Attack).toBe(1200); // 1000 × 1.2
        });

        test('鼓舞（環境設定）の適用', () => {
            const character = createTestCharacter();
            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                inspireFlat: 500,
            };
            const result = calculateDamage(character, environment);

            expect(result.phase1Attack).toBe(1500); // 1000 + 500
        });

        test('複合バフの適用', () => {
            const character = createTestCharacter({
                selfBuffs: {
                    percentBuffs: [{ value: 40, type: 'self' }],
                    flatBuffs: [100],
                    additiveBuffs: [],
                    duplicateBuffs: [20],
                    damageMultipliers: [],
                    defenseIgnore: false,
                },
            });
            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                inspireFlat: 500,
                duplicateBuff: 20,
            };
            const result = calculateDamage(character, environment);

            // (1000 × 1.4 + 100 + 500 × 1.4) × 1.4 = (1400 + 100 + 700) × 1.4 = 3080
            expect(result.phase1Attack).toBeCloseTo(3080, 0);
        });
    });

    describe('Phase 3: 防御力による減算', () => {
        test('防御力がない場合', () => {
            const character = createTestCharacter();
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.phase3Damage).toBe(1000);
        });

        test('防御力による減算', () => {
            const character = createTestCharacter();
            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                enemyDefense: 300,
            };
            const result = calculateDamage(character, environment);

            expect(result.phase3Damage).toBe(700); // 1000 - 300
        });

        test('防御無視', () => {
            const character = createTestCharacter({
                selfBuffs: {
                    percentBuffs: [],
                    flatBuffs: [],
                    additiveBuffs: [],
                    duplicateBuffs: [],
                    damageMultipliers: [],
                    defenseIgnore: true,
                },
            });
            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                enemyDefense: 300,
            };
            const result = calculateDamage(character, environment);

            expect(result.phase3Damage).toBe(1000); // 防御無視
        });

        test('最低ダメージ保証', () => {
            const character = createTestCharacter();
            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                enemyDefense: 2000, // 攻撃力より高い
            };
            const result = calculateDamage(character, environment);

            expect(result.phase3Damage).toBe(1); // 最低1保証
        });
    });

    describe('Phase 5: 連撃による乗算', () => {
        test('連撃なし', () => {
            const character = createTestCharacter();
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.totalDamage).toBe(1000);
        });

        test('5連撃', () => {
            const character = createTestCharacter({
                multiHit: 5,
            });
            const result = calculateDamage(character, defaultEnvironment);

            expect(result.totalDamage).toBe(5000); // 1000 × 5
        });
    });

    describe('DPS計算', () => {
        test('刀のDPS', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 刀: attack=19, gap=22, total=41
            // 攻撃/秒 = 60 / 41 ≈ 1.463
            // DPS = 1000 × 1.463 ≈ 1463
            expect(result.dps).toBeCloseTo(1463, 0);
        });

        test('攻撃速度バフの適用', () => {
            const character = createTestCharacter({
                weapon: '刀',
                selfBuffs: {
                    percentBuffs: [],
                    flatBuffs: [],
                    additiveBuffs: [],
                    duplicateBuffs: [],
                    damageMultipliers: [],
                    defenseIgnore: false,
                    attackSpeed: 30,
                },
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 攻撃フレーム = 19 / 1.3 ≈ 14.6
            // 合計フレーム = 14.6 + 22 = 36.6
            // 攻撃/秒 = 60 / 36.6 ≈ 1.639
            // DPS = 1000 × 1.639 ≈ 1639
            expect(result.dps).toBeCloseTo(1639, 0);
        });
    });

    describe('差分計算', () => {
        test('ダメージ差分の計算', () => {
            const character = createTestCharacter();
            const before = calculateDamage(character, defaultEnvironment);

            const environment: EnvironmentSettings = {
                ...defaultEnvironment,
                damageTaken: 50, // 被ダメ+50%
            };
            const after = calculateDamage(character, environment);

            const comparison = calculateDamageComparison(before, after);

            expect(comparison.diff.totalDamage).toBe(500); // 1500 - 1000
            expect(comparison.diff.totalDamagePercent).toBe(50);
        });
    });

    describe('ユーティリティ関数', () => {
        test('formatCompactNumber', () => {
            expect(formatCompactNumber(500)).toBe('500');
            expect(formatCompactNumber(1500)).toBe('1.5K');
            expect(formatCompactNumber(15234)).toBe('15.2K');
            expect(formatCompactNumber(1500000)).toBe('1.5M');
        });

        test('truncateName', () => {
            expect(truncateName('絢爛ダノター城', 4)).toBe('絢爛ダノ');
            expect(truncateName('短い名前', 10)).toBe('短い名前');
        });
    });
});
