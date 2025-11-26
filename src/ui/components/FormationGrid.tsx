import React from 'react';
import type { Formation } from '../../core/types';

interface Props {
    formation: Formation;
}

export const FormationGrid: React.FC<Props> = ({ formation }) => {
    return (
        <div className="grid grid-cols-8 gap-2 mb-8">
            {formation.slots.map((char, index) => (
                <div
                    key={index}
                    className={`
            h-16 border-2 rounded-lg flex flex-col items-center justify-center px-1
            ${char ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 border-dashed'}
          `}
                >
                    {char ? (
                        <>
                            <div className="font-bold text-xs truncate w-full text-center">{char.name}</div>
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
