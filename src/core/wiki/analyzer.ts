import type { Character, Buff } from '../types';
import type { RawCharacterData } from './types';

let buffIdCounter = 0;

/**
 * バフテキストを解析してBuff配列に変換する
 * @param text バフの説明文（例: "攻撃力+30%"）
 * @returns 解析されたBuff配列
 */
/**
 * バフテキストを解析してBuff配列に変換する
 * @param text バフの説明文（例: "攻撃力+30%"）
 * @returns 解析されたBuff配列
 */
export function analyzeBuffText(text: string): Omit<Buff, 'id' | 'source' | 'isActive'>[] {
    const buffs: Omit<Buff, 'id' | 'source' | 'isActive'>[] = [];

    if (!text || text.trim() === '') {
        return buffs;
    }

    // ターゲット判定（優先順位: 範囲 > 全体 > 自己）
    let target: 'self' | 'range' | 'all' = 'self';
    if (text.includes('範囲内')) {
        target = 'range';
    } else if (text.includes('全体') || text.includes('味方全員') || text.includes('殿')) {
        target = 'all';
    }

    // 解析済み箇所を追跡して重複マッチを防ぐ
    const matchedRanges: { start: number; end: number }[] = [];
    const isOverlapping = (start: number, end: number) => {
        return matchedRanges.some(r =>
            (start >= r.start && start < r.end) ||
            (end > r.start && end <= r.end) ||
            (start <= r.start && end >= r.end)
        );
    };

    // バフ定義（優先度順：具体的なものから先に）
    const definitions: {
        pattern: RegExp;
        stat: Buff['stat'];
        mode: Buff['mode'];
        valueIndex: number; // 正規表現のキャプチャグループ番号
        isNegative?: boolean; // 値を負にするか（デバフなど）
    }[] = [
            // --- 攻撃系 ---
            // 攻撃割合
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'attack', mode: 'percent_max', valueIndex: 1 },
            { pattern: /攻撃(?:力)?\+(\d+)%/, stat: 'attack', mode: 'percent_max', valueIndex: 1 },
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'attack', mode: 'percent_max', valueIndex: 1 }, // 倍率は別途処理が必要だが一旦percent_maxで扱う（値の変換が必要）
            // 攻撃固定
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+)(?!%)(?:上昇|増加|アップ)/, stat: 'attack', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /攻撃(?:力)?\+(\d+)(?!%)/, stat: 'attack', mode: 'flat_sum', valueIndex: 1 },

            // --- 防御系 ---
            // 防御割合
            { pattern: /防御(?:力)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'defense', mode: 'percent_max', valueIndex: 1 },
            { pattern: /防御(?:力)?\+(\d+)%/, stat: 'defense', mode: 'percent_max', valueIndex: 1 },
            { pattern: /防御(?:力)?(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'defense', mode: 'percent_max', valueIndex: 1 },
            // 防御固定
            { pattern: /防御(?:力)?(?:が|を)?(\d+)(?!%)(?:上昇|増加|アップ)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /防御(?:力)?\+(\d+)(?!%)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1 },
            // 防御デバフ
            { pattern: /(?:敵の?)?防御(?:力)?(?:が|を)?(\d+)%(?:低下|減少|ダウン)/, stat: 'defense', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:敵の?)?防御(?:力)?(?:が|を)?(\d+)(?!%)(?:低下|減少|ダウン)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1, isNegative: true },

            // --- 射程系 ---
            // 射程割合
            { pattern: /射程(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'range', mode: 'percent_max', valueIndex: 1 },
            { pattern: /射程\+(\d+)%/, stat: 'range', mode: 'percent_max', valueIndex: 1 },
            // 射程固定
            { pattern: /射程(?:が|を)?(\d+)(?!%)(?:上昇|増加|アップ)/, stat: 'range', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /射程\+(\d+)(?!%)/, stat: 'range', mode: 'flat_sum', valueIndex: 1 },

            // --- ダメージ系 ---
            // 与ダメージ
            { pattern: /与える?ダメージ(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            { pattern: /与ダメ(?:ージ)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            { pattern: /与ダメ(?:ージ)?\+(\d+)%/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            // 被ダメージ軽減
            { pattern: /(?:受ける?|被)ダメージ(?:が|を)?(\d+)%(?:低下|減少|軽減|ダウン)/, stat: 'damage_taken', mode: 'percent_max', valueIndex: 1, isNegative: true },

            // --- その他 ---
            // コスト
            { pattern: /気(?:トークン)?(?:が|を)?(\d+)(?:低下|減少|軽減|ダウン)/, stat: 'cost', mode: 'flat_sum', valueIndex: 1, isNegative: true },
            // 再配置
            { pattern: /(?:再配置|復帰)(?:時間)?(?:が|を)?(\d+)%(?:短縮|減少|軽減)/, stat: 'cooldown', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:再配置|復帰)(?:時間)?\+(\d+)%/, stat: 'cooldown', mode: 'percent_max', valueIndex: 1, isNegative: true },
        ];

    for (const def of definitions) {
        // グローバル検索のために 'g' フラグを追加した新しいRegExpを作成
        const regex = new RegExp(def.pattern, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;

            if (isOverlapping(start, end)) {
                continue;
            }

            let value = parseFloat(match[def.valueIndex]);

            // 倍率表記（1.5倍など）の場合はパーセントに変換（+50%）
            if (match[0].includes('倍')) {
                value = (value - 1) * 100;
            }

            if (def.isNegative) {
                value = -value;
            }

            buffs.push({
                stat: def.stat,
                mode: def.mode,
                value,
                target,
            });

            matchedRanges.push({ start, end });
        }
    }

    return buffs;
}

/**
 * RawCharacterDataをCharacterオブジェクトに変換する
 * @param rawData Wiki解析で得られた生データ
 * @returns Character オブジェクト
 */
export function analyzeCharacter(rawData: RawCharacterData): Character {
    const skills: Buff[] = [];
    const strategies: Buff[] = [];

    // 特技テキストを解析
    for (const skillText of rawData.skillTexts) {
        const buffTemplates = analyzeBuffText(skillText);
        for (const template of buffTemplates) {
            skills.push({
                id: `buff_${buffIdCounter++}`,
                ...template,
                source: 'self_skill',
                isActive: true,
            });
        }
    }

    // 計略テキストを解析
    for (const strategyText of rawData.strategyTexts) {
        const buffTemplates = analyzeBuffText(strategyText);
        for (const template of buffTemplates) {
            strategies.push({
                id: `buff_${buffIdCounter++}`,
                ...template,
                source: 'strategy',
                isActive: true,
            });
        }
    }

    return {
        id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: rawData.name,
        weapon: rawData.weapon,
        attributes: rawData.attributes,
        baseStats: {
            attack: rawData.baseStats.attack ?? 0,
            defense: rawData.baseStats.defense ?? 0,
            range: rawData.baseStats.range ?? 0,
            cooldown: rawData.baseStats.cooldown ?? 0,
            cost: rawData.baseStats.cost ?? 0,
            damage_dealt: 0,
            damage_taken: 0,
        },
        skills,
        strategies,
    };
}
