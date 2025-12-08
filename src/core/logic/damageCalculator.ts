/**
 * ShiroPro Tools (Reborn) - ダメージ計算ロジック
 * 
 * DAMAGE_CALCULATOR_SPEC.mdに基づいたダメージ計算の実装
 * 
 * 計算フェーズ:
 * Phase 1: 攻撃力の確定
 * Phase 2: ダメージ倍率の適用
 * Phase 3: 防御力による減算
 * Phase 4: 与ダメ・被ダメによる増減
 * Phase 5: 連撃による乗算
 * DPS計算
 */

import type {
    Character,
    EnvironmentSettings,
    DamageCalculationResult,
    DamageBreakdown,
    BuffValue,
    DamageComparison,
} from '../types';
import { WEAPON_FRAMES } from '../data/weaponFrames';

// ========================================
// ユーティリティ関数
// ========================================

/**
 * 最大値ルールを適用
 * 同種バフは最大値のみを使用
 */
function applyMaxValueRule(buffs: BuffValue[]): number {
    if (buffs.length === 0) return 0;

    // 同種バフごとにグループ化
    const grouped = buffs.reduce((acc, buff) => {
        if (!acc[buff.type]) {
            acc[buff.type] = [];
        }
        acc[buff.type].push(buff.value);
        return acc;
    }, {} as Record<string, number[]>);

    // 各グループの最大値を取得して合計
    return Object.values(grouped)
        .map((values) => Math.max(...values))
        .reduce((sum, max) => sum + max, 0);
}

// ========================================
// Phase 1: 攻撃力の確定
// ========================================

function calculatePhase1(
    character: Character,
    environment: EnvironmentSettings
): {
    attack: number;
    breakdown: DamageBreakdown['phase1'];
} {
    const baseAttack = character.baseStats.attack || 0;
    const selfBuffs = character.selfBuffs;
    const envAttackPercent = environment.attackPercent || 0;

    if (!selfBuffs) {
        return {
            attack: baseAttack,
            breakdown: {
                baseAttack,
                percentBuffApplied: envAttackPercent,
                flatBuffApplied: 0,
                additiveBuffApplied: 0,
                duplicateBuffApplied: 0,
                finalAttack: baseAttack * (1 + envAttackPercent / 100),
            },
        };
    }

    // 割合バフ（最大値ルール適用）
    const selfPercentBuff = applyMaxValueRule(selfBuffs.percentBuffs || []);
    const percentBuffApplied = selfPercentBuff + envAttackPercent;

    // 固定値バフ（すべて加算）
    const flatBuffApplied = (selfBuffs.flatBuffs || []).reduce((sum, val) => sum + val, 0);

    // 加算バフ（基礎攻撃力を参照）
    const selfAdditiveBuff = (selfBuffs.additiveBuffs || []).reduce(
        (sum, buff) => sum + (baseAttack * buff.value) / 100,
        0
    );
    const envAdditiveBuff = environment.inspireFlat;
    const additiveBuffApplied = selfAdditiveBuff + envAdditiveBuff;

    // 重複バフ（自己と環境を加算）
    const selfDuplicateBuff = (selfBuffs.duplicateBuffs || []).reduce((sum, val) => sum + val, 0);
    const envDuplicateBuff = environment.duplicateBuff;
    const duplicateBuffApplied = selfDuplicateBuff + envDuplicateBuff;

    // Phase 1の計算
    // 特殊な挙動: 加算バフも重複バフで乗算される
    const additiveWithDuplicate = additiveBuffApplied * (1 + duplicateBuffApplied / 100);

    const attackBeforeDuplicate =
        baseAttack * (1 + percentBuffApplied / 100) + flatBuffApplied + additiveWithDuplicate;
    const finalAttack = attackBeforeDuplicate * (1 + duplicateBuffApplied / 100);

    return {
        attack: finalAttack,
        breakdown: {
            baseAttack,
            percentBuffApplied,
            flatBuffApplied,
            additiveBuffApplied: additiveWithDuplicate,
            duplicateBuffApplied,
            finalAttack,
        },
    };
}

