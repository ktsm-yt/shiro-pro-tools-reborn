import { useState, useEffect } from 'react';
import type { Character, EnvironmentSettings } from '../../core/types';
import { getWeaponMeta } from '../constants/meta';

interface RightSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    selectedChar: Character | null;
    env: EnvironmentSettings;
    onEnvChange: (env: EnvironmentSettings) => void;
    onEnvReset: () => void;
    activeTab: 'matrix' | 'analysis';
}

type PanelMode = 'env' | 'detail';

export function RightSidebar({
    collapsed,
    onToggle,
    selectedChar,
    env,
    onEnvChange,
    onEnvReset,
    activeTab,
}: RightSidebarProps) {
    const [panel, setPanel] = useState<PanelMode>('env');

    // activeTab切り替え時に自動でパネルを切り替える
    // Matrix: 詳細 (選択したキャラなどを見たい)
    // Analysis: 環境 (倍率などをいじりたい)
    useEffect(() => {
        if (activeTab === 'matrix') {
            setPanel('detail');
        } else if (activeTab === 'analysis') {
            setPanel('env');
        }
    }, [activeTab]);

    // analysisタブ以外では詳細パネルを強制的に表示するなどの制御が必要ならここで行う
    // 今回はユーザーが切り替えられるようにしておく

    const Field = ({
        label,
        name,
        value,
        suffix = '',
    }: {
        label: string;
        name: keyof EnvironmentSettings;
        value: number;
        suffix?: string;
    }) => (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-gray-400">{label}</span>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onEnvChange({ ...env, [name]: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white text-right focus:outline-none focus:border-blue-500 transition-colors"
                />
                {suffix && <span className="text-xs text-gray-500 w-4">{suffix}</span>}
            </div>
        </div>
    );

    if (collapsed) {
        return (
            <aside className="w-12 bg-[#0f1626] border-l border-gray-800 flex flex-col items-center py-4 transition-all duration-200">
                <button
                    onClick={onToggle}
                    className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs flex items-center justify-center transition-colors"
                >
                    ◀
                </button>
            </aside>
        );
    }

    return (
        <aside className="w-64 bg-[#0f1626] border-l border-gray-800 flex flex-col flex-shrink-0 transition-all duration-200">
            {/* ヘッダー */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-end bg-[#0f1626]">
                <button
                    onClick={onToggle}
                    className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs flex items-center justify-center transition-colors"
                >
                    ▶
                </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {panel === 'env' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                <span>⚙</span> 環境設定
                            </span>
                            <button
                                onClick={onEnvReset}
                                className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                            >
                                リセット
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">攻撃補正</div>
                                <div className="space-y-1">
                                    <Field label="攻撃 (%)" name="attackPercent" value={env.attackPercent} suffix="%" />
                                    <Field label="与ダメ (%)" name="damageDealt" value={env.damageDealt} suffix="%" />
                                    <Field label="被ダメ (%)" name="damageTaken" value={env.damageTaken} suffix="%" />
                                    <Field label="倍率 (乗算)" name="damageMultiplier" value={env.damageMultiplier} suffix="×" />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">特殊効果</div>
                                <div className="space-y-1">
                                    <Field label="鼓舞 (固定値)" name="inspireFlat" value={env.inspireFlat} />
                                    <Field label="効果重複 (%)" name="duplicateBuff" value={env.duplicateBuff} suffix="%" />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">速度関連</div>
                                <div className="space-y-1">
                                    <Field label="攻撃速度 (%)" name="attackSpeed" value={env.attackSpeed} suffix="%" />
                                    <Field label="隙短縮 (%)" name="gapReduction" value={env.gapReduction} suffix="%" />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">敵ステータス</div>
                                <div className="space-y-1">
                                    <Field label="防御力" name="enemyDefense" value={env.enemyDefense} />
                                    <Field label="防御デバフ (%)" name="defenseDebuffPercent" value={env.defenseDebuffPercent} suffix="%" />
                                    <Field label="防御デバフ (固定)" name="defenseDebuffFlat" value={env.defenseDebuffFlat} />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        {selectedChar ? (
                            <div className="space-y-5">
                                {/* キャラヘッダー */}
                                <div className="text-center pb-4 border-b border-gray-800">
                                    <div className="text-3xl mb-2">{getWeaponMeta(selectedChar.weapon).icon}</div>
                                    <div className="text-base font-bold text-white mb-1">{selectedChar.name}</div>
                                    <div className="text-xs text-gray-400 bg-gray-800/50 inline-block px-2 py-0.5 rounded-full">
                                        {getWeaponMeta(selectedChar.weapon).name} ・ ☆{selectedChar.rarity}
                                    </div>
                                </div>

                                {/* 基礎ステータス */}
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">基礎ステータス</div>
                                    <div className="bg-gray-800/40 rounded-xl p-3 grid grid-cols-2 gap-y-3 gap-x-2 border border-gray-800">
                                        <div>
                                            <span className="text-[10px] text-gray-500 block">攻撃</span>
                                            <span className="text-sm font-medium text-white">{selectedChar.baseStats.attack}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 block">防御</span>
                                            <span className="text-sm font-medium text-white">{selectedChar.baseStats.defense}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 block">射程</span>
                                            <span className="text-sm font-medium text-white">{selectedChar.baseStats.range}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 block">HP</span>
                                            <span className="text-sm font-medium text-white">{selectedChar.baseStats.hp ?? '---'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 特技・計略 */}
                                <div className="space-y-3">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">能力</div>

                                    {selectedChar.skills?.map((skill, i) => (
                                        <div key={`skill-${i}`} className="bg-gray-800/40 rounded-xl p-3 border border-gray-800">
                                            <div className="text-xs font-bold text-blue-300 mb-1 flex items-center gap-1">
                                                <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                                {skill.name}
                                            </div>
                                            <div className="text-[11px] text-gray-300 leading-relaxed opacity-90">{skill.description}</div>
                                        </div>
                                    ))}

                                    {selectedChar.strategies?.map((strat, i) => (
                                        <div key={`strat-${i}`} className="bg-gray-800/40 rounded-xl p-3 border border-gray-800">
                                            <div className="text-xs font-bold text-purple-300 mb-1 flex items-center gap-1">
                                                <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                                                {strat.name}
                                            </div>
                                            <div className="text-[11px] text-gray-300 leading-relaxed opacity-90">{strat.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-gray-600 space-y-2">
                                <span className="text-2xl opacity-50">👆</span>
                                <span className="text-xs">キャラを選択すると<br />詳細が表示されます</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
