// ========================================
// Stat definitions (v1.2)
// ========================================
export type AllyBuffStat =
    | 'attack'
    | 'defense'
    | 'range'
    | 'attack_speed'
    | 'attack_gap'
    | 'recovery'
    | 'cost'
    | 'cost_gradual'        // 徐々気
    | 'cost_giant'          // 気軽減（巨大化消費気軽減）
    | 'cost_strategy'       // 計略消費気軽減
    | 'cost_enemy_defeat'   // 気牛（敵へのデバフ：その敵を倒すと気増加）
    | 'cost_defeat_bonus'   // 気ノビ（自身/味方へのバフ：そのキャラが敵を倒すと気増加）
    | 'strategy_cooldown'
    | 'target_count'
    | 'attack_count';

export type DamageMultiplierStat =
    | 'damage_dealt'
    | 'give_damage'
    | 'damage_taken'
    | 'damage_recovery'
    | 'critical_bonus';

export type EnemyDebuffStat =
    | 'enemy_attack'
    | 'enemy_defense'
    | 'enemy_defense_ignore_percent'
    | 'enemy_defense_ignore_complete'
    | 'enemy_movement'
    | 'enemy_retreat'        // 敵後退（旧: knockback）
    | 'enemy_knockback'
    | 'enemy_range'
    | 'enemy_damage_dealt'   // 敵の与ダメ低下（防御貢献）
    | 'enemy_damage_taken';  // 敵の被ダメ上昇（攻撃貢献）

export type SpecialBuffStat = 'inspire' | 'skill_multiplier';

export type LegacyStat =
    | 'hp'
    | 'cooldown'
    | 'movement_speed'
    | 'retreat'              // 後退（旧: knockback）
    | 'ki_gain'
    | 'damage_drain'
    | 'ignore_defense';

export type Stat = AllyBuffStat | DamageMultiplierStat | EnemyDebuffStat | SpecialBuffStat | LegacyStat;

export type BuffMode = 'percent_max' | 'flat_sum' | 'percent_reduction' | 'absolute_set'; // percent_reductionは短縮系

export type Target = 'self' | 'ally' | 'range' | 'all' | 'field' | 'out_of_range';
export type Priority = 'low' | 'normal' | 'high';
export type CostBuffType =
    | 'natural'
    | 'enemy_defeat'
    | 'ally_defeat'
    | 'gradual'
    | 'strategy_use'
    | 'strategy_cost'
    | 'giant_cost';

export type DynamicBuffType =
    | 'per_enemy_in_range'
    | 'per_ally_in_range'
    | 'per_ally_other'
    | 'per_ambush_deployed'
    | 'per_enemy_defeated'
    | 'per_specific_attribute'
    | 'per_specific_weapon';

export type ConditionTag =
    // 武器種条件（優先度: MEDIUM）
    | 'melee'
    | 'ranged'
    | 'physical'
    | 'magical'
    // HP条件（優先度: HIGH）
    | 'hp_above_50'
    | 'hp_below_50'
    | 'hp_above_70'
    | 'hp_below_30'
    | 'hp_full'
    // 巨大化段階条件（優先度: MEDIUM/LOW）
    | 'giant_1_plus'
    | 'giant_2_plus'
    | 'giant_3_plus'
    | 'giant_4_plus'
    | 'giant_5'
    // 属性条件（優先度: MEDIUM）
    | 'water'
    | 'plain'
    | 'mountain'
    | 'plain_mountain'
    | 'hell'
    // 季節属性条件（優先度: MEDIUM）
    | 'summer'
    | 'kenran'
    | 'halloween'
    | 'school'
    | 'christmas'
    | 'new_year'
    | 'moon_viewing'
    | 'bride'
    // 対象種別条件（優先度: MEDIUM/LOW）
    | 'castle_girl'
    | 'ambush'
    | 'lord'
    // 敵種別条件（優先度: MEDIUM）
    | 'flying_enemy'
    | 'ground_enemy'
    | 'boss_enemy'
    // 特殊条件（優先度: LOW〜MEDIUM）
    | 'same_weapon'
    | 'different_weapon'
    | 'night_battle'
    | 'continuous_deploy'
    // 特殊条件（v1.2追加）
    | 'on_water'
    | 'exclude_self'
    | 'hp_dependent'
    | 'on_placement';

