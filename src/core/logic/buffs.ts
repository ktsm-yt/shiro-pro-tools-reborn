import type { Formation, Buff, Character, BuffMatrixResult, CharacterBuffResult } from '../types';

/**
 * 編成全体のバフを計算する
 * @param formation 編成データ
 * @returns バフ計算結果
 */
export function calcBuffMatrix(formation: Formation): BuffMatrixResult {
    const result: BuffMatrixResult = {};

    // 1. 結果オブジェクトの初期化
    formation.slots.forEach((char) => {
        if (!char) return;
        result[char.id] = {
            stats: {
                hp: char.baseStats.hp,
                attack: char.baseStats.attack,
                defense: char.baseStats.defense,
                range: char.baseStats.range,
                recovery: char.baseStats.recovery,
                cooldown: char.baseStats.cooldown,
                cost: char.baseStats.cost,
                damage_dealt: char.baseStats.damage_dealt,
                damage_taken: char.baseStats.damage_taken,
                attack_speed: char.baseStats.attack_speed,
                attack_gap: char.baseStats.attack_gap,
                movement_speed: char.baseStats.movement_speed,
                knockback: char.baseStats.knockback,
                target_count: char.baseStats.target_count,
                ki_gain: char.baseStats.ki_gain,
                damage_drain: char.baseStats.damage_drain,
                ignore_defense: char.baseStats.ignore_defense,
            },
            activeBuffs: [],
            percentMax: {},
            breakdown: {
                hp: { base: char.baseStats.hp, selfBuff: 0, allyBuff: 0 },
                attack: { base: char.baseStats.attack, selfBuff: 0, allyBuff: 0 },
                defense: { base: char.baseStats.defense, selfBuff: 0, allyBuff: 0 },
                range: { base: char.baseStats.range, selfBuff: 0, allyBuff: 0 },
                recovery: { base: char.baseStats.recovery, selfBuff: 0, allyBuff: 0 },
                cooldown: { base: char.baseStats.cooldown, selfBuff: 0, allyBuff: 0 },
                cost: { base: char.baseStats.cost, selfBuff: 0, allyBuff: 0 },
                damage_dealt: { base: char.baseStats.damage_dealt, selfBuff: 0, allyBuff: 0 },
                damage_taken: { base: char.baseStats.damage_taken, selfBuff: 0, allyBuff: 0 },
                attack_speed: { base: char.baseStats.attack_speed, selfBuff: 0, allyBuff: 0 },
                attack_gap: { base: char.baseStats.attack_gap, selfBuff: 0, allyBuff: 0 },
                movement_speed: { base: char.baseStats.movement_speed, selfBuff: 0, allyBuff: 0 },
                knockback: { base: char.baseStats.knockback, selfBuff: 0, allyBuff: 0 },
                target_count: { base: char.baseStats.target_count, selfBuff: 0, allyBuff: 0 },
                ki_gain: { base: char.baseStats.ki_gain, selfBuff: 0, allyBuff: 0 },
                damage_drain: { base: char.baseStats.damage_drain, selfBuff: 0, allyBuff: 0 },
                ignore_defense: { base: char.baseStats.ignore_defense, selfBuff: 0, allyBuff: 0 },
            }
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

                if (isBuffApplicable(buff, sourceChar, targetChar)) {
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
    targetChar: Character
): boolean {
    // 条件判定（タグなど）は後で実装
    // if (buff.conditionTags && !checkConditions(buff, targetChar)) return false;

    switch (buff.target) {
        case 'self':
            return sourceChar.id === targetChar.id;
        case 'all':
            return true;
        case 'range':
            // TODO: 射程内判定の実装。一旦「自分には適用、他人は適用」としておく（テスト用）
            // 実際はMap上の配置と射程計算が必要
            return true;
        default:
            return false;
    }
}
