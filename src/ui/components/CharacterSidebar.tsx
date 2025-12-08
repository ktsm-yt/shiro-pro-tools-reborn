import { useMemo, useState } from 'react';
import type { Character } from '../../core/types';
import { ATTRIBUTE_META, getAttributeMeta } from '../constants/meta';

const ATTRIBUTE_ORDER: Array<keyof typeof ATTRIBUTE_META> = [
  'plain',
  'plain_mountain',
  'mountain',
  'water',
  'hell',
  'none',
];

interface CharacterSidebarProps {
  characters: Character[];
  formationIds: string[];
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (character: Character) => void;
}

export function CharacterSidebar({
  characters,
  formationIds,
  collapsed,
  onToggle,
  onSelect,
}: CharacterSidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return characters;
    return characters.filter((c) => c.name.includes(q) || c.weapon.includes(q));
  }, [characters, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Character[]> = {};
    filtered.forEach((char) => {
      const { key } = getAttributeMeta(char);
      groups[key] = groups[key] || [];
      groups[key].push(char);
    });
    return groups;
  }, [filtered]);

  return (
    <aside
      className={`flex flex-col bg-[#0f1626] border-r border-gray-800 transition-all duration-200 ${collapsed ? 'w-16' : 'w-72'
        }`}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
        <button
          aria-label="toggle sidebar"
          onClick={onToggle}
          className="w-9 h-9 rounded-xl bg-gray-800 text-gray-200 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center"
        >
          {collapsed ? '▶' : '◀'}
        </button>
        {!collapsed && <span className="text-base font-semibold text-white">キャラ一覧</span>}
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b border-gray-800">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前/武器で検索"
            className="w-full bg-[#111a2c] text-sm text-gray-100 placeholder:text-gray-500 px-4 py-2.5 rounded-lg border border-[#27344a] focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {ATTRIBUTE_ORDER.map((attrKey) => {
          const chars = grouped[attrKey] || [];
          if (chars.length === 0) return null;
          const meta = ATTRIBUTE_META[attrKey];
          return (
            <div key={attrKey} className="space-y-2">
              {!collapsed && (
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-gray-600">/</span>
                  <span>{chars.length}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {chars.map((char) => {
                  const isInFormation = formationIds.includes(char.id);
                  const attrMeta = getAttributeMeta(char).meta;
                  return (
                    <button
                      key={char.id}
                      onClick={() => !isInFormation && onSelect(char)}
                      title={char.name}
                      className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition-all group ${collapsed
                          ? 'border-transparent bg-transparent'
                          : 'border-[#1f2a3d] bg-[#131b2b] hover:border-[#2c3a52] hover:bg-[#1a2436]'
                        } ${isInFormation ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:-translate-y-0.5'}`}
                    >
                      {/* Status Dot */}
                      <span className={`absolute top-2 left-2 w-2 h-2 rounded-full ${attrMeta.dot}`} />

                      {/* Content */}
                      {!collapsed && (
                        <div className="w-full flex flex-col items-center pt-2">
                          {/* Replace text with icon representation if available, or just keep compact text */}
                          <div className="text-xs font-bold text-gray-200 truncate w-full px-1 mb-0.5">{char.name}</div>
                          <div className="text-[10px] text-gray-500 truncate w-full px-1">{char.weapon}</div>
                        </div>
                      )}

                      {/* Formation Indicator (Icon overlay instead of large tag) */}
                      {!collapsed && isInFormation && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-[1px]">
                          <span className="text-[10px] font-bold text-white bg-green-600/90 px-2 py-0.5 rounded-full">編成中</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-xs text-gray-500 px-2">該当するキャラが見つかりません</div>
        )}
      </div>
    </aside>
  );
}
