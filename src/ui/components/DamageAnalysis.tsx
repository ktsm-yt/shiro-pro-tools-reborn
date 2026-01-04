import { useState } from 'react';
import type { Character, DamageCalculationResult, DamageComparison, DamageRange, EnvironmentSettings } from '../../core/types';
import { CompactCharacterCard } from './CompactCharacterCard';
import { DamageDetailModal } from './DamageDetailModal';

interface DamageAnalysisProps {
    characters: Character[];
    results: Record<string, DamageCalculationResult>;
    comparisons: Record<string, DamageComparison>;
    damageRanges?: Record<string, DamageRange>;
    env: EnvironmentSettings;
    onCharClick: (char: Character) => void;
    onRemove: (charId: string) => void;
    onUpdateCharacter?: (updated: Character) => void;
    mode?: 'formation' | 'compare';
}

const fmt = (n: number) => Math.floor(n).toLocaleString();

export function DamageAnalysis({
    characters,
    results,
    comparisons,
    damageRanges,
    env,
    onCharClick,
    onRemove,
    onUpdateCharacter,
    mode = 'formation',
}: DamageAnalysisProps) {
    const [modalChar, setModalChar] = useState<Character | null>(null);
    const activeChars = characters;

    const handleShowDetails = (char: Character) => {
        setModalChar(char);
        onCharClick(char);
    };

    const handleUpdateCharacter = (updated: Character) => {
        // モーダル内のキャラクター状態を更新
        setModalChar(updated);
        // 親に伝播
        onUpdateCharacter?.(updated);
    };

    const totalDPS = Object.values(results).reduce((sum, r) => sum + (r?.dps || 0), 0);
    const baseTotalDPS = Object.values(comparisons).reduce((sum, comparison) => {
        return sum + (comparison?.before?.dps || 0);
    }, 0);

    if (activeChars.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                <span className="text-3xl mb-2 opacity-50">📊</span>
                {mode === 'compare' ? (
                    <>
                        <p className="text-sm">比較するキャラクターを選択してください</p>
                        <p className="text-xs text-gray-600 mt-1">上のセレクターからキャラクターを追加</p>
                    </>
                ) : (
                    <>
                        <p className="text-sm">キャラクターが編成されていません</p>
                        <p className="text-xs text-gray-600 mt-1">左のリストからキャラクターを追加してください</p>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* グリッド表示 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {activeChars.map((char) => (
                    <CompactCharacterCard
                        key={char.id}
                        character={char}
                        result={results[char.id]}
                        comparison={comparisons[char.id]}
                        damageRange={damageRanges?.[char.id]}
                        onShowDetails={() => handleShowDetails(char)}
                        onRemove={() => onRemove(char.id)}
                    />
                ))}
            </div>

            {/* 詳細モーダル */}
            {modalChar && (
                <DamageDetailModal
                    character={modalChar}
                    baseEnv={env}
                    onClose={() => setModalChar(null)}
                    onUpdateCharacter={handleUpdateCharacter}
                />
            )}
        </div>
    );
}