export type BaseStatKey = Stat;
export type BaseStats = Partial<Record<BaseStatKey, number>>;

export interface Buff {
    id: string;
    stat: Stat;
    mode: BuffMode;
    value: number;
    source: 'self_skill' | 'ally_skill' | 'strategy' | 'formation_skill' | 'special_ability';
    target: Target;
    conditionTags?: ConditionTag[]; // 条件タグ
    isActive: boolean;
    costType?: CostBuffType;
    inspireSourceStat?: Stat;
    isDuplicate?: boolean;      // 効果重複
    isExplicitlyNonDuplicate?: boolean; // 明示的な重複なし
    nonStacking?: boolean;      // 重複なし
    stackPenalty?: number;      // 重複時効果減少率
    stackable?: boolean;        // スタック可能か
    maxStacks?: number;         // 最大スタック数
    currentStacks?: number;     // 現在のスタック数（実行時に使用）
    priority?: Priority;        // 優先度
    isDynamic?: boolean;        // 動的バフ
    dynamicType?: DynamicBuffType;
    dynamicCategory?: 'formation' | 'combat_situation';
    unitValue?: number;         // 単位あたり効果値
    dynamicParameter?: string;  // 動的条件の説明
    requiresAmbush?: boolean;   // 伏兵依存
    confidence?: 'certain' | 'inferred' | 'uncertain';
    inferenceReason?: string;
    note?: string;              // 補足情報
    name?: string;              // 表示名 (UI用)
    description?: string;       // 説明文 (UI用)
}

export interface Character {
    id: string;
    name: string;
    imageUrl?: string; // 画像URL
    rarity?: string; // レアリティ (☆7, 曉 etc.)
    period?: string; // [絢爛] etc.
    seasonAttributes?: string[]; // 夏/絢爛/ハロウィン/学園/聖夜/正月/お月見/花嫁
    type?: 'castle_girl' | 'ambush' | 'lord'; // デフォルトは城娘
    weapon: string;
    weaponRange?: '近' | '遠' | '遠近';
    weaponType?: '物' | '術';
    placement?: '近' | '遠' | '遠近';
    attributes: string[]; // 平, 水, etc.
    baseStats: BaseStats; // 基礎ステータス
    skills: Buff[];
    strategies: Buff[];
    specialAbilities?: Buff[];
    rawSkillTexts?: string[];
    rawStrategyTexts?: string[];
    rawSpecialTexts?: string[];

    // ダメージ計算用フィールド
    selfBuffs?: {
        percentBuffs: BuffValue[];
        flatBuffs: number[];
        additiveBuffs: AdditiveValue[];
        duplicateBuffs: number[];
        damageMultipliers: DamageMultiplier[];
        defenseIgnore: boolean;
        attackSpeed?: number;
        gapReduction?: number;
        inspire?: {
            stat: 'attack' | 'defense';
            value: number;
            range: number;
        };
    };
    multiHit?: number; // 連撃数
}

/**
 * 条件判定に必要な追加コンテキスト
 */
export interface ConditionContext {
    getHpPercent?: (characterId: string) => number | undefined;
    getGiantLevel?: (characterId: string) => number | undefined;
    isTargetFlying?: () => boolean;
    isTargetBoss?: () => boolean;
    enemyType?: 'flying' | 'ground' | 'boss';
    hasSameWeaponInRange?: (character: Character) => boolean;
    hasDifferentWeaponInRange?: (character: Character) => boolean;
    isNightBattle?: boolean;
    isContinuousDeploy?: (characterId: string) => boolean;
    isOnWater?: boolean;
    allyHpPercent?: number;
    enemyHpPercent?: number;
}

export interface Formation {
    slots: (Character | null)[]; // 8枠
}

