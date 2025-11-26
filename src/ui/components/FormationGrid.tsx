import React from 'react';
import type { Formation } from '../../core/types';

interface Props {
    formation: Formation;
}

export const FormationGrid: React.FC<Props> = ({ formation }) => {
    return (
        <div className="grid grid-cols-4 gap-4 mb-8">
            {formation.slots.map((char, index) => (
                <div
                    key={index}
                    className={`
            h-24 border-2 rounded-lg flex flex-col items-center justify-center
            ${char ? 'border-slate-400 bg-white' : 'border-slate-200 bg-slate-50 border-dashed'}
          `}
                >
                    {char ? (
                        <>
                            <div className="font-bold text-lg">{char.name}</div>
                            <div className="text-xs text-slate-500">
                                {char.weapon} / {char.attributes.join(', ')}
                            </div>
                        </>
                    ) : (
                        <span className="text-slate-300">Empty</span>
                    )}
                </div>
            ))}
        </div>
    );
};
