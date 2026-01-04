import { useEffect, useState, useRef, memo } from 'react';
import type { EnvironmentSettings } from '../../core/types';

interface SidebarModalProps {
    isOpen: boolean;
    onClose: () => void;
    env?: EnvironmentSettings;
    onEnvChange?: (env: EnvironmentSettings) => void;
    onEnvReset?: () => void;
}

/**
 * 数値入力フィールド（非制御コンポーネント）
 * モーダル内で使用
 */
const EnvFieldLarge = memo(function EnvFieldLarge({
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
        // IME変換中のEnterは無視（変換確定用のため）
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <div className="flex items-center py-1">
            <span className="text-xs text-gray-300 flex-1 min-w-0">{label}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={text}
                    onFocus={() => { isFocusedRef.current = true; }}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-14 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white text-right focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-gray-500 w-4">{suffix}</span>
            </div>
        </div>
    );
});

export function SidebarModal({
    isOpen,
    onClose,
    env,
    onEnvChange,
    onEnvReset,
}: SidebarModalProps) {
    const [resetKey, setResetKey] = useState(0);

    // ESCキーでモーダルを閉じる
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleEnvCommit = (name: string, value: number) => {
        if (env && onEnvChange) {
            onEnvChange({ ...env, [name]: value });
        }
    };

    const handleReset = () => {
        setResetKey(k => k + 1);
        onEnvReset?.();
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#131b2b] border border-gray-700 rounded-xl w-full max-w-md overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
                    <span className="font-semibold text-white flex items-center gap-2 text-sm">
                        <span className="text-gray-400">⚙</span> 環境設定
                    </span>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                    {env ? (
                        <EnvironmentContent
                            env={env}
                            resetKey={resetKey}
                            onCommit={handleEnvCommit}
                            onReset={handleReset}
                        />
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-600 space-y-2">
                            <span className="text-3xl opacity-50">👆</span>
                            <span className="text-sm">データがありません</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// 環境設定コンテンツ
function EnvironmentContent({
    env,
    resetKey,
    onCommit,
    onReset,
}: {
    env: EnvironmentSettings;
    resetKey: number;
    onCommit: (name: string, value: number) => void;
    onReset: () => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button
                    onClick={onReset}
                    className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                >
                    リセット
                </button>
            </div>

            <div key={resetKey} className="space-y-3">
                {/* 攻撃補正 */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-2 font-medium">攻撃補正</div>
                    <EnvFieldLarge label="攻撃 (%)" name="attackPercent" defaultValue={env.attackPercent} suffix="%" onCommit={onCommit} />
                    <EnvFieldLarge label="与ダメ (%)" name="damageDealt" defaultValue={env.damageDealt} suffix="%" onCommit={onCommit} />
                    <EnvFieldLarge label="被ダメ (%)" name="damageTaken" defaultValue={env.damageTaken} suffix="%" onCommit={onCommit} />
                    <EnvFieldLarge label="倍率 (乗算)" name="damageMultiplier" defaultValue={env.damageMultiplier} suffix="×" onCommit={onCommit} />
                </div>

                {/* 特殊効果 */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-2 font-medium">特殊効果</div>
                    <EnvFieldLarge label="鼓舞 (固定値)" name="inspireFlat" defaultValue={env.inspireFlat} onCommit={onCommit} />
                    <EnvFieldLarge label="効果重複 (%)" name="duplicateBuff" defaultValue={env.duplicateBuff} suffix="%" onCommit={onCommit} />
                </div>

                {/* 速度関連 */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-green-400 mb-2 font-medium">速度関連</div>
                    <EnvFieldLarge label="攻撃速度 (%)" name="attackSpeed" defaultValue={env.attackSpeed} suffix="%" onCommit={onCommit} />
                    <EnvFieldLarge label="隙短縮 (%)" name="gapReduction" defaultValue={env.gapReduction} suffix="%" onCommit={onCommit} />
                </div>

                {/* 敵ステータス */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-orange-400 mb-2 font-medium">敵ステータス</div>
                    <EnvFieldLarge label="防御力" name="enemyDefense" defaultValue={env.enemyDefense} onCommit={onCommit} />
                    <EnvFieldLarge label="防御デバフ (%)" name="defenseDebuffPercent" defaultValue={env.defenseDebuffPercent} suffix="%" onCommit={onCommit} />
                    <EnvFieldLarge label="防御デバフ (固定)" name="defenseDebuffFlat" defaultValue={env.defenseDebuffFlat} onCommit={onCommit} />
                </div>

                {/* 動的バフ */}
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-2 font-medium">動的バフ</div>
                    <EnvFieldLarge label="射程内味方数" name="currentAmbushCount" defaultValue={env.currentAmbushCount ?? 0} suffix="体" onCommit={onCommit} />
                </div>
            </div>
        </div>
    );
}
