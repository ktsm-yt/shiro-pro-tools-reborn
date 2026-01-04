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
    DamageRange,
    ConditionalMultiplier,
    DamageScenario,
} from '../types';
import { WEAPON_FRAMES } from '../data/weaponFrames';
import { areConditionsSatisfied } from '../conditions';

// ========================================
// 条件タグのラベル変換
// ========================================
const conditionLabels: Record<string, string> = {
    'melee': '近接',
    'ranged': '遠隔',
    'fictional': '架空',
    'physical': '物理',
    'magical': '術',
    'kenran': '絢爛',
    'summer': '夏',
    'water': '水',
    'plain': '平',
    'mountain': '山',
    'plain_mountain': '平山',
};

// ========================================
// ユーティリティ関数
// ========================================

/**
 * 動的バフの倍率を取得
 * per_ally_in_range, per_ally_other: currentAmbushCount を使用（味方数として代用）
 */
function getDynamicBuffMultiplier(
    buff: { isDynamic?: boolean; dynamicType?: string },
    environment: EnvironmentSettings,
    character?: Character
): number {
    if (!buff.isDynamic || !buff.dynamicType) return 1;

    // 味方数に依存するバフ: currentAmbushCount を味方数として使用
    if (buff.dynamicType === 'per_ally_in_range' || buff.dynamicType === 'per_ally_other') {
        const allyCount = environment.currentAmbushCount ?? 0;
        return allyCount > 0 ? allyCount : 1;
    }

    // 伏兵数に依存するバフ
    if (buff.dynamicType === 'per_ambush_deployed' && character?.ambushInfo) {
        const maxCount = character.ambushInfo.maxCount;
        const ambushCount = (environment.currentAmbushCount && environment.currentAmbushCount > 0)
            ? Math.min(environment.currentAmbushCount, maxCount)  // キャラクターの最大数で制限
            : maxCount;
        return ambushCount > 0 ? ambushCount : 1;
    }

    return 1;
}

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

    // skills/strategies/specialAbilities から攻撃バフを抽出
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    // 射程→攻撃変換: 最終射程を計算（[竜焔]仙台城など）
    // 後方互換: rangeToAttack が boolean (true) または { enabled: true } のどちらもサポート
    let rangeToAttackValue = 0;
    const rangeToAttackConfig = character.rangeToAttack;
    const isRangeToAttackEnabled = rangeToAttackConfig === true ||
        (typeof rangeToAttackConfig === 'object' && rangeToAttackConfig?.enabled);

    if (isRangeToAttackEnabled) {
        const baseRange = character.baseStats.range || 0;

        // 射程バフを収集
        const rangeBuffs = [
            ...allBuffs,
            ...(character.specialAbilities || []),
        ];

        let rangePercentBuff = 0;
        let rangeFlatBuff = 0;

        for (const buff of rangeBuffs) {
            if (buff.stat !== 'range' || buff.isActive === false) continue;
            const appliesToSelf = buff.target === 'self' || buff.target === 'range';
            if (!appliesToSelf) continue;

            if (buff.mode === 'percent_max') {
                rangePercentBuff = Math.max(rangePercentBuff, buff.value);
            } else if (buff.mode === 'flat_sum') {
                rangeFlatBuff += buff.value;
            }
        }

        // 最終射程 = 基礎射程 × (1 + %バフ/100) + 固定バフ
        const finalRange = baseRange * (1 + rangePercentBuff / 100) + rangeFlatBuff;

        // 閾値チェック: 射程が閾値以上の場合のみ変換を適用
        // 後方互換: 古い形式(boolean)は閾値なしとして扱う
        const threshold = typeof rangeToAttackConfig === 'object' ? rangeToAttackConfig?.threshold : undefined;
        if (threshold === undefined || finalRange >= threshold) {
            rangeToAttackValue = finalRange;
        }
    }

    // 割合バフ（最大値ルール: target=self または target=range で自身に適用）
    let selfPercentBuff = 0;
    let flatBuffApplied = 0;
    let duplicateBuffSum = 0;
    const flatBuffDetails: Array<{ value: number; condition: string }> = [];

    // 攻撃バフの収集
    for (const buff of allBuffs) {
        if (buff.stat !== 'attack' || buff.isActive === false) continue;
        // 自身に適用されるバフ: target=self または target=range/all（自身も射程内に含む）
        const appliesToSelf = buff.target === 'self' || buff.target === 'range' || buff.target === 'all';
        if (!appliesToSelf) continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        // 条件タグをチェック（絢爛城娘は50%など）
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            if (!areConditionsSatisfied(buff.conditionTags, character)) continue;
        }

        // 動的バフの倍率を取得（味方数による累積）- 固定値バフにのみ適用
        const dynamicMultiplier = getDynamicBuffMultiplier(buff, environment, character);

        if (buff.mode === 'percent_max') {
            // 通常バフは最大値ルール
            selfPercentBuff = Math.max(selfPercentBuff, buff.value);
        } else if (buff.mode === 'flat_sum') {
            // 固定値バフには動的倍率を適用
            const effectiveValue = buff.value * dynamicMultiplier;
            flatBuffApplied += effectiveValue;
            // 内訳を記録
            let condition = buff.conditionTags?.length
                ? buff.conditionTags.map(t => conditionLabels[t] || t).join('・')
                : '無条件';
            if (buff.isDynamic && dynamicMultiplier > 1) {
                condition = `${buff.dynamicType === 'per_ally_in_range' || buff.dynamicType === 'per_ally_other' ? '味方' : ''}${dynamicMultiplier}体 × ${buff.value}`;
            }
            flatBuffDetails.push({ value: effectiveValue, condition });
        }
    }

    // 攻撃効果重複バフの収集（effect_duplicate_attack stat）
    for (const buff of allBuffs) {
        if (buff.stat !== 'effect_duplicate_attack' || buff.isActive === false) continue;
        const appliesToSelf = buff.target === 'self' || buff.target === 'range' || buff.target === 'all';
        if (!appliesToSelf) continue;
        if (buff.conditionTags?.includes('exclude_self')) continue;
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            if (!areConditionsSatisfied(buff.conditionTags, character)) continue;
        }
        // 効果重複バフは合算（効率指定がある場合は適用: 150%なら1.5倍）
        const efficiency = buff.duplicateEfficiency ? buff.duplicateEfficiency / 100 : 1;
        duplicateBuffSum += buff.value * efficiency;
    }

    // 射程→攻撃変換を適用
    if (rangeToAttackValue > 0) {
        flatBuffApplied += rangeToAttackValue;
        flatBuffDetails.push({ value: rangeToAttackValue, condition: '射程→攻撃' });
    }

    // selfBuffs からも取得（後方互換）
    if (selfBuffs) {
        const oldPercentBuff = applyMaxValueRule(selfBuffs.percentBuffs || []);
        selfPercentBuff = Math.max(selfPercentBuff, oldPercentBuff);
        flatBuffApplied += (selfBuffs.flatBuffs || []).reduce((sum, val) => sum + val, 0);
        duplicateBuffSum += (selfBuffs.duplicateBuffs || []).reduce((sum, val) => sum + val, 0);
    }

    // 環境設定の攻撃%も最大値ルールで適用（割合バフは最高値のみ）
    const percentBuffApplied = Math.max(selfPercentBuff, envAttackPercent);

    // 加算バフ（基礎攻撃力を参照）
    const selfAdditiveBuff = selfBuffs
        ? (selfBuffs.additiveBuffs || []).reduce(
              (sum, buff) => sum + (baseAttack * buff.value) / 100,
              0
          )
        : 0;
    const envAdditiveBuff = environment.inspireFlat;
    const additiveBuffApplied = selfAdditiveBuff + envAdditiveBuff;

    // 重複バフ（自己と環境を加算）
    const envDuplicateBuff = environment.duplicateBuff;
    const duplicateBuffApplied = duplicateBuffSum + envDuplicateBuff;

    // Phase 1の計算
    // 特殊な挙動: 加算バフも重複バフで乗算される
    const additiveWithDuplicate = additiveBuffApplied * (1 + duplicateBuffApplied / 100);

    const attackBeforeDuplicate =
        baseAttack * (1 + percentBuffApplied / 100) + flatBuffApplied + additiveWithDuplicate;
    let finalAttack = attackBeforeDuplicate * (1 + duplicateBuffApplied / 100);

    // 伏兵配置による攻撃倍率を適用（千賀地氏城など）
    // 同種効果と重複 = 伏兵1体ごとに累乗で乗算
    // 0または未設定の場合はキャラクターの最大数を使用
    let ambushAttackMultiplier = 1;
    if (character.ambushInfo?.attackMultiplier) {
        const maxCount = character.ambushInfo.maxCount;
        const ambushCount = (environment.currentAmbushCount && environment.currentAmbushCount > 0)
            ? Math.min(environment.currentAmbushCount, maxCount)  // キャラクターの最大数で制限
            : maxCount;
        if (ambushCount > 0) {
            if (character.ambushInfo.isMultiplicative) {
                // 累乗計算: 1.4^2 = 1.96
                ambushAttackMultiplier = Math.pow(character.ambushInfo.attackMultiplier, ambushCount);
            } else {
                // 加算計算: 1 + 0.4 * 2 = 1.8
                const perUnitBuff = character.ambushInfo.attackMultiplier - 1;
                ambushAttackMultiplier = 1 + perUnitBuff * ambushCount;
            }
            finalAttack *= ambushAttackMultiplier;
            flatBuffDetails.push({
                value: Math.round((ambushAttackMultiplier - 1) * finalAttack / ambushAttackMultiplier),
                condition: `伏兵${ambushCount}体 (×${ambushAttackMultiplier.toFixed(2)})`,
            });
        }
    }

    return {
        attack: finalAttack,
        breakdown: {
            baseAttack,
            percentBuffApplied,
            flatBuffApplied,
            flatBuffDetails,
            additiveBuffApplied: additiveWithDuplicate,
            duplicateBuffApplied,
            finalAttack,
        },
    };
}