export interface CharacterBuffResult {
    // 各ステータスの最終適用値
    stats: Record<BaseStatKey, number>;
    // 適用されたバフの詳細（デバッグ/UI表示用）
    // 適用されたバフの詳細（デバッグ/UI表示用）
    activeBuffs: Buff[];
    // バフの内訳
    breakdown?: {
        [key in BaseStatKey]?: {
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

// ========================================
// ダメージ計算関連の型定義
// ========================================

/**
 * 環境設定
 * ダメージ計算時の外部パラメータを定義します
 */
export interface EnvironmentSettings {
    // 共通バフ
    inspireFlat: number;           // 鼓舞（固定値）
    duplicateBuff: number;         // 効果重複%
    attackPercent: number;         // 環境からの攻撃%バフ
    damageDealt: number;           // 与ダメ%
    damageMultiplier: number;      // 乗算バフ（環境由来）

    // 速度バフ
    attackSpeed: number;           // 攻撃速度%
    gapReduction: number;          // 隙短縮%

    // 敵ステータス
    enemyDefense: number;          // 敵防御力
    defenseDebuffPercent: number;  // 防御デバフ%
    defenseDebuffFlat: number;     // 防御デバフ固定値

    // ダメージバフ
    damageTaken: number;           // 被ダメ%

    // 条件設定
    enemyHpPercent: number;        // 敵HP% (条件付きバフ用)
}

/**
 * ダメージ計算時のコンテキスト
 */
export interface DamageCalculationContext extends ConditionContext {
    enemyDefense: number;
    enemyHpPercent: number;
    allyHpPercent: number;
    hitCount: number;
    isStrategyActive: boolean;
}

/**
 * バフ値（最大値ルール適用用）
 */
export interface BuffValue {
    value: number;
    type: string; // バフの種類識別用（最大値ルール適用のため）
}

/**
 * 加算バフ値
 */
export interface AdditiveValue {
    value: number;
    source: 'deployment' | 'tactic'; // 配置特技 or 計略
}

/**
 * ダメージ倍率
 */
export interface DamageMultiplier {
    type: 'attack_multiple' | 'give_damage' | 'conditional';
    value: number;
    condition?: string; // 条件の説明
}

/**
 * ダメージ計算の詳細な内訳
 */
export interface DamageBreakdown {
    phase1: {
        baseAttack: number;
        percentBuffApplied: number;
        flatBuffApplied: number;
        additiveBuffApplied: number;
        duplicateBuffApplied: number;
        finalAttack: number;
    };
    phase2: {
        multipliers: Array<{ type: string; value: number }>;
        damage: number;
    };
    phase3: {
        enemyDefense: number;
        effectiveDefense: number;
        damage: number;
    };
    phase4: {
        damageDealt: number;
        damageTaken: number;
        damage: number;
    };
    phase5?: {
        attackCount: number;
        totalDamage: number;
    };
    dps: {
        attackFrames: number;
        gapFrames: number;
        totalFrames: number;
        attacksPerSecond: number;
        dps: number;
    };
}

/**
 * ダメージ計算結果
 */
export interface DamageCalculationResult {
    characterId: string;

    // 各フェーズの結果
    phase1Attack: number;
    phase2Damage: number;
    phase3Damage: number;
    phase4Damage: number;
    totalDamage: number;

    // DPS
    dps: number;

    // 鼓舞量（該当キャラのみ）
    inspireAmount?: number;

    // 詳細情報（デバッグ/表示用）
    breakdown: DamageBreakdown;
}

/**
 * ダメージ差分比較
 */
export interface DamageComparison {
    characterId: string;
    before: DamageCalculationResult;
    after: DamageCalculationResult;

    diff: {
        totalDamage: number;
        totalDamagePercent: number;
        dps: number;
        dpsPercent: number;
        inspireAmount?: number;
    };
}

/**
 * 編成データ（ダメージ計算用）
 */
export interface FormationData {
    id: string;
    name: string;
    characters: Character[];
    environmentSettings: EnvironmentSettings;
    createdAt: Date;
    updatedAt: Date;
}
