import { isBuffApplicable } from '../../core/logic/buffs';
import type { Buff, Character, Formation, Stat } from '../../core/types';

export type VisualBuffSource = {
  from: string;
  value: number;
  type: 'self' | 'ally' | 'strategy';
  stat: Stat;
  isFlat?: boolean;
  isDuplicate?: boolean;
  isSelfOnly?: boolean;      // target='self' のバフか（自分だけに適用）
  isExcludedFromSelf?: boolean; // exclude_selfタグで自分には適用されないが表示用
  requiresAmbush?: boolean;  // 伏兵条件
  // 動的バフ情報
  isDynamic?: boolean;
  dynamicType?: string;      // 'per_ally_other', 'per_enemy_in_range', etc.
  dynamicParameter?: string; // "味方1体につき" などの説明
  unitValue?: number;        // 単位あたりの値
};
export type VisualBuffCell = {
  maxValue: number;           // %バフの最大値（トータル）
  maxFlat: number;            // 固定値バフの最大値（トータル）

  // スタックバー表示用：3色表示
  // 緑: 味方から（通常バフ） / 黄: 効果重複バフ / 青: 自分だけの追加分
  sharedValue: number;        // 味方からの通常%バフ値（緑）
  duplicateValue: number;     // 効果重複%バフ値（黄）
  selfExtra: number;          // 自分だけの追加%バフ値（青）
  sharedFlat: number;         // 味方からの通常固定値
  duplicateFlat: number;      // 効果重複固定値
  selfExtraFlat: number;      // 自分だけの追加固定値

  // 同キャラ内スタック用（徐々気など）: 特技(青)+計略(紫)を合算
  selfStackValue: number;     // 特技由来の合算値（青）
  strategyStackValue: number; // 計略由来の合算値（紫）

  hasSelf: boolean;           // 自分由来のバフがあるか（バッジ用）
  hasAlly: boolean;           // 味方由来のバフがあるか（バッジ用）
  hasStrategy: boolean;       // 計略由来のバフがあるか（バッジ用）
  hasDuplicate: boolean;      // 効果重複バフがあるか（バッジ用）
  hasAmbush: boolean;         // 伏兵条件バフがあるか（バッジ用）
  hasDynamic: boolean;        // 動的バフがあるか（バッジ用）
  hasSelfFlat: boolean;       // 自分由来の固定値バフがあるか
  hasAllyFlat: boolean;       // 味方由来の固定値バフがあるか
  hasStrategyFlat: boolean;   // 計略由来の固定値バフがあるか
  dynamicSources: VisualBuffSource[]; // 動的バフのソース（ツールチップ表示用）
  sources: VisualBuffSource[];
};
export type VisualBuffMatrix = Record<string, Partial<Record<Stat, VisualBuffCell>>>;

export const VISUAL_STAT_KEYS: Stat[] = [
  // 気・計略
  'cost',
  'cost_gradual',
  'cost_enemy_defeat',
  'cost_defeat_bonus',
  'cost_giant',
  'cost_strategy',
  'strategy_cooldown',
  // 攻撃系
  'attack',
  'effect_duplicate_attack',  // 攻撃効果重複（Phase 1乗算）
  'damage_dealt',
  'give_damage',
  'enemy_damage_taken', // 敵の被ダメ↑（攻撃貢献）
  'critical_bonus',
  'enemy_defense',
  'enemy_defense_ignore_percent',
  'enemy_defense_ignore_complete',
  // 射程系
  'range',
  'effect_duplicate_range',  // 射程効果重複
  'target_count',
  'attack_count',
  'enemy_range',
  // 防御系
  'defense',
  'effect_duplicate_defense',  // 防御効果重複
  'damage_taken',       // 自分の被ダメ軽減（防御）
  'enemy_attack',
  'enemy_damage_dealt',
  // 速度系
  'attack_speed',
  'attack_gap',
  'enemy_movement',
  'enemy_retreat',
  // 特殊
  'inspire',
  'recovery',
  'damage_recovery',
];

// 固定値として別表示するstat（%とは別に表示）
export const FLAT_STAT_KEYS: Stat[] = ['attack', 'defense', 'range', 'cost_giant', 'cost_defeat_bonus', 'cost_enemy_defeat'];