// ========================================
// Phase 2: ダメージ倍率の適用（乗算系）
// give_damage は同種効果として最大値のみ適用（条件別にグループ化）
// ========================================

/**
 * キャラクターの現在の射程を計算する（条件判定用）
 */
function calculateCurrentRange(character: Character): number {
    const baseRange = character.baseStats.range || 0;

    // 射程バフを収集
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    let rangePercentBuff = 0;
    let rangeFlatBuff = 0;

    for (const buff of allBuffs) {
        if (buff.stat !== 'range' || buff.isActive === false) continue;
        const appliesToSelf = buff.target === 'self' || buff.target === 'range' || buff.target === 'all';
        if (!appliesToSelf) continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        if (buff.mode === 'percent_max') {
            rangePercentBuff = Math.max(rangePercentBuff, buff.value);
        } else if (buff.mode === 'flat_sum') {
            rangeFlatBuff += buff.value;
        }
    }

    // 最終射程 = 基礎射程 × (1 + %バフ/100) + 固定バフ
    return baseRange * (1 + rangePercentBuff / 100) + rangeFlatBuff;
}

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
    const multiplierDetails: Array<{
        type: string;
        value: number;
        condition: string;
        unitValue?: number;
        count?: number;
    }> = [];

    // selfBuffs.damageMultipliers から抽出
    const selfBuffs = character.selfBuffs;
    if (selfBuffs && selfBuffs.damageMultipliers) {
        for (const mult of selfBuffs.damageMultipliers) {
            damage *= mult.value;
            multipliers.push({ type: mult.type, value: mult.value });
            multiplierDetails.push({ type: mult.type, value: mult.value, condition: '常時' });
        }
    }

    // skills/strategies/specialAbilities から give_damage を抽出
    // 同種効果ルール: 同じソース種別(skill/strategy)内で最大値のみ適用
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    // 条件に該当するgive_damageバフを収集（詳細情報を含む）
    interface GiveDamageBuffInfo {
        multiplier: number;
        conditionKey: string;
        isDynamic: boolean;
        dynamicType?: string;
        unitValue?: number;
        count?: number;
        condition: string;
    }
    const skillGiveDamageBuffs: GiveDamageBuffInfo[] = [];
    const strategyGiveDamageBuffs: GiveDamageBuffInfo[] = [];

    for (const buff of allBuffs) {
        if (buff.stat !== 'give_damage' || buff.isActive === false) continue;

        // 射程条件のバフはスキップ（conditionalGiveDamageで別途処理）
        if (buff.note === '射程条件') continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        // 自身に適用されるか判定
        let appliesToSelf = buff.target === 'self' || buff.target === 'all';

        // target=range の場合、条件タグに該当すれば自身にも適用
        if (buff.target === 'range' && buff.conditionTags && buff.conditionTags.length > 0) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }

        if (!appliesToSelf) continue;

        // 動的バフの倍率を取得（味方数による累積）
        const dynamicMultiplier = getDynamicBuffMultiplier(buff, environment, character);
        const conditionKey = buff.conditionTags?.filter(t => t !== 'exclude_self').sort().join(',') || 'no_condition';

        // 乗算スタック: (1 + value/100)^count
        // 例: 15%バフが20体 → 1.15^20 ≈ 16.37倍
        const isDynamic = dynamicMultiplier > 1;
        let multiplier: number;
        if (buff.mode === 'percent_max') {
            const baseMultiplier = 1 + buff.value / 100;
            multiplier = isDynamic ? Math.pow(baseMultiplier, dynamicMultiplier) : baseMultiplier;
        } else {
            multiplier = buff.value * dynamicMultiplier;
        }

        // 条件ラベルの生成
        let conditionLabel = '無条件';
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            conditionLabel = buff.conditionTags.map(tag => conditionLabels[tag] || tag).join('・');
        }

        // 動的バフの場合は味方数の情報を付加
        const baseMultiplierValue = 1 + buff.value / 100;
        const buffInfo: GiveDamageBuffInfo = {
            multiplier,
            conditionKey,
            isDynamic,
            dynamicType: isDynamic ? buff.mode : undefined,
            unitValue: isDynamic ? buff.value : undefined,
            count: isDynamic ? dynamicMultiplier : undefined,
            condition: isDynamic
                ? `${baseMultiplierValue.toFixed(2)}^${dynamicMultiplier}体`
                : conditionLabel,
        };

        // ソース別に分類
        if (buff.source === 'strategy') {
            strategyGiveDamageBuffs.push(buffInfo);
        } else {
            skillGiveDamageBuffs.push(buffInfo);
        }
    }

    // 同種効果ルール: 各ソース内で最大値のみ適用
    const applyMaxFromBuffs = (buffs: GiveDamageBuffInfo[], sourceType: string) => {
        if (buffs.length === 0) return;

        // 全バフから最大値を取得（同種効果として扱う）
        const maxBuff = buffs.reduce((max, b) => b.multiplier > max.multiplier ? b : max, buffs[0]);
        damage *= maxBuff.multiplier;
        multipliers.push({ type: `give_damage`, value: maxBuff.multiplier });
        multiplierDetails.push({
            type: 'give_damage',
            value: maxBuff.multiplier,
            condition: maxBuff.condition,
            unitValue: maxBuff.unitValue,
            count: maxBuff.count,
        });
    };

    applyMaxFromBuffs(skillGiveDamageBuffs, 'skill');
    applyMaxFromBuffs(strategyGiveDamageBuffs, 'strategy');

    // 条件付き与えるダメージを適用（射程条件など）
    if (character.conditionalGiveDamage && character.conditionalGiveDamage.length > 0) {
        const currentRange = calculateCurrentRange(character);

        for (const cond of character.conditionalGiveDamage) {
            if (currentRange >= cond.rangeThreshold) {
                damage *= cond.multiplier;
                multipliers.push({
                    type: `give_damage（射程${cond.rangeThreshold}+）`,
                    value: cond.multiplier,
                });
            }
        }
    }

    // 直撃ボーナスを適用（Phase 2で乗算）
    // 計算式: 直撃ボーナスX% = (100+X)/100 倍
    // ベース直撃ボーナスは50%（1.5倍）
    // absolute_set: 「直撃ボーナスが300%に上昇」→ (100+300)/100 = 4.0倍
    // percent_max: 「直撃ボーナスが120%上昇」→ ベース50% + 120% = 170% = (100+170)/100 = 2.70倍
    // 同種効果ルール: 複数の直撃ボーナスがある場合は最大値のみ適用
    const BASE_CRITICAL_BONUS = 50; // ベース直撃ボーナス 50%

    interface CriticalBonusInfo {
        multiplier: number;
        conditionLabel: string;
    }
    const criticalBonusCandidates: CriticalBonusInfo[] = [];

    for (const buff of allBuffs) {
        if (buff.stat !== 'critical_bonus' || buff.isActive === false) continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        // 自身に適用されるか判定
        let appliesToSelf = buff.target === 'self' || buff.target === 'all';
        if (buff.target === 'range' && buff.conditionTags && buff.conditionTags.length > 0) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }
        if (!appliesToSelf) continue;

        let criticalMultiplier: number;
        let conditionLabel: string;

        if (buff.mode === 'absolute_set') {
            // 「直撃ボーナスが300%に上昇」→ (100+300)/100 = 4.0倍
            criticalMultiplier = (100 + buff.value) / 100;
            conditionLabel = `直撃${buff.value}%`;
        } else {
            // 「直撃ボーナスが120%上昇」→ ベース50% + 120% = 170% = (100+170)/100 = 2.70倍
            const totalBonus = BASE_CRITICAL_BONUS + buff.value;
            criticalMultiplier = (100 + totalBonus) / 100;
            conditionLabel = `直撃${totalBonus}%`;
        }

        criticalBonusCandidates.push({ multiplier: criticalMultiplier, conditionLabel });
    }

    // 最大値のみ適用（同種効果ルール）
    if (criticalBonusCandidates.length > 0) {
        const maxBonus = criticalBonusCandidates.reduce(
            (max, b) => b.multiplier > max.multiplier ? b : max,
            criticalBonusCandidates[0]
        );
        damage *= maxBonus.multiplier;
        multipliers.push({ type: '直撃ボーナス', value: maxBonus.multiplier });
        multiplierDetails.push({
            type: '直撃ボーナス',
            value: maxBonus.multiplier,
            condition: maxBonus.conditionLabel,
        });
    }

    if (environment.damageMultiplier && environment.damageMultiplier !== 1) {
        damage *= environment.damageMultiplier;
        multipliers.push({ type: 'env_multiplier', value: environment.damageMultiplier });
    }

    return {
        damage,
        breakdown: {
            multipliers,
            multiplierDetails,
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
// damage_dealt は最大値のみ適用（give_damage とは異なる）
// ========================================

function calculatePhase4(
    damage: number,
    character: Character,
    environment: EnvironmentSettings
): {
    damage: number;
    breakdown: DamageBreakdown['phase4'];
} {
    // skills/strategies/specialAbilities から damage_dealt を抽出（最大値ルール）
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    let selfDamageDealt = 0;
    let selfEnemyDamageTaken = 0;

    for (const buff of allBuffs) {
        if (buff.isActive === false) continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        // 自身に適用されるか判定
        let appliesToSelf = buff.target === 'self' || buff.target === 'all';

        // target=range の場合、条件タグに該当すれば自身にも適用
        if (buff.target === 'range' && buff.conditionTags && buff.conditionTags.length > 0) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }
        // target=range で条件タグがない場合も自身に適用（射程内の敵は自分の攻撃対象）
        if (buff.target === 'range' && (!buff.conditionTags || buff.conditionTags.length === 0)) {
            appliesToSelf = true;
        }

        if (!appliesToSelf) continue;

        if (buff.stat === 'damage_dealt') {
            selfDamageDealt = Math.max(selfDamageDealt, buff.value);
        } else if (buff.stat === 'enemy_damage_taken') {
            // 敵の被ダメ上昇（射程内敵の被ダメ50%上昇など）
            selfEnemyDamageTaken = Math.max(selfEnemyDamageTaken, buff.value);
        }
    }

    const damageDealt = Math.max(selfDamageDealt, environment.damageDealt || 0);

    // 被ダメ（キャラのバフと環境設定の最大値を適用）
    const damageTaken = Math.max(selfEnemyDamageTaken, environment.damageTaken || 0);

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

    // skills/strategies/specialAbilities から速度・隙バフを抽出
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    let parsedSpeedBuff = 0;
    let parsedGapReduction = 0;

    for (const buff of allBuffs) {
        if (buff.isActive === false) continue;
        const appliesToSelf = buff.target === 'self' || buff.target === 'range' || buff.target === 'all';
        if (!appliesToSelf) continue;

        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;

        // 条件タグをチェック
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            if (!areConditionsSatisfied(buff.conditionTags, character)) continue;
        }

        if (buff.stat === 'attack_speed' && buff.mode === 'percent_max') {
            parsedSpeedBuff = Math.max(parsedSpeedBuff, buff.value);
        } else if (buff.stat === 'attack_gap' && buff.mode === 'percent_reduction') {
            parsedGapReduction = Math.max(parsedGapReduction, buff.value);
        }
    }

    // 速度バフを合算（最大値ルール: パース済み, selfBuffs, environment）
    const attackSpeedBuff = Math.max(
        parsedSpeedBuff,
        (selfBuffs && selfBuffs.attackSpeed) || 0,
        environment.attackSpeed || 0
    );

    const gapReductionBuff = Math.max(
        parsedGapReduction,
        (selfBuffs && selfBuffs.gapReduction) || 0,
        environment.gapReduction || 0
    );

    // 伏兵配置による攻撃速度倍率を計算（千賀地氏城など）
    // 0または未設定の場合はキャラクターの最大数を使用
    let ambushSpeedMultiplier = 1;
    if (character.ambushInfo?.attackSpeedMultiplier) {
        const maxCount = character.ambushInfo.maxCount;
        const ambushCount = (environment.currentAmbushCount && environment.currentAmbushCount > 0)
            ? Math.min(environment.currentAmbushCount, maxCount)  // キャラクターの最大数で制限
            : maxCount;
        if (ambushCount > 0) {
            if (character.ambushInfo.isMultiplicative) {
                // 累乗計算: 1.4^2 = 1.96
                ambushSpeedMultiplier = Math.pow(character.ambushInfo.attackSpeedMultiplier, ambushCount);
            } else {
                // 加算計算: 1 + 0.4 * 2 = 1.8
                const perUnitBuff = character.ambushInfo.attackSpeedMultiplier - 1;
                ambushSpeedMultiplier = 1 + perUnitBuff * ambushCount;
            }
        }
    }

    // フレーム計算（伏兵バフは攻撃速度に乗算）
    const effectiveSpeedMultiplier = (1 + attackSpeedBuff / 100) * ambushSpeedMultiplier;
    const attackFrames = frameData.attack / effectiveSpeedMultiplier;
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
// 特殊攻撃ダメージ計算
// ========================================

function calculateSpecialAttackDamage(
    phase1Attack: number,
    phase2Damage: number,
    character: Character,
    environment: EnvironmentSettings
): {
    damage: number;
    multiplier: number;
    hits: number;
    defenseIgnore: boolean;
    cycleN: number;
    rangeMultiplier?: number;
    stackMultiplier?: number;
    effectiveMultiplier: number;
} | undefined {
    const specialAttack = character.specialAttack;
    if (!specialAttack) return undefined;

    const { multiplier, hits: rawHits, defenseIgnore, cycleN, rangeMultiplier, stackMultiplier } = specialAttack;
    // 既存データとの互換性: hitsが未設定の場合は1（単発）
    const hits = rawHits ?? 1;

    // 実効倍率 = 基本倍率 × スタック倍率（全ストック消費時）
    // 例: 7倍 × 3 = 21倍（大坂城の最大値）
    const effectiveMultiplier = multiplier * (stackMultiplier ?? 1);

    // 特殊攻撃ダメージ = Phase2ダメージ × 実効倍率
    // (Phase2時点で give_damage 等の乗算が適用済み)
    let damage = phase2Damage * effectiveMultiplier;

    // Phase 3: 防御力による減算（防御無視なら0）
    if (!defenseIgnore) {
        let effectiveDefense = environment.enemyDefense * (1 - environment.defenseDebuffPercent / 100);
        effectiveDefense = Math.max(0, effectiveDefense - environment.defenseDebuffFlat);
        damage = Math.max(1, damage - effectiveDefense);
    }

    // Phase 4: 与ダメ・被ダメによる増減
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    let selfDamageDealt = 0;
    for (const buff of allBuffs) {
        if (buff.stat !== 'damage_dealt' || buff.isActive === false) continue;
        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;
        let appliesToSelf = buff.target === 'self' || buff.target === 'all';
        if (buff.target === 'range' && buff.conditionTags?.length) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }
        if (!appliesToSelf) continue;
        selfDamageDealt = Math.max(selfDamageDealt, buff.value);
    }

    const damageDealt = Math.max(selfDamageDealt, environment.damageDealt || 0);
    const damageTaken = environment.damageTaken;
    damage = Math.floor(damage * (1 + damageDealt / 100) * (1 + damageTaken / 100));

    // 連撃数を適用（2連撃なら2倍のダメージ）
    const totalDamage = damage * hits;

    return { damage: totalDamage, multiplier, hits, defenseIgnore, cycleN, rangeMultiplier, stackMultiplier, effectiveMultiplier };
}

