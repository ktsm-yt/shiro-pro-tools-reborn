/**
 * ShiroPro Tools (Reborn) - ダメージ計算実装サンプル
 * 
 * このファイルは、ダメージ計算仕様書に基づいた実装例です。
 */

// ========================================
// 型定義
// ========================================

interface Character {
  id: string;
  name: string;
  weaponType: string;
  level: number;
  stats: {
    baseAttack: number;
  };
  selfBuffs: {
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
  multiHit?: number;
}

interface BuffValue {
  value: number;
  type: string;
}

interface AdditiveValue {
  value: number;
  source: 'deployment' | 'tactic';
}

interface DamageMultiplier {
  type: 'attack_multiple' | 'give_damage' | 'conditional';
  value: number;
  condition?: string;
}

interface EnvironmentSettings {
  inspireFlat: number;
  duplicateBuff: number;
  attackSpeed: number;
  gapReduction: number;
  enemyDefense: number;
  defenseDebuffPercent: number;
  defenseDebuffFlat: number;
  damageTaken: number;
  enemyHpPercent: number;
}

interface DamageCalculationResult {
  characterId: string;
  phase1Attack: number;
  phase2Damage: number;
  phase3Damage: number;
  phase4Damage: number;
  totalDamage: number;
  dps: number;
  inspireAmount?: number;
  breakdown: DamageBreakdown;
}

interface DamageBreakdown {
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

// ========================================
// 定数
// ========================================

const WEAPON_FRAMES: Record<string, { attack: number; gap: number; total: number; multiHit?: number }> = {
  '刀': { attack: 19, gap: 22, total: 41 },
  '槍': { attack: 23, gap: 27, total: 50 },
  '槌': { attack: 27, gap: 30, total: 57 },
  '盾': { attack: 24, gap: 30, total: 54 },
  '拳': { attack: 37, gap: 18, total: 55 },
  '鎌': { attack: 22, gap: 22, total: 44 },
  '戦棍': { attack: 27, gap: 25, total: 52 },
  '双剣': { attack: 29, gap: 21, total: 50 },
  'ランス': { attack: 27, gap: 27, total: 54 },
  '弓': { attack: 19, gap: 18, total: 37 },
  '石弓': { attack: 24, gap: 24, total: 48 },
  '鉄砲': { attack: 29, gap: 27, total: 56 },
  '大砲': { attack: 42, gap: 42, total: 84 },
  '歌舞': { attack: 47, gap: 54, total: 101 },
  '法術': { attack: 42, gap: 30, total: 72 },
  '鈴': { attack: 134, gap: 0, total: 134, multiHit: 12 },
  '杖': { attack: 37, gap: 30, total: 67 },
  '祓串': { attack: 32, gap: 27, total: 59 },
  '投剣': { attack: 24, gap: 18, total: 42 },
  '鞭': { attack: 24, gap: 21, total: 45 },
  '陣貝': { attack: 218, gap: 0, total: 218, multiHit: 18 },
  '軍船': { attack: 32, gap: 42, total: 74 },
};

// ========================================
// ユーティリティ関数
// ========================================

/**
 * 最大値ルールを適用
 * 同種バフは最大値のみを使用
 */
function applyMaxValueRule(buffs: BuffValue[]): number {
  if (buffs.length === 0) return 0;
  
  // 同種バフごとにグループ化
  const grouped = buffs.reduce((acc, buff) => {
    if (!acc[buff.type]) {
      acc[buff.type] = [];
    }
    acc[buff.type].push(buff.value);
    return acc;
  }, {} as Record<string, number[]>);
  
  // 各グループの最大値を取得して合計
  return Object.values(grouped)
    .map(values => Math.max(...values))
    .reduce((sum, max) => sum + max, 0);
}

// ========================================
// Phase 1: 攻撃力の確定
// ========================================

function calculatePhase1(
  character: Character,
  environment: EnvironmentSettings
): {
  attack: number;
  breakdown: DamageBreakdown['phase1'];
} {
  const baseAttack = character.stats.baseAttack;
  
  // 割合バフ（最大値ルール適用）
  const selfPercentBuff = applyMaxValueRule(character.selfBuffs.percentBuffs);
  const percentBuffApplied = selfPercentBuff; // 環境側の割合バフがあれば比較
  
  // 固定値バフ（すべて加算）
  const flatBuffApplied = character.selfBuffs.flatBuffs.reduce((sum, val) => sum + val, 0);
  
  // 加算バフ（基礎攻撃力を参照）
  const selfAdditiveBuff = character.selfBuffs.additiveBuffs.reduce(
    (sum, buff) => sum + (baseAttack * buff.value / 100),
    0
  );
  const envAdditiveBuff = environment.inspireFlat;
  const additiveBuffApplied = selfAdditiveBuff + envAdditiveBuff;
  
  // 重複バフ（自己と環境を加算）
  const selfDuplicateBuff = character.selfBuffs.duplicateBuffs.reduce((sum, val) => sum + val, 0);
  const envDuplicateBuff = environment.duplicateBuff;
  const duplicateBuffApplied = selfDuplicateBuff + envDuplicateBuff;
  
  // Phase 1の計算
  // 特殊な挙動: 加算バフも重複バフで乗算される
  const additiveWithDuplicate = additiveBuffApplied * (1 + duplicateBuffApplied / 100);
  
  const attackBeforeDuplicate = (baseAttack * (1 + percentBuffApplied / 100)) + flatBuffApplied + additiveWithDuplicate;
  const finalAttack = attackBeforeDuplicate * (1 + duplicateBuffApplied / 100);
  
  return {
    attack: finalAttack,
    breakdown: {
      baseAttack,
      percentBuffApplied,
      flatBuffApplied,
      additiveBuffApplied: additiveWithDuplicate,
      duplicateBuffApplied,
      finalAttack,
    },
  };
}

// ========================================
// Phase 2: ダメージ倍率の適用
// ========================================

function calculatePhase2(
  attack: number,
  character: Character,
  environment: EnvironmentSettings
): {
  damage: number;
  breakdown: DamageBreakdown['phase2'];
} {
  let damage = attack;
  const multipliers: Array<{ type: string; value: number }> = [];
  
  // すべての倍率を個別に乗算
  for (const mult of character.selfBuffs.damageMultipliers) {
    damage *= mult.value;
    multipliers.push({ type: mult.type, value: mult.value });
  }
  
  return {
    damage,
    breakdown: {
      multipliers,
      damage,
    },
  };
}

// ========================================
// Phase 3: 防御力による減算
// ========================================

function calculatePhase3(
  damage: number,
  character: Character,
  environment: EnvironmentSettings
): {
  damage: number;
  breakdown: DamageBreakdown['phase3'];
} {
  // 防御無視チェック
  if (character.selfBuffs.defenseIgnore) {
    return {
      damage,
      breakdown: {
        enemyDefense: environment.enemyDefense,
        effectiveDefense: 0,
        damage,
      },
    };
  }
  
  // 有効防御力の計算: (基礎防御 × (1 - 割合デバフ%)) - 固定値デバフ
  let effectiveDefense = environment.enemyDefense * (1 - environment.defenseDebuffPercent / 100);
  effectiveDefense = effectiveDefense - environment.defenseDebuffFlat;
  effectiveDefense = Math.max(0, effectiveDefense);
  
  // ダメージ計算（最低1保証）
  const finalDamage = Math.max(1, damage - effectiveDefense);
  
  return {
    damage: finalDamage,
    breakdown: {
      enemyDefense: environment.enemyDefense,
      effectiveDefense,
      damage: finalDamage,
    },
  };
}

// ========================================
// Phase 4: 与ダメ・被ダメによる増減
// ========================================

function calculatePhase4(
  damage: number,
  character: Character,
  environment: EnvironmentSettings
): {
  damage: number;
  breakdown: DamageBreakdown['phase4'];
} {
  // 与ダメ（現状は環境設定にないため0）
  const damageDealt = 0;
  
  // 被ダメ（最大値のみ適用）
  const damageTaken = environment.damageTaken;
  
  // 乗算
  const finalDamage = damage * (1 + damageDealt / 100) * (1 + damageTaken / 100);
  
  return {
    damage: Math.floor(finalDamage),
    breakdown: {
      damageDealt,
      damageTaken,
      damage: Math.floor(finalDamage),
    },
  };
}

// ========================================
// Phase 5: 連撃による乗算
// ========================================

function calculatePhase5(
  damage: number,
  character: Character
): {
  damage: number;
  breakdown?: DamageBreakdown['phase5'];
} {
  if (!character.multiHit) {
    return { damage };
  }
  
  const totalDamage = damage * character.multiHit;
  
  return {
    damage: totalDamage,
    breakdown: {
      attackCount: character.multiHit,
      totalDamage,
    },
  };
}

// ========================================
// DPS計算
// ========================================

function calculateDPS(
  totalDamage: number,
  character: Character,
  environment: EnvironmentSettings
): {
  dps: number;
  breakdown: DamageBreakdown['dps'];
} {
  const frameData = WEAPON_FRAMES[character.weaponType];
  if (!frameData) {
    return {
      dps: 0,
      breakdown: {
        attackFrames: 0,
        gapFrames: 0,
        totalFrames: 0,
        attacksPerSecond: 0,
        dps: 0,
      },
    };
  }
  
  // 速度バフを合算（最大値ルール）
  const attackSpeedBuff = Math.max(
    character.selfBuffs.attackSpeed || 0,
    environment.attackSpeed || 0
  );
  
  const gapReductionBuff = Math.max(
    character.selfBuffs.gapReduction || 0,
    environment.gapReduction || 0
  );
  
  // フレーム計算
  const attackFrames = frameData.attack / (1 + attackSpeedBuff / 100);
  const gapFrames = frameData.gap * (1 - gapReductionBuff / 100);
  const totalFrames = attackFrames + gapFrames;
  
  // 1秒あたりの攻撃回数（60FPS想定）
  const attacksPerSecond = 60 / totalFrames;
  
  // DPS
  const dps = totalDamage * attacksPerSecond;
  
  return {
    dps,
    breakdown: {
      attackFrames,
      gapFrames,
      totalFrames,
      attacksPerSecond,
      dps,
    },
  };
}

// ========================================
// メイン計算関数
// ========================================

export function calculateDamage(
  character: Character,
  environment: EnvironmentSettings
): DamageCalculationResult {
  // Phase 1: 攻撃力の確定
  const phase1 = calculatePhase1(character, environment);
  
  // Phase 2: ダメージ倍率の適用
  const phase2 = calculatePhase2(phase1.attack, character, environment);
  
  // Phase 3: 防御力による減算
  const phase3 = calculatePhase3(phase2.damage, character, environment);
  
  // Phase 4: 与ダメ・被ダメによる増減
  const phase4 = calculatePhase4(phase3.damage, character, environment);
  
  // Phase 5: 連撃による乗算
  const phase5 = calculatePhase5(phase4.damage, character);
  
  // DPS計算
  const dpsCalc = calculateDPS(phase5.damage, character, environment);
  
  // 鼓舞量計算（該当キャラのみ）
  let inspireAmount: number | undefined;
  if (character.selfBuffs.inspire && character.selfBuffs.inspire.stat === 'attack') {
    inspireAmount = phase1.attack * (character.selfBuffs.inspire.value / 100);
  }
  
  return {
    characterId: character.id,
    phase1Attack: phase1.attack,
    phase2Damage: phase2.damage,
    phase3Damage: phase3.damage,
    phase4Damage: phase4.damage,
    totalDamage: phase5.damage,
    dps: dpsCalc.dps,
    inspireAmount,
    breakdown: {
      phase1: phase1.breakdown,
      phase2: phase2.breakdown,
      phase3: phase3.breakdown,
      phase4: phase4.breakdown,
      phase5: phase5.breakdown,
      dps: dpsCalc.breakdown,
    },
  };
}

// ========================================
// 使用例
// ========================================

// キャラクター例: 絢爛ダノター城
const exampleCharacter: Character = {
  id: 'danotter-kenran',
  name: '絢爛ダノター城',
  weaponType: '刀',
  level: 120,
  stats: {
    baseAttack: 1000,
  },
  selfBuffs: {
    percentBuffs: [{ value: 40, type: 'self' }],
    flatBuffs: [100],
    additiveBuffs: [],
    duplicateBuffs: [20],
    damageMultipliers: [
      { type: 'attack_multiple', value: 2, condition: '攻撃の2倍' },
      { type: 'conditional', value: 1.5, condition: '耐久50%以下' },
      { type: 'give_damage', value: 1.3, condition: '与えるダメージ' },
      { type: 'conditional', value: 2.5, condition: '耐久依存' },
    ],
    defenseIgnore: true,
    attackSpeed: 30,
    gapReduction: 40,
  },
  multiHit: 5,
};

// 環境設定例
const exampleEnvironment: EnvironmentSettings = {
  inspireFlat: 500,
  duplicateBuff: 20,
  attackSpeed: 0,
  gapReduction: 0,
  enemyDefense: 300,
  defenseDebuffPercent: 20,
  defenseDebuffFlat: 100,
  damageTaken: 50,
  enemyHpPercent: 30,
};

// 計算実行
const result = calculateDamage(exampleCharacter, exampleEnvironment);

console.log('計算結果:', result);
console.log('最終ダメージ:', result.totalDamage);
console.log('DPS:', result.dps.toFixed(0));
