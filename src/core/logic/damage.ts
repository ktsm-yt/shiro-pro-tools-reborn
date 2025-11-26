import type { Character, DamageCalculationContext, DamageCalculationResult, Buff } from '../types';

interface DamageStats {
    attackFlat: number;
    attackPercent: number;
    attackMultipliers: number[];
    damagePercent: number;
    damageMultipliers: number[];
    enemyDefenseDebuffFlat: number;
    enemyDefenseDebuffPercent: number;
    ignoreDefense: boolean;
}

/**
 * キャラクターのバフを集計してダメージ計算用の中間パラメータを生成する
 */
function collectDamageStats(character: Character, context: DamageCalculationContext): DamageStats {
    const stats: DamageStats = {
        attackFlat: 0,
        attackPercent: 0,
        attackMultipliers: [],
        damagePercent: 0,
        damageMultipliers: [],
        enemyDefenseDebuffFlat: 0,
        enemyDefenseDebuffPercent: 0,
        ignoreDefense: false,
    };

    const allBuffs = [...character.skills, ...character.strategies];

    for (const buff of allBuffs) {
        if (!buff.isActive) continue;

        // 条件判定（簡易実装：条件タグがないか、条件を満たす場合のみ適用）
        // TODO: より詳細な条件判定ロジックの実装
        if (buff.conditionTags && buff.conditionTags.length > 0) {
            // 条件ロジックはここに追加
            // 例: if (buff.conditionTags.includes('hp_below_50') && context.allyHpPercent > 50) continue;
        }

        const value = buff.value;

        switch (buff.stat) {
            case 'attack':
                if (buff.mode === 'flat_sum') {
                    stats.attackFlat += value;
                } else if (buff.mode === 'percent_max') {
                    // 倍率（1.5倍など）の場合は乗算枠として扱うか、加算枠として扱うか
                    // analyzer側で (value - 1) * 100 に変換されている場合は加算枠
                    // ここでは単純に加算枠として扱う
                    stats.attackPercent += value;
                }
                break;

            case 'damage_dealt':
                if (buff.mode === 'percent_max') {
                    stats.damagePercent += value;
                }
                break;

            case 'defense':
                // 敵の防御デバフ（負の値）
                if (value < 0) {
                    if (buff.mode === 'flat_sum') {
                        stats.enemyDefenseDebuffFlat += Math.abs(value);
                    } else if (buff.mode === 'percent_max') {
                        stats.enemyDefenseDebuffPercent += Math.abs(value);
                    }
                }
                break;

            // TODO: その他のステータス（防御無視など）の処理
        }
    }

    return stats;
}

/**
 * キャラクターのダメージを計算する
 */
export function calculateDamage(
    character: Character,
    context: DamageCalculationContext
): DamageCalculationResult {
    // 1. バフの集計
    const stats = collectDamageStats(character, context);

    // 2. 攻撃力の計算
    const baseAttack = character.baseStats.attack;
    const attackBase = baseAttack + stats.attackFlat;
    const attackPercentMultiplier = Math.max(0, 1 + stats.attackPercent / 100);
    const attackMultiplierProduct = stats.attackMultipliers.reduce((acc, mult) => acc * mult, 1);

    const finalAttack = Math.max(0, attackBase * attackPercentMultiplier * attackMultiplierProduct);

    // 3. 有効防御力の計算
    let effectiveDefense = context.enemyDefense;
    if (stats.enemyDefenseDebuffFlat > 0) {
        effectiveDefense = Math.max(0, effectiveDefense - stats.enemyDefenseDebuffFlat);
    }
    if (stats.enemyDefenseDebuffPercent > 0) {
        const cappedPercent = Math.min(100, stats.enemyDefenseDebuffPercent);
        effectiveDefense = Math.max(0, effectiveDefense * (1 - cappedPercent / 100));
    }
    if (stats.ignoreDefense) {
        effectiveDefense = 0;
    }

    // 4. ダメージ倍率の計算
    const damagePercentMultiplier = Math.max(0, 1 + stats.damagePercent / 100);
    const damageMultiplierProduct = stats.damageMultipliers.reduce((acc, mult) => acc * mult, 1);
    const totalDamageMultiplier = damagePercentMultiplier * damageMultiplierProduct;

    // 5. 最終ダメージの計算
    let damagePerHit = Math.max(0, finalAttack - effectiveDefense);
    damagePerHit *= totalDamageMultiplier;
    const totalDamage = damagePerHit * context.hitCount;

    return {
        finalAttack,
        damagePerHit,
        totalDamage,
        effectiveDefense,
        receivedDamageMultiplier: 1.0, // TODO: 実装
        breakdown: {
            baseAttack,
            attackFlat: stats.attackFlat,
            attackPercent: stats.attackPercent,
            attackMultipliers: stats.attackMultipliers,
            damagePercent: stats.damagePercent,
            damageMultipliers: stats.damageMultipliers,
            enemyDefenseDebuffFlat: stats.enemyDefenseDebuffFlat,
            enemyDefenseDebuffPercent: stats.enemyDefenseDebuffPercent,
            ignoreDefense: stats.ignoreDefense,
        }
    };
}
