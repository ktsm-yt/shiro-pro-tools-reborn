import type { Character, Buff } from '../types';
import type { RawCharacterData } from './types';

let buffIdCounter = 0;

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
    } else if (text.includes('全体') || text.includes('味方全員')) {
        target = 'all';
    }

    // ステータス名のマッピング
    const statMap: Record<string, Buff['stat']> = {
        '攻撃力': 'attack',
        '防御力': 'defense',
        '射程': 'range',
        '再配置': 'cooldown',
        'コスト': 'cost',
        '与ダメージ': 'damage_dealt',
        '被ダメージ': 'damage_taken',
    };

    // パーセントバフを検出した位置を記録（重複回避用）
    const percentMatchedIndices = new Set<number>();

    // パーセントバフのパターン: "攻撃力+30%"
    const percentPattern = /(攻撃力|防御力|射程|再配置|コスト|与ダメージ|被ダメージ)\+(\d+)%/g;
    let match;
    while ((match = percentPattern.exec(text)) !== null) {
        percentMatchedIndices.add(match.index);
        const statName = match[1];
        const value = parseInt(match[2], 10);
        const stat = statMap[statName];
        if (stat) {
            buffs.push({
                stat,
                mode: 'percent_max',
                value,
                target,
            });
        }
    }

    // 固定値バフのパターン: "攻撃力+50"（%がない）
    const flatPattern = /(攻撃力|防御力|射程|再配置|コスト)\+(\d+)/g;
    while ((match = flatPattern.exec(text)) !== null) {
        // パーセントバフとして既に処理済みの位置はスキップ
        if (percentMatchedIndices.has(match.index)) {
            continue;
        }

        const statName = match[1];
        const value = parseInt(match[2], 10);
        const stat = statMap[statName];
        if (stat) {
            buffs.push({
                stat,
                mode: 'flat_sum',
                value,
                target,
            });
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
