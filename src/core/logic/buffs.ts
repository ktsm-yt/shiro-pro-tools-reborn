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
                    applyBuffToResult(result[targetChar.id], buff);
                }
            });
        });
    });

    return result;
}

function applyBuffToResult(result: CharacterBuffResult, buff: Buff) {
    const currentVal = result.stats[buff.stat];

    if (buff.mode === 'percent_max') {
        // 最大値適用
        if (buff.value > currentVal) {
            result.stats[buff.stat] = buff.value;
            // 既存の同種バフを削除して入れ替え（厳密には履歴を残すべきだが一旦シンプルに）
            // TODO: UI表示用に「上書きされたバフ」も残すか検討
        }
    } else if (buff.mode === 'flat_sum') {
        // 加算
        result.stats[buff.stat] += buff.value;
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
