import type { Formation } from '../../core/types';
import { getAttributeMeta, isRangedWeapon } from '../constants/meta';

interface FormationSummaryProps {
  formation: Formation;
}

export function FormationSummary({ formation }: FormationSummaryProps) {
  const active = formation.slots.filter((c): c is NonNullable<typeof c> => Boolean(c));

  const melee = active.filter((c) => !isRangedWeapon(c.weapon)).length;
  const ranged = active.filter((c) => isRangedWeapon(c.weapon)).length;

  const attrCounts = active.reduce<Record<string, number>>((acc, char) => {
    const { meta } = getAttributeMeta(char);
    acc[meta.label] = (acc[meta.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">近</span>
        <span className="font-mono text-white bg-gray-800 px-1.5 py-0.5 rounded">{melee}</span>
        <span className="text-gray-400">遠</span>
        <span className="font-mono text-white bg-gray-800 px-1.5 py-0.5 rounded">{ranged}</span>
      </div>
      <span className="w-px h-4 bg-gray-700" />
      {Object.entries(attrCounts).map(([label, count]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="text-gray-400">{label}</span>
          <span className="font-mono text-white bg-gray-800 px-1.5 py-0.5 rounded">{count}</span>
        </span>
      ))}
      <span className="w-px h-4 bg-gray-700" />
      <span className="text-gray-400">
        <span className="text-white font-mono">{active.length}</span>/8
      </span>
    </div>
  );
}
