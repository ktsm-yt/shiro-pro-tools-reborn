import React from 'react';
import type { BuffMatrixResult, Formation, Stat } from '../../core/types';

interface Props {
    formation: Formation;
    matrix: BuffMatrixResult;
}

const STAT_LABELS: Record<Stat, string> = {
    attack: '攻撃',
    defense: '防御',
    range: '射程',
    cooldown: '短縮',
    cost: 'コスト',
    damage_dealt: '与ダメ',
    damage_taken: '被ダメ',
};

export const BuffMatrix: React.FC<Props> = ({ formation, matrix }) => {
    const stats: Stat[] = ['attack', 'defense', 'range']; // 表示するステータス

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-200">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-200 text-left w-24">項目</th>
                        {formation.slots.map((char, i) => (
                            <th key={i} className="p-2 border border-slate-200 w-32 text-center">
                                {char ? char.name : '-'}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {stats.map((stat) => (
                        <tr key={stat}>
                            <td className="p-2 border border-slate-200 font-bold bg-slate-50">
                                {STAT_LABELS[stat]}
                            </td>
                            {formation.slots.map((char, i) => {
                                if (!char) return <td key={i} className="p-2 border border-slate-200 bg-slate-50" />;

                                const val = matrix[char.id]?.stats[stat] || 0;
                                // 簡易的な表示
                                return (
                                    <td key={i} className="p-2 border border-slate-200 text-center">
                                        {val > 0 ? (
                                            <span className="font-bold text-blue-600">+{val}</span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