// ========================================
// Phase 2: ダメージ倍率の適用
// ========================================

function calculatePhase2(
    attack: number,
    character: Character,
    environment: EnvironmentSettings
): {
    damage: number;
    breakdown: DamageBreakdown['phase2'];
} {
    let damage = attack;
    const multipliers: Array<{ type: string; value: number }> = [];

    const selfBuffs = character.selfBuffs;
    if (selfBuffs && selfBuffs.damageMultipliers) {
        // すべての倍率を個別に乗算
        for (const mult of selfBuffs.damageMultipliers) {
            damage *= mult.value;
            multipliers.push({ type: mult.type, value: mult.value });
        }
    }

    if (environment.damageMultiplier && environment.damageMultiplier !== 1) {
        damage *= environment.damageMultiplier;
        multipliers.push({ type: 'env_multiplier', value: environment.damageMultiplier });
    }

    return {
        damage,
        breakdown: {
            multipliers,
            damage,
        },
    };
}

// ========================================
// Phase 3: 防御力による減算
// ========================================

function calculatePhase3(
    damage: number,
    character: Character,
    environment: EnvironmentSettings
): {
    damage: number;
    breakdown: DamageBreakdown['phase3'];
} {
    const selfBuffs = character.selfBuffs;

    // 防御無視チェック
    if (selfBuffs && selfBuffs.defenseIgnore) {
        return {
            damage,
            breakdown: {
                enemyDefense: environment.enemyDefense,
                effectiveDefense: 0,
                damage,
            },
        };
    }

    // 有効防御力の計算: (基礎防御 × (1 - 割合デバフ%)) - 固定値デバフ
    let effectiveDefense = environment.enemyDefense * (1 - environment.defenseDebuffPercent / 100);
    effectiveDefense = effectiveDefense - environment.defenseDebuffFlat;
    effectiveDefense = Math.max(0, effectiveDefense);

    // ダメージ計算（最低1保証）
    const finalDamage = Math.max(1, damage - effectiveDefense);

    return {
        damage: finalDamage,
        breakdown: {
            enemyDefense: environment.enemyDefense,
            effectiveDefense,
            damage: finalDamage,
        },
    };
}

// ========================================
// Phase 4: 与ダメ・被ダメによる増減
// ========================================

function calculatePhase4(
    damage: number,
    environment: EnvironmentSettings
): {
    damage: number;
    breakdown: DamageBreakdown['phase4'];
} {
    const damageDealt = environment.damageDealt || 0;

    // 被ダメ（最大値のみ適用）
    const damageTaken = environment.damageTaken;

    // 乗算
    const finalDamage = damage * (1 + damageDealt / 100) * (1 + damageTaken / 100);

    return {
        damage: Math.floor(finalDamage),
        breakdown: {
            damageDealt,
            damageTaken,
            damage: Math.floor(finalDamage),
        },
    };
}

// ========================================
// Phase 5: 連撃による乗算
// ========================================

function calculatePhase5(
    damage: number,
    character: Character
): {
    damage: number;
    breakdown?: DamageBreakdown['phase5'];
} {
    if (!character.multiHit) {
        return { damage };
    }

    const totalDamage = damage * character.multiHit;

    return {
        damage: totalDamage,
        breakdown: {
            attackCount: character.multiHit,
            totalDamage,
        },
    };
}

// ========================================
// DPS計算
// ========================================