// ========================================
// 計略ダメージ計算
// ========================================

function calculateStrategyDamage(
    phase2Damage: number,
    character: Character,
    environment: EnvironmentSettings,
    normalDps: number
): {
    instantDamage: number;
    cycleDps: number;
    buffedDps?: number;
    multiplier: number;
    hits: number;
    maxMultiplier?: number;
    defenseIgnore: boolean;
    rangeMultiplier?: number;
    cycleDuration: number;
    buffDuration?: number;
    buffGiveDamage?: number;
    buffDamageDealt?: number;
    buffAttackSpeed?: number;
    buffAttackGap?: number;
    buffedCycleDps?: number;  // バフ効果中の特殊攻撃サイクルDPS（5回に1回発動考慮）
} | undefined {
    const strategyDamage = character.strategyDamage;
    if (!strategyDamage) return undefined;

    const {
        multiplier,
        hits,
        maxMultiplier,
        defenseIgnore,
        rangeMultiplier,
        cycleDuration,
        buffDuration,
        buffGiveDamage,
        buffDamageDealt,
        buffAttackSpeed,
        buffAttackGap,
    } = strategyDamage;

    // Phase2: 攻撃倍率と最大倍率を適用
    let damage = phase2Damage * multiplier;
    if (maxMultiplier) {
        damage *= maxMultiplier;
    }

    // Phase 3: 防御力による減算（防御無視なら0）
    if (!defenseIgnore) {
        let effectiveDefense = environment.enemyDefense * (1 - environment.defenseDebuffPercent / 100);
        effectiveDefense = Math.max(0, effectiveDefense - environment.defenseDebuffFlat);
        damage = Math.max(1, damage - effectiveDefense);
    }

    // Phase 4: 与ダメ・被ダメによる増減
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
        ...(character.specialAbilities || []),
    ];

    let selfDamageDealt = 0;
    for (const buff of allBuffs) {
        if (buff.stat !== 'damage_dealt' || buff.isActive === false) continue;
        // exclude_self タグがある場合は自身には適用しない
        if (buff.conditionTags?.includes('exclude_self')) continue;
        let appliesToSelf = buff.target === 'self' || buff.target === 'all';
        if (buff.target === 'range' && buff.conditionTags?.length) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }
        if (!appliesToSelf) continue;
        selfDamageDealt = Math.max(selfDamageDealt, buff.value);
    }

    const damageDealt = Math.max(selfDamageDealt, environment.damageDealt || 0);
    const damageTaken = environment.damageTaken;
    damage = Math.floor(damage * (1 + damageDealt / 100) * (1 + damageTaken / 100));

    // 連撃: Phase4の後で最終ダメージを乗算
    const instantDamage = damage * hits;

    // 効果時間中のDPS計算
    let buffedDps: number | undefined;
    if (buffGiveDamage || buffDamageDealt || buffAttackSpeed || buffAttackGap) {
        // Phase 2: 与えるダメージ倍率（乗算）
        const giveDamageMultiplier = buffGiveDamage || 1;

        // Phase 4: 与ダメ倍率（最大値ルール）
        let damageDealtAdjustment = 1;
        if (buffDamageDealt) {
            // buffDamageDealt は倍率（例: 2.5 = 250%）
            // これを%に変換: (2.5 - 1) * 100 = 150%
            const buffDamageDealtPercent = (buffDamageDealt - 1) * 100;
            const existingDamageDealt = environment.damageDealt || 0;

            // 最大値ルール: バフの方が大きければ差分を適用
            if (buffDamageDealtPercent > existingDamageDealt) {
                // 既存の与ダメを除去して新しい与ダメを適用
                // (1 + new%) / (1 + old%) の比率で補正
                damageDealtAdjustment = (1 + buffDamageDealtPercent / 100) / (1 + existingDamageDealt / 100);
            }
        }

        const attackSpeedMultiplier = buffAttackSpeed || 1;

        // 攻撃後の隙短縮によるDPS増加
        // 隙80%短縮 → gapFrames = original × (1 - 0.8) = original × 0.2
        // 攻撃フレームは変わらず、隙フレームのみ短縮
        let gapReductionMultiplier = 1;
        if (buffAttackGap && buffAttackGap > 0) {
            // 現在のフレーム構成から隙短縮の影響を計算
            const frameData = WEAPON_FRAMES[character.weapon];
            if (frameData) {
                const originalTotal = frameData.attack + frameData.gap;
                const reducedGap = frameData.gap * (1 - buffAttackGap / 100);
                const newTotal = frameData.attack + reducedGap;
                // DPSは総フレーム数に反比例するため、フレーム数の比率がDPS倍率
                gapReductionMultiplier = originalTotal / newTotal;
            }
        }

        buffedDps = normalDps * giveDamageMultiplier * damageDealtAdjustment * attackSpeedMultiplier * gapReductionMultiplier;
    }

    // バフ効果中の特殊攻撃サイクルDPS計算
    // 計略発動中に特殊攻撃（N回に1回）が発動する場合
    let buffedCycleDps: number | undefined;
    const specialAttack = character.specialAttack;
    if (specialAttack && buffedDps) {
        const { multiplier: spMultiplier, hits: spHits, cycleN } = specialAttack;

        // バフ効果中の通常ダメージ（与えるダメージ1.2倍等が適用済み）
        const buffedNormalDamage = (buffedDps / normalDps) * (normalDps / (60 / (WEAPON_FRAMES[character.weapon]?.attack + WEAPON_FRAMES[character.weapon]?.gap || 41)));

        // 特殊攻撃ダメージ = バフ効果中の通常ダメージ × 特殊攻撃倍率 × 連撃数
        // ただしPhase2ダメージを使用する必要がある
        // ここでは近似値として buffedNormalDamage × spMultiplier × spHits を使用
        const frameData = WEAPON_FRAMES[character.weapon];
        if (frameData) {
            // バフ効果中のフレーム計算
            const attackSpeedMultiplier = strategyDamage.buffAttackSpeed || 1;
            const attackFrames = frameData.attack / attackSpeedMultiplier;
            const gapReduction = strategyDamage.buffAttackGap || 0;
            const gapFrames = frameData.gap * (1 - gapReduction / 100);
            const totalFrames = attackFrames + gapFrames;

            // バフ効果中の1攻撃あたりダメージを逆算
            const buffedDamagePerAttack = buffedDps * (totalFrames / 60);

            // 特殊攻撃ダメージ
            const spDamage = buffedDamagePerAttack * spMultiplier * spHits;

            // サイクルDPS = ((N-1) × 通常ダメージ + 特殊攻撃ダメージ) / サイクル時間
            const totalCycleDamage = (cycleN - 1) * buffedDamagePerAttack + spDamage;
            const cycleTime = totalFrames * cycleN;
            buffedCycleDps = totalCycleDamage / (cycleTime / 60);
        }
    }

    // サイクルDPS計算
    // サイクルダメージ = 瞬間ダメージ + (バフDPS × バフ持続時間)
    // 特殊攻撃サイクルがある場合はそちらを使用
    const actualBuffDuration = buffDuration || cycleDuration;
    const effectiveDps = buffedCycleDps || buffedDps || normalDps;
    const buffDamage = effectiveDps * actualBuffDuration;
    const cycleDamage = instantDamage + buffDamage;
    const cycleDps = cycleDamage / cycleDuration;

    return {
        instantDamage,
        cycleDps,
        buffedDps,
        buffedCycleDps,
        multiplier,
        hits,
        maxMultiplier,
        defenseIgnore,
        rangeMultiplier,
        cycleDuration,
        buffDuration,
        buffGiveDamage,
        buffDamageDealt,
        buffAttackSpeed,
        buffAttackGap,
    };
}

