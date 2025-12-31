/**
 * マップ制約チェック
 * 近接/遠隔の配置数制限を確認
 */

import type { Character, Formation } from '../types';
import { getWeaponInfo } from '../data/weaponMapping';

export interface MapConstraints {
  meleeSlots: number;   // 近接配置可能数
  rangedSlots: number;  // 遠隔配置可能数
}

export interface PlacementCount {
  melee: number;        // 近接配置キャラ数
  ranged: number;       // 遠隔配置キャラ数
  flexible: number;     // 遠近両用キャラ数（どちらにもカウント可能）
}

export interface ConstraintCheckResult {
  isValid: boolean;
  meleeCount: number;
  rangedCount: number;
  flexibleCount: number;
  meleeOverflow: number;  // 近接オーバー数（負なら余裕あり）
  rangedOverflow: number; // 遠隔オーバー数（負なら余裕あり）
  warnings: string[];
}

// よくあるマップ制約パターン
export const COMMON_MAP_CONSTRAINTS: Record<string, MapConstraints> = {
  '4-4': { meleeSlots: 4, rangedSlots: 4 },
  '5-3': { meleeSlots: 5, rangedSlots: 3 },
  '3-5': { meleeSlots: 3, rangedSlots: 5 },
  '6-2': { meleeSlots: 6, rangedSlots: 2 },
  '2-6': { meleeSlots: 2, rangedSlots: 6 },
  '4-3': { meleeSlots: 4, rangedSlots: 3 },
  '3-4': { meleeSlots: 3, rangedSlots: 4 },
  '5-2': { meleeSlots: 5, rangedSlots: 2 },
  '2-5': { meleeSlots: 2, rangedSlots: 5 },
};

/**
 * キャラクターの配置タイプを取得
 */
export function getPlacementType(character: Character): '近' | '遠' | '遠近' {
  // Character自体にplacementがあればそれを使用
  if (character.placement) {
    return character.placement;
  }

  // weaponRangeがあればそれを使用
  if (character.weaponRange) {
    return character.weaponRange;
  }

  // 武器種からマッピングで取得
  const weaponInfo = getWeaponInfo(character.weapon);
  if (weaponInfo) {
    return weaponInfo.placement;
  }

  // デフォルトは近接
  return '近';
}

/**
 * 編成の配置数をカウント
 */
export function countPlacements(formation: Formation): PlacementCount {
  let melee = 0;
  let ranged = 0;
  let flexible = 0;

  formation.slots.forEach(char => {
    if (!char) return;

    const placement = getPlacementType(char);
    switch (placement) {
      case '近':
        melee++;
        break;
      case '遠':
        ranged++;
        break;
      case '遠近':
        flexible++;
        break;
    }
  });

  return { melee, ranged, flexible };
}

/**
 * マップ制約をチェック
 */
export function checkMapConstraints(
  formation: Formation,
  constraints: MapConstraints
): ConstraintCheckResult {
  const counts = countPlacements(formation);
  const warnings: string[] = [];

  // 遠近両用キャラを最適配置するための計算
  // まず固定枠を埋めて、余った遠近をどちらに振り分けるか計算
  const meleeFixed = counts.melee;
  const rangedFixed = counts.ranged;
  const flexibleTotal = counts.flexible;

  // 近接スロットの空き
  const meleeRemaining = constraints.meleeSlots - meleeFixed;
  // 遠隔スロットの空き
  const rangedRemaining = constraints.rangedSlots - rangedFixed;

  // 遠近両用を振り分け（貪欲法: 空きが多い方から埋める）
  let flexUsedForMelee = 0;
  let flexUsedForRanged = 0;

  // 両方に余裕があれば、順番に振り分け
  let remainingFlex = flexibleTotal;

  // 近接に空きがあれば振り分け
  if (meleeRemaining > 0 && remainingFlex > 0) {
    const toMelee = Math.min(meleeRemaining, remainingFlex);
    flexUsedForMelee = toMelee;
    remainingFlex -= toMelee;
  }

  // 遠隔に空きがあれば振り分け
  if (rangedRemaining > 0 && remainingFlex > 0) {
    const toRanged = Math.min(rangedRemaining, remainingFlex);
    flexUsedForRanged = toRanged;
    remainingFlex -= toRanged;
  }

  // 最終的なカウント
  const finalMelee = meleeFixed + flexUsedForMelee;
  const finalRanged = rangedFixed + flexUsedForRanged;

  // オーバーフロー計算
  const meleeOverflow = finalMelee - constraints.meleeSlots;
  const rangedOverflow = finalRanged - constraints.rangedSlots;

  // 配置しきれなかった遠近両用
  const unplacedFlex = remainingFlex;

  // 警告生成
  if (meleeOverflow > 0) {
    warnings.push(`近接が${meleeOverflow}体オーバー（${finalMelee}/${constraints.meleeSlots}）`);
  }
  if (rangedOverflow > 0) {
    warnings.push(`遠隔が${rangedOverflow}体オーバー（${finalRanged}/${constraints.rangedSlots}）`);
  }
  if (unplacedFlex > 0) {
    warnings.push(`遠近両用${unplacedFlex}体が配置不可`);
  }

  const isValid = meleeOverflow <= 0 && rangedOverflow <= 0 && unplacedFlex === 0;

  return {
    isValid,
    meleeCount: finalMelee,
    rangedCount: finalRanged,
    flexibleCount: flexibleTotal,
    meleeOverflow,
    rangedOverflow,
    warnings,
  };
}

/**
 * 制約文字列をパース（例: "4-4" → { meleeSlots: 4, rangedSlots: 4 }）
 */
export function parseConstraintString(str: string): MapConstraints | null {
  const match = str.match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return {
    meleeSlots: parseInt(match[1], 10),
    rangedSlots: parseInt(match[2], 10),
  };
}