// 同キャラ内で合算するstat（特技+計略がスタック）
export const SELF_STACKABLE_STATS: Stat[] = ['cost_gradual'];

/**
 * UI表示用にバフの内訳を収集する
 * 全ソースを通じて最大値を採用（ゲームルール）
 */
export function buildVisualBuffMatrix(
  formation: Formation,
  trackedStats: Stat[] = VISUAL_STAT_KEYS,
): VisualBuffMatrix {
  const tracked = new Set<Stat>(trackedStats);
  const flatStats = new Set<Stat>(FLAT_STAT_KEYS);
  const selfStackable = new Set<Stat>(SELF_STACKABLE_STATS);
  const result: VisualBuffMatrix = {};

  const activeChars = formation.slots.filter((c): c is Character => Boolean(c));

  activeChars.forEach((char) => {
    result[char.id] = {};
    tracked.forEach((stat) => {
      result[char.id][stat] = {
        maxValue: 0, maxFlat: 0,
        sharedValue: 0, duplicateValue: 0, selfExtra: 0,
        sharedFlat: 0, duplicateFlat: 0, selfExtraFlat: 0,
        selfStackValue: 0, strategyStackValue: 0,
        hasSelf: false, hasAlly: false, hasStrategy: false, hasDuplicate: false, hasAmbush: false, hasDynamic: false,
        hasSelfFlat: false, hasAllyFlat: false, hasStrategyFlat: false,
        dynamicSources: [],
        sources: []
      };
    });
  });

  activeChars.forEach((sourceChar) => {
    // 特殊能力から skill_multiplier を抽出
    const skillMultiplier = sourceChar.specialAbilities?.find(
      (b) => b.stat === 'skill_multiplier' && b.isActive !== false
    );
    const multiplier = skillMultiplier?.value ?? 1;

    const allBuffs: Buff[] = [
      ...(sourceChar.skills || []),
      ...(sourceChar.strategies || []),
      ...(sourceChar.specialAbilities || []),
    ];

    allBuffs.forEach((buff) => {
      if (buff.isActive === false) return;

      // skill_multiplier 自体は表示しない
      if (buff.stat === 'skill_multiplier') return;

      if (!tracked.has(buff.stat)) return;

      activeChars.forEach((targetChar) => {
        if (!isBuffApplicable(buff, sourceChar, targetChar)) return;

        const cell = result[targetChar.id]?.[buff.stat];
        if (!cell) return;

        // バッジの色を決定（バフの出所で判定）:
        // - 紫 (strategy): 計略由来
        // - 青 (self): 自分自身のスキル/特殊能力由来
        // - 緑 (ally): 他キャラのスキル/特殊能力由来
        const type: 'self' | 'ally' | 'strategy' =
          buff.source === 'strategy'
            ? 'strategy'
            : sourceChar.id === targetChar.id
              ? 'self'
              : 'ally';

        // 特技バフには skill_multiplier を適用
        const effectiveValue = buff.source === 'self_skill' ? buff.value * multiplier : buff.value;

        // flat_sum は固定値として別途追跡
        const isFlat = buff.mode === 'flat_sum' && flatStats.has(buff.stat);
        const isDuplicate = buff.isDuplicate === true;
        const isSelfOnly = buff.target === 'self';  // target='self' は自分だけに適用
        // exclude_selfタグで自分には適用されないが、表示用には記録
        const isExcludedFromSelf = sourceChar.id === targetChar.id && buff.conditionTags?.includes('exclude_self');
        const requiresAmbush = buff.requiresAmbush === true;
        const isDynamic = buff.isDynamic === true;
        const isSelfStackable = selfStackable.has(buff.stat);

        // 同キャラ内スタック（徐々気など）: 特技+計略を合算
        if (isSelfStackable && sourceChar.id === targetChar.id) {
          if (type === 'self') {
            cell.selfStackValue += effectiveValue;
            cell.hasSelf = true;
          } else if (type === 'strategy') {
            cell.strategyStackValue += effectiveValue;
            cell.hasStrategy = true;
          }
          cell.maxValue = cell.selfStackValue + cell.strategyStackValue;
        } else if (isFlat) {
          // 固定値バフ（exclude_selfの場合は合計に含めない）
          if (!isExcludedFromSelf) {
            cell.maxFlat += effectiveValue;
          }
          if (type === 'self') cell.hasSelfFlat = true;
          else if (type === 'ally') cell.hasAllyFlat = true;
          else if (type === 'strategy') cell.hasStrategyFlat = true;
        } else {
          // %バフ
          cell.maxValue = Math.max(cell.maxValue, effectiveValue);
          if (type === 'self') cell.hasSelf = true;
          else if (type === 'ally') cell.hasAlly = true;
          else if (type === 'strategy') cell.hasStrategy = true;
        }

        if (isDuplicate) cell.hasDuplicate = true;
        if (requiresAmbush) cell.hasAmbush = true;
        if (isDynamic) cell.hasDynamic = true;

        const source: VisualBuffSource = {
          from: sourceChar.name,
          value: effectiveValue,
          type,
          stat: buff.stat,
          isFlat,
          isDuplicate,
          isSelfOnly,
          isExcludedFromSelf,
          requiresAmbush,
          isDynamic,
          dynamicType: buff.dynamicType,
          dynamicParameter: buff.dynamicParameter,
          unitValue: buff.unitValue,
        };

        cell.sources.push(source);
        if (isDynamic) {
          cell.dynamicSources.push(source);
        }
      });
    });
  });

  // スタックバー用: 3色表示の計算
  // 緑: 味方にも適用されるバフ（target != 'self'）
  // 黄: 効果重複バフ
  // 青: 自分だけの追加分（target = 'self' で、緑を上回る分）
  activeChars.forEach((char) => {
    tracked.forEach((stat) => {
      const cell = result[char.id]?.[stat];
      if (!cell) return;

      // 分類して最大値を計算
      // shared = 味方にも適用（isSelfOnly=false）、通常バフ
      // selfOnly = 自分だけ（isSelfOnly=true）、通常バフ
      // duplicate = 効果重複バフ（isDuplicate=true）
      // excluded = exclude_selfで自分には適用されないが表示用に記録
      let sharedMax = 0;          // 味方にも適用される通常バフ
      let selfOnlyMax = 0;        // 自分だけの通常バフ
      let duplicateSum = 0;       // 効果重複バフ（合算）
      let sharedFlatSum = 0;      // 味方にも適用される固定値
      let selfOnlyFlatSum = 0;    // 自分だけの固定値
      let duplicateFlatSum = 0;   // 効果重複の固定値
      let excludedFlatSum = 0;    // exclude_selfで除外される固定値（表示用）

      cell.sources.forEach((src) => {
        const isSelfOnly = src.isSelfOnly === true;
        const isDup = src.isDuplicate === true;
        const isExcluded = src.isExcludedFromSelf === true;

        if (src.isFlat) {
          if (isDup) {
            duplicateFlatSum += src.value;  // 効果重複は合算
          } else if (isExcluded) {
            // exclude_selfは表示用に記録（緑部分）、maxFlatには含めない
            excludedFlatSum += src.value;
          } else if (isSelfOnly) {
            selfOnlyFlatSum += src.value;
          } else {
            sharedFlatSum += src.value;
          }
        } else {
          if (isDup) {
            duplicateSum += src.value;  // 効果重複は合算
          } else if (isSelfOnly) {
            selfOnlyMax = Math.max(selfOnlyMax, src.value);
          } else {
            sharedMax = Math.max(sharedMax, src.value);
          }
        }
      });

      // %バフの3色計算
      // 緑: 味方にも適用される分（ベース）
      // 黄: 効果重複（合算）
      // 青: 自分だけの追加分（selfOnlyがsharedを上回る分）
      cell.sharedValue = sharedMax;
      cell.duplicateValue = duplicateSum;
      cell.selfExtra = Math.max(0, selfOnlyMax - sharedMax);

      // 固定値の3色計算
      // 緑: 味方にも適用される分（excludedも含む、表示用ベース）
      // 青: 自分だけの追加分（selfOnlyがshared+excludedを上回る分）
      const flatBase = sharedFlatSum + excludedFlatSum;
      cell.sharedFlat = flatBase;
      cell.duplicateFlat = duplicateFlatSum;
      cell.selfExtraFlat = Math.max(0, selfOnlyFlatSum - flatBase);
      // maxFlatは実際に適用される値（excludedは含まない）
      cell.maxFlat = sharedFlatSum + duplicateFlatSum + selfOnlyFlatSum;
    });
  });

  return result;
}
