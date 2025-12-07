import React, { useState, useMemo } from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { Character } from '../../core/types';
import { calculateDamage } from '../../core/logic/damageCalculator';
import type { EnvironmentSettings } from '../../core/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    character: Character | null;
}

export const AttackerAnalysisModal: React.FC<Props> = ({ isOpen, onClose, character }) => {
    const [environment, setEnvironment] = useState<EnvironmentSettings>({
        inspireFlat: 0,
        duplicateBuff: 0,
        attackSpeed: 0,
        gapReduction: 0,
        enemyDefense: 0,
        defenseDebuffPercent: 0,
        defenseDebuffFlat: 0,
        damageTaken: 0,
        enemyHpPercent: 100,
    });

    const calculationResult = useMemo(() => {
        if (!character) return null;
        return calculateDamage(character, environment);
    }, [character, environment]);

    if (!isOpen || !character || !calculationResult) return null;

    // レーダーチャート用データ（仮：まだ正規化ロジックがないため固定値のまま）
    const radarData = [
        { subject: '攻撃性能', A: Math.min(150, calculationResult.phase1Attack / 10), fullMark: 150 },
        { subject: '防御性能', A: 98, fullMark: 150 },
        { subject: '射程', A: Math.min(150, (character.baseStats.range ?? 0) / 3), fullMark: 150 },
        { subject: 'コスト効率', A: 99, fullMark: 150 },
        { subject: '支援力', A: 85, fullMark: 150 },
        { subject: '汎用性', A: 65, fullMark: 150 },
    ];

    // ダメージ構成データ（積み上げ棒グラフ用）
    const breakdown = calculationResult.breakdown;
    const phase1 = breakdown.phase1;
    // 割合バフの影響量を概算（基礎値 * 割合）
    const percentBuffValue = (phase1.baseAttack + phase1.flatBuffApplied) * (phase1.percentBuffApplied / 100);

    const damageData = [
        {
            name: '攻撃力構成',
            base: phase1.baseAttack,
            flatBuff: phase1.flatBuffApplied,
            percentBuff: percentBuffValue,
            multiplier: 0, // 乗算枠は別途表現するか、ここに含めるか検討
        },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center p-4 border-b shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>📊</span>
                        {character.name} の性能分析
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-y-auto">
                    {/* 左カラム：入力フォームと基本ステータス */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-sm font-bold mb-3 text-slate-700">計算条件</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">敵防御力</label>
                                    <input
                                        type="number"
                                        value={environment.enemyDefense}
                                        onChange={(e) => setEnvironment({ ...environment, enemyDefense: Number(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">防御デバフ (%)</label>
                                    <input
                                        type="number"
                                        value={environment.defenseDebuffPercent}
                                        onChange={(e) => setEnvironment({ ...environment, defenseDebuffPercent: Number(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">防御デバフ (固定)</label>
                                    <input
                                        type="number"
                                        value={environment.defenseDebuffFlat}
                                        onChange={(e) => setEnvironment({ ...environment, defenseDebuffFlat: Number(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="font-bold text-lg mb-4 border-b border-slate-600 pb-2 relative z-10">
                                計算結果
                            </div>
                            <ul className="space-y-3 text-sm relative z-10">
                                <li className="flex justify-between items-center border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">最終攻撃力</span>
                                    <strong className="text-xl text-yellow-400 font-mono">{Math.round(calculationResult.phase1Attack)}</strong>
                                </li>
                                <li className="flex justify-between items-center border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">1ヒットダメージ</span>
                                    <strong className="text-lg text-white font-mono">{Math.round(calculationResult.phase4Damage)}</strong>
                                </li>
                                <li className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                                    <span className="text-slate-300 font-bold">合計ダメージ</span>
                                    <strong className="text-2xl text-yellow-400 font-mono">{Math.round(calculationResult.totalDamage)}</strong>
                                </li>
                                <li className="flex justify-between items-center pt-1">
                                    <span className="text-slate-400 text-xs">敵の有効防御</span>
                                    <strong className="text-slate-300 font-mono text-xs">{Math.round(breakdown.phase3.effectiveDefense)}</strong>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 中央・右カラム：グラフ */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* レーダーチャート */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold mb-4 text-center text-slate-700">総合性能評価（仮）</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis />
                                            <Radar
                                                name={character.name}
                                                dataKey="A"
                                                stroke="#8884d8"
                                                fill="#8884d8"
                                                fillOpacity={0.6}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ダメージ構成グラフ */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold mb-4 text-center text-slate-700">攻撃力構成</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={damageData}
                                            layout="vertical"
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="name" type="category" width={80} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="base" name="基礎値" stackId="a" fill="#94a3b8" />
                                            <Bar dataKey="flatBuff" name="固定バフ" stackId="a" fill="#60a5fa" />
                                            <Bar dataKey="percentBuff" name="割合バフ分" stackId="a" fill="#34d399" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* 詳細テキスト情報 */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-sm font-bold mb-2 text-slate-700">分析サマリー</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                <li>基礎攻撃力 <strong>{phase1.baseAttack}</strong> に対して、バフ合計で <strong>+{Math.round(phase1.finalAttack - phase1.baseAttack)}</strong> の強化を受けています。</li>
                                <li>攻撃割合バフ合計: <strong>{phase1.percentBuffApplied}%</strong></li>
                                <li>攻撃固定バフ合計: <strong>{phase1.flatBuffApplied}</strong></li>
                                {breakdown.phase3.effectiveDefense < environment.enemyDefense && (
                                    <li>敵の防御力を <strong>{environment.enemyDefense - breakdown.phase3.effectiveDefense}</strong> 低下させています。</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};
