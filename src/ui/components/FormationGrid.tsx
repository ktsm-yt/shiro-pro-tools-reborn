import React from 'react';
import type { Formation, Character } from '../../core/types';

interface Props {
    formation: Formation;
    onCharacterClick?: (char: Character) => void;
}

export const FormationGrid: React.FC<Props> = ({ formation, onCharacterClick }) => {
    const displayName = (char: Character) => char.period ? `［${char.period}］${char.name}` : char.name;

    return (
        <div className="grid grid-cols-8 gap-2">
            {formation.slots.map((char, i) => (
                <div
                    key={i}
                    className="relative bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 h-16 flex items-center justify-center overflow-hidden hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer group"
                    onClick={() => char && onCharacterClick?.(char)}
                >
                    {char ? (
                        <>
                            <div className="font-bold text-xs truncate w-full text-center">{displayName(char)}</div>
                            <div className="text-[10px] text-slate-500 truncate w-full text-center">
                                {char.weapon}
                            </div>
                        </>
                    ) : (
                        <span className="text-slate-300 text-xs">Empty</span>
                    )}
                </div>
            ))}
        </div>
    );
};
