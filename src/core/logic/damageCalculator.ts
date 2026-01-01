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

    // skills/strategies から攻撃バフを抽出
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
    ];

    // 割合バフ（最大値ルール: target=self または target=range で自身に適用）
    let selfPercentBuff = 0;
    let flatBuffApplied = 0;
    let duplicateBuffSum = 0;
    const flatBuffDetails: Array<{ value: number; condition: string }> = [];

    // 条件タグのラベル変換
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

    for (const buff of allBuffs) {
        if (buff.stat !== 'attack' || buff.isActive === false) continue;
        // 自身に適用されるバフ: target=self または target=range（自身も射程内に含む）
        const appliesToSelf = buff.target === 'self' || buff.target === 'range';
        if (!appliesToSelf) continue;

        // 条件タグをチェック（絢爛城娘は50%など）
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            if (!areConditionsSatisfied(buff.conditionTags, character)) continue;
        }

        if (buff.mode === 'percent_max') {
            if (buff.isDuplicate) {
                // 効果重複バフは合算
                duplicateBuffSum += buff.value;
            } else {
                // 通常バフは最大値
                selfPercentBuff = Math.max(selfPercentBuff, buff.value);
            }
        } else if (buff.mode === 'flat_sum') {
            flatBuffApplied += buff.value;
            // 内訳を記録
            const condition = buff.conditionTags?.length
                ? buff.conditionTags.map(t => conditionLabels[t] || t).join('・')
                : '無条件';
            flatBuffDetails.push({ value: buff.value, condition });
        }
    }

    // selfBuffs からも取得（後方互換）
    if (selfBuffs) {
        const oldPercentBuff = applyMaxValueRule(selfBuffs.percentBuffs || []);
        selfPercentBuff = Math.max(selfPercentBuff, oldPercentBuff);
        flatBuffApplied += (selfBuffs.flatBuffs || []).reduce((sum, val) => sum + val, 0);
        duplicateBuffSum += (selfBuffs.duplicateBuffs || []).reduce((sum, val) => sum + val, 0);
    }

    const percentBuffApplied = selfPercentBuff + envAttackPercent;

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
    const finalAttack = attackBeforeDuplicate * (1 + duplicateBuffApplied / 100);

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

    // selfBuffs.damageMultipliers から抽出
    const selfBuffs = character.selfBuffs;
    if (selfBuffs && selfBuffs.damageMultipliers) {
        for (const mult of selfBuffs.damageMultipliers) {
            damage *= mult.value;
            multipliers.push({ type: mult.type, value: mult.value });
        }
    }

    // skills/strategies から give_damage を抽出
    // 同種効果ルール: 同じソース種別(skill/strategy)内で最大値のみ適用
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
    ];

    // 条件に該当するgive_damageバフを収集
    const skillGiveDamageBuffs: Array<{ multiplier: number; conditionKey: string }> = [];
    const strategyGiveDamageBuffs: Array<{ multiplier: number; conditionKey: string }> = [];

    for (const buff of allBuffs) {
        if (buff.stat !== 'give_damage' || buff.isActive === false) continue;

        // 自身に適用されるか判定
        let appliesToSelf = buff.target === 'self';

        // target=range の場合、条件タグに該当すれば自身にも適用
        if (buff.target === 'range' && buff.conditionTags && buff.conditionTags.length > 0) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }

        if (!appliesToSelf) continue;

        const multiplier = buff.mode === 'percent_max' ? 1 + buff.value / 100 : buff.value;
        const conditionKey = buff.conditionTags?.sort().join(',') || 'no_condition';

        // ソース別に分類
        if (buff.source === 'strategy') {
            strategyGiveDamageBuffs.push({ multiplier, conditionKey });
        } else {
            skillGiveDamageBuffs.push({ multiplier, conditionKey });
        }
    }

    // 同種効果ルール: 各ソース内で最大値のみ適用
    const applyMaxFromBuffs = (buffs: Array<{ multiplier: number; conditionKey: string }>, sourceType: string) => {
        if (buffs.length === 0) return;

        // 全バフから最大値を取得（同種効果として扱う）
        const maxMultiplier = Math.max(...buffs.map(b => b.multiplier));
        damage *= maxMultiplier;
        multipliers.push({ type: `give_damage`, value: maxMultiplier });
    };

    applyMaxFromBuffs(skillGiveDamageBuffs, 'skill');
    applyMaxFromBuffs(strategyGiveDamageBuffs, 'strategy');

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
    // skills/strategies から damage_dealt を抽出（最大値ルール）
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
    ];

    let selfDamageDealt = 0;
    for (const buff of allBuffs) {
        if (buff.stat !== 'damage_dealt' || buff.isActive === false) continue;

        // 自身に適用されるか判定
        let appliesToSelf = buff.target === 'self';

        // target=range の場合、条件タグに該当すれば自身にも適用
        if (buff.target === 'range' && buff.conditionTags && buff.conditionTags.length > 0) {
            if (areConditionsSatisfied(buff.conditionTags, character)) {
                appliesToSelf = true;
            }
        }

        if (!appliesToSelf) continue;
        selfDamageDealt = Math.max(selfDamageDealt, buff.value);
    }

    const damageDealt = Math.max(selfDamageDealt, environment.damageDealt || 0);

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

    // skills/strategies から速度・隙バフを抽出
    const allBuffs = [
        ...(character.skills || []),
        ...(character.strategies || []),
    ];

    let parsedSpeedBuff = 0;
    let parsedGapReduction = 0;

    for (const buff of allBuffs) {
        if (buff.isActive === false) continue;
        const appliesToSelf = buff.target === 'self' || buff.target === 'range';
        if (!appliesToSelf) continue;

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
    defenseIgnore: boolean;
    cycleN: number;
} | undefined {
    const specialAttack = character.specialAttack;
    if (!specialAttack) return undefined;

    const { multiplier, defenseIgnore, cycleN } = specialAttack;

    // 特殊攻撃ダメージ = Phase2ダメージ × 特殊攻撃倍率
    // (Phase2時点で give_damage 等の乗算が適用済み)
    let damage = phase2Damage * multiplier;

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
    ];

    let selfDamageDealt = 0;
    for (const buff of allBuffs) {
        if (buff.stat !== 'damage_dealt' || buff.isActive === false) continue;
        let appliesToSelf = buff.target === 'self';
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

    return { damage, multiplier, defenseIgnore, cycleN };
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
        const { damage: spDamage, multiplier, defenseIgnore, cycleN } = specialAttackResult;

        // サイクルDPS = ((N-1) * 通常ダメージ + 1 * 特殊攻撃ダメージ) / サイクル時間
        const normalDamage = phase5.damage;
        const totalCycleDamage = (cycleN - 1) * normalDamage + spDamage;

        // サイクル時間 = N回分の攻撃時間
        const cycleTime = dpsCalc.breakdown.totalFrames * cycleN;
        cycleDps = totalCycleDamage / (cycleTime / 60); // 60FPS

        specialAttackBreakdown = {
            multiplier,
            defenseIgnore,
            cycleN,
            damage: spDamage,
            cycleDps,
        };
    }

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
        inspireAmount,
        breakdown: {
            phase1: phase1.breakdown,
            phase2: phase2.breakdown,
            phase3: phase3.breakdown,
            phase4: phase4.breakdown,
            phase5: phase5.breakdown,
            dps: dpsCalc.breakdown,
            specialAttack: specialAttackBreakdown,
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
