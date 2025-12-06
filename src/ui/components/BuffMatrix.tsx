import React, { useState } from 'react';
import type { BuffMatrixResult, Formation, Stat } from '../../core/types';
import { BuffStackBar } from './BuffStackBar';

interface Props {
    formation: Formation;
    matrix: BuffMatrixResult;
}

const STAT_LABELS: Record<Stat, string> = {
    hp: '耐久',
    attack: '攻撃',
    defense: '防御',
    range: '射程',
    recovery: '回復',
    cooldown: '短縮',
    cost: 'コスト',
    damage_dealt: '与ダメ',
    damage_taken: '被ダメ',
    attack_speed: '攻速',
    attack_gap: '隙',
    movement_speed: '移速',
    knockback: '後退',
    target_count: '対象',
    ki_gain: '気増',
    damage_drain: '吸収',
    ignore_defense: '無視',
};

// ステータスごとの目標値（仮）
const STAT_REFERENCES: Record<Stat, number> = {
    hp: 10000,
    attack: 15000,
    defense: 1000,
    range: 800,
    recovery: 500,
    cooldown: 50, // %
    cost: 10,
    damage_dealt: 50, // %
    damage_taken: -50, // %
    attack_speed: 50,
    attack_gap: 50,
    movement_speed: 50,
    knockback: 100,
    target_count: 2,
    ki_gain: 10,
    damage_drain: 10,
    ignore_defense: 100,
};

export const BuffMatrix: React.FC<Props> = ({ formation, matrix }) => {
    const [isDetailed, setIsDetailed] = useState(true);
    const stats: Stat[] = ['hp', 'attack', 'defense', 'range', 'recovery']; // 表示するステータス

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

                                // バフ内訳の取得
                                const breakdown = result.breakdown?.[stat] || {
                                    base: char.baseStats[stat],
                                    selfBuff: 0,
                                    allyBuff: 0
                                };

                                return (
                                    <td key={i} className="p-2 border border-slate-200 align-top">
                                        {isDetailed ? (
                                            <BuffStackBar
                                                base={breakdown.base}
                                                selfBuff={breakdown.selfBuff}
                                                allyBuff={breakdown.allyBuff}
                                                reference={STAT_REFERENCES[stat]}
                                            />
                                        ) : (
                                            <div className="text-center">
                                                <span className="font-bold">{totalVal}</span>
                                                {/* シンプル表示ではバフ値の合計を表示 */}
                                                {(breakdown.selfBuff + breakdown.allyBuff) > 0 && (
                                                    <span className="text-xs text-blue-600 block">
                                                        +{(breakdown.selfBuff + breakdown.allyBuff)}
                                                    </span>
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
