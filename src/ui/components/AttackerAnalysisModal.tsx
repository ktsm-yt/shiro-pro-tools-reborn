import React from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { Character, BuffMatrixResult } from '../../core/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    character: Character | null;
    analysisData?: BuffMatrixResult[string]; // 分析結果（仮）
}

export const AttackerAnalysisModal: React.FC<Props> = ({ isOpen, onClose, character }) => {
    if (!isOpen || !character) return null;

    // レーダーチャート用データ（仮）
    // 実際にはCoreロジックから計算された正規化データが必要
    const radarData = [
        { subject: '攻撃性能', A: 120, fullMark: 150 },
        { subject: '防御性能', A: 98, fullMark: 150 },
        { subject: '射程', A: 86, fullMark: 150 },
        { subject: 'コスト効率', A: 99, fullMark: 150 },
        { subject: '支援力', A: 85, fullMark: 150 },
        { subject: '汎用性', A: 65, fullMark: 150 },
    ];

    // ダメージ構成データ（積み上げ棒グラフ用）
    const damageData = [
        {
            name: '通常攻撃',
            base: character.baseStats.attack,
            flatBuff: 50, // 仮
            percentBuff: 120, // 仮
            damageUp: 30, // 仮
        },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>📊</span>
                        {character.name} の性能分析
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* レーダーチャート */}
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-4 text-center">総合性能評価</h3>
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
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-4 text-center">ダメージ構成分析</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={damageData}
                                    layout="vertical"
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="base" name="基礎攻撃力" stackId="a" fill="#94a3b8" />
                                    <Bar dataKey="flatBuff" name="固定バフ" stackId="a" fill="#60a5fa" />
                                    <Bar dataKey="percentBuff" name="割合バフ分" stackId="a" fill="#34d399" />
                                    <Bar dataKey="damageUp" name="与ダメ上昇分" stackId="a" fill="#f472b6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 詳細テキスト情報 */}
                    <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-2">分析サマリー</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            <li>基礎攻撃力 {character.baseStats.attack} に対して、バフ合計で +XXX の強化を受けています。</li>
                            <li>特に <strong>割合バフ</strong> の恩恵が大きく、全体の XX% を占めています。</li>
                            <li>射程は {character.baseStats.range} ですが、バフにより XXX まで拡大しています。</li>
                        </ul>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end">
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
