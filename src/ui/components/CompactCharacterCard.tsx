/**
 * コンパクトキャラクターカード
 * 
 * ダメージ計算結果を表示する超コンパクトなカード（約180px × 200px）
 */

import type { Character, DamageCalculationResult, DamageComparison } from '../../core/types';
import { formatCompactNumber, truncateName } from '../../core/logic/damageCalculator';
import { DiffIndicator } from './DiffIndicator';

interface CompactCharacterCardProps {
    character: Character;
    result: DamageCalculationResult;
    comparison?: DamageComparison;
    onShowDetails: () => void;
    onRemove: () => void;
}

export function CompactCharacterCard({
    character,
    result,
    comparison,
    onShowDetails,
    onRemove,
}: CompactCharacterCardProps) {
    const displayName = truncateName(character.name, 6);
    const level = 120; // TODO: キャラクターデータから取得

    return (
        <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-move">
            {/* キャラ名 */}
            <div className="text-sm font-bold text-gray-800 mb-2 truncate" title={character.name}>
                {displayName}
            </div>

            {/* 武器アイコン + レベル */}
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
                <span>{character.weapon}</span>
                <span>Lv{level}</span>
            </div>

            {/* 最終ダメージ */}
            <div className="mb-2">
                <div className="text-2xl font-bold text-blue-600">
                    {formatCompactNumber(result.totalDamage)}
                </div>
                {comparison && (
                    <DiffIndicator
                        value={comparison.diff.totalDamage}
                        percent={comparison.diff.totalDamagePercent}
                    />
                )}
            </div>

            {/* DPS */}
            <div className="mb-3">
                <div className="flex items-center gap-1 text-sm text-gray-700">
                    <span className="text-xs">⚡</span>
                    <span className="font-semibold">{Math.floor(result.dps)}</span>
                </div>
                {comparison && (
                    <DiffIndicator
                        value={comparison.diff.dps}
                        percent={comparison.diff.dpsPercent}
                    />
                )}
            </div>

            {/* バッジ */}
            <div className="flex gap-2 mb-3">
                {character.multiHit && (
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        🎯×{character.multiHit}
                    </span>
                )}
                {result.inspireAmount && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                        🎺{Math.floor(result.inspireAmount)}
                    </span>
                )}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2">
                <button
                    onClick={onShowDetails}
                    className="flex-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    title="詳細を表示"
                >
                    📊
                </button>
                <button
                    onClick={onRemove}
                    className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                    title="削除"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}
