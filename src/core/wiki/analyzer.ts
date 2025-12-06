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
    // "範囲内の敵" はデバフ対象だが、バフのターゲットとしては "range" (範囲内の味方へのバフ) と区別が必要
    // しかし現状のシステムでは "range" は "範囲内の味方" を指すことが多い
    // 文脈によるが、簡易的にキーワードで判定
    let target: 'self' | 'range' | 'all' = 'self';

    if (text.includes('味方全員') || text.includes('味方全体') || text.includes('全ての城娘') || text.includes('殿')) {
        target = 'all';
    } else if (text.includes('範囲内') || text.includes('射程内')) {
        target = 'range';
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
        unit?: string; // 単位（デバッグ用）
    }[] = [
            // --- 攻撃系 ---
            // 攻撃割合
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'attack', mode: 'percent_max', valueIndex: 1 },
            { pattern: /攻撃(?:力)?\+(\d+)%/, stat: 'attack', mode: 'percent_max', valueIndex: 1 },
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'attack', mode: 'percent_max', valueIndex: 1, unit: '×' },
            // 攻撃固定
            { pattern: /攻撃(?:力)?(?:が|を)?(\d+)(?!%)(?:上昇|増加|アップ)/, stat: 'attack', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /攻撃(?:力)?\+(\d+)(?!%)/, stat: 'attack', mode: 'flat_sum', valueIndex: 1 },
            // 攻撃デバフ
            { pattern: /(?:敵の?)?攻撃(?:力)?(?:が|を)?(\d+)%(?:低下|減少|ダウン)/, stat: 'attack', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:敵の?)?攻撃(?:力)?(?:が|を)?(\d+)(?:低下|減少|ダウン)/, stat: 'attack', mode: 'flat_sum', valueIndex: 1, isNegative: true },

            // --- 防御系 ---
            // 防御割合
            { pattern: /防御(?:力)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'defense', mode: 'percent_max', valueIndex: 1 },
            { pattern: /防御(?:力)?\+(\d+)%/, stat: 'defense', mode: 'percent_max', valueIndex: 1 },
            { pattern: /防御(?:力)?(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'defense', mode: 'percent_max', valueIndex: 1, unit: '×' },
            // 防御固定
            { pattern: /防御(?:力)?(?:が|を)?(\d+)(?!%)(?:上昇|増加|アップ)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /防御(?:力)?\+(\d+)(?!%)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1 },
            // 防御デバフ
            { pattern: /(?:敵の?)?防御(?:力)?(?:が|を)?(\d+)%(?:低下|減少|ダウン)/, stat: 'defense', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:敵の?)?防御(?:力)?(?:が|を)?(\d+)(?:低下|減少|ダウン)/, stat: 'defense', mode: 'flat_sum', valueIndex: 1, isNegative: true },
            // 防御無視
            { pattern: /防御[をが]?無視/, stat: 'ignore_defense', mode: 'flat_sum', valueIndex: 0 }, // 値はダミー(1)

            // --- 耐久・回復系 ---
            // 耐久割合
            { pattern: /耐久(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'hp', mode: 'percent_max', valueIndex: 1 },
            { pattern: /耐久\+(\d+)%/, stat: 'hp', mode: 'percent_max', valueIndex: 1 },
            { pattern: /耐久(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'hp', mode: 'percent_max', valueIndex: 1, unit: '×' },
            // 回復
            { pattern: /回復[がを]?(\d+)(?:上昇|アップ|UP|増加)/, stat: 'recovery', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /回復\+(\d+)/, stat: 'recovery', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /回復[がを]?(\d+(?:\.\d+)?)倍/, stat: 'recovery', mode: 'percent_max', valueIndex: 1, unit: '×' },

            // --- 射程系 ---
            // 射程割合
            { pattern: /射程(?:[がをと]|は)?\s*(\d+(?:\.\d+)?)%(?:上昇|アップ|UP|増加)/, stat: 'range', mode: 'percent_max', valueIndex: 1 },
            { pattern: /射程\+(\d+)%/, stat: 'range', mode: 'percent_max', valueIndex: 1 },
            { pattern: /射程(?:[がをと]|は)?\s*(\d+(?:\.\d+)?)%(?:低下|減少|ダウン|DOWN)/, stat: 'range', mode: 'percent_max', valueIndex: 1, isNegative: true },
            // 射程固定
            { pattern: /射程(?:[がをと]|は)?\s*(\d+)(?!%)(?:上昇|アップ|UP|増加)/, stat: 'range', mode: 'flat_sum', valueIndex: 1 },
            { pattern: /射程\+(\d+)(?!%)/, stat: 'range', mode: 'flat_sum', valueIndex: 1 },

            // --- ダメージ系 ---
            // 与ダメージ
            { pattern: /与ダメ(?:ージ)?(?:が|を)?(\d+)%(?:上昇|増加|アップ)/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            { pattern: /与ダメ(?:ージ)?\+(\d+)%/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            { pattern: /与える?ダメージ(?:が|を)?(\d+(?:\.\d+)?)倍/, stat: 'damage_dealt', mode: 'percent_max', valueIndex: 1 },
            // 被ダメージ軽減
            { pattern: /(?:受ける?|被)ダメージ(?:が|を)?(\d+)%(?:低下|減少|軽減|ダウン)/, stat: 'damage_taken', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:受ける?|被)ダメージ(?:が|を)?(\d+)%(?:上昇|増加)/, stat: 'damage_taken', mode: 'percent_max', valueIndex: 1 }, // デメリット

            // --- その他 ---
            // コスト
            { pattern: /気(?:トークン)?(?:が|を)?(\d+)(?:低下|減少|軽減|ダウン)/, stat: 'cost', mode: 'flat_sum', valueIndex: 1, isNegative: true },
            // 再配置
            { pattern: /(?:再配置|復帰)(?:時間)?(?:が|を)?(\d+)%(?:短縮|減少|軽減)/, stat: 'cooldown', mode: 'percent_max', valueIndex: 1, isNegative: true },
            { pattern: /(?:再配置|復帰)(?:時間)?\+(\d+)%/, stat: 'cooldown', mode: 'percent_max', valueIndex: 1, isNegative: true },
            // 隙短縮
            { pattern: /(?:攻撃後の)?隙(?:が|を)?(\d+)%(?:短縮|減少|軽減)/, stat: 'cooldown', mode: 'percent_max', valueIndex: 1, isNegative: true }, // 便宜上cooldownとして扱うか、専用statを作るか。一旦cooldown
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
    const specials: Buff[] = [];

    // 特技テキストを解析
    for (const skillText of rawData.skillTexts) {
        const buffTemplates = analyzeBuffText(skillText);
        for (const template of buffTemplates) {
            skills.push({
                id: `buff_${buffIdCounter++}`,
                ...template,
                source: 'self_skill',
                isActive: false,
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
                isActive: false,
            });
        }
    }

    // 特殊能力テキストを解析
    if (rawData.specialTexts) {
        for (const specialText of rawData.specialTexts) {
            const buffTemplates = analyzeBuffText(specialText);
            for (const template of buffTemplates) {
                specials.push({
                    id: `buff_${buffIdCounter++}`,
                    ...template,
                    source: 'special_ability',
                    isActive: false,
                });
            }
        }
    }

    return {
        id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: rawData.name,
        period: rawData.period,
        weapon: rawData.weapon,
        weaponRange: rawData.weaponRange,
        weaponType: rawData.weaponType,
        placement: rawData.placement,
        attributes: rawData.attributes,
        baseStats: {
            hp: rawData.baseStats.hp ?? 0,
            attack: rawData.baseStats.attack ?? 0,
            defense: rawData.baseStats.defense ?? 0,
            range: rawData.baseStats.range ?? 0,
            recovery: rawData.baseStats.recovery ?? 0,
            cooldown: rawData.baseStats.cooldown ?? 0,
            cost: rawData.baseStats.cost ?? 0,
            damage_dealt: 0,
            damage_taken: 0,
            attack_speed: 0,
            attack_gap: 0,
            movement_speed: 0,
            knockback: 0,
            target_count: 0,
            ki_gain: 0,
            damage_drain: 0,
            ignore_defense: 0,
        },
        skills,
        strategies,
        specialAbilities: specials,
        rawSkillTexts: rawData.skillTexts,
        rawStrategyTexts: rawData.strategyTexts,
        rawSpecialTexts: rawData.specialTexts,
    };
}
