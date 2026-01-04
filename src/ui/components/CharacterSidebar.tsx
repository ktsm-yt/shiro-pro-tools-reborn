import { useMemo, useState, useRef, useCallback } from 'react';
import type { Character } from '../../core/types';
import { ATTRIBUTE_META, getAttributeMeta } from '../constants/meta';
import { Trash2 } from 'lucide-react';

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
  savedCharacterIds?: ReadonlySet<string>;
  onDelete?: (character: Character) => void;
  compareIds?: string[];
  activeTab?: 'matrix' | 'analysis';
}

export function CharacterSidebar({
  characters,
  formationIds,
  collapsed,
  onToggle,
  onSelect,
  savedCharacterIds,
  onDelete,
  compareIds = [],
  activeTab = 'matrix',
}: CharacterSidebarProps) {
  const isAnalysisMode = activeTab === 'analysis';
  const compareIdSet = useMemo(() => new Set(compareIds), [compareIds]);
  const [query, setQuery] = useState('');
  const [pressingCharId, setPressingCharId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDeletePress = useCallback((char: Character) => {
    setPressingCharId(char.id);
    deleteTimerRef.current = setTimeout(() => {
      setPressingCharId(null);
      onDelete?.(char);
    }, 500);
  }, [onDelete]);

  const cancelDeletePress = useCallback(() => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPressingCharId(null);
  }, []);

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
      className={`flex flex-col bg-[#0f1626] border-r border-gray-800 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'
        }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <button
          aria-label="toggle sidebar"
          onClick={onToggle}
          className="w-7 h-7 rounded-lg bg-gray-800 text-gray-200 hover:text-white hover:bg-gray-700 transition-colors flex items-center justify-center text-xs"
        >
          {collapsed ? '▶' : '◀'}
        </button>
        {!collapsed && <span className="text-sm font-semibold text-white">キャラ一覧</span>}
      </div>

      {!collapsed && (
        <div className="px-2 py-2 border-b border-gray-800">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前/武器で検索"
            className="w-full bg-[#111a2c] text-xs text-gray-100 placeholder:text-gray-500 px-2.5 py-1.5 rounded-md border border-[#27344a] focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {ATTRIBUTE_ORDER.map((attrKey) => {
          const chars = grouped[attrKey] || [];
          if (chars.length === 0) return null;
          const meta = ATTRIBUTE_META[attrKey];
          return (
            <div key={attrKey} className="space-y-1">
              {!collapsed && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 px-0.5">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-gray-600">/</span>
                  <span>{chars.length}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {chars.map((char) => {
                  const isInFormation = formationIds.includes(char.id);
                  const isInCompareList = compareIdSet.has(char.id);
                  const isDeletable = Boolean(onDelete && savedCharacterIds?.has(char.id));
                  const attrMeta = getAttributeMeta(char).meta;

                  // Both modes: always clickable (toggle behavior)
                  const isDisabled = false;

                  return (
                    <div
                      key={char.id}
                      role="button"
                      tabIndex={!isDisabled ? 0 : -1}
                      aria-disabled={isDisabled}
                      onClick={() => !isDisabled && onSelect(char)}
                      onKeyDown={(e) => {
                        if (isDisabled) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(char);
                        }
                      }}
                      title={`${char.name}${char.rarity ? ` (${char.rarity})` : ''} - ${char.weapon}`}
                      className={`relative flex flex-col items-center p-1 rounded-lg border text-center transition-all group hover:-translate-y-0.5 cursor-pointer ${collapsed
                          ? 'border-transparent bg-transparent'
                          : isInFormation && !isAnalysisMode
                            ? 'border-green-500 bg-green-950/30 hover:border-green-400'
                            : isInCompareList && isAnalysisMode
                              ? 'border-blue-500 bg-blue-950/30 hover:border-blue-400'
                              : 'border-[#1f2a3d] bg-[#131b2b] hover:border-[#2c3a52] hover:bg-[#1a2436]'
                        }`}
                    >
                      {/* Status Dot */}
                      <span className={`absolute top-1 left-1 w-1.5 h-1.5 rounded-full ${attrMeta.dot}`} />

                      {/* Delete Button (Saved Characters Only) - Long Press to Delete */}
                      {!collapsed && isDeletable && (
                        <button
                          type="button"
                          title="長押しで削除"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startDeletePress(char);
                          }}
                          onMouseUp={cancelDeletePress}
                          onMouseLeave={cancelDeletePress}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            startDeletePress(char);
                          }}
                          onTouchEnd={cancelDeletePress}
                          onTouchCancel={cancelDeletePress}
                          className={`absolute top-1.5 right-1.5 z-10 p-1 rounded-md text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-100 ${
                            pressingCharId === char.id
                              ? 'bg-red-600 text-white opacity-100 transition-[background-color] duration-500'
                              : 'hover:text-red-400 hover:bg-red-950/40'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {/* Content */}
                      {!collapsed && (
                        <div className="w-full flex flex-col items-center pt-0.5">
                          <div className="text-[10px] font-bold text-gray-200 truncate w-full text-center leading-tight">{char.name}</div>
                        </div>
                      )}

                      {/* Formation Indicator (Matrix mode only) - clickable to remove */}
                      {!collapsed && isInFormation && !isAnalysisMode && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-green-500 rounded-full text-white text-[10px] font-bold shadow-sm">
                          ✓
                        </div>
                      )}

                      {/* Compare Selection Indicator (Analysis mode only) */}
                      {!collapsed && isInCompareList && isAnalysisMode && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-blue-500 rounded-full text-white text-[10px] font-bold shadow-sm">
                          ✓
                        </div>
                      )}
                    </div>
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
