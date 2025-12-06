export type Stat =
    | 'hp'
    | 'attack'
    | 'defense'
    | 'range'
    | 'recovery'
    | 'cooldown'
    | 'cost'
    | 'damage_dealt'
    | 'damage_taken'
    | 'attack_speed' // 攻撃速度
    | 'attack_gap'   // 隙
    | 'movement_speed' // 移動速度
    | 'knockback'    // 後退
    | 'target_count' // 対象数
    | 'ki_gain'      // 気増加
    | 'damage_drain' // 与ダメ回復
    | 'ignore_defense'; // 防御無視

export type BuffMode = 'percent_max' | 'flat_sum'; // 最大値適用 or 合算

export type ConditionTag =
    | 'melee'
    | 'ranged'
    | 'water'
    | 'mountain'
    | 'flat'
    | 'hell'
    | 'hp_below_50'
    | 'strategy_active';

export interface Buff {
    id: string;
    stat: Stat;
    mode: BuffMode;
    value: number;
    source: 'self_skill' | 'ally_skill' | 'strategy' | 'formation_skill' | 'special_ability';
    target: 'self' | 'range' | 'all';
    conditionTags?: ConditionTag[]; // 条件タグ
    isActive: boolean;
}

export interface Character {
    id: string;
    name: string;
    period?: string; // [絢爛] etc.
    weapon: string;
    weaponRange?: '近' | '遠' | '遠近';
    weaponType?: '物' | '術';
    placement?: '近' | '遠' | '遠近';
    attributes: string[]; // 平, 水, etc.
    baseStats: Record<Stat, number>; // 基礎ステータス
    skills: Buff[];
    strategies: Buff[];
    specialAbilities?: Buff[];
    rawSkillTexts?: string[];
    rawStrategyTexts?: string[];
    rawSpecialTexts?: string[];
}

export interface Formation {
    slots: (Character | null)[]; // 8枠
}

export interface CharacterBuffResult {
    // 各ステータスの最終適用値
    stats: Record<Stat, number>;
    // 適用されたバフの詳細（デバッグ/UI表示用）
    // 適用されたバフの詳細（デバッグ/UI表示用）
    activeBuffs: Buff[];
    // バフの内訳
    breakdown?: {
        [key in Stat]?: {
            base: number;
            selfBuff: number;
            allyBuff: number;
        };
    };
    // percent_max の現在適用中値（最大を採用するためのメモ）
    percentMax?: Partial<Record<Stat, { value: number; isSelf: boolean }>>;
}

/**
 * バフ計算結果の型
 * キャラクターIDをキーとし、各ステータスの計算結果を保持する
 */
export type BuffMatrixResult = Record<string, CharacterBuffResult>;

export interface DamageCalculationResult {
    finalAttack: number;      // 最終攻撃力
    damagePerHit: number;     // 1ヒットあたりのダメージ
    totalDamage: number;      // 合計ダメージ
    effectiveDefense: number; // 敵の有効防御力
    receivedDamageMultiplier: number; // 被ダメージ倍率

    // 計算の内訳（UI表示用）
    breakdown: {
        baseAttack: number;
        attackFlat: number;
        attackPercent: number;
        attackMultipliers: number[];
        damagePercent: number;
        damageMultipliers: number[];
        enemyDefenseDebuffFlat: number;
        enemyDefenseDebuffPercent: number;
        ignoreDefense: boolean;
    };
}

export interface DamageCalculationContext {
    enemyDefense: number;
    enemyHpPercent: number;
    allyHpPercent: number;
    hitCount: number;
    isStrategyActive: boolean;
}
