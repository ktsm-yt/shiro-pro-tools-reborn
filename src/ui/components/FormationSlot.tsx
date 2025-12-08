import type React from 'react';
import type { Character } from '../../core/types';
import { getAttributeMeta, getWeaponMeta } from '../constants/meta';

interface FormationSlotProps {
  index: number;
  character: Character | null;
  onRemove: (index: number) => void;
  onOpenDetail: (character: Character, index: number) => void;
}

export function FormationSlot({ index, character, onRemove, onOpenDetail }: FormationSlotProps) {
  const attr = character ? getAttributeMeta(character).meta : null;
  const weapon = character ? getWeaponMeta(character.weapon) : null;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => character && onOpenDetail(character, index)}
      onKeyDown={(e) => e.key === 'Enter' && character && onOpenDetail(character, index)}
      className={`relative group aspect-[4/3] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${character
          ? `${attr?.light ?? 'bg-gray-800/40'} ${attr?.border ?? 'border-gray-700'} hover:scale-[1.02] hover:shadow-lg hover:shadow-black/40 hover:border-white/40`
          : 'border-dashed border-[#27344a] bg-[#131b2b] hover:border-gray-500 hover:bg-[#1a2436]'
        }`}
    >
      {character ? (
        <>
          <button
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 text-gray-200 text-xs opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:text-white flex items-center justify-center z-10"
            aria-label="remove from formation"
          >
            ✕
          </button>
          <div className="text-3xl filter drop-shadow-md mb-1">{weapon?.icon}</div>
          <div className="w-full px-2 text-center">
            <div className="font-bold text-white text-sm truncate drop-shadow-sm">{character.name}</div>
            <div className="text-[10px] text-gray-300 opacity-80">{weapon?.name}</div>
          </div>

          <div
            className={`absolute bottom-2 right-2 text-[9px] px-1.5 py-0.5 rounded-md border ${attr?.border ?? 'border-gray-600'} ${attr?.text ?? 'text-gray-300'} bg-black/40 backdrop-blur-sm`}
          >
            {attr?.label ?? '属性'}
          </div>
        </>
      ) : (
        <>
          <span className="text-2xl text-gray-600 group-hover:text-gray-400 transition-colors">+</span>
          <span className="text-[10px] text-gray-600 group-hover:text-gray-500 transition-colors font-mono">SLOT {index + 1}</span>
        </>
      )}
    </div>
  );
}
