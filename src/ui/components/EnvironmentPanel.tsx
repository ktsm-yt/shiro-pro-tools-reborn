import { useState, useEffect, useRef, memo } from 'react';
import type { EnvironmentSettings } from '../../core/types';

interface EnvironmentPanelProps {
    settings: EnvironmentSettings;
    onChange: (settings: EnvironmentSettings) => void;
    onReset: () => void;
}

/**
 * 数値入力フィールド（非制御コンポーネント）
 * - 入力はローカルで管理し、blur時に親に通知
 * - 親からの値変更は初回マウント時とリセット時のみ反映
 */
const NumberInput = memo(function NumberInput({
    id,
    label,
    defaultValue,
    suffix = '',
    onCommit,
}: {
    id: string;
    label: string;
    defaultValue: number;
    suffix?: string;
    onCommit: (value: number) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState<string>(String(defaultValue));
    const isFocusedRef = useRef(false);
    // リセット時に値を更新するためのref
    const resetValueRef = useRef(defaultValue);

    useEffect(() => {
        // 値が大きく変わった場合（リセット時など）は入力を更新
        if (Math.abs(resetValueRef.current - defaultValue) > 0.001) {
            resetValueRef.current = defaultValue;
            if (!isFocusedRef.current) {
                setText(String(defaultValue));
            }
        }
    }, [defaultValue]);

    const commitValue = (raw: string) => {
        // 空欄の場合は0として扱う
        const trimmed = raw.trim();
        const num = trimmed === '' ? 0 : parseFloat(trimmed);
        if (!isNaN(num)) {
            onCommit(num);
            resetValueRef.current = num;
            setText(String(num));
        } else {
            // 無効な値の場合は元に戻す
            setText(String(resetValueRef.current));
        }
    };

    const handleBlur = () => {
        isFocusedRef.current = false;
        commitValue(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <div className="flex items-center gap-3 min-w-[160px]">
            <label htmlFor={id} className="text-sm text-gray-400 w-16 text-left">{label}</label>
            <input
                ref={inputRef}
                id={id}
                type="text"
                inputMode="decimal"
                value={text}
                onFocus={() => { isFocusedRef.current = true; }}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="flex-1 h-11 px-3 bg-[#111a2c] border border-[#27344a] rounded-lg text-base text-white text-right focus:outline-none focus:border-blue-500"
            />
            {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
        </div>
    );
});

/**
 * 環境設定パネル
 * - 各入力フィールドは非制御コンポーネントとして動作
 * - blur時に親に変更を通知
 */
export const EnvironmentPanel = memo(function EnvironmentPanel({
    settings,
    onChange,
    onReset
}: EnvironmentPanelProps) {
    // リセット時にすべての入力を更新するためのキー
    const [resetKey, setResetKey] = useState(0);

    const handleReset = () => {
        setResetKey(k => k + 1);
        onReset();
    };

    const handleCommit = (key: keyof EnvironmentSettings, value: number) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <div className="bg-[#131b2b] border border-[#1f2a3d] rounded-2xl px-4 py-4 shadow-lg shadow-black/25">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                    <span>⚙</span> 環境設定
                </span>
                <button
                    onClick={handleReset}
                    className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors"
                >
                    リセット
                </button>
            </div>
            <div key={resetKey} className="space-y-3">
                <NumberInput id="env-attack" label="攻撃" defaultValue={settings.attackPercent ?? 0} suffix="%" onCommit={(v) => handleCommit('attackPercent', v)} />
                <NumberInput id="env-damage-dealt" label="与ダメ" defaultValue={settings.damageDealt ?? 0} suffix="%" onCommit={(v) => handleCommit('damageDealt', v)} />
                <NumberInput id="env-damage-taken" label="被ダメ" defaultValue={settings.damageTaken ?? 0} suffix="%" onCommit={(v) => handleCommit('damageTaken', v)} />
                <NumberInput id="env-multiplier" label="倍率" defaultValue={settings.damageMultiplier ?? 1} suffix="×" onCommit={(v) => handleCommit('damageMultiplier', v)} />
                <NumberInput id="env-inspire" label="鼓舞" defaultValue={settings.inspireFlat ?? 0} onCommit={(v) => handleCommit('inspireFlat', v)} />
                <NumberInput id="env-duplicate" label="重複" defaultValue={settings.duplicateBuff ?? 0} suffix="%" onCommit={(v) => handleCommit('duplicateBuff', v)} />
                <NumberInput id="env-attack-speed" label="攻速" defaultValue={settings.attackSpeed ?? 0} suffix="%" onCommit={(v) => handleCommit('attackSpeed', v)} />
                <NumberInput id="env-gap" label="隙短" defaultValue={settings.gapReduction ?? 0} suffix="%" onCommit={(v) => handleCommit('gapReduction', v)} />
                <NumberInput id="env-defense" label="敵防御" defaultValue={settings.enemyDefense ?? 0} onCommit={(v) => handleCommit('enemyDefense', v)} />
                <NumberInput id="env-defense-debuff" label="防デバフ" defaultValue={settings.defenseDebuffPercent ?? 0} suffix="%" onCommit={(v) => handleCommit('defenseDebuffPercent', v)} />
                <NumberInput id="env-defense-flat" label="防-固定" defaultValue={settings.defenseDebuffFlat ?? 0} onCommit={(v) => handleCommit('defenseDebuffFlat', v)} />
                <NumberInput id="env-enemy-hp" label="敵HP" defaultValue={settings.enemyHpPercent ?? 0} suffix="%" onCommit={(v) => handleCommit('enemyHpPercent', v)} />
                <NumberInput id="env-ambush" label="味方数" defaultValue={settings.currentAmbushCount ?? 0} suffix="体" onCommit={(v) => handleCommit('currentAmbushCount', v)} />
            </div>
        </div>
    );
});
