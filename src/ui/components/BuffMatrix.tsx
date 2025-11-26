import React, { useState } from 'react';
import type { BuffMatrixResult, Formation, Stat } from '../../core/types';
import { BuffStackBar } from './BuffStackBar';

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

// ステータスごとの目標値（仮）
const STAT_REFERENCES: Record<Stat, number> = {
    attack: 15000,
    defense: 1000,
    range: 800,
    cooldown: 50, // %
    cost: 10,
    damage_dealt: 50, // %
    damage_taken: -50, // %
};

export const BuffMatrix: React.FC<Props> = ({ formation, matrix }) => {
    const [isDetailed, setIsDetailed] = useState(true);
    const stats: Stat[] = ['attack', 'defense', 'range']; // 表示するステータス

    return (
        <div className="overflow-x-auto">
            <div className="flex justify-end mb-2">
                <button
                    onClick={() => setIsDetailed(!isDetailed)}
                    className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-700"
                >
                    {isDetailed ? 'シンプル表示' : '詳細表示'}
                </button>
            </div>
            <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-200 text-left w-20">項目</th>
                        {formation.slots.map((char, i) => (
                            <th key={i} className="p-2 border border-slate-200 w-32 text-center">
                                {char ? (
                                    <div className="text-xs font-bold truncate">{char.name}</div>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {stats.map((stat) => (
                        <tr key={stat}>
                            <td className="p-2 border border-slate-200 font-bold bg-slate-50 text-xs">
                                {STAT_LABELS[stat]}
                            </td>
                            {formation.slots.map((char, i) => {
                                if (!char) return <td key={i} className="p-2 border border-slate-200 bg-slate-50" />;

                                const result = matrix[char.id];
                                const totalVal = result?.stats[stat] || 0;
                                const baseVal = char.baseStats[stat] || 0;

                                // 内訳計算（簡易版：実際はBuffオブジェクトから集計が必要だが、一旦差分をバフとする）
                                // TODO: Coreロジック側で内訳を計算して返すように修正が必要
                                const buffVal = Math.max(0, totalVal - baseVal);
                                const selfBuff = buffVal; // 仮：全て自前として表示（後で修正）
                                const allyBuff = 0;      // 仮

                                return (
                                    <td key={i} className="p-2 border border-slate-200 align-top">
                                        {isDetailed ? (
                                            <BuffStackBar
                                                base={baseVal}
                                                selfBuff={selfBuff}
                                                allyBuff={allyBuff}
                                                reference={STAT_REFERENCES[stat]}
                                            />
                                        ) : (
                                            <div className="text-center">
                                                <span className="font-bold">{totalVal}</span>
                                                {buffVal > 0 && (
                                                    <span className="text-xs text-blue-600 block">+{buffVal}</span>
                                                )}
                                            </div>
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
