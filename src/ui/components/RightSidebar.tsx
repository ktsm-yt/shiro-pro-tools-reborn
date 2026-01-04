import { useState, useEffect, useRef, memo } from 'react';
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

/**
 * 数値入力フィールド（非制御コンポーネント）
 * RightSidebarの外で定義することで、再マウントを防ぐ
 */
const EnvField = memo(function EnvField({
    label,
    name,
    defaultValue,
    suffix = '',
    onCommit,
}: {
    label: string;
    name: string;
    defaultValue: number;
    suffix?: string;
    onCommit: (name: string, value: number) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState(String(defaultValue));
    const isFocusedRef = useRef(false);
    const lastValueRef = useRef(defaultValue);

    // リセット時など、外部から値が変わった場合に反映
    useEffect(() => {
        if (!isFocusedRef.current && Math.abs(lastValueRef.current - defaultValue) > 0.001) {
            setText(String(defaultValue));
            lastValueRef.current = defaultValue;
        }
    }, [defaultValue]);

    const handleBlur = () => {
        isFocusedRef.current = false;
        const num = parseFloat(text);
        if (!isNaN(num)) {
            onCommit(name, num);
            lastValueRef.current = num;
        } else {
            setText(String(lastValueRef.current));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-gray-400">{label}</span>
            <div className="flex items-center gap-1">
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={text}
                    onFocus={() => { isFocusedRef.current = true; }}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white text-right focus:outline-none focus:border-blue-500 transition-colors"
                />
                {suffix && <span className="text-xs text-gray-500 w-4">{suffix}</span>}
            </div>
        </div>
    );
});

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
    const [resetKey, setResetKey] = useState(0);

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

    const handleEnvCommit = (name: string, value: number) => {
        onEnvChange({ ...env, [name]: value });
    };

    const handleReset = () => {
        setResetKey(k => k + 1);
        onEnvReset();
    };

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
                                onClick={handleReset}
                                className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                            >
                                リセット
                            </button>
                        </div>

                        <div key={resetKey} className="space-y-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">攻撃補正</div>
                                <div className="space-y-1">
                                    <EnvField label="攻撃 (%)" name="attackPercent" defaultValue={env.attackPercent} suffix="%" onCommit={handleEnvCommit} />
                                    <EnvField label="与ダメ (%)" name="damageDealt" defaultValue={env.damageDealt} suffix="%" onCommit={handleEnvCommit} />
                                    <EnvField label="被ダメ (%)" name="damageTaken" defaultValue={env.damageTaken} suffix="%" onCommit={handleEnvCommit} />
                                    <EnvField label="倍率 (乗算)" name="damageMultiplier" defaultValue={env.damageMultiplier} suffix="×" onCommit={handleEnvCommit} />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">特殊効果</div>
                                <div className="space-y-1">
                                    <EnvField label="鼓舞 (固定値)" name="inspireFlat" defaultValue={env.inspireFlat} onCommit={handleEnvCommit} />
                                    <EnvField label="効果重複 (%)" name="duplicateBuff" defaultValue={env.duplicateBuff} suffix="%" onCommit={handleEnvCommit} />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">速度関連</div>
                                <div className="space-y-1">
                                    <EnvField label="攻撃速度 (%)" name="attackSpeed" defaultValue={env.attackSpeed} suffix="%" onCommit={handleEnvCommit} />
                                    <EnvField label="隙短縮 (%)" name="gapReduction" defaultValue={env.gapReduction} suffix="%" onCommit={handleEnvCommit} />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">敵ステータス</div>
                                <div className="space-y-1">
                                    <EnvField label="防御力" name="enemyDefense" defaultValue={env.enemyDefense} onCommit={handleEnvCommit} />
                                    <EnvField label="防御デバフ (%)" name="defenseDebuffPercent" defaultValue={env.defenseDebuffPercent} suffix="%" onCommit={handleEnvCommit} />
                                    <EnvField label="防御デバフ (固定)" name="defenseDebuffFlat" defaultValue={env.defenseDebuffFlat} onCommit={handleEnvCommit} />
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-medium">動的バフ</div>
                                <div className="space-y-1">
                                    <EnvField label="射程内味方数" name="currentAmbushCount" defaultValue={env.currentAmbushCount ?? 0} suffix="体" onCommit={handleEnvCommit} />
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
                                    {selectedChar.imageUrl ? (
                                        <img
                                            src={selectedChar.imageUrl}
                                            alt={selectedChar.name}
                                            className="w-16 h-16 object-cover rounded-xl border-2 border-gray-700 mx-auto mb-2"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="text-3xl mb-2">{getWeaponMeta(selectedChar.weapon).icon}</div>
                                    )}
                                    <div className="text-base font-bold text-white mb-1">{selectedChar.name}</div>
                                    <div className="text-xs text-gray-400 bg-gray-800/50 inline-block px-2 py-0.5 rounded-full">
                                        {getWeaponMeta(selectedChar.weapon).name}
                                        {selectedChar.rarity && <span> ・ {selectedChar.rarity}</span>}
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
