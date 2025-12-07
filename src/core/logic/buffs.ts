import type { Formation, Buff, Character, BuffMatrixResult, CharacterBuffResult, Stat, ConditionContext, Target } from '../types';
import { areConditionsSatisfied } from '../conditions';

const STAT_ORDER: Stat[] = [
    'hp',
    'attack',
    'defense',
    'range',
    'attack_speed',
    'attack_gap',
    'recovery',
    'cost',
    'strategy_cooldown',
    'target_count',
    'attack_count',
    'damage_dealt',
    'give_damage',
    'damage_taken',
    'damage_recovery',
    'critical_bonus',
    'inspire',
    'enemy_attack',
    'enemy_defense',
    'enemy_defense_ignore_percent',
    'enemy_defense_ignore_complete',
    'enemy_movement',
    'enemy_range',
    'enemy_knockback',
    // legacy placeholders
    'cooldown',
    'movement_speed',
    'knockback',
    'ki_gain',
    'damage_drain',
    'ignore_defense',
];

/**
 * 編成全体のバフを計算する
 * @param formation 編成データ
 * @returns バフ計算結果
 */
export function calcBuffMatrix(formation: Formation, conditionContext?: ConditionContext): BuffMatrixResult {
    const result: BuffMatrixResult = {};

    // 1. 結果オブジェクトの初期化
    formation.slots.forEach((char) => {
        if (!char) return;

        const initStats: any = {};
        const breakdown: any = {};
        STAT_ORDER.forEach((stat: Stat) => {
            const baseVal = char.baseStats[stat] ?? 0;
            initStats[stat] = baseVal;
            breakdown[stat] = { base: baseVal, selfBuff: 0, allyBuff: 0 };
        });

        result[char.id] = {
            stats: initStats,
            activeBuffs: [],
            percentMax: {},
            breakdown,
        };
    });

    // 2. バフの集計
    formation.slots.forEach((sourceChar) => {
        if (!sourceChar) return;

        // 特技と計略をマージして処理
        const allBuffs = [
            ...(sourceChar.skills || []),
            ...(sourceChar.strategies || []),
            ...(sourceChar.specialAbilities || []),
        ];

        allBuffs.forEach((buff) => {
            if (!buff.isActive) return;

            // バフの適用対象となるキャラを探す
            formation.slots.forEach((targetChar) => {
                if (!targetChar) return;

                if (isBuffApplicable(buff, sourceChar, targetChar, conditionContext)) {
                    const isSelfBuff = sourceChar.id === targetChar.id;
                    applyBuffToResult(result[targetChar.id], buff, isSelfBuff);
                }
            });
        });
    });

    return result;
}

function applyBuffToResult(result: CharacterBuffResult, buff: Buff, isSelfBuff: boolean) {
    const breakdown = result.breakdown![buff.stat]!;
    const base = breakdown.base;

    if (buff.mode === 'percent_max') {
        const percentMap = result.percentMax || (result.percentMax = {});
        const prev = percentMap[buff.stat];
        if (!prev || buff.value > prev.value) {
            // 既存の%バフを引き剥がす（最大値更新時）
            if (prev) {
                const prevDelta = base * (prev.value / 100);
                result.stats[buff.stat] -= prevDelta;
                if (prev.isSelf) {
                    breakdown.selfBuff -= prevDelta;
                } else {
                    breakdown.allyBuff -= prevDelta;
                }
            }

            const delta = base * (buff.value / 100);
            result.stats[buff.stat] += delta;
            if (isSelfBuff) {
                breakdown.selfBuff += delta;
            } else {
                breakdown.allyBuff += delta;
            }

            percentMap[buff.stat] = { value: buff.value, isSelf: isSelfBuff };
        }
    } else if (buff.mode === 'flat_sum') {
        // 加算
        result.stats[buff.stat] += buff.value;

        // 加算の場合は単純に積み上げ
        if (isSelfBuff) {
            breakdown.selfBuff += buff.value;
        } else {
            breakdown.allyBuff += buff.value;
        }
    } else if (buff.mode === 'percent_reduction') {
        const delta = base * (buff.value / 100);
        result.stats[buff.stat] -= delta;
        if (isSelfBuff) {
            breakdown.selfBuff -= delta;
        } else {
            breakdown.allyBuff -= delta;
        }
    } else if (buff.mode === 'absolute_set') {
        const prev = result.stats[buff.stat] ?? 0;
        const delta = buff.value - prev;
        result.stats[buff.stat] = buff.value;
        if (isSelfBuff) {
            breakdown.selfBuff += delta;
        } else {
            breakdown.allyBuff += delta;
        }
    }

    result.activeBuffs.push(buff);
}

/**
 * バフがキャラクターに適用可能か判定する
 * @param buff バフデータ
 * @param sourceChar バフ発動者
 * @param targetChar バフ適用対象
 * @returns 適用可能な場合true
 */
export function isBuffApplicable(
    buff: Buff,
    sourceChar: Character,
    targetChar: Character,
    conditionContext?: ConditionContext
): boolean {
    if (buff.conditionTags && !areConditionsSatisfied(buff.conditionTags, targetChar, conditionContext)) {
        return false;
    }

    switch (buff.target as Target) {
        case 'self':
            return sourceChar.id === targetChar.id;
        case 'ally':
            // 対象指定は本来単体だが座標情報がないため一旦全員に適用
            return true;
        case 'all':
            return true;
        case 'range':
            // TODO: 射程内判定の実装。一旦「自分には適用、他人は適用」としておく（テスト用）
            // 実際はMap上の配置と射程計算が必要
            return true;
        case 'field':
            return true;
        case 'out_of_range':
            return true;
        default:
            return false;
    }
}
