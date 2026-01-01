import type { Character, ConditionContext, ConditionTag } from './types';

export type DisplayLevel = 'prominent' | 'normal' | 'subtle';

type ConditionDetectionPattern = {
    pattern: RegExp;
    tags: ConditionTag[];
    priority: number;
    exclusive: boolean;
    category: string;
};

/**
 * 除外する条件パターン（前提条件のためConditionTagに含めない）
 */
export const EXCLUDED_CONDITION_PATTERNS: RegExp[] = [
    /計略(?:発動)?中/,
    /計略(?:使用)?時/,
    /特技(?:発動)?中/,
    /特技(?:使用)?時/,
    /巨大化時/,
    /巨大化(?:する)?(?:と|すると)/,
    /効果時間[：:]\s*\d+秒/,
    /\d+秒間/,
    /効果重複/,
    /重複可(?:能)?/,
    /ゲージ蓄積/,
    /最大ストック/,
    /時間経過で/,
    /徐々に/,
];

/**
 * ConditionTagごとの優先度（UI表示・ソート用）
 */
export const CONDITION_PRIORITY: Record<ConditionTag, number> = {
    hp_above_50: 9,
    hp_below_50: 9,
    hp_above_70: 8,
    hp_below_30: 8,
    hp_full: 7,

    melee: 6,
    ranged: 6,
    physical: 6,
    magical: 6,
    water: 6,
    plain: 6,
    mountain: 6,
    plain_mountain: 6,
    hell: 6,
    fictional: 6,
    summer: 6,
    kenran: 6,
    halloween: 6,
    school: 6,
    christmas: 6,
    new_year: 6,
    moon_viewing: 6,
    bride: 6,
    giant_3_plus: 5,
    giant_4_plus: 5,
    giant_5: 5,
    ambush: 5,
    lord: 5,
    flying_enemy: 5,
    ground_enemy: 5,
    boss_enemy: 5,
    same_weapon: 3,
    different_weapon: 3,
    night_battle: 2,
    continuous_deploy: 2,
    on_water: 6,
    exclude_self: 5,
    hp_dependent: 7,
    on_placement: 6,
    giant_1_plus: 1,
    giant_2_plus: 1,
    castle_girl: 1,
} as const;

/**
 * 検出パターン定義
 */
