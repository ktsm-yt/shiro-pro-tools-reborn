export type Stat =
    | 'attack'
    | 'defense'
    | 'range'
    | 'cooldown'
    | 'cost'
    | 'damage_dealt'
    | 'damage_taken';

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
    source: 'self_skill' | 'ally_skill' | 'strategy' | 'formation_skill';
    target: 'self' | 'range' | 'all';
    conditionTags?: ConditionTag[]; // 条件タグ
    isActive: boolean;
}

export interface Character {
    id: string;
    name: string;
    weapon: string;
    attributes: string[]; // 平, 水, etc.
    baseStats: Record<Stat, number>; // 基礎ステータス
    skills: Buff[];
    strategies: Buff[];
}

export interface Formation {
    slots: (Character | null)[]; // 8枠
}
