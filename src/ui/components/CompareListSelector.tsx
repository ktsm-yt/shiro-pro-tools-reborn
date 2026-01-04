import { useMemo, useState } from 'react';
import type { Character } from '../../core/types';
import { getAttributeMeta } from '../constants/meta';

interface CompareListSelectorProps {
    allCharacters: Character[];
    selectedIds: string[];
    onToggle: (charId: string) => void;
    onClear: () => void;
}

export function CompareListSelector({
    allCharacters,
    selectedIds,
    onToggle,
    onClear,
}: CompareListSelectorProps) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allCharacters;
        return allCharacters.filter(
            (c) => c.name.toLowerCase().includes(q) || c.weapon.toLowerCase().includes(q)
        );
    }, [allCharacters, query]);

    const selectedCount = selectedIds.length;

    return (
        <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-300">比較キャラ選択</span>
                    <span className="text-xs text-gray-500">({selectedCount}件選択中)</span>
                </div>
                {selectedCount > 0 && (
                    <button
                        onClick={onClear}
                        className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                        クリア
                    </button>
                )}
            </div>

            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="名前/武器で検索"
                className="w-full bg-gray-900/50 text-xs text-gray-100 placeholder:text-gray-500 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 mb-3"
            />

            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-4">
                        キャラが見つかりません
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-0.5">
                        {filtered.map((char) => {
                            const isSelected = selectedIds.includes(char.id);
                            const attrMeta = getAttributeMeta(char).meta;
                            // Use period field from character data (e.g., "絢爛", "飢渇")
                            const prefix = char.period || null;
                            return (
                                <button
                                    key={char.id}
                                    onClick={() => onToggle(char.id)}
                                    className={`flex items-center gap-1 px-1 py-0.5 rounded text-left transition-colors ${
                                        isSelected
                                            ? 'bg-blue-600/30 border border-blue-500/50'
                                            : 'bg-gray-800/30 border border-transparent hover:bg-gray-700/50'
                                    }`}
                                >
                                    {char.imageUrl ? (
                                        <img
                                            src={char.imageUrl}
                                            alt=""
                                            className="w-4 h-4 rounded object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${attrMeta.dot}`} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-0.5">
                                            {prefix && (
                                                <span className="text-[8px] text-amber-400/90">[{prefix}]</span>
                                            )}
                                            <span className="text-[10px] text-white truncate">{char.name}</span>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <span className="text-[8px] text-blue-400 flex-shrink-0">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
