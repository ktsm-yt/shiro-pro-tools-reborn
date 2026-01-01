import { useEffect, useMemo, useState } from 'react';
import type { Character, DamageCalculationResult, EnvironmentSettings, DamageBreakdown, Buff, DamageRange } from '../../core/types';
import { calculateDamage, calculateDamageRange } from '../../core/logic/damageCalculator';

interface DamageDetailModalProps {
    character: Character;
    baseEnv: EnvironmentSettings;
    onClose: () => void;
    onUpdateCharacter?: (updated: Character) => void;
}

const fmt = (n: number) => Math.floor(n).toLocaleString();

/** バフからダメージ倍率情報を抽出 */
interface MultiplierInfo {
    value: number;
    condition: string;
    source: 'skill' | 'strategy';
}

/** rawテキストからダメージ倍率を抽出 */
function extractMultipliersFromText(texts: string[], source: 'skill' | 'strategy'): MultiplierInfo[] {
    const results: MultiplierInfo[] = [];
    const patterns = [
        // 「与えるダメージ1.5倍」
        { regex: /与えるダメージ(?:が)?(\d+(?:\.\d+)?)倍/, getCondition: (text: string, match: RegExpExecArray) => {
            // 前後のコンテキストから条件を抽出
            const before = text.slice(0, match.index);
            if (/耐久\d+%以下/.test(before)) return before.match(/耐久(\d+)%以下/)?.[0] || '';
            if (/計略中/.test(before)) return '計略中';
            return '';
        }},
        // 「与ダメ2.5倍」
        { regex: /与ダメ(?:ージ)?(?:が)?(\d+(?:\.\d+)?)倍/, getCondition: () => '' },
        // 「攻撃の2倍のダメージ」
        { regex: /攻撃の?(\d+(?:\.\d+)?)倍の(?:ダメージ|連続攻撃)/, getCondition: () => '攻撃時' },
    ];

    for (const text of texts) {
        for (const { regex, getCondition } of patterns) {
            const match = regex.exec(text);
            if (match) {
                const value = parseFloat(match[1]);
                const condition = getCondition(text, match);
                // 重複チェック
                if (!results.some(r => Math.abs(r.value - value) < 0.01 && r.condition === condition)) {
                    results.push({ value, condition: condition || '常時', source });
                }
            }
        }
        // 「敵の耐久が低い程...最大○倍」
        const hpDepMatch = /敵の耐久が低い程.*?最大(\d+(?:\.\d+)?)倍/.exec(text);
        if (hpDepMatch) {
            results.push({ value: parseFloat(hpDepMatch[1]), condition: '敵HP依存（最大）', source });
        }
    }

    return results;
}

function extractMultipliers(character: Character): MultiplierInfo[] {
    const multipliers: MultiplierInfo[] = [];

    // バフから抽出
    const processBuffs = (buffs: Buff[], source: 'skill' | 'strategy') => {
        for (const buff of buffs) {
            if (buff.stat === 'damage_dealt' || buff.stat === 'give_damage') {
                const condition = buff.conditionTags?.length
                    ? formatConditionTags(buff.conditionTags)
                    : buff.note || '常時';

                const value = buff.mode === 'percent_max'
                    ? 1 + buff.value / 100
                    : buff.value;

                multipliers.push({ value, condition, source });
            }
        }
    };

    processBuffs(character.skills || [], 'skill');
    processBuffs(character.strategies || [], 'strategy');

    // rawテキストからも抽出（バフで拾えなかった倍率用）
    // 同じ値の倍率が既にパース済みバフから抽出されている場合はスキップ
    if (character.rawSkillTexts?.length) {
        const fromText = extractMultipliersFromText(character.rawSkillTexts, 'skill');
        for (const m of fromText) {
            // 同じ値・同じソースの倍率が既にあればスキップ
            if (!multipliers.some(existing =>
                Math.abs(existing.value - m.value) < 0.01 && existing.source === m.source
            )) {
                multipliers.push(m);
            }
        }
    }
    if (character.rawStrategyTexts?.length) {
        const fromText = extractMultipliersFromText(character.rawStrategyTexts, 'strategy');
        for (const m of fromText) {
            // 同じ値・同じソースの倍率が既にあればスキップ
            if (!multipliers.some(existing =>
                Math.abs(existing.value - m.value) < 0.01 && existing.source === m.source
            )) {
                multipliers.push(m);
            }
        }
    }

    return multipliers;
}

