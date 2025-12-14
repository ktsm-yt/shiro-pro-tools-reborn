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
  requiresAmbush?: boolean;  // 伏兵条件
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

  hasSelf: boolean;           // 自分由来のバフがあるか（バッジ用）
  hasAlly: boolean;           // 味方由来のバフがあるか（バッジ用）
  hasStrategy: boolean;       // 計略由来のバフがあるか（バッジ用）
  hasDuplicate: boolean;      // 効果重複バフがあるか（バッジ用）
  hasAmbush: boolean;         // 伏兵条件バフがあるか（バッジ用）
  hasSelfFlat: boolean;       // 自分由来の固定値バフがあるか
  hasAllyFlat: boolean;       // 味方由来の固定値バフがあるか
  hasStrategyFlat: boolean;   // 計略由来の固定値バフがあるか
  sources: VisualBuffSource[];
};
export type VisualBuffMatrix = Record<string, Partial<Record<Stat, VisualBuffCell>>>;

export const VISUAL_STAT_KEYS: Stat[] = [
  // 気・計略
  'cost',
  'cooldown',
  'strategy_cooldown',
  // 攻撃系
  'attack',
  'damage_dealt',
  'give_damage',
  'enemy_damage_taken', // 敵の被ダメ↑（攻撃貢献）
  'critical_bonus',
  'enemy_defense',
  'enemy_defense_ignore_percent',
  'enemy_defense_ignore_complete',
  // 射程系
  'range',
  'target_count',
  'attack_count',
  'enemy_range',
  // 防御系
  'defense',
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
export const FLAT_STAT_KEYS: Stat[] = ['attack', 'defense', 'range'];

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
  const result: VisualBuffMatrix = {};

  const activeChars = formation.slots.filter((c): c is Character => Boolean(c));

  activeChars.forEach((char) => {
    result[char.id] = {};
    tracked.forEach((stat) => {
      result[char.id][stat] = {
        maxValue: 0, maxFlat: 0,
        sharedValue: 0, duplicateValue: 0, selfExtra: 0,
        sharedFlat: 0, duplicateFlat: 0, selfExtraFlat: 0,
        hasSelf: false, hasAlly: false, hasStrategy: false, hasDuplicate: false, hasAmbush: false,
        hasSelfFlat: false, hasAllyFlat: false, hasStrategyFlat: false,
        sources: []
      };
    });
  });

  activeChars.forEach((sourceChar) => {
    const allBuffs: Buff[] = [
      ...(sourceChar.skills || []),
      ...(sourceChar.strategies || []),
      ...(sourceChar.specialAbilities || []),
    ];

    allBuffs.forEach((buff) => {
      if (buff.isActive === false) return;
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

        // flat_sum は固定値として別途追跡
        const isFlat = buff.mode === 'flat_sum' && flatStats.has(buff.stat);
        const isDuplicate = buff.isDuplicate === true;
        const isSelfOnly = buff.target === 'self';  // target='self' は自分だけに適用
        const requiresAmbush = buff.requiresAmbush === true;

        if (isFlat) {
          // 固定値バフ
          cell.maxFlat = Math.max(cell.maxFlat, buff.value);
          if (type === 'self') cell.hasSelfFlat = true;
          else if (type === 'ally') cell.hasAllyFlat = true;
          else if (type === 'strategy') cell.hasStrategyFlat = true;
        } else {
          // %バフ
          cell.maxValue = Math.max(cell.maxValue, buff.value);
          if (type === 'self') cell.hasSelf = true;
          else if (type === 'ally') cell.hasAlly = true;
          else if (type === 'strategy') cell.hasStrategy = true;
        }

        if (isDuplicate) cell.hasDuplicate = true;
        if (requiresAmbush) cell.hasAmbush = true;

        cell.sources.push({
          from: sourceChar.name,
          value: buff.value,
          type,
          stat: buff.stat,
          isFlat,
          isDuplicate,
          isSelfOnly,
          requiresAmbush,
        });
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
      let sharedMax = 0;          // 味方にも適用される通常バフ
      let selfOnlyMax = 0;        // 自分だけの通常バフ
      let duplicateSum = 0;       // 効果重複バフ（合算）
      let sharedFlatMax = 0;
      let selfOnlyFlatMax = 0;
      let duplicateFlatSum = 0;

      cell.sources.forEach((src) => {
        const isSelfOnly = src.isSelfOnly === true;
        const isDup = src.isDuplicate === true;

        if (src.isFlat) {
          if (isDup) {
            duplicateFlatSum += src.value;  // 効果重複は合算
          } else if (isSelfOnly) {
            selfOnlyFlatMax = Math.max(selfOnlyFlatMax, src.value);
          } else {
            sharedFlatMax = Math.max(sharedFlatMax, src.value);
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
      cell.sharedFlat = sharedFlatMax;
      cell.duplicateFlat = duplicateFlatSum;
      cell.selfExtraFlat = Math.max(0, selfOnlyFlatMax - sharedFlatMax);
    });
  });

  return result;
}