function calculateDPS(
    totalDamage: number,
    character: Character,
    environment: EnvironmentSettings
): {
    dps: number;
    breakdown: DamageBreakdown['dps'];
} {
    const frameData = WEAPON_FRAMES[character.weapon];
    if (!frameData) {
        return {
            dps: 0,
            breakdown: {
                attackFrames: 0,
                gapFrames: 0,
                totalFrames: 0,
                attacksPerSecond: 0,
                dps: 0,
            },
        };
    }

    const selfBuffs = character.selfBuffs;

    // 速度バフを合算（最大値ルール）
    const attackSpeedBuff = Math.max(
        (selfBuffs && selfBuffs.attackSpeed) || 0,
        environment.attackSpeed || 0
    );

    const gapReductionBuff = Math.max(
        (selfBuffs && selfBuffs.gapReduction) || 0,
        environment.gapReduction || 0
    );

    // フレーム計算
    const attackFrames = frameData.attack / (1 + attackSpeedBuff / 100);
    const gapFrames = frameData.gap * (1 - gapReductionBuff / 100);
    const totalFrames = attackFrames + gapFrames;

    // 1秒あたりの攻撃回数（60FPS想定）
    const attacksPerSecond = 60 / totalFrames;

    // DPS
    const dps = totalDamage * attacksPerSecond;

    return {
        dps,
        breakdown: {
            attackFrames,
            gapFrames,
            totalFrames,
            attacksPerSecond,
            dps,
        },
    };
}

// ========================================
// メイン計算関数
// ========================================

/**
 * ダメージを計算
 * 
 * @param character キャラクター
 * @param environment 環境設定
 * @returns ダメージ計算結果
 */
export function calculateDamage(
    character: Character,
    environment: EnvironmentSettings
): DamageCalculationResult {
    // Phase 1: 攻撃力の確定
    const phase1 = calculatePhase1(character, environment);

    // Phase 2: ダメージ倍率の適用
    const phase2 = calculatePhase2(phase1.attack, character, environment);

    // Phase 3: 防御力による減算
    const phase3 = calculatePhase3(phase2.damage, character, environment);

    // Phase 4: 与ダメ・被ダメによる増減
    const phase4 = calculatePhase4(phase3.damage, environment);

    // Phase 5: 連撃による乗算
    const phase5 = calculatePhase5(phase4.damage, character);

    // DPS計算
    const dpsCalc = calculateDPS(phase5.damage, character, environment);

    // 鼓舞量計算（該当キャラのみ）
    let inspireAmount: number | undefined;
    const selfBuffs = character.selfBuffs;
    if (selfBuffs && selfBuffs.inspire && selfBuffs.inspire.stat === 'attack') {
        inspireAmount = phase1.attack * (selfBuffs.inspire.value / 100);
    }

    return {
        characterId: character.id,
        phase1Attack: phase1.attack,
        phase2Damage: phase2.damage,
        phase3Damage: phase3.damage,
        phase4Damage: phase4.damage,
        totalDamage: phase5.damage,
        dps: dpsCalc.dps,
        inspireAmount,
        breakdown: {
            phase1: phase1.breakdown,
            phase2: phase2.breakdown,
            phase3: phase3.breakdown,
            phase4: phase4.breakdown,
            phase5: phase5.breakdown,
            dps: dpsCalc.breakdown,
        },
    };
}

/**
 * ダメージ差分を計算
 * 
 * @param beforeResult 変更前の計算結果
 * @param afterResult 変更後の計算結果
 * @returns 差分比較結果
 */
export function calculateDamageComparison(
    beforeResult: DamageCalculationResult,
    afterResult: DamageCalculationResult
): DamageComparison {
    return {
        characterId: afterResult.characterId,
        before: beforeResult,
        after: afterResult,
        diff: {
            totalDamage: afterResult.totalDamage - beforeResult.totalDamage,
            totalDamagePercent:
                beforeResult.totalDamage > 0
                    ? ((afterResult.totalDamage - beforeResult.totalDamage) / beforeResult.totalDamage) * 100
                    : 0,
            dps: afterResult.dps - beforeResult.dps,
            dpsPercent:
                beforeResult.dps > 0
                    ? ((afterResult.dps - beforeResult.dps) / beforeResult.dps) * 100
                    : 0,
            inspireAmount:
                afterResult.inspireAmount && beforeResult.inspireAmount
                    ? afterResult.inspireAmount - beforeResult.inspireAmount
                    : undefined,
        },
    };
}

/**
 * 数値を短縮表示（15234 → 15.2K）
 */
export function formatCompactNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
}

/**
 * 名前を短縮（「絢爛ダノター城」→「絢爛ダノ」）
 */
export function truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength);
}
