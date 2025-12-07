/**
 * 詳細パネル
 * 
 * ダメージ計算の各フェーズの詳細を表示するモーダル
 */

import type { DamageCalculationResult } from '../../core/types';

interface DetailPanelProps {
    result: DamageCalculationResult;
    characterName: string;
    onClose: () => void;
}

export function DetailPanel({ result, characterName, onClose }: DetailPanelProps) {
    const { breakdown } = result;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
                {/* ヘッダー */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                        {characterName} - ダメージ詳細
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 space-y-6">
                    {/* Phase 1: 攻撃力の確定 */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            Phase 1: 攻撃力の確定
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">基礎攻撃:</span>
                                <span className="font-medium">{breakdown.phase1.baseAttack.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">+ 割合バフ:</span>
                                <span className="font-medium">{breakdown.phase1.percentBuffApplied.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">+ 固定値バフ:</span>
                                <span className="font-medium">+{breakdown.phase1.flatBuffApplied.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">+ 加算バフ:</span>
                                <span className="font-medium">+{breakdown.phase1.additiveBuffApplied.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">× 効果重複:</span>
                                <span className="font-medium">{(1 + breakdown.phase1.duplicateBuffApplied / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                <span className="font-semibold text-gray-800">= 最終攻撃力:</span>
                                <span className="font-bold text-blue-600">{breakdown.phase1.finalAttack.toFixed(0)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Phase 2: ダメージ倍率 */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            Phase 2: ダメージ倍率の適用
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            {breakdown.phase2.multipliers.length > 0 ? (
                                <>
                                    {breakdown.phase2.multipliers.map((mult, index) => (
                                        <div key={index} className="flex justify-between">
                                            <span className="text-gray-600">× {mult.type}:</span>
                                            <span className="font-medium">{mult.value.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                        <span className="font-semibold text-gray-800">= ダメージ:</span>
                                        <span className="font-bold text-blue-600">{breakdown.phase2.damage.toFixed(0)}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-gray-500">倍率なし</div>
                            )}
                        </div>
                    </section>

                    {/* Phase 3: 防御力減算 */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            Phase 3: 防御力による減算
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">敵防御力:</span>
                                <span className="font-medium">{breakdown.phase3.enemyDefense.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">有効防御力:</span>
                                <span className="font-medium">{breakdown.phase3.effectiveDefense.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                <span className="font-semibold text-gray-800">= ダメージ:</span>
                                <span className="font-bold text-blue-600">{breakdown.phase3.damage.toFixed(0)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Phase 4: 与ダメ・被ダメ */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            Phase 4: 与ダメ・被ダメによる増減
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">× 与ダメ:</span>
                                <span className="font-medium">{(1 + breakdown.phase4.damageDealt / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">× 被ダメ:</span>
                                <span className="font-medium">{(1 + breakdown.phase4.damageTaken / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                <span className="font-semibold text-gray-800">= ダメージ:</span>
                                <span className="font-bold text-blue-600">{breakdown.phase4.damage.toFixed(0)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Phase 5: 連撃 */}
                    {breakdown.phase5 && (
                        <section>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                Phase 5: 連撃による乗算
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">× 連撃数:</span>
                                    <span className="font-medium">{breakdown.phase5.attackCount}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                    <span className="font-semibold text-gray-800">= 合計ダメージ:</span>
                                    <span className="font-bold text-blue-600">{breakdown.phase5.totalDamage.toFixed(0)}</span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* DPS計算 */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            DPS計算
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">攻撃フレーム:</span>
                                <span className="font-medium">{breakdown.dps.attackFrames.toFixed(1)}f</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">隙フレーム:</span>
                                <span className="font-medium">{breakdown.dps.gapFrames.toFixed(1)}f</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">合計フレーム:</span>
                                <span className="font-medium">{breakdown.dps.totalFrames.toFixed(1)}f</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">攻撃/秒:</span>
                                <span className="font-medium">{breakdown.dps.attacksPerSecond.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                                <span className="font-semibold text-gray-800">= DPS:</span>
                                <span className="font-bold text-blue-600">{breakdown.dps.dps.toFixed(0)}</span>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
