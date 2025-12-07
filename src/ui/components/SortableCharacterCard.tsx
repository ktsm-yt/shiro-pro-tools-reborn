/**
 * ソート可能なキャラクターカード
 * 
 * dnd-kitを使用したドラッグ&ドロップ対応のラッパーコンポーネント
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CompactCharacterCard } from './CompactCharacterCard';
import type { Character, DamageCalculationResult, DamageComparison } from '../../core/types';

interface SortableCharacterCardProps {
    character: Character;
    result: DamageCalculationResult;
    comparison?: DamageComparison;
    onShowDetails: () => void;
    onRemove: () => void;
}

export function SortableCharacterCard({
    character,
    result,
    comparison,
    onShowDetails,
    onRemove,
}: SortableCharacterCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: character.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const, // ドラッグ時の配置ずれ防止
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <CompactCharacterCard
                character={character}
                result={result}
                comparison={comparison}
                onShowDetails={onShowDetails}
                onRemove={onRemove}
            />
        </div>
    );
}
