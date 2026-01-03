import { useMemo, useState } from 'react';
import type { Character, Formation, Stat } from '../../core/types';
import { getAttributeMeta, getWeaponMeta } from '../constants/meta';
import type { VisualBuffMatrix, VisualBuffCell } from '../utils/visualBuffMatrix';

interface BuffMatrixProps {
  formation: Formation;
  matrix: VisualBuffMatrix;
  onCharClick?: (character: Character) => void;
}

type StatRow = { key: Stat; name: string; icon: string; isFlat?: boolean };
const BUFF_CATEGORIES: { key: string; name: string; icon: string; stats: StatRow[] }[] = [
  {
    key: 'resource', name: '気・計略', icon: '⚡', stats: [
      { key: 'cost', name: '自然気', icon: '⚡' },
      { key: 'cost_gradual', name: '徐々気', icon: '💧' },
      { key: 'cost_enemy_defeat', name: '気(牛)', icon: '🐄', isFlat: true },
      { key: 'cost_defeat_bonus', name: '気(ノビ)', icon: '🌱', isFlat: true },
      { key: 'cost_giant', name: '気軽減%', icon: '💨' },
      { key: 'cost_giant', name: '気軽減-', icon: '💨', isFlat: true },
      { key: 'cost_strategy', name: '計略気-', icon: '📜' },
      { key: 'strategy_cooldown', name: '計略短縮', icon: '⏱' },
    ]
  },
  {
    key: 'offense', name: '攻撃系', icon: '⚔', stats: [
      { key: 'attack', name: '攻撃%', icon: '⚔' },
      { key: 'attack', name: '攻撃+', icon: '⚔', isFlat: true },
      { key: 'effect_duplicate_attack', name: '効果重複', icon: '🔄' },
      { key: 'damage_dealt', name: '与ダメ↑', icon: '💥' },
      { key: 'give_damage', name: '与えるダメージ', icon: '✕' },
      { key: 'enemy_damage_taken', name: '被ダメ↑', icon: '🔥' },
      { key: 'critical_bonus', name: '直撃', icon: '🎯' },
      { key: 'enemy_defense', name: '敵防御↓', icon: '🔻' },
      { key: 'enemy_defense_ignore_percent', name: '防御無視%', icon: '💢' },
      { key: 'enemy_defense_ignore_complete', name: '防御無視', icon: '⚡' },
    ]
  },
  {
    key: 'range', name: '射程系', icon: '◎', stats: [
      { key: 'range', name: '射程%', icon: '◎' },
      { key: 'range', name: '射程+', icon: '◎', isFlat: true },
      { key: 'effect_duplicate_range', name: '効果重複', icon: '🔄' },
      { key: 'target_count', name: '対象数', icon: '👥' },
      { key: 'attack_count', name: '攻撃回数', icon: '🔄' },
      { key: 'enemy_range', name: '敵射程↓', icon: '📉' },
    ]
  },
  {
    key: 'defense', name: '防御系', icon: '🛡', stats: [
      { key: 'defense', name: '防御%', icon: '🛡' },
      { key: 'defense', name: '防御+', icon: '🛡', isFlat: true },
      { key: 'effect_duplicate_defense', name: '効果重複', icon: '🔄' },
      { key: 'damage_taken', name: '被ダメ軽減', icon: '🔰' },
      { key: 'enemy_attack', name: '敵攻撃↓', icon: '🔻' },
      { key: 'enemy_damage_dealt', name: '与ダメ↓', icon: '📉' },
    ]
  },
  {
    key: 'speed', name: '速度系', icon: '💨', stats: [
      { key: 'attack_speed', name: '攻撃速度', icon: '⚡' },
      { key: 'attack_gap', name: '攻撃隙', icon: '⏳' },
      { key: 'enemy_movement', name: '敵移動', icon: '🐢' },
      { key: 'enemy_retreat', name: '敵後退', icon: '↩' },
    ]
  },
  {
    key: 'special', name: '特殊', icon: '✨', stats: [
      { key: 'inspire', name: '鼓舞', icon: '📯' },
      { key: 'recovery', name: '回復', icon: '💚' },
      { key: 'damage_recovery', name: '与ダメ回復', icon: '💉' },
    ]
  },
];

