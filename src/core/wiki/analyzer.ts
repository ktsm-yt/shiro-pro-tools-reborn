import type { Character, Buff } from '../types';
import type { RawCharacterData } from './types';
import { parseSkillLine } from '../parser/buffParser';
import { convertToRebornBuff, createBuffId } from '../parser/converter';

let buffIdCounter = 0;

export function analyzeBuffText(text: string): Omit<Buff, 'id' | 'source' | 'isActive'>[] {
    if (!text || text.trim() === '') return [];
    const parsed = parseSkillLine(text);
    if (process.env.DEBUG_BUFF === '1') {
        // eslint-disable-next-line no-console
        console.log('[DEBUG_BUFF]', text, parsed);
    }
    const uniq = new Map<string, Omit<Buff, 'id' | 'source' | 'isActive'>>();
    parsed.map(convertToRebornBuff).forEach(b => {
        const key = `${b.stat}-${b.mode}-${b.value}-${b.target}`;
        if (!uniq.has(key)) uniq.set(key, b);
    });
    return Array.from(uniq.values());
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
            damage_dealt: rawData.baseStats.damage_dealt ?? 0,
            damage_taken: rawData.baseStats.damage_taken ?? 0,
            attack_speed: rawData.baseStats.attack_speed ?? 0,
            attack_gap: rawData.baseStats.attack_gap ?? 0,
            movement_speed: rawData.baseStats.movement_speed ?? 0,
            knockback: rawData.baseStats.knockback ?? 0,
            target_count: rawData.baseStats.target_count ?? 0,
            ki_gain: rawData.baseStats.ki_gain ?? 0,
            damage_drain: rawData.baseStats.damage_drain ?? 0,
            ignore_defense: rawData.baseStats.ignore_defense ?? 0,
        },
        skills,
        strategies,
        specialAbilities: specials,
        rawSkillTexts: rawData.skillTexts,
        rawStrategyTexts: rawData.strategyTexts,
        rawSpecialTexts: rawData.specialTexts,
    };
}
