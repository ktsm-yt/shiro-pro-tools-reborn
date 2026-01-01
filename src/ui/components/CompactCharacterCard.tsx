import type { Character, DamageCalculationResult, DamageComparison } from '../../core/types';
import { getWeaponMeta } from '../constants/meta';

const fmt = (n: number) => Math.floor(n).toLocaleString();
const fmtFull = (n: number) => Math.floor(n).toLocaleString();

const DiffArrow = ({ before, after }: { before: number; after: number }) => {
    if (before === after) return null;
    const up = after > before;
    const pct = before !== 0 ? (((after - before) / before) * 100).toFixed(1) : '∞';
    return (
        <span className={`text-xs ml-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? '↑' : '↓'}
            {pct}%
        </span>
    );
};

interface CompactCharacterCardProps {
    character: Character;
    result?: DamageCalculationResult;
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
    if (!result) return null;
    const icon = getWeaponMeta(character.weapon).icon;
    const prev = comparison?.before;
    const hasPrev = prev && (prev.totalDamage !== result.totalDamage || prev.dps !== result.dps || prev.inspireAmount !== result.inspireAmount);

    return (
        <div
            className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-gray-500 transition-colors group cursor-pointer"
            onClick={onShowDetails}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white leading-tight truncate" title={character.name}>
                    {character.name}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    ✕
                </button>
            </div>

            <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-400">
                <span>{icon}</span>
                {character.multiHit && <span className="px-1 py-0.5 bg-purple-500/30 text-purple-200 rounded text-[11px]">×{character.multiHit}</span>}
                {character.selfBuffs?.defenseIgnore && <span className="px-1 py-0.5 bg-red-500/30 text-red-200 rounded text-[11px]">防無</span>}
                {result.inspireAmount && <span className="px-1 py-0.5 bg-green-500/30 text-green-200 rounded text-[11px]">鼓舞</span>}
            </div>

            <div className="mb-1.5">
                <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-white">{fmt(result.totalDamage)}</span>
                    {hasPrev && prev && <DiffArrow before={prev.totalDamage} after={result.totalDamage} />}
                </div>
                {hasPrev && prev && (
                    <div className="text-[11px] text-gray-500">
                        前: {fmt(prev.totalDamage)}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[11px] text-gray-500">DPS</span>
                <span className="text-sm font-semibold text-yellow-400">{fmt(result.dps)}</span>
                {hasPrev && prev && <DiffArrow before={prev.dps} after={result.dps} />}
            </div>
            {hasPrev && prev && (
                <div className="text-[11px] text-gray-500 mb-1">
                    前: {fmt(prev.dps)}
                </div>
            )}

            {result.inspireAmount && (
                <div className="text-[11px] text-green-400">
                    🎺 鼓舞 +{fmtFull(result.inspireAmount)}
                    {hasPrev && prev?.inspireAmount && prev.inspireAmount !== result.inspireAmount && (
                        <span className="text-gray-500 ml-1">(前: +{fmtFull(prev.inspireAmount)})</span>
                    )}
                </div>
            )}
        </div>
    );
}