const PERCENT_STATS = new Set<Stat>([
  'attack', 'defense', 'range',
  'damage_dealt', 'give_damage', 'damage_taken', 'enemy_damage_taken', 'damage_recovery', 'critical_bonus',
  'effect_duplicate_attack', 'effect_duplicate_defense', 'effect_duplicate_range',  // 効果重複
  'attack_speed', 'attack_gap',
  'strategy_cooldown', 'cost_giant',
  'enemy_defense', 'enemy_defense_ignore_percent', 'enemy_attack', 'enemy_movement', 'enemy_range',
  'inspire',
]);

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

// 動的バフのタイプを日本語に変換
const DYNAMIC_TYPE_LABELS: Record<string, string> = {
  'per_ally_other': '味方1体につき',
  'per_ally_in_range': '射程内味方1体につき',
  'per_enemy_in_range': '射程内敵1体につき',
  'per_ambush_deployed': '配置伏兵1体につき',
  'per_enemy_defeated': '敵撃破毎に',
  'per_specific_attribute': '特定属性の城娘毎に',
  'per_specific_weapon': '特定武器種の城娘毎に',
};

const BuffDots = ({ cell, isFlat }: { cell: VisualBuffCell; isFlat?: boolean }) => {
  const value = isFlat ? cell.maxFlat : cell.maxValue;
  const hasSelf = isFlat ? cell.hasSelfFlat : cell.hasSelf;
  const hasAlly = isFlat ? cell.hasAllyFlat : cell.hasAlly;
  const hasStrategy = isFlat ? cell.hasStrategyFlat : cell.hasStrategy;
  const hasDuplicate = cell.hasDuplicate;
  const hasAmbush = cell.hasAmbush;
  const hasDynamic = cell.hasDynamic;

  // 動的バフのツールチップを生成
  const dynamicTooltip = cell.dynamicSources?.map(src => {
    const typeLabel = src.dynamicType ? DYNAMIC_TYPE_LABELS[src.dynamicType] || src.dynamicType : '';
    const paramLabel = src.dynamicParameter || typeLabel;
    return `${src.from}: ${paramLabel} +${src.unitValue ?? src.value}%`;
  }).join('\n') || '';

  if (value === 0) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <div className="flex gap-1 items-center">
      {hasSelf && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title="自前" />}
      {hasAlly && <span className="w-2.5 h-2.5 rounded-full bg-green-500" title="味方" />}
      {hasDuplicate && <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" title="効果重複" />}
      {hasStrategy && <span className="w-2.5 h-2.5 rounded-full bg-purple-500" title="計略" />}
      {hasAmbush && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" title="伏兵" />}
      {hasDynamic && (
        <span
          className="w-2.5 h-2.5 rounded-full bg-cyan-500 cursor-help"
          title={`動的バフ\n${dynamicTooltip}`}
        />
      )}
    </div>
  );
};

const StackBar = ({ cell, max, isFlat }: { cell: VisualBuffCell; max: number; isFlat?: boolean }) => {
  // 3色: 緑（味方にも適用）/ 黄（効果重複）/ 青（自分だけ追加）
  const sharedValue = isFlat ? cell.sharedFlat : cell.sharedValue;
  const duplicateValue = isFlat ? cell.duplicateFlat : cell.duplicateValue;
  const selfExtra = isFlat ? cell.selfExtraFlat : cell.selfExtra;
  const total = sharedValue + duplicateValue + selfExtra;
  const safeMax = Math.max(max, total, 1);

  const sharedWidth = (sharedValue / safeMax) * 100;
  const duplicateWidth = (duplicateValue / safeMax) * 100;
  const selfExtraWidth = (selfExtra / safeMax) * 100;
  const unit = isFlat ? '' : '%';

  // バー内に数値を表示するためのラベル
  const labels: string[] = [];
  if (sharedValue > 0) labels.push(`${Math.round(sharedValue)}`);
  if (duplicateValue > 0) labels.push(`${Math.round(duplicateValue)}`);
  if (selfExtra > 0) labels.push(`+${Math.round(selfExtra)}`);

  return (
    <div className="space-y-0.5">
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
        {duplicateValue > 0 && (
          <div
            className="bg-yellow-500 h-full"
            style={{ width: `${duplicateWidth}%` }}
            title={`効果重複: ${Math.round(duplicateValue)}${unit}`}
          />
        )}
        {sharedValue > 0 && (
          <div
            className="bg-green-500 h-full"
            style={{ width: `${sharedWidth}%` }}
            title={`味方にも: ${Math.round(sharedValue)}${unit}`}
          />
        )}
        {selfExtra > 0 && (
          <div
            className="bg-blue-500 h-full"
            style={{ width: `${selfExtraWidth}%` }}
            title={`自分だけ: +${Math.round(selfExtra)}${unit}`}
          />
        )}
      </div>
      {/* 各セクションの数値をバー下に表示 */}
      {total > 0 && (
        <div className="flex text-[10px] gap-1">
          {duplicateValue > 0 && <span className="text-yellow-400">{Math.round(duplicateValue)}{unit}</span>}
          {sharedValue > 0 && <span className="text-green-400">{Math.round(sharedValue)}{unit}</span>}
          {selfExtra > 0 && <span className="text-blue-400">+{Math.round(selfExtra)}{unit}</span>}
        </div>
      )}
    </div>
  );
};

const formatValue = (stat: Stat, value: number, isFlat?: boolean) => {
  if (value === 0) return '—';
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  // 固定値表示の場合は単位なし、それ以外はPERCENT_STATSを参照
  const unit = isFlat ? '' : (PERCENT_STATS.has(stat) ? '%' : '');
  return `${sign}${rounded}${unit}`;
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
    const maxFlat: Partial<Record<Stat, number>> = {};
    activeChars.forEach((char) => {
      const charRow = matrix[char.id];
      if (!charRow) return;
      Object.entries(charRow).forEach(([stat, cell]) => {
        max[stat as Stat] = Math.max(max[stat as Stat] ?? 0, cell.maxValue);
        maxFlat[stat as Stat] = Math.max(maxFlat[stat as Stat] ?? 0, cell.maxFlat);
      });
    });
    return { percent: max, flat: maxFlat };
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
              {category.stats.map((stat, idx) => (
                <div
                  key={`${stat.key}-${stat.isFlat ? 'flat' : 'pct'}-${idx}`}
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
                        matrix[char.id]?.[stat.key] || {
                          maxValue: 0, maxFlat: 0,
                          sharedValue: 0, duplicateValue: 0, selfExtra: 0,
                          sharedFlat: 0, duplicateFlat: 0, selfExtraFlat: 0,
                          hasSelf: false, hasAlly: false, hasStrategy: false, hasDuplicate: false, hasAmbush: false,
                          hasSelfFlat: false, hasAllyFlat: false, hasStrategyFlat: false,
                          sources: []
                        };
                      const value = stat.isFlat ? cell.maxFlat : cell.maxValue;
                      const max = stat.isFlat ? (rowMax.flat[stat.key] ?? 100) : (rowMax.percent[stat.key] ?? 100);
                      return (
                        <div key={char.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <BuffDots cell={cell} isFlat={stat.isFlat} />
                            <span className={`text-xs font-mono ${value !== 0 ? 'text-white' : 'text-gray-600'}`}>
                              {formatValue(stat.key, value, stat.isFlat)}
                            </span>
                          </div>
                          <StackBar cell={cell} max={max} isFlat={stat.isFlat} />
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
