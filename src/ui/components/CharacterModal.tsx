import { useEffect } from 'react';
import type { Character, Stat } from '../../core/types';
import { getAttributeMeta, getWeaponMeta } from '../constants/meta';
import type { VisualBuffCell } from '../utils/visualBuffMatrix';

interface CharacterModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  currentBuffs?: Partial<Record<Stat, VisualBuffCell>>;
}

const STAT_LABELS: { key: Stat; label: string }[] = [
  { key: 'attack', label: '攻撃' },
  { key: 'defense', label: '防御' },
  { key: 'range', label: '射程' },
  { key: 'hp', label: '耐久' },
  { key: 'cost', label: '気' },
];

export function CharacterModal({ character, isOpen, onClose, currentBuffs }: CharacterModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
    }
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !character) return null;

  const { meta } = getAttributeMeta(character);
  const weapon = getWeaponMeta(character.weapon);
  const wikiUrl = `https://scre.swiki.jp/index.php?${encodeURIComponent(character.name)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-gray-900 text-white rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
        <header className={`p-5 bg-gradient-to-r from-gray-800 to-gray-700 relative`}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-lg"
            aria-label="close"
          >
            ✕
          </button>
          <div className="flex items-center gap-4">
            {/* Character Image or Weapon Icon */}
            {character.imageUrl ? (
              <img
                src={character.imageUrl}
                alt={character.name}
                className={`w-14 h-14 object-cover rounded-xl border-2 ${meta.border}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl border ${meta.border} ${meta.light}`}>
                {weapon.icon}
              </div>
            )}
            <div>
              <div className="text-sm text-gray-300">
                {character.rarity && <span className="mr-2">{character.rarity}</span>}
                {meta.label}・{weapon.name}
              </div>
              <h3 className="text-2xl font-bold leading-tight">{character.name}</h3>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 編成中のバフサマリー */}
          {currentBuffs && (
            <section className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
              <h4 className="text-xs uppercase text-gray-400 tracking-wider mb-3">編成で受けているバフ</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(currentBuffs).map(([stat, cell]) => {
                  if (!cell) return null;
                  if (cell.maxValue === 0) return null;
                  return (
                    <div key={stat} className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2 border border-gray-700">
                      <span className="text-sm text-gray-300">{stat}</span>
                      <span className="text-sm font-mono text-white">+{Math.round(cell.maxValue)}</span>
                    </div>
                  );
                })}
                {Object.values(currentBuffs).filter(Boolean).every((c) => (c as VisualBuffCell).maxValue === 0) && (
                  <p className="text-sm text-gray-500">現在受けているバフはありません</p>
                )}
              </div>
            </section>
          )}

          {/* 基礎ステータス */}
          <section>
            <h4 className="text-xs uppercase text-gray-400 tracking-wider mb-2">基礎ステータス</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAT_LABELS.map(({ key, label }) => {
                const value = character.baseStats[key];
                if (value === undefined) return null;
                return (
                  <div key={key} className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 特技 */}
          {character.skills?.length ? (
            <section>
              <h4 className="text-xs uppercase text-gray-400 tracking-wider mb-2">特技</h4>
              <div className="space-y-2">
                {character.skills.map((skill, i) => (
                  <div key={skill.id ?? i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">#{i + 1}</span>
                      <span className="text-[11px] text-gray-400">{skill.target}</span>
                    </div>
                    <p className="text-sm text-gray-200">
                      {skill.stat} {skill.value}{skill.mode === 'percent_max' ? '%' : ''}
                      <span className="text-gray-400 text-xs ml-2">{skill.mode}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* 計略 */}
          {character.strategies?.length ? (
            <section>
              <h4 className="text-xs uppercase text-gray-400 tracking-wider mb-2">計略</h4>
              <div className="space-y-2">
                {character.strategies.map((strategy, i) => (
                  <div key={strategy.id ?? i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">#{i + 1}</span>
                      <span className="text-[11px] text-purple-300">{strategy.target}</span>
                    </div>
                    <p className="text-sm text-gray-200">
                      {strategy.stat} {strategy.value}{strategy.mode === 'percent_max' ? '%' : ''}
                      <span className="text-gray-400 text-xs ml-2">{strategy.mode}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between">
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-300 hover:text-blue-200"
          >
            📖 Wikiで見る
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-100 hover:bg-gray-700 transition-colors"
          >
            閉じる (Esc)
          </button>
        </footer>
      </div>
    </div>
  );
}
