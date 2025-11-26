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
                attack: 0,
                defense: 0,
                range: 0,
                cooldown: 0,
                cost: 0,
                damage_dealt: 0,
                damage_taken: 0,
            },
            activeBuffs: [],
            breakdown: {
                attack: { base: char.baseStats.attack, selfBuff: 0, allyBuff: 0 },
                defense: { base: char.baseStats.defense, selfBuff: 0, allyBuff: 0 },
                range: { base: char.baseStats.range, selfBuff: 0, allyBuff: 0 },
                cooldown: { base: char.baseStats.cooldown, selfBuff: 0, allyBuff: 0 },
                cost: { base: char.baseStats.cost, selfBuff: 0, allyBuff: 0 },
                damage_dealt: { base: char.baseStats.damage_dealt, selfBuff: 0, allyBuff: 0 },
                damage_taken: { base: char.baseStats.damage_taken, selfBuff: 0, allyBuff: 0 },
            }
        };
    });

    // 2. バフの集計
    formation.slots.forEach((sourceChar) => {
        if (!sourceChar) return;

        // 特技と計略をマージして処理
        const allBuffs = [...sourceChar.skills, ...sourceChar.strategies];

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
    const currentVal = result.stats[buff.stat];
    const breakdown = result.breakdown![buff.stat]!;

    if (buff.mode === 'percent_max') {
        // 最大値適用
        if (buff.value > currentVal) {
            result.stats[buff.stat] = buff.value;

            // 最大値更新時、内訳も更新（上書き）
            // 注意: percent_maxの場合、"最も高い効果"のみが有効になるため、
            // それが自己バフなら自己バフ分、味方バフなら味方バフ分として計上する
            breakdown.selfBuff = isSelfBuff ? buff.value : 0;
            breakdown.allyBuff = isSelfBuff ? 0 : buff.value;
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