/**
 * 特殊能力モード（計略発動中の通常攻撃置換）のDPSを計算
 *
 * 例: ［竜焔］仙台城
 * - 発動中（60秒）: 置換攻撃（2.5倍×2連）+ 与ダメ1.2倍 + 隙80%短縮 + 特殊攻撃（5回に1回）
 * - 非発動中（CT 60秒）: 通常攻撃 + 特殊攻撃（5回に1回）
 */
function calculateAbilityModeDps(
    phase2Damage: number,
    phase5Damage: number,
    character: Character,
    environment: EnvironmentSettings,
    normalDpsResult: { dps: number; breakdown: { totalFrames: number; attackFrames: number; gapFrames: number } }
): DamageBreakdown['abilityMode'] | undefined {
    const abilityMode = character.abilityMode;
    if (!abilityMode) return undefined;

    const { replacedAttack, giveDamage, gapReduction, duration, cooldown } = abilityMode;
    const specialAttack = character.specialAttack;

    const frameData = WEAPON_FRAMES[character.weapon];
    if (!frameData) return undefined;

    // ========================================
    // 発動中のDPS計算
    // ========================================

    // 与えるダメージ倍率（Phase 2 乗算）
    const giveDamageMultiplier = 1 + (giveDamage || 0) / 100;

    // 隙短縮によるフレーム調整
    const activeGapFrames = frameData.gap * (1 - (gapReduction || 0) / 100);
    const activeTotalFrames = frameData.attack + activeGapFrames;

    // 置換攻撃のダメージ（Phase 2ダメージ × 与ダメ倍率 × 置換攻撃倍率 × 連撃数）
    const replacedAttackDamage = phase2Damage * giveDamageMultiplier * replacedAttack.multiplier * replacedAttack.hits;

    // 置換攻撃のPhase 3/4処理
    let effectiveDefense = environment.enemyDefense * (1 - environment.defenseDebuffPercent / 100);
    effectiveDefense = Math.max(0, effectiveDefense - environment.defenseDebuffFlat);
    const replacedAfterDefense = Math.max(1, replacedAttackDamage - effectiveDefense);

    // Phase 4: 与ダメ・被ダメ（環境設定から）
    const damageDealt = environment.damageDealt || 0;
    const damageTaken = environment.damageTaken || 0;
    const replacedFinalDamage = Math.floor(replacedAfterDefense * (1 + damageDealt / 100) * (1 + damageTaken / 100));

    // 発動中のサイクルDPS
    let activeDps: number;
    if (specialAttack) {
        // 特殊攻撃も与ダメ1.2倍の影響を受ける
        const spMultiplier = specialAttack.multiplier;
        const spHits = specialAttack.hits;
        const cycleN = specialAttack.cycleN;

        // 特殊攻撃のダメージ（Phase 2 × 与ダメ倍率 × 特殊攻撃倍率）
        const spDamage = phase2Damage * giveDamageMultiplier * spMultiplier;

        // 特殊攻撃のPhase 3（防御無視判定）
        let spAfterDefense: number;
        if (specialAttack.defenseIgnore) {
            spAfterDefense = spDamage;
        } else {
            spAfterDefense = Math.max(1, spDamage - effectiveDefense);
        }

        // Phase 4 + 連撃
        const spFinalDamage = Math.floor(spAfterDefense * (1 + damageDealt / 100) * (1 + damageTaken / 100)) * spHits;

        // サイクルダメージ = 置換攻撃 × (N-1) + 特殊攻撃 × 1
        const cycleDamage = replacedFinalDamage * (cycleN - 1) + spFinalDamage;
        const cycleTime = activeTotalFrames * cycleN;
        activeDps = cycleDamage / (cycleTime / 60);
    } else {
        // 特殊攻撃がない場合は置換攻撃のみ
        activeDps = replacedFinalDamage / (activeTotalFrames / 60);
    }

    // ========================================
    // 非発動中のDPS計算
    // ========================================

    // 通常攻撃のダメージ（phase5Damage = 連撃込み最終ダメージ）
    const normalDamage = phase5Damage;
    const normalTotalFrames = normalDpsResult.breakdown.totalFrames;

    let inactiveDps: number;
    if (specialAttack) {
        const cycleN = specialAttack.cycleN;

        // 既存の特殊攻撃サイクルDPS計算を使用
        // 特殊攻撃ダメージは calculateSpecialAttackDamage で計算済み
        const spResult = calculateSpecialAttackDamage(
            0, // phase1Attack は使用しない
            phase2Damage,
            character,
            environment
        );

        if (spResult) {
            // サイクルダメージ = 通常攻撃 × (N-1) + 特殊攻撃 × 1
            const cycleDamage = normalDamage * (cycleN - 1) + spResult.damage;
            const cycleTime = normalTotalFrames * cycleN;
            inactiveDps = cycleDamage / (cycleTime / 60);
        } else {
            inactiveDps = normalDpsResult.dps;
        }
    } else {
        inactiveDps = normalDpsResult.dps;
    }

    // ========================================
    // 平均DPS計算（時間加重）
    // ========================================
    const totalCycleTime = duration + cooldown;
    const averageDps = (activeDps * duration + inactiveDps * cooldown) / totalCycleTime;
    const uptime = duration / totalCycleTime;

    return {
        replacedAttack,
        giveDamage,
        gapReduction,
        duration,
        cooldown,
        activeDps,
        inactiveDps,
        averageDps,
        uptime,
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
    const phase4 = calculatePhase4(phase3.damage, character, environment);

    // Phase 5: 連撃による乗算
    const phase5 = calculatePhase5(phase4.damage, character);

    // DPS計算
    const dpsCalc = calculateDPS(phase5.damage, character, environment);

    // 特殊攻撃ダメージ計算
    const specialAttackResult = calculateSpecialAttackDamage(
        phase1.attack,
        phase2.damage,
        character,
        environment
    );

    // サイクルDPS計算（特殊攻撃がある場合）
    let cycleDps: number | undefined;
    let specialAttackBreakdown: DamageBreakdown['specialAttack'] | undefined;

    if (specialAttackResult) {
        const { damage: spDamage, multiplier, hits, defenseIgnore, cycleN, rangeMultiplier, stackMultiplier, effectiveMultiplier } = specialAttackResult;

        // サイクルDPS = ((N-1) * 通常ダメージ + 1 * 特殊攻撃ダメージ) / サイクル時間
        const normalDamage = phase5.damage;
        const totalCycleDamage = (cycleN - 1) * normalDamage + spDamage;

        // サイクル時間 = N回分の攻撃時間
        const cycleTime = dpsCalc.breakdown.totalFrames * cycleN;
        cycleDps = totalCycleDamage / (cycleTime / 60); // 60FPS

        specialAttackBreakdown = {
            multiplier,
            hits,
            defenseIgnore,
            cycleN,
            rangeMultiplier,
            stackMultiplier,
            effectiveMultiplier,
            damage: spDamage,
            cycleDps,
        };
    }

    // 計略ダメージ計算
    const strategyDamageResult = calculateStrategyDamage(
        phase2.damage,
        character,
        environment,
        dpsCalc.dps
    );

    let strategyDamageBreakdown: DamageBreakdown['strategyDamage'] | undefined;
    if (strategyDamageResult) {
        strategyDamageBreakdown = {
            multiplier: strategyDamageResult.multiplier,
            hits: strategyDamageResult.hits,
            maxMultiplier: strategyDamageResult.maxMultiplier,
            defenseIgnore: strategyDamageResult.defenseIgnore,
            rangeMultiplier: strategyDamageResult.rangeMultiplier,
            cycleDuration: strategyDamageResult.cycleDuration,
            instantDamage: strategyDamageResult.instantDamage,
            cycleDps: strategyDamageResult.cycleDps,
            buffedDps: strategyDamageResult.buffedDps,
            buffedCycleDps: strategyDamageResult.buffedCycleDps,
            buffDuration: strategyDamageResult.buffDuration,
            buffGiveDamage: strategyDamageResult.buffGiveDamage,
            buffDamageDealt: strategyDamageResult.buffDamageDealt,
            buffAttackSpeed: strategyDamageResult.buffAttackSpeed,
            buffAttackGap: strategyDamageResult.buffAttackGap,
        };
    }

    // 特殊能力モード（計略発動中の通常攻撃置換）のDPS計算
    const abilityModeResult = calculateAbilityModeDps(
        phase2.damage,
        phase5.damage,
        character,
        environment,
        dpsCalc
    );

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
        specialAttackDamage: specialAttackResult?.damage,
        cycleDps,
        strategyDamage: strategyDamageResult?.instantDamage,
        strategyCycleDps: strategyDamageResult?.cycleDps,
        inspireAmount,
        breakdown: {
            phase1: phase1.breakdown,
            phase2: phase2.breakdown,
            phase3: phase3.breakdown,
            phase4: phase4.breakdown,
            phase5: phase5.breakdown,
            dps: dpsCalc.breakdown,
            specialAttack: specialAttackBreakdown,
            strategyDamage: strategyDamageBreakdown,
            abilityMode: abilityModeResult,
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

// ========================================
// ダメージ変動計算
// ========================================

/**
 * rawテキストから条件付きダメージ倍率を抽出
 */
function extractConditionalMultipliers(character: Character): ConditionalMultiplier[] {
    const multipliers: ConditionalMultiplier[] = [];

    const processTexts = (texts: string[] | undefined, source: 'skill' | 'strategy') => {
        if (!texts) return;

        for (const text of texts) {
            // 敵HP条件: 「耐久50%以下の敵に与えるダメージ1.4倍」
            const hpBelowMatch = /耐久(\d+)[%％]以下の敵に与えるダメージ(\d+(?:\.\d+)?)倍/.exec(text);
            if (hpBelowMatch) {
                const threshold = parseInt(hpBelowMatch[1]);
                multipliers.push({
                    value: parseFloat(hpBelowMatch[2]),
                    condition: `敵HP${threshold}%以下`,
                    scenario: threshold <= 30 ? 'enemy_hp_30' : 'enemy_hp_50',
                    source,
                    hpThreshold: threshold,
                });
            }

            // HP50%以上: 「耐久50%以上の敵に2倍のダメージ」
            const hpAboveMatch = /耐久(\d+)[%％]以上の敵に(\d+(?:\.\d+)?)倍/.exec(text);
            if (hpAboveMatch) {
                const threshold = parseInt(hpAboveMatch[1]);
                multipliers.push({
                    value: parseFloat(hpAboveMatch[2]),
                    condition: `敵HP${threshold}%以上`,
                    scenario: 'enemy_hp_100',
                    source,
                    hpThreshold: threshold,
                });
            }

            // HP依存スケーリング: 「敵の耐久が低い程...最大2倍」
            const hpScaleMatch = /敵の耐久が低い(?:程|ほど).*?最大(\d+(?:\.\d+)?)倍/.exec(text);
            if (hpScaleMatch) {
                multipliers.push({
                    value: parseFloat(hpScaleMatch[1]),
                    condition: '敵HP依存（最大）',
                    scenario: 'enemy_hp_1',
                    source,
                    isHpDependent: true,
                    maxMultiplier: parseFloat(hpScaleMatch[1]),
                });
            }

            // 与ダメ倍率: 「与ダメ2.5倍」「与えるダメージ2.5倍」
            const giveDamageMatch = /与(?:ダメ(?:ージ)?|えるダメージ)(?:が)?(\d+(?:\.\d+)?)倍/.exec(text);
            if (giveDamageMatch && !hpBelowMatch && !hpAboveMatch) {
                // 計略中かどうかを判定
                const isStrategy = source === 'strategy' || /計略/.test(text);
                multipliers.push({
                    value: parseFloat(giveDamageMatch[1]),
                    condition: isStrategy ? '計略中' : '常時',
                    scenario: isStrategy ? 'strategy_active' : 'base',
                    source,
                });
            }

            // 攻撃のN倍: 「攻撃の2倍の5連続攻撃」
            const attackMultMatch = /攻撃の?(\d+(?:\.\d+)?)倍の(?:連続)?攻撃/.exec(text);
            if (attackMultMatch) {
                multipliers.push({
                    value: parseFloat(attackMultMatch[1]),
                    condition: '計略発動時',
                    scenario: 'strategy_active',
                    source,
                });
            }

            // 漸増バフ: 「徐々に攻撃が上昇（最大250%）」
            const gradualMatch = /徐々に攻撃が?(?:上昇|増加).*?最大(\d+)[%％]/.exec(text);
            if (gradualMatch) {
                multipliers.push({
                    value: 1 + parseInt(gradualMatch[1]) / 100,
                    condition: '最大蓄積時',
                    scenario: 'max_stacks',
                    source,
                });
            }

            // 切替計略: 複数の倍率オプション
            const switchMatch = text.matchAll(/(\d+(?:\.\d+)?)倍/g);
            const switches = [...switchMatch].map(m => parseFloat(m[1]));
            if (switches.length >= 2 && /切替/.test(text)) {
                // 最大の倍率のみ追加
                const maxSwitch = Math.max(...switches);
                if (!multipliers.some(m => Math.abs(m.value - maxSwitch) < 0.01)) {
                    multipliers.push({
                        value: maxSwitch,
                        condition: '計略最大',
                        scenario: 'strategy_active',
                        source,
                    });
                }
            }
        }
    };

    processTexts(character.rawSkillTexts, 'skill');
    processTexts(character.rawStrategyTexts, 'strategy');

    // 重複除去
    return multipliers.filter((m, i, arr) =>
        arr.findIndex(x =>
            Math.abs(x.value - m.value) < 0.01 &&
            x.condition === m.condition
        ) === i
    );
}

/**
 * シナリオラベルを取得
 */
function getScenarioLabel(scenario: DamageScenario): string {
    const labels: Record<DamageScenario, string> = {
        'base': '基本',
        'enemy_hp_100': '敵HP100%',
        'enemy_hp_50': '敵HP50%',
        'enemy_hp_30': '敵HP30%',
        'enemy_hp_1': '敵HP1%',
        'strategy_active': '計略中',
        'max_stacks': '最大蓄積',
    };
    return labels[scenario];
}

/**
 * HP依存ダメージの補間計算
 * @param hpPercent 敵HP%（0-100）
 * @param maxMultiplier 最大倍率
 * @returns 現在の倍率（1.0 ～ maxMultiplier）
 */
function interpolateHpDamage(hpPercent: number, maxMultiplier: number): number {
    // HP100%で1倍、HP0%で最大倍率（線形補間）
    return 1 + (maxMultiplier - 1) * (1 - hpPercent / 100);
}

/**
 * ダメージレンジを計算（条件による変動幅）
 */
export function calculateDamageRange(
    character: Character,
    baseEnv: EnvironmentSettings
): DamageRange {
    const conditionalMultipliers = extractConditionalMultipliers(character);

    // ベース計算（条件なし）
    const baseResult = calculateDamage(character, baseEnv);

    // 各シナリオで計算
    const scenarios: DamageRange['scenarios'] = [];
    const scenarioSet = new Set<DamageScenario>();

    // 条件付き倍率からシナリオを抽出
    for (const mult of conditionalMultipliers) {
        if (!scenarioSet.has(mult.scenario) && mult.scenario !== 'base') {
            scenarioSet.add(mult.scenario);
        }
    }

    // シナリオごとに計算
    for (const scenario of scenarioSet) {
        const envCopy = { ...baseEnv };
        let additionalMultiplier = 1;

        // このシナリオで発動する倍率を適用
        for (const mult of conditionalMultipliers) {
            if (mult.scenario === scenario) {
                if (mult.isHpDependent && mult.maxMultiplier) {
                    // HP依存: シナリオに応じたHP%で補間
                    const hpPercent = scenario === 'enemy_hp_1' ? 1 :
                                     scenario === 'enemy_hp_30' ? 30 :
                                     scenario === 'enemy_hp_50' ? 50 : 100;
                    additionalMultiplier *= interpolateHpDamage(hpPercent, mult.maxMultiplier);
                } else {
                    additionalMultiplier *= mult.value;
                }
            }
            // HP閾値条件のチェック
            else if (mult.hpThreshold) {
                const scenarioHp = scenario === 'enemy_hp_1' ? 1 :
                                  scenario === 'enemy_hp_30' ? 30 :
                                  scenario === 'enemy_hp_50' ? 50 :
                                  scenario === 'enemy_hp_100' ? 100 : 50;

                // 「以下」条件
                if (mult.condition.includes('以下') && scenarioHp <= mult.hpThreshold) {
                    additionalMultiplier *= mult.value;
                }
                // 「以上」条件
                else if (mult.condition.includes('以上') && scenarioHp >= mult.hpThreshold) {
                    additionalMultiplier *= mult.value;
                }
            }
        }

        // 環境の乗算倍率に追加
        envCopy.damageMultiplier = (envCopy.damageMultiplier || 1) * additionalMultiplier;

        const result = calculateDamage(character, envCopy);
        scenarios.push({
            scenario,
            label: getScenarioLabel(scenario),
            result,
        });
    }

    // 最大DPSを特定
    const allResults = [baseResult, ...scenarios.map(s => s.result)];
    const maxResult = allResults.reduce((max, r) => r.dps > max.dps ? r : max, baseResult);

    return {
        base: baseResult,
        max: maxResult,
        scenarios: scenarios.sort((a, b) => b.result.dps - a.result.dps),
        conditionalMultipliers,
    };
}
