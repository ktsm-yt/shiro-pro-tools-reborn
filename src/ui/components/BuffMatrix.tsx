import { useMemo, useState } from 'react';
import type { Character, Formation, Stat } from '../../core/types';
import { getAttributeMeta, getWeaponMeta } from '../constants/meta';
import type { VisualBuffMatrix, VisualBuffCell } from '../utils/visualBuffMatrix';

interface BuffMatrixProps {
  formation: Formation;
  matrix: VisualBuffMatrix;
  onCharClick?: (character: Character) => void;
}

type StatRow = { key: Stat; name: string; icon: string };
const BUFF_CATEGORIES: { key: string; name: string; icon: string; stats: StatRow[] }[] = [
  { key: 'resource', name: '気・計略', icon: '⚡', stats: [{ key: 'cost', name: '気', icon: '⚡' }, { key: 'cooldown', name: '計略短縮', icon: '⏱' }] },
  { key: 'offense', name: '攻撃系', icon: '⚔', stats: [{ key: 'attack', name: '攻撃', icon: '⚔' }, { key: 'damage_dealt', name: '与ダメ', icon: '💥' }, { key: 'range', name: '射程', icon: '◎' }] },
  { key: 'defense', name: '防御系', icon: '🛡', stats: [{ key: 'defense', name: '防御', icon: '🛡' }, { key: 'damage_taken', name: '被ダメ軽減', icon: '🔰' }] },
  { key: 'speed', name: '速度系', icon: '💨', stats: [{ key: 'attack_speed', name: '攻撃速度', icon: '⚡' }, { key: 'attack_gap', name: '攻撃隙', icon: '⏳' }] },
  { key: 'utility', name: 'その他', icon: '✨', stats: [{ key: 'recovery', name: '回復', icon: '💚' }, { key: 'target_count', name: '対象数', icon: '🎯' }] },
];

const PERCENT_STATS = new Set<Stat>(['attack', 'defense', 'range', 'damage_dealt', 'damage_taken', 'attack_speed', 'attack_gap', 'recovery', 'cooldown']);

const CategoryHeader = ({ name, icon, expanded, toggle }: { name: string; icon: string; expanded: boolean; toggle: () => void }) => (
  <button
    onClick={toggle}
    className="w-full flex items-center gap-2 py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
  >
    <span className="text-lg">{icon}</span>
    <span className="font-medium text-white flex-1 text-left">{name}</span>
    <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
  </button>
);

const BuffDots = ({ cell }: { cell: VisualBuffCell }) => {
  const total = cell.self + cell.ally + cell.strategy;
  if (total === 0) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <div className="flex gap-1 items-center">
      {cell.self > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title={`自前 +${cell.self}`} />}
      {cell.ally > 0 && <span className="w-2.5 h-2.5 rounded-full bg-green-500" title={`味方 +${cell.ally}`} />}
      {cell.strategy > 0 && <span className="w-2.5 h-2.5 rounded-full bg-purple-500" title={`計略 +${cell.strategy}`} />}
    </div>
  );
};

const StackBar = ({ cell, max }: { cell: VisualBuffCell; max: number }) => {
  const total = cell.self + cell.ally + cell.strategy;
  const safeMax = Math.max(max, total, 1);
  const width = (value: number) => `${Math.min((value / safeMax) * 100, 100)}%`;
  return (
    <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
      {cell.self > 0 && <div className="bg-blue-500 h-full" style={{ width: width(cell.self) }} />}
      {cell.ally > 0 && <div className="bg-green-500 h-full" style={{ width: width(cell.ally) }} />}
      {cell.strategy > 0 && <div className="bg-purple-500 h-full" style={{ width: width(cell.strategy) }} />}
      {total === 0 && <div className="w-full h-full bg-gray-700" />}
    </div>
  );
};

const formatValue = (stat: Stat, value: number) => {
  if (value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  const unit = PERCENT_STATS.has(stat) ? '%' : '';
  return `${sign}${value}${unit}`;
};

export function BuffMatrix({ formation, matrix, onCharClick }: BuffMatrixProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(BUFF_CATEGORIES.map((c) => [c.key, true])),
  );

  const activeChars = useMemo(
    () => formation.slots.filter((c): c is Character => Boolean(c)),
    [formation.slots],
  );

  const rowMax = useMemo(() => {
    const max: Partial<Record<Stat, number>> = {};
    activeChars.forEach((char) => {
      const charRow = matrix[char.id];
      if (!charRow) return;
      Object.entries(charRow).forEach(([stat, cell]) => {
        const total = cell.self + cell.ally + cell.strategy;
        max[stat as Stat] = Math.max(max[stat as Stat] ?? 0, total);
      });
    });
    return max;
  }, [activeChars, matrix]);

  if (activeChars.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 border border-dashed border-gray-700 rounded-xl bg-gray-900/40">
        <div className="text-center space-y-2">
          <div className="text-4xl">📋</div>
          <div className="text-sm">左のキャラ一覧からキャラを追加してください</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-gray-900 z-10">
        <div className="w-28 text-xs text-gray-400">項目</div>
        <div
          className="flex-1 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${activeChars.length}, minmax(120px, 1fr))` }}
        >
          {activeChars.map((char) => {
            const attr = getAttributeMeta(char).meta;
            const weapon = getWeaponMeta(char.weapon);
            return (
              <button
                key={char.id}
                onClick={() => onCharClick?.(char)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-700 hover:border-white/40 transition-colors`}
              >
                <span className="text-sm">{weapon.icon}</span>
                <span className="font-medium text-white text-xs truncate">{char.name}</span>
                <span className={`w-2 h-2 rounded-full ${attr.dot}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* カテゴリ別 */}
      {BUFF_CATEGORIES.map((category) => (
        <div key={category.key} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
          <CategoryHeader
            name={category.name}
            icon={category.icon}
            expanded={expanded[category.key]}
            toggle={() => setExpanded((prev) => ({ ...prev, [category.key]: !prev[category.key] }))}
          />

          {expanded[category.key] && (
            <div className="px-3 pb-2">
              {category.stats.map((stat) => (
                <div
                  key={stat.key}
                  className="flex items-center gap-2 py-2 border-t border-gray-700 first:border-t-0"
                >
                  <div className="w-28 flex items-center gap-1.5 text-sm text-gray-300">
                    <span>{stat.icon}</span>
                    <span>{stat.name}</span>
                  </div>
                  <div
                    className="flex-1 grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${activeChars.length}, minmax(120px, 1fr))` }}
                  >
                    {activeChars.map((char) => {
                      const cell: VisualBuffCell =
                        matrix[char.id]?.[stat.key] || { self: 0, ally: 0, strategy: 0, sources: [] };
                      const total = cell.self + cell.ally + cell.strategy;
                      const max = rowMax[stat.key] ?? 100;
                      return (
                        <div key={char.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <BuffDots cell={cell} />
                            <span className={`text-xs font-mono ${total !== 0 ? 'text-white' : 'text-gray-600'}`}>
                              {formatValue(stat.key, total)}
                            </span>
                          </div>
                          <StackBar cell={cell} max={max} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