export const CONDITION_DETECTION_PATTERNS: ConditionDetectionPattern[] = [
    // 配置/水上マーカー
    { pattern: /【配置】|配置(?:時|と同時)/i, tags: ['on_placement'], priority: 120, exclusive: false, category: 'trigger' },
    { pattern: /【水上】|水上(?:マップ)?/i, tags: ['on_water'], priority: 115, exclusive: false, category: 'terrain' },

    // 除外条件
    { pattern: /自身を除く|自分を除く/i, tags: ['exclude_self'], priority: 110, exclusive: false, category: 'exclusion' },

    // HP依存（耐久依存を含む）
    { pattern: /(?:HP|耐久)(?:に)?依存|(?:HP|耐久)(?:が)?高いほど|(?:HP|耐久)に応じて?/i, tags: ['hp_dependent'], priority: 105, exclusive: false, category: 'hp_dependency' },

    // 武器種
    { pattern: /近接(?:武器)?(?:のみ|限定)?/i, tags: ['melee'], priority: 100, exclusive: true, category: 'weapon_range' },
    { pattern: /遠隔(?:武器)?(?:のみ|限定)?/i, tags: ['ranged'], priority: 100, exclusive: true, category: 'weapon_range' },
    { pattern: /物理(?:攻撃)?(?:のみ|限定)?/i, tags: ['physical'], priority: 95, exclusive: true, category: 'attack_type' },
    { pattern: /(?:法術|術)(?:攻撃)?(?:のみ|限定)?/i, tags: ['magical'], priority: 95, exclusive: true, category: 'attack_type' },

    // HP
    { pattern: /(?:HP|耐久|体力)(?:が)?50[％%]以上/i, tags: ['hp_above_50'], priority: 90, exclusive: true, category: 'hp_condition' },
    { pattern: /(?:HP|耐久|体力)(?:が)?50[％%]以下/i, tags: ['hp_below_50'], priority: 90, exclusive: true, category: 'hp_condition' },
    { pattern: /(?:HP|耐久|体力)(?:が)?70[％%]以上/i, tags: ['hp_above_70'], priority: 90, exclusive: true, category: 'hp_condition' },
    { pattern: /(?:HP|耐久|体力)(?:が)?30[％%]以下/i, tags: ['hp_below_30'], priority: 90, exclusive: true, category: 'hp_condition' },
    { pattern: /(?:HP|耐久|体力)(?:が)?(?:満タン|100[％%]|最大)/i, tags: ['hp_full'], priority: 90, exclusive: true, category: 'hp_condition' },

    // 巨大化段階
    { pattern: /巨大化(?:が)?5(?:段階|回)?(?:以上)?/i, tags: ['giant_5'], priority: 70, exclusive: true, category: 'giant_level' },
    { pattern: /巨大化(?:が)?4(?:段階|回)?以上/i, tags: ['giant_4_plus'], priority: 70, exclusive: true, category: 'giant_level' },
    { pattern: /巨大化(?:が)?3(?:段階|回)?以上/i, tags: ['giant_3_plus'], priority: 70, exclusive: true, category: 'giant_level' },
    { pattern: /巨大化(?:が)?2(?:段階|回)?以上/i, tags: ['giant_2_plus'], priority: 70, exclusive: true, category: 'giant_level' },
    { pattern: /巨大化(?:が)?1(?:段階|回)?以上/i, tags: ['giant_1_plus'], priority: 70, exclusive: true, category: 'giant_level' },

    // 属性
    { pattern: /水(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['water'], priority: 80, exclusive: false, category: 'attribute' },
    { pattern: /平(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['plain'], priority: 80, exclusive: false, category: 'attribute' },
    { pattern: /山(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['mountain'], priority: 80, exclusive: false, category: 'attribute' },
    { pattern: /平山(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['plain_mountain'], priority: 85, exclusive: false, category: 'attribute' },
    { pattern: /地獄(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['hell'], priority: 80, exclusive: false, category: 'attribute' },
    { pattern: /架空(?:城)?(?:のみ|限定)?/i, tags: ['fictional'], priority: 80, exclusive: false, category: 'attribute' },

    // 季節属性
    { pattern: /夏(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['summer'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /絢爛(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['kenran'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /ハロウィン(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['halloween'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /学園(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['school'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /聖夜(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['christmas'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /正月(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['new_year'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /お月見(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['moon_viewing'], priority: 80, exclusive: false, category: 'season' },
    { pattern: /花嫁(?:属性)?(?:城娘)?(?:のみ|限定)?/i, tags: ['bride'], priority: 80, exclusive: false, category: 'season' },

    // 対象種別
    { pattern: /伏兵(?:のみ|限定)?/i, tags: ['ambush'], priority: 75, exclusive: false, category: 'target_type' },
    // 「殿のみ」「殿限定」は殿専用、「殿と城娘」などは含めない
    { pattern: /殿(?:のみ|限定)/i, tags: ['lord'], priority: 75, exclusive: false, category: 'target_type' },

    // 敵種別
    { pattern: /飛行(?:敵|ユニット)(?:のみ|限定)?/i, tags: ['flying_enemy'], priority: 75, exclusive: false, category: 'enemy_type' },
    { pattern: /地上(?:敵|ユニット)(?:のみ|限定)?/i, tags: ['ground_enemy'], priority: 75, exclusive: false, category: 'enemy_type' },
    { pattern: /ボス(?:敵)?(?:のみ|限定)?/i, tags: ['boss_enemy'], priority: 75, exclusive: false, category: 'enemy_type' },

    // 特殊
    { pattern: /同(?:じ)?武器(?:種)?(?:のみ|限定)?/i, tags: ['same_weapon'], priority: 50, exclusive: false, category: 'special' },
    { pattern: /異(?:なる)?武器(?:種)?(?:のみ|限定)?/i, tags: ['different_weapon'], priority: 50, exclusive: false, category: 'special' },
    { pattern: /夜戦/i, tags: ['night_battle'], priority: 50, exclusive: false, category: 'special' },
];

/**
 * テキストからConditionTagを抽出
 */
export function extractConditionTags(text: string): ConditionTag[] {
    if (!text) return [];

    let cleanedText = text;
    for (const excludePattern of EXCLUDED_CONDITION_PATTERNS) {
        cleanedText = cleanedText.replace(excludePattern, '');
    }

    const detected: ConditionTag[] = [];
    const matchedCategories = new Set<string>();
    const sortedPatterns = [...CONDITION_DETECTION_PATTERNS].sort((a, b) => b.priority - a.priority);

    for (const patternDef of sortedPatterns) {
        if (patternDef.exclusive && matchedCategories.has(patternDef.category)) continue;
        if (patternDef.pattern.test(cleanedText)) {
            detected.push(...patternDef.tags);
            if (patternDef.exclusive) matchedCategories.add(patternDef.category);
        }
    }

    const unique = Array.from(new Set(detected));
    unique.sort((a, b) => {
        const diff = (CONDITION_PRIORITY[b] || 0) - (CONDITION_PRIORITY[a] || 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b);
    });
    return unique;
}

export function hasConditionKeyword(text: string): boolean {
    return extractConditionTags(text).length > 0;
}

export function getDisplayLevel(tag: ConditionTag): DisplayLevel {
    const priority = CONDITION_PRIORITY[tag] ?? 0;
    if (priority >= 8) return 'prominent';
    if (priority >= 5) return 'normal';
    return 'subtle';
}

const PHYSICAL_WEAPONS = new Set(['弓', '鉄砲', '石弓', '投剣', '軍船', '槍', '刀', '盾', 'ランス', '双剣', '拳', '鞭', '茶器', '大砲']);
const MAGICAL_WEAPONS = new Set(['歌舞', '本', '法術', '鈴', '杖', '札', '陣貝']);

const isMeleeWeapon = (character: Character): boolean => {
    const range = character.weaponRange ?? character.placement;
    return range === '近' || range === '遠近';
};

const isRangedWeapon = (character: Character): boolean => {
    const range = character.weaponRange ?? character.placement;
    return range === '遠' || range === '遠近';
};

const isPhysicalWeapon = (character: Character): boolean => {
    if (character.weaponType === '物') return true;
    if (character.weaponType === '術') return false;
    if (character.weapon && PHYSICAL_WEAPONS.has(character.weapon)) return true;
    if (character.weapon && MAGICAL_WEAPONS.has(character.weapon)) return false;
    return true; // 不明な場合は除外しない
};

const isMagicalWeapon = (character: Character): boolean => {
    if (character.weaponType === '術') return true;
    if (character.weaponType === '物') return false;
    if (character.weapon && MAGICAL_WEAPONS.has(character.weapon)) return true;
    if (character.weapon && PHYSICAL_WEAPONS.has(character.weapon)) return false;
    return true;
};

const matchAttribute = (character: Character, attr: string): boolean =>
    character.attributes?.includes(attr) ?? false;

const matchSeason = (character: Character, keyword: string): boolean => {
    if (character.seasonAttributes?.includes(keyword)) return true;
    if (character.period && character.period.includes(keyword)) return true;
    return false;
};

/**
 * 個別ConditionTagの判定
 */
export function checkCondition(tag: ConditionTag, character: Character, context?: ConditionContext): boolean {
    switch (tag) {
        case 'melee':
            return isMeleeWeapon(character);
        case 'ranged':
            return isRangedWeapon(character);
        case 'physical':
            return isPhysicalWeapon(character);
        case 'magical':
            return isMagicalWeapon(character);

        case 'hp_above_50': {
            const hp = context?.getHpPercent?.(character.id) ?? context?.allyHpPercent;
            return hp === undefined ? true : hp >= 50;
        }
        case 'hp_below_50': {
            const hp = context?.getHpPercent?.(character.id) ?? context?.allyHpPercent;
            return hp === undefined ? true : hp < 50;
        }
        case 'hp_above_70': {
            const hp = context?.getHpPercent?.(character.id) ?? context?.allyHpPercent;
            return hp === undefined ? true : hp >= 70;
        }
        case 'hp_below_30': {
            const hp = context?.getHpPercent?.(character.id) ?? context?.allyHpPercent;
            return hp === undefined ? true : hp < 30;
        }
        case 'hp_full': {
            const hp = context?.getHpPercent?.(character.id) ?? context?.allyHpPercent;
            return hp === undefined ? true : hp >= 100;
        }

        case 'giant_1_plus': {
            const level = context?.getGiantLevel?.(character.id);
            return level === undefined ? true : level >= 1;
        }
        case 'giant_2_plus': {
            const level = context?.getGiantLevel?.(character.id);
            return level === undefined ? true : level >= 2;
        }
        case 'giant_3_plus': {
            const level = context?.getGiantLevel?.(character.id);
            return level === undefined ? true : level >= 3;
        }
        case 'giant_4_plus': {
            const level = context?.getGiantLevel?.(character.id);
            return level === undefined ? true : level >= 4;
        }
        case 'giant_5': {
            const level = context?.getGiantLevel?.(character.id);
            return level === undefined ? true : level >= 5;
        }

        case 'water':
            return matchAttribute(character, '水');
        case 'plain':
            return matchAttribute(character, '平');
        case 'mountain':
            return matchAttribute(character, '山');
        case 'plain_mountain':
            return matchAttribute(character, '平山');
        case 'hell':
            return matchAttribute(character, '地獄');
        case 'fictional':
            return matchAttribute(character, '架空');

        case 'summer':
            return matchSeason(character, '夏');
        case 'kenran':
            return matchSeason(character, '絢爛');
        case 'halloween':
            return matchSeason(character, 'ハロウィン');
        case 'school':
            return matchSeason(character, '学園');
        case 'christmas':
            return matchSeason(character, '聖夜');
        case 'new_year':
            return matchSeason(character, '正月');
        case 'moon_viewing':
            return matchSeason(character, 'お月見');
        case 'bride':
            return matchSeason(character, '花嫁');

        case 'castle_girl':
            return !character.type || character.type === 'castle_girl';
        case 'ambush':
            return character.type === 'ambush';
        case 'lord':
            return character.type === 'lord';

        case 'flying_enemy': {
            if (context?.enemyType) return context.enemyType === 'flying';
            if (context?.isTargetFlying) return context.isTargetFlying();
            return true;
        }
        case 'ground_enemy': {
            if (context?.enemyType) return context.enemyType === 'ground';
            if (context?.isTargetFlying) return !context.isTargetFlying();
            return true;
        }
        case 'boss_enemy': {
            if (context?.enemyType) return context.enemyType === 'boss';
            if (context?.isTargetBoss) return context.isTargetBoss();
            return true;
        }

        case 'same_weapon':
            return context?.hasSameWeaponInRange ? context.hasSameWeaponInRange(character) : true;
        case 'different_weapon':
            return context?.hasDifferentWeaponInRange ? context.hasDifferentWeaponInRange(character) : true;
        case 'night_battle':
            return context?.isNightBattle ?? true;
        case 'continuous_deploy':
            return context?.isContinuousDeploy ? context.isContinuousDeploy(character.id) : true;
        case 'on_water':
            return context?.isOnWater ?? true;
        case 'exclude_self':
            // フィルタは呼び出し側で行う前提。ここでは常に許可。
            return true;
        case 'hp_dependent':
            // HPに比例する効果は計算時に扱うため、条件判定としては常に満たす。
            return true;
        case 'on_placement':
            return true;
        default:
            return true;
    }
}

export function areConditionsSatisfied(
    tags: ConditionTag[] | undefined,
    character: Character,
    context?: ConditionContext
): boolean {
    if (!tags || tags.length === 0) return true;
    return tags.every(tag => checkCondition(tag, character, context));
}
