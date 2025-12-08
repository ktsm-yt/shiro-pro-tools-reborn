import { isBuffApplicable } from '../../core/logic/buffs';
import type { Buff, Character, Formation, Stat } from '../../core/types';

export type VisualBuffSource = { from: string; value: number; type: 'self' | 'ally' | 'strategy'; stat: Stat };
export type VisualBuffCell = { self: number; ally: number; strategy: number; sources: VisualBuffSource[] };
export type VisualBuffMatrix = Record<string, Partial<Record<Stat, VisualBuffCell>>>;

export const VISUAL_STAT_KEYS: Stat[] = [
  'cost',
  'cooldown',
  'attack',
  'damage_dealt',
  'range',
  'defense',
  'damage_taken',
  'attack_speed',
  'attack_gap',
  'recovery',
  'target_count',
];

/**
 * UI表示用にバフの内訳を収集する
 */
export function buildVisualBuffMatrix(
  formation: Formation,
  trackedStats: Stat[] = VISUAL_STAT_KEYS,
): VisualBuffMatrix {
  const tracked = new Set<Stat>(trackedStats);
  const result: VisualBuffMatrix = {};

  const activeChars = formation.slots.filter((c): c is Character => Boolean(c));

  activeChars.forEach((char) => {
    result[char.id] = {};
    tracked.forEach((stat) => {
      result[char.id][stat] = { self: 0, ally: 0, strategy: 0, sources: [] };
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

        const type: 'self' | 'ally' | 'strategy' =
          buff.source === 'strategy' ? 'strategy' : (sourceChar.id === targetChar.id ? 'self' : 'ally');

        cell[type] += buff.value;
        cell.sources.push({
          from: sourceChar.name,
          value: buff.value,
          type,
          stat: buff.stat,
        });
      });
    });
  });

  return result;
}
