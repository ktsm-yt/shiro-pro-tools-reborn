import type { Character, DamageCalculationResult, EnvironmentSettings } from '../../core/types';
import { CompactCharacterCard } from './CompactCharacterCard';

interface DamageAnalysisProps {
    characters: Character[];
    results: Record<string, DamageCalculationResult>;
    comparisons: Record<string, { before?: DamageCalculationResult }>;
    onCharClick: (char: Character) => void;
    onRemove: (charId: string) => void;
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : Math.floor(n).toString());

export function DamageAnalysis({
    characters,
    results,
    comparisons,
    onCharClick,
    onRemove,
}: DamageAnalysisProps) {
    const activeChars = characters;

    const totalDPS = Object.values(results).reduce((sum, r) => sum + (r?.dps || 0), 0);
    const baseTotalDPS = Object.values(comparisons).reduce((sum, c) => sum + (c.before?.dps || 0), 0);

    if (activeChars.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                <span className="text-3xl mb-2 opacity-50">📊</span>
                <p className="text-sm">キャラクターが編成されていません</p>
                <p className="text-xs text-gray-600 mt-1">左のリストからキャラクターを追加してください</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 統計バー */}
            <div className="flex items-center gap-4 text-sm bg-gray-800/40 px-4 py-2 rounded-lg border border-gray-800/60">
                <span className="text-gray-400 flex items-center gap-2">
                    合計DPS
                    <span className="text-yellow-400 font-bold text-lg">{fmt(totalDPS)}</span>
                </span>
                {baseTotalDPS !== totalDPS && (
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                        (前: {fmt(baseTotalDPS)})
                        <span className={totalDPS > baseTotalDPS ? 'text-green-500' : 'text-red-500'}>
                            {totalDPS > baseTotalDPS ? '▲' : '▼'}
                        </span>
                    </span>
                )}
            </div>

            {/* グリッド表示 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {activeChars.map((char) => (
                    <CompactCharacterCard
                        key={char.id}
                        character={char}
                        result={results[char.id]}
                        comparison={comparisons[char.id]}
                        onShowDetails={() => onCharClick(char)}
                        onRemove={() => onRemove(char.id)}
                    />
                ))}
            </div>
        </div>
    );
}
