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
            retreat: 0,
            target_count: 0,
            ki_gain: 0,
            damage_drain: 0,
            ignore_defense: 0,
            enemy_attack: 0,
            enemy_defense: 0,
            enemy_defense_ignore_complete: 0,
            enemy_defense_ignore_percent: 0,
            enemy_movement: 0,
            enemy_retreat: 0,
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

        test('射程→攻撃変換（閾値なし）', () => {
            const character = createTestCharacter({
                baseStats: {
                    hp: 0,
                    attack: 1000,
                    defense: 0,
                    range: 400, // 基礎射程400
                    recovery: 0,
                    cooldown: 0,
                    cost: 0,
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
                    enemy_attack: 0,
                    enemy_defense: 0,
                    enemy_defense_ignore_complete: 0,
                    enemy_defense_ignore_percent: 0,
                    enemy_movement: 0,
                    enemy_retreat: 0,
                    strategy_cooldown: 0,
                    damage_recovery: 0,
                    give_damage: 0,
                    inspire: 0,
                    attack_count: 0,
                },
                rangeToAttack: { enabled: true },
                skills: [
                    {
                        id: 'range-buff',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 100,
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 基礎攻撃1000 + 射程(400+100)=500が加算 → 1500
            expect(result.phase1Attack).toBe(1500);
            expect(result.breakdown.phase1.flatBuffDetails).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 500, condition: '射程→攻撃' }),
                ])
            );
        });

        test('射程→攻撃変換（%バフも考慮）', () => {
            const character = createTestCharacter({
                baseStats: {
                    hp: 0,
                    attack: 1000,
                    defense: 0,
                    range: 500, // 基礎射程500
                    recovery: 0,
                    cooldown: 0,
                    cost: 0,
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
                    enemy_attack: 0,
                    enemy_defense: 0,
                    enemy_defense_ignore_complete: 0,
                    enemy_defense_ignore_percent: 0,
                    enemy_movement: 0,
                    enemy_retreat: 0,
                    strategy_cooldown: 0,
                    damage_recovery: 0,
                    give_damage: 0,
                    inspire: 0,
                    attack_count: 0,
                },
                rangeToAttack: { enabled: true },
                skills: [
                    {
                        id: 'range-buff-flat',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 100, // +100
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
                strategies: [
                    {
                        id: 'range-buff-percent',
                        stat: 'range',
                        mode: 'percent_max',
                        value: 80, // +80%
                        source: 'strategy',
                        target: 'self',
                        isActive: true,
                    },
                ],
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 最終射程 = 500 × 1.8 + 100 = 1000
            // 基礎攻撃1000 + 射程1000が加算 → 2000
            expect(result.phase1Attack).toBe(2000);
        });

        test('射程→攻撃変換（閾値1000以上で発動 - [竜焔]仙台城）', () => {
            const character = createTestCharacter({
                baseStats: {
                    hp: 0,
                    attack: 1000,
                    defense: 0,
                    range: 648, // [竜焔]仙台城の基礎射程
                    recovery: 0,
                    cooldown: 0,
                    cost: 0,
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
                    enemy_attack: 0,
                    enemy_defense: 0,
                    enemy_defense_ignore_complete: 0,
                    enemy_defense_ignore_percent: 0,
                    enemy_movement: 0,
                    enemy_retreat: 0,
                    strategy_cooldown: 0,
                    damage_recovery: 0,
                    give_damage: 0,
                    inspire: 0,
                    attack_count: 0,
                },
                rangeToAttack: { enabled: true, threshold: 1000 },
                skills: [
                    {
                        id: 'range-buff-skill',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 100, // 特技で+100
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
                strategies: [
                    {
                        id: 'range-buff-strategy',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 400, // 計略最大で+400
                        source: 'strategy',
                        target: 'self',
                        isActive: true,
                    },
                ],
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 最終射程 = 648 + 100 + 400 = 1148 >= 1000 → 発動
            // 基礎攻撃1000 + 射程1148が加算 → 2148
            expect(result.phase1Attack).toBe(2148);
            expect(result.breakdown.phase1.flatBuffDetails).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 1148, condition: '射程→攻撃' }),
                ])
            );
        });

        test('射程→攻撃変換（閾値未満で発動しない）', () => {
            const character = createTestCharacter({
                baseStats: {
                    hp: 0,
                    attack: 1000,
                    defense: 0,
                    range: 648, // [竜焔]仙台城の基礎射程
                    recovery: 0,
                    cooldown: 0,
                    cost: 0,
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
                    enemy_attack: 0,
                    enemy_defense: 0,
                    enemy_defense_ignore_complete: 0,
                    enemy_defense_ignore_percent: 0,
                    enemy_movement: 0,
                    enemy_retreat: 0,
                    strategy_cooldown: 0,
                    damage_recovery: 0,
                    give_damage: 0,
                    inspire: 0,
                    attack_count: 0,
                },
                rangeToAttack: { enabled: true, threshold: 1000 },
                skills: [
                    {
                        id: 'range-buff-skill',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 100, // 特技で+100のみ（計略なし）
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
            });
            const result = calculateDamage(character, defaultEnvironment);

            // 最終射程 = 648 + 100 = 748 < 1000 → 発動しない
            // 基礎攻撃1000のまま
            expect(result.phase1Attack).toBe(1000);
            expect(result.breakdown.phase1.flatBuffDetails).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ condition: '射程→攻撃' }),
                ])
            );
        });
    });

    describe('Phase 2: 条件付きダメージ倍率', () => {
        test('条件付き与えるダメージ（射程条件満たす場合）', () => {
            const character = createTestCharacter({
                baseStats: {
                    attack: 1000,
                    range: 800,  // 基礎射程800
                },
                skills: [
                    {
                        id: 'range-buff',
                        stat: 'range',
                        mode: 'flat_sum',
                        value: 300,  // +300 で合計1100
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
                conditionalGiveDamage: [
                    { rangeThreshold: 1000, multiplier: 2 },  // 射程1000以上で2倍
                ],
            });

            const result = calculateDamage(character, defaultEnvironment);

            // Phase2で2倍が適用される
            expect(result.phase2Damage).toBe(2000);
            expect(result.breakdown.phase2.multipliers).toContainEqual(
                expect.objectContaining({ type: 'give_damage（射程1000+）', value: 2 })
            );
        });

        test('条件付き与えるダメージ（射程条件満たさない場合）', () => {
            const character = createTestCharacter({
                baseStats: {
                    attack: 1000,
                    range: 800,  // 基礎射程800（条件未達）
                },
                conditionalGiveDamage: [
                    { rangeThreshold: 1000, multiplier: 2 },
                ],
            });

            const result = calculateDamage(character, defaultEnvironment);

            // 条件を満たさないので倍率適用なし
            expect(result.phase2Damage).toBe(1000);
            expect(result.breakdown.phase2.multipliers).not.toContainEqual(
                expect.objectContaining({ type: expect.stringContaining('射程') })
            );
        });

        test('複数の与えるダメージ倍率（特殊攻撃専用は通常攻撃に適用されない）', () => {
            const character = createTestCharacter({
                baseStats: {
                    attack: 1000,
                    range: 1200,  // 条件満たす
                },
                skills: [
                    {
                        id: 'special-give-damage',
                        stat: 'give_damage',
                        mode: 'percent_max',
                        value: 30,  // 1.3倍（特殊攻撃専用 - 通常攻撃には適用されない）
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                        note: '特殊攻撃',
                    },
                    {
                        id: 'normal-give-damage',
                        stat: 'give_damage',
                        mode: 'percent_max',
                        value: 20,  // 1.2倍（汎用 - 全攻撃に適用）
                        source: 'self_skill',
                        target: 'self',
                        isActive: true,
                    },
                ],
                conditionalGiveDamage: [
                    { rangeThreshold: 1000, multiplier: 2 },  // 2倍
                ],
                specialAttack: {
                    multiplier: 6,
                    hits: 1,
                    defenseIgnore: false,
                    cycleN: 5,
                },
            });

            const result = calculateDamage(character, defaultEnvironment);

            // 通常攻撃Phase2: 1000 × 1.2（汎用give_damage） × 2（条件付き） = 2400
            // 特殊攻撃専用の1.3倍は通常攻撃には適用されない
            expect(result.phase2Damage).toBe(2400);

            // 特殊攻撃ダメージ: 1000 × 1.2（汎用） × 1.3（特殊攻撃専用） × 2（条件付き） × 6（倍率）
            // = 1000 × 1.2 × 1.3 × 2 × 6 = 18720
            expect(result.breakdown.specialAttack?.damage).toBeCloseTo(18720);
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

    describe('特殊攻撃', () => {
        test('連撃数がダメージに反映される（2連撃）', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });
            // 2.5倍の2連撃、5回に1回発動
            character.specialAttack = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleN: 5,
            };
            const result = calculateDamage(character, defaultEnvironment);

            // 特殊攻撃ダメージ = 1000 × 2.5 × 2連撃 = 5000
            expect(result.breakdown.specialAttack).toBeDefined();
            expect(result.breakdown.specialAttack!.damage).toBe(5000);
            expect(result.breakdown.specialAttack!.hits).toBe(2);
            expect(result.breakdown.specialAttack!.multiplier).toBe(2.5);
        });

        test('連撃数がサイクルDPSに反映される', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });
            // 2.5倍の2連撃、5回に1回発動
            character.specialAttack = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleN: 5,
            };
            const result = calculateDamage(character, defaultEnvironment);

            // 刀: attack=19, gap=22, total=41フレーム
            // 通常ダメージ = 1000
            // 特殊攻撃ダメージ = 1000 × 2.5 × 2 = 5000
            // サイクル合計 = 4 × 1000 + 5000 = 9000
            // サイクル時間 = 41 × 5 = 205フレーム = 3.417秒
            // サイクルDPS = 9000 / 3.417 ≈ 2634
            expect(result.breakdown.specialAttack!.cycleDps).toBeCloseTo(2634, 0);
        });

        test('連撃数1の場合は通常計算', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });
            // 6倍の1連撃（通常の特殊攻撃）、3回に1回発動
            character.specialAttack = {
                multiplier: 6,
                hits: 1,
                defenseIgnore: false,
                cycleN: 3,
            };
            const result = calculateDamage(character, defaultEnvironment);

            // 特殊攻撃ダメージ = 1000 × 6 × 1 = 6000
            expect(result.breakdown.specialAttack!.damage).toBe(6000);
            expect(result.breakdown.specialAttack!.hits).toBe(1);
        });

        test('与えるダメージ倍率が連撃にも適用される', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });
            // 与えるダメージ1.2倍のスキル
            character.skills = [{
                stat: 'give_damage',
                value: 20, // 1.2倍 = 20%増加
                mode: 'percent_max',
                source: 'skill',
                target: 'self',
                note: '与えるダメージ1.2倍',
            }];
            // 2.5倍の2連撃
            character.specialAttack = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleN: 5,
            };
            const result = calculateDamage(character, defaultEnvironment);

            // Phase 2: 1000 × 1.2 = 1200
            // 特殊攻撃ダメージ = 1200 × 2.5 × 2 = 6000
            expect(result.breakdown.specialAttack!.damage).toBe(6000);
        });

        test('仙台城パターン: 特殊攻撃専用1.3倍 + 汎用1.2倍が正しく適用される', () => {
            // 仙台城の特技: 「自身の特殊攻撃で与えるダメージが1.3倍」
            // 仙台城の特殊能力: 「与えるダメージ1.2倍」
            const character = createTestCharacter({
                weapon: '刀',
                baseStats: { attack: 1000, range: 300 },
            });
            character.skills = [
                {
                    id: 'skill-special-give-damage',
                    stat: 'give_damage',
                    value: 30, // 1.3倍 = 30%増加
                    mode: 'percent_max',
                    source: 'self_skill',
                    target: 'self',
                    isActive: true,
                    note: '特殊攻撃', // 特殊攻撃専用
                },
                {
                    id: 'ability-general-give-damage',
                    stat: 'give_damage',
                    value: 20, // 1.2倍 = 20%増加
                    mode: 'percent_max',
                    source: 'special_ability',
                    target: 'self',
                    isActive: true,
                    // note なし = 汎用（全攻撃に適用）
                },
            ];
            // 2.5倍の2連撃
            character.specialAttack = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleN: 5,
            };
            const result = calculateDamage(character, defaultEnvironment);

            // 通常攻撃のPhase2: 1000 × 1.2（汎用のみ） = 1200
            // 特殊攻撃専用の1.3倍は通常攻撃には適用されない
            expect(result.phase2Damage).toBe(1200);

            // 特殊攻撃: 1000 × 1.2（汎用） × 1.3（特殊攻撃専用） × 2.5 × 2連撃
            // = 1000 × 1.56 × 5 = 7800
            expect(result.breakdown.specialAttack!.damage).toBe(7800);
        });
    });

    describe('計略ダメージ', () => {
        test('最大倍率がPhase2のgive_damageに含まれている場合は二重に掛けない', () => {
            const character = createTestCharacter({
                strategies: [
                    {
                        id: 'hp-dependent-max',
                        stat: 'give_damage',
                        mode: 'percent_max',
                        value: 150, // 2.5倍
                        source: 'strategy',
                        target: 'self',
                        isActive: true,
                        note: 'HP依存（最大値）',
                    },
                ],
            });

            character.strategyDamage = {
                multiplier: 2,
                hits: 5,
                maxMultiplier: 2.5,
                defenseIgnore: false,
                cycleDuration: 10,
            };

            const result = calculateDamage(character, defaultEnvironment);

            // Phase2で既に2.5倍が適用されているため、計略ダメージ側での最大倍率は追加しない
            // 1000 × 2.5 × 2 × 5 = 25,000
            expect(result.strategyDamage).toBe(25000);
        });

        test('計略バフ効果（隙80%短縮、与えるダメージ1.2倍）+ 2.5倍2連撃 + 5回に1回発動', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });

            // 計略ダメージ: 2.5倍の2連撃、60秒間のバフ
            character.strategyDamage = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleDuration: 60,
                buffDuration: 60,
                buffGiveDamage: 1.2, // 与えるダメージ1.2倍
                buffAttackGap: 80,   // 隙80%短縮
            };

            // 特殊攻撃: 2.5倍の2連撃、5回に1回発動
            character.specialAttack = {
                multiplier: 2.5,
                hits: 2,
                defenseIgnore: false,
                cycleN: 5,
            };

            const result = calculateDamage(character, defaultEnvironment);

            // 計略ダメージ確認
            expect(result.breakdown.strategyDamage).toBeDefined();
            const sd = result.breakdown.strategyDamage!;

            // 瞬間ダメージ = 1000 × 2.5 × 2 = 5000
            expect(sd.instantDamage).toBe(5000);

            // バフ効果中DPSが計算されている
            expect(sd.buffedDps).toBeDefined();
            expect(sd.buffedDps).toBeGreaterThan(result.dps);

            // 計略常時発動前提：攻撃速度・隙短縮は既にnormalDpsに含まれている
            // buffedDpsでは与ダメージ倍率のみ適用
            // 通常DPS ≈ 1463 (フレーム41で1000ダメージ)
            // バフDPS ≈ 1463 × 1.2 ≈ 1756
            expect(sd.buffedDps).toBeCloseTo(1756, -1); // 10の位で丸め

            // 特殊攻撃サイクルDPSが計算されている（5回に1回発動）
            expect(sd.buffedCycleDps).toBeDefined();
            // 計略常時発動前提でのサイクルDPS計算:
            // buffedDps = 1756 (normalDps × 1.2)
            // フレーム時間 = 23.4 (攻撃速度・隙短縮適用後)
            // 1攻撃ダメージ = 1756 × (23.4/60) ≈ 685
            // 特殊攻撃ダメージ = 685 × 2.5 × 2 = 3425
            // サイクル合計 = 4 × 685 + 3425 = 6165
            // サイクル時間 = 1.95秒
            // サイクルDPS ≈ 6165 / 1.95 ≈ 3161
            expect(sd.buffedCycleDps).toBeCloseTo(3161, -2); // 100の位で丸め
        });

        test('隙短縮のみの場合buffedDpsはnormalDpsと同じ（計略常時発動前提）', () => {
            const character = createTestCharacter({
                weapon: '刀',
            });

            // 計略ダメージ: シンプルな2倍の1連撃、隙50%短縮のみ
            character.strategyDamage = {
                multiplier: 2,
                hits: 1,
                defenseIgnore: false,
                cycleDuration: 30,
                buffDuration: 30,
                buffAttackGap: 50, // 隙50%短縮
            };

            const result = calculateDamage(character, defaultEnvironment);

            expect(result.breakdown.strategyDamage).toBeDefined();
            const sd = result.breakdown.strategyDamage!;

            // 計略常時発動前提：隙短縮は既にnormalDpsに含まれている
            // buffedDpsでは追加の乗算なし（与ダメ倍率もないため）
            // 通常DPS ≈ 1463
            // バフDPS ≈ 1463（同じ）
            expect(sd.buffedDps).toBeCloseTo(result.dps, 0);
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

    describe('伏兵配置による累乗バフ（千賀地氏城など）', () => {
        test('should apply multiplicative stacking for ambush buffs with 2 units', () => {
            const character: Character = {
                id: 'test-ambush',
                name: '千賀地氏城',
                weapon: '投剣',
                attributes: ['平'],
                baseStats: { attack: 1000 },
                skills: [],
                strategies: [],
                ambushInfo: {
                    maxCount: 2,
                    attackMultiplier: 1.4,
                    attackSpeedMultiplier: 1.4,
                    isMultiplicative: true,
                },
            };

            const result = calculateDamage(character, defaultEnvironment);

            // 伏兵2体: 1.4^2 = 1.96
            // Phase1攻撃力 = 1000 * 1.96 = 1960
            expect(result.phase1Attack).toBeCloseTo(1960, 0);
        });

        test('should apply multiplicative stacking for attack speed', () => {
            const character: Character = {
                id: 'test-ambush-speed',
                name: '千賀地氏城',
                weapon: '投剣',
                attributes: ['平'],
                baseStats: { attack: 1000 },
                skills: [],
                strategies: [],
                ambushInfo: {
                    maxCount: 2,
                    attackMultiplier: 1.4,
                    attackSpeedMultiplier: 1.4,
                    isMultiplicative: true,
                },
            };

            const resultWith2 = calculateDamage(character, defaultEnvironment);

            // 伏兵1体の場合
            const resultWith1 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 1,
            });

            // 伏兵2体の方がDPSが高い（攻撃速度も上昇するため）
            expect(resultWith2.dps).toBeGreaterThan(resultWith1.dps);
            // 攻撃力も2体の方が高い（1.4^2 vs 1.4^1）
            expect(resultWith2.phase1Attack).toBeCloseTo(resultWith1.phase1Attack * 1.4, 0);
        });

        test('should use currentAmbushCount from environment if specified', () => {
            const character: Character = {
                id: 'test-ambush-count',
                name: '千賀地氏城',
                weapon: '投剣',
                attributes: ['平'],
                baseStats: { attack: 1000 },
                skills: [],
                strategies: [],
                ambushInfo: {
                    maxCount: 2,
                    attackMultiplier: 1.4,
                    attackSpeedMultiplier: 1.4,
                    isMultiplicative: true,
                },
            };

            // 0体の場合 → 最大数（2体）を使用
            const resultWith0 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 0,
            });
            expect(resultWith0.phase1Attack).toBeCloseTo(1960, 0);

            // 1体の場合
            const resultWith1 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 1,
            });
            expect(resultWith1.phase1Attack).toBeCloseTo(1400, 0);

            // デフォルト（maxCount = 2体）
            const resultDefault = calculateDamage(character, defaultEnvironment);
            expect(resultDefault.phase1Attack).toBeCloseTo(1960, 0);

            // 明示的に2体
            const resultWith2 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 2,
            });
            expect(resultWith2.phase1Attack).toBeCloseTo(1960, 0);
        });

        test('should apply additive stacking when isMultiplicative is false', () => {
            const character: Character = {
                id: 'test-ambush-additive',
                name: 'テスト城',
                weapon: '投剣',
                attributes: ['平'],
                baseStats: { attack: 1000 },
                skills: [],
                strategies: [],
                ambushInfo: {
                    maxCount: 2,
                    attackMultiplier: 1.4,
                    isMultiplicative: false,
                },
            };

            const result = calculateDamage(character, defaultEnvironment);

            // 加算: 1 + 0.4 * 2 = 1.8
            // Phase1攻撃力 = 1000 * 1.8 = 1800
            expect(result.phase1Attack).toBeCloseTo(1800, 0);
        });
    });

    describe('動的バフ（per_ally）', () => {
        test('should apply per_ally flat attack buff with currentAmbushCount (ドレッドノート式)', () => {
            const character: Character = {
                id: 'test-per-ally-attack',
                name: 'テスト城',
                weapon: '大砲',
                attributes: ['水'],
                baseStats: { attack: 1000 },
                skills: [{
                    id: 'per-ally-buff',
                    stat: 'attack',
                    mode: 'flat_sum',
                    value: 150, // 味方1体につき+150
                    source: 'strategy',
                    target: 'self',
                    isActive: true,
                    isDynamic: true,
                    dynamicType: 'per_ally_other',
                }],
                strategies: [],
            };

            // 味方3体の場合
            const resultWith3 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 3,
            });
            // 1000 + 150 * 3 = 1450
            expect(resultWith3.phase1Attack).toBeCloseTo(1450, 0);
        });

        test('should apply per_ally give_damage buff with currentAmbushCount (ドレッドノート式)', () => {
            const character: Character = {
                id: 'test-per-ally-givedamage',
                name: 'テスト城',
                weapon: '大砲',
                attributes: ['水'],
                baseStats: { attack: 1000 },
                skills: [],
                strategies: [{
                    id: 'per-ally-givedamage',
                    stat: 'give_damage',
                    mode: 'percent_max',
                    value: 15, // 味方1体につき与ダメ+15%
                    source: 'strategy',
                    target: 'self',
                    isActive: true,
                    isDynamic: true,
                    dynamicType: 'per_ally_other',
                }],
            };

            // 味方3体の場合
            const resultWith3 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 3,
            });
            // Phase1: 1000
            // Phase2: 1000 * 1.15^3 = 1000 * 1.520875 ≈ 1520.88（乗算スタック）
            expect(resultWith3.phase1Attack).toBe(1000);
            expect(resultWith3.phase2Damage).toBeCloseTo(1520.875, 0);
        });

        test('should default to 1 when currentAmbushCount is 0 for per_ally', () => {
            const character: Character = {
                id: 'test-per-ally-default',
                name: 'テスト城',
                weapon: '大砲',
                attributes: ['水'],
                baseStats: { attack: 1000 },
                skills: [{
                    id: 'per-ally-buff',
                    stat: 'attack',
                    mode: 'flat_sum',
                    value: 150,
                    source: 'strategy',
                    target: 'self',
                    isActive: true,
                    isDynamic: true,
                    dynamicType: 'per_ally_other',
                }],
                strategies: [],
            };

            // 0体の場合 → デフォルト1として扱う
            const resultWith0 = calculateDamage(character, {
                ...defaultEnvironment,
                currentAmbushCount: 0,
            });
            // 1000 + 150 * 1 = 1150
            expect(resultWith0.phase1Attack).toBeCloseTo(1150, 0);
        });
    });
});
