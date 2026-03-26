import type { Character, Buff, BaseStats } from '../types';

// DB row shapes (snake_case)
export interface DbCharacterRow {
    id: string;
    wiki_url: string | null;
    name: string;
    period: string | null;
    rarity: string | null;
    weapon: string;
    weapon_range: string | null;
    weapon_type: string | null;
    placement: string | null;
    attributes: string[];
    season_attributes: string[];
    base_stats: BaseStats;
    special_attack: Character['specialAttack'] | null;
    strategy_damage: Character['strategyDamage'] | null;
    ability_mode: Character['abilityMode'] | null;
    range_to_attack: Character['rangeToAttack'] | null;
    conditional_give_damage: Character['conditionalGiveDamage'] | null;
    ambush_info: Character['ambushInfo'] | null;
    image_url: string | null;
    raw_skill_texts: string[];
    raw_strategy_texts: string[];
    raw_special_texts: string[];
    review_status: string;
    parser_version: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbBuffRow {
    id: string;
    character_id: string;
    stat: string;
    mode: string;
    value: number;
    source: string;
    target: string;
    condition_tags: string[];
    is_active: boolean;
    is_duplicate: boolean;
    duplicate_efficiency: number | null;
    non_stacking: boolean;
    stackable: boolean;
    max_stacks: number | null;
    is_dynamic: boolean;
    dynamic_type: string | null;
    unit_value: number | null;
    confidence: string;
    raw_text: string | null;
    buff_group: string;
    is_manual_override: boolean;
    note: string | null;
    created_at: string;
}

export function characterToDbRow(char: Character, wikiUrl?: string): Omit<DbCharacterRow, 'id' | 'created_at' | 'updated_at'> {
    return {
        wiki_url: wikiUrl ?? null,
        name: char.name,
        period: char.period ?? null,
        rarity: char.rarity ?? null,
        weapon: char.weapon,
        weapon_range: char.weaponRange ?? null,
        weapon_type: char.weaponType ?? null,
        placement: char.placement ?? null,
        attributes: char.attributes,
        season_attributes: char.seasonAttributes ?? [],
        base_stats: char.baseStats,
        special_attack: char.specialAttack ?? null,
        strategy_damage: char.strategyDamage ?? null,
        ability_mode: char.abilityMode ?? null,
        range_to_attack: char.rangeToAttack ?? null,
        conditional_give_damage: char.conditionalGiveDamage ?? null,
        ambush_info: char.ambushInfo ?? null,
        image_url: char.imageUrl ?? null,
        raw_skill_texts: char.rawSkillTexts ?? [],
        raw_strategy_texts: char.rawStrategyTexts ?? [],
        raw_special_texts: char.rawSpecialTexts ?? [],
        review_status: 'unreviewed',
        parser_version: null,
    };
}

export function dbRowToCharacter(row: DbCharacterRow, buffs: DbBuffRow[]): Character {
    const skillBuffs = buffs.filter(b => b.buff_group === 'skills').map(dbBuffToAppBuff);
    const strategyBuffs = buffs.filter(b => b.buff_group === 'strategies').map(dbBuffToAppBuff);
    const specialBuffs = buffs.filter(b => b.buff_group === 'specialAbilities').map(dbBuffToAppBuff);

    return {
        id: row.id,
        name: row.name,
        period: row.period ?? undefined,
        rarity: row.rarity ?? undefined,
        weapon: row.weapon,
        weaponRange: row.weapon_range as Character['weaponRange'],
        weaponType: row.weapon_type as Character['weaponType'],
        placement: row.placement as Character['placement'],
        attributes: row.attributes,
        seasonAttributes: row.season_attributes,
        baseStats: row.base_stats,
        skills: skillBuffs,
        strategies: strategyBuffs,
        specialAbilities: specialBuffs,
        specialAttack: row.special_attack ?? undefined,
        strategyDamage: row.strategy_damage ?? undefined,
        abilityMode: row.ability_mode ?? undefined,
        rangeToAttack: row.range_to_attack ?? undefined,
        conditionalGiveDamage: row.conditional_give_damage ?? undefined,
        ambushInfo: row.ambush_info ?? undefined,
        imageUrl: row.image_url ?? undefined,
        rawSkillTexts: row.raw_skill_texts,
        rawStrategyTexts: row.raw_strategy_texts,
        rawSpecialTexts: row.raw_special_texts,
    };
}

export function buffToDbRow(buff: Buff, characterId: string): Omit<DbBuffRow, 'id' | 'created_at'> {
    return {
        character_id: characterId,
        stat: buff.stat,
        mode: buff.mode,
        value: buff.value,
        source: buff.source,
        target: buff.target,
        condition_tags: buff.conditionTags ?? [],
        is_active: buff.isActive,
        is_duplicate: buff.isDuplicate ?? false,
        duplicate_efficiency: buff.duplicateEfficiency ?? null,
        non_stacking: buff.nonStacking ?? false,
        stackable: buff.stackable ?? false,
        max_stacks: buff.maxStacks ?? null,
        is_dynamic: buff.isDynamic ?? false,
        dynamic_type: buff.dynamicType ?? null,
        unit_value: buff.unitValue ?? null,
        confidence: buff.confidence ?? 'certain',
        raw_text: buff.rawText ?? null,
        buff_group: buff.buffGroup ?? 'skills',
        is_manual_override: false,
        note: buff.note ?? null,
    };
}

function dbBuffToAppBuff(row: DbBuffRow): Buff {
    return {
        id: row.id,
        stat: row.stat as Buff['stat'],
        mode: row.mode as Buff['mode'],
        value: row.value,
        source: row.source as Buff['source'],
        target: row.target as Buff['target'],
        conditionTags: row.condition_tags as Buff['conditionTags'],
        isActive: row.is_active,
        isDuplicate: row.is_duplicate,
        duplicateEfficiency: row.duplicate_efficiency ?? undefined,
        nonStacking: row.non_stacking,
        stackable: row.stackable,
        maxStacks: row.max_stacks ?? undefined,
        isDynamic: row.is_dynamic,
        dynamicType: row.dynamic_type as Buff['dynamicType'],
        unitValue: row.unit_value ?? undefined,
        confidence: row.confidence as Buff['confidence'],
        rawText: row.raw_text ?? undefined,
        buffGroup: row.buff_group as Buff['buffGroup'],
        note: row.note ?? undefined,
    };
}