function formatConditionTags(tags: string[]): string {
    const tagLabels: Record<string, string> = {
        'hp_below_50': '敵HP50%以下',
        'hp_below_30': '敵HP30%以下',
        'hp_above_50': 'HP50%以上',
        'hp_above_70': 'HP70%以上',
        'strategy_active': '計略発動中',
        'giant_5': '巨大化5段階',
        'giant_4_plus': '巨大化4段階以上',
        'flying_enemy': '飛行敵',
        'boss_enemy': 'ボス敵',
        'kenran': '［絢爛］対象',
        'melee': '近接',
        'ranged': '遠隔',
    };

    return tags.map(t => tagLabels[t] || t).join('・');
}

function PhaseDetail({
    breakdown,
    onCycleNChange,
}: {
    breakdown: DamageBreakdown;
    onCycleNChange?: (value: number) => void;
}) {
    return (
        <div className="bg-gray-800/30 text-xs space-y-3 p-4 rounded-xl border border-gray-700">
            {/* Phase 1 */}
            <div>
                <div className="text-blue-400 font-medium mb-1">Phase 1: 攻撃力確定</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                    <span>基礎攻撃</span><span className="text-right">{fmt(breakdown.phase1.baseAttack)}</span>
                    <span>割合バフ</span><span className="text-right">+{breakdown.phase1.percentBuffApplied.toFixed(1)}%</span>
                    <span>固定値バフ</span><span className="text-right">+{fmt(breakdown.phase1.flatBuffApplied)}</span>
                    {breakdown.phase1.flatBuffDetails && breakdown.phase1.flatBuffDetails.length > 0 && (
                        <div className="col-span-2 pl-4 text-xs text-gray-400">
                            {breakdown.phase1.flatBuffDetails.map((d, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>└ {d.condition}</span>
                                    <span>+{d.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <span>加算バフ</span><span className="text-right">+{fmt(breakdown.phase1.additiveBuffApplied)}</span>
                    <span>効果重複</span><span className="text-right">+{breakdown.phase1.duplicateBuffApplied.toFixed(1)}%</span>
                    <span className="font-bold text-white">最終攻撃</span><span className="text-right font-bold text-white">{fmt(breakdown.phase1.finalAttack)}</span>
                </div>
            </div>

            {/* Phase 2 */}
            <div>
                <div className="text-purple-400 font-medium mb-1">Phase 2: ダメージ倍率</div>
                <div className="text-gray-300">
                    {breakdown.phase2.multipliers.length > 0 ? (
                        breakdown.phase2.multipliers.map((m, i) => (
                            <div key={i} className="flex justify-between">
                                <span>{m.type}</span>
                                <span>×{m.value.toFixed(2)}</span>
                            </div>
                        ))
                    ) : (
                        <span className="text-gray-500">なし</span>
                    )}
                    <div className="flex justify-between font-bold text-white mt-1">
                        <span>結果</span>
                        <span>{fmt(breakdown.phase2.damage)}</span>
                    </div>
                </div>
            </div>

            {/* Phase 3 */}
            <div>
                <div className="text-orange-400 font-medium mb-1">Phase 3: 防御減算</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                    <span>敵防御</span><span className="text-right">{fmt(breakdown.phase3.enemyDefense)}</span>
                    <span>有効防御</span><span className="text-right">{fmt(breakdown.phase3.effectiveDefense)}</span>
                    <span className="font-bold text-white">結果</span><span className="text-right font-bold text-white">{fmt(breakdown.phase3.damage)}</span>
                </div>
            </div>

            {/* Phase 4 */}
            <div>
                <div className="text-green-400 font-medium mb-1">Phase 4: 与ダメ・被ダメ</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                    <span>与ダメ</span><span className="text-right">+{breakdown.phase4.damageDealt.toFixed(1)}%</span>
                    <span>被ダメ</span><span className="text-right">+{breakdown.phase4.damageTaken.toFixed(1)}%</span>
                    <span className="font-bold text-white">結果</span><span className="text-right font-bold text-white">{fmt(breakdown.phase4.damage)}</span>
                </div>
            </div>

            {/* Phase 5 (連撃) */}
            {breakdown.phase5 && (
                <div>
                    <div className="text-red-400 font-medium mb-1">Phase 5: 連撃</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                        <span>連撃数</span><span className="text-right">×{breakdown.phase5.attackCount}</span>
                        <span className="font-bold text-white">合計ダメージ</span><span className="text-right font-bold text-white">{fmt(breakdown.phase5.totalDamage)}</span>
                    </div>
                </div>
            )}

            {/* DPS */}
            <div>
                <div className="text-yellow-400 font-medium mb-1">DPS計算</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                    <span>攻撃フレーム</span><span className="text-right">{breakdown.dps.attackFrames.toFixed(1)}F</span>
                    <span>隙フレーム</span><span className="text-right">{breakdown.dps.gapFrames.toFixed(1)}F</span>
                    <span>合計</span><span className="text-right">{breakdown.dps.totalFrames.toFixed(1)}F</span>
                    <span>攻撃/秒</span><span className="text-right">{breakdown.dps.attacksPerSecond.toFixed(2)}</span>
                    <span className="font-bold text-white">DPS</span><span className="text-right font-bold text-yellow-400">{fmt(breakdown.dps.dps)}</span>
                </div>
            </div>

            {/* 特殊攻撃 */}
            {breakdown.specialAttack && (
                <div>
                    <div className="text-cyan-400 font-medium mb-1">特殊攻撃</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                        <span>倍率</span><span className="text-right">×{breakdown.specialAttack.multiplier}</span>
                        <span>防御無視</span><span className="text-right">{breakdown.specialAttack.defenseIgnore ? '✓' : '−'}</span>
                        <span>発動周期</span>
                        <span className="text-right flex items-center justify-end gap-1">
                            {onCycleNChange ? (
                                <>
                                    <button
                                        onClick={() => onCycleNChange(breakdown.specialAttack!.cycleN - 1)}
                                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                                        disabled={breakdown.specialAttack.cycleN <= 1}
                                    >−</button>
                                    <span className="w-4 text-center">{breakdown.specialAttack.cycleN}</span>
                                    <button
                                        onClick={() => onCycleNChange(breakdown.specialAttack!.cycleN + 1)}
                                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                                        disabled={breakdown.specialAttack.cycleN >= 10}
                                    >+</button>
                                    <span className="text-gray-500 ml-1">回に1回</span>
                                </>
                            ) : (
                                <>{breakdown.specialAttack.cycleN}回に1回</>
                            )}
                        </span>
                        <span className="font-bold text-white">瞬間ダメージ</span>
                        <span className="text-right font-bold text-cyan-400">{fmt(breakdown.specialAttack.damage)}</span>
                        <span className="font-bold text-white">サイクルDPS</span>
                        <span className="text-right font-bold text-cyan-400">{fmt(breakdown.specialAttack.cycleDps)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function DamageDetailModal({ character, baseEnv, onClose, onUpdateCharacter }: DamageDetailModalProps) {
    // cycleN のローカル編集状態
    const [localCycleN, setLocalCycleN] = useState<number | undefined>(character.specialAttack?.cycleN);

    // ESCキーでモーダルを閉じる
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // cycleN をオーバーライドしたキャラクターを生成
    const effectiveCharacter = useMemo(() => {
        if (!character.specialAttack || localCycleN === undefined) return character;
        return {
            ...character,
            specialAttack: {
                ...character.specialAttack,
                cycleN: localCycleN,
            },
        };
    }, [character, localCycleN]);

    // 計算結果
    const result: DamageCalculationResult = useMemo(() => {
        return calculateDamage(effectiveCharacter, baseEnv);
    }, [effectiveCharacter, baseEnv]);

    // ダメージレンジ計算
    const damageRange: DamageRange = useMemo(() => {
        return calculateDamageRange(effectiveCharacter, baseEnv);
    }, [effectiveCharacter, baseEnv]);

    // ダメージ倍率と条件を抽出
    const multipliers = useMemo(() => extractMultipliers(character), [character]);

    // cycleN 変更ハンドラ
    const handleCycleNChange = (newValue: number) => {
        const clampedValue = Math.max(1, Math.min(10, newValue));
        setLocalCycleN(clampedValue);
        // 永続化
        if (onUpdateCharacter && character.specialAttack) {
            onUpdateCharacter({
                ...character,
                specialAttack: {
                    ...character.specialAttack,
                    cycleN: clampedValue,
                },
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#131b2b] border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        {character.imageUrl && (
                            <img
                                src={character.imageUrl}
                                alt={character.name}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-600"
                            />
                        )}
                        <div>
                            <div className="text-white font-bold">{character.name}</div>
                            <div className="text-xs text-gray-400">{character.weapon}</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* ダメージ倍率一覧 */}
                    {multipliers.length > 0 && (
                        <div>
                            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                                ダメージ倍率
                            </div>
                            <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700 space-y-2">
                                {multipliers.map((m, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                        <span className={`font-mono font-bold ${m.source === 'strategy' ? 'text-purple-400' : 'text-blue-400'}`}>
                                            ×{m.value.toFixed(2)}
                                        </span>
                                        <span className="text-gray-300">{m.condition}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${m.source === 'strategy' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                                            {m.source === 'strategy' ? '計略' : '特技'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 結果サマリー */}
                    <div className="bg-gradient-to-r from-gray-800/60 to-gray-800/40 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-400 mb-1">ダメージ</div>
                                <div className="text-2xl font-bold text-white">{fmt(result.totalDamage)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-400 mb-1">DPS</div>
                                <div className="text-2xl font-bold text-yellow-400">{fmt(result.dps)}</div>
                            </div>
                        </div>
                        {/* 特殊攻撃サマリー */}
                        {result.specialAttackDamage && result.cycleDps && (
                            <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">特殊攻撃</div>
                                    <div className="text-xl font-bold text-cyan-400">{fmt(result.specialAttackDamage)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 mb-1">サイクルDPS</div>
                                    <div className="text-xl font-bold text-cyan-400">{fmt(result.cycleDps)}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ダメージ変動（シナリオ別DPS） */}
                    {damageRange.scenarios.length > 0 && (
                        <div>
                            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                                ダメージ変動（シナリオ別）
                            </div>
                            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700 space-y-3">
                                {/* ベースDPS */}
                                <div className="flex items-center gap-3">
                                    <div className="w-24 text-xs text-gray-400">基本</div>
                                    <div className="flex-1 h-5 bg-gray-700/50 rounded overflow-hidden">
                                        <div
                                            className="h-full bg-gray-500 rounded"
                                            style={{ width: `${(damageRange.base.dps / damageRange.max.dps) * 100}%` }}
                                        />
                                    </div>
                                    <div className="w-20 text-right text-sm font-mono text-gray-300">
                                        {fmt(damageRange.base.dps)}
                                    </div>
                                </div>
                                {/* 各シナリオ */}
                                {damageRange.scenarios.map((s, i) => {
                                    const ratio = (s.result.dps / damageRange.max.dps) * 100;
                                    const isMax = s.result.dps === damageRange.max.dps;
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-24 text-xs text-gray-400">{s.label}</div>
                                            <div className="flex-1 h-5 bg-gray-700/50 rounded overflow-hidden">
                                                <div
                                                    className={`h-full rounded ${isMax ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${ratio}%` }}
                                                />
                                            </div>
                                            <div className={`w-20 text-right text-sm font-mono ${isMax ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                                                {fmt(s.result.dps)}
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* 変動幅表示 */}
                                <div className="pt-2 border-t border-gray-700/50 text-xs text-gray-500 flex justify-between">
                                    <span>変動幅</span>
                                    <span>
                                        {fmt(damageRange.base.dps)} ～ {fmt(damageRange.max.dps)}
                                        <span className="ml-2 text-green-400">
                                            (+{((damageRange.max.dps / damageRange.base.dps - 1) * 100).toFixed(0)}%)
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 鼓舞量 */}
                    {result.inspireAmount && (
                        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700">
                            <div className="text-xs text-gray-400 mb-1">鼓舞量</div>
                            <div className="text-xl font-bold text-pink-400">
                                +{fmt(result.inspireAmount)}
                            </div>
                        </div>
                    )}

                    {/* Phase詳細（デフォルトで開く） */}
                    <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">
                            Phase詳細
                        </div>
                        <PhaseDetail breakdown={result.breakdown} onCycleNChange={character.specialAttack ? handleCycleNChange : undefined} />
                    </div>
                </div>
            </div>
        </div>
    );
}
