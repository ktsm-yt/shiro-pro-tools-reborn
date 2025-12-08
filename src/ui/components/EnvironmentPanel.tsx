import type { EnvironmentSettings } from '../../core/types';

interface EnvironmentPanelProps {
    settings: EnvironmentSettings;
    onChange: (settings: EnvironmentSettings) => void;
    onReset: () => void;
}

export function EnvironmentPanel({ settings, onChange, onReset }: EnvironmentPanelProps) {
    const handleChange = (key: keyof EnvironmentSettings, value: number) => {
        onChange({ ...settings, [key]: value });
    };

    const Field = ({
        label,
        name,
        suffix = '',
    }: {
        label: string;
        name: keyof EnvironmentSettings;
        suffix?: string;
    }) => (
        <div className="flex items-center gap-3 min-w-[160px]">
            <span className="text-sm text-gray-400 w-16 text-left">{label}</span>
            <input
                type="number"
                value={settings[name] ?? 0}
                onChange={(e) => handleChange(name, Number(e.target.value))}
                className="flex-1 h-11 px-3 bg-[#111a2c] border border-[#27344a] rounded-lg text-base text-white text-right focus:outline-none focus:border-blue-500"
            />
            {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
        </div>
    );

    return (
        <div className="bg-[#131b2b] border border-[#1f2a3d] rounded-2xl px-4 py-4 shadow-lg shadow-black/25">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                    <span>⚙</span> 環境設定
                </span>
                <button
                    onClick={onReset}
                    className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors"
                >
                    リセット
                </button>
            </div>
            <div className="space-y-3">
                <Field label="攻撃" name="attackPercent" suffix="%" />
                <Field label="与ダメ" name="damageDealt" suffix="%" />
                <Field label="被ダメ" name="damageTaken" suffix="%" />
                <Field label="倍率" name="damageMultiplier" suffix="×" />
                <Field label="鼓舞" name="inspireFlat" />
                <Field label="重複" name="duplicateBuff" suffix="%" />
                <Field label="攻速" name="attackSpeed" suffix="%" />
                <Field label="隙短" name="gapReduction" suffix="%" />
                <Field label="敵防御" name="enemyDefense" />
                <Field label="防デバフ" name="defenseDebuffPercent" suffix="%" />
                <Field label="防-固定" name="defenseDebuffFlat" />
                <Field label="敵HP" name="enemyHpPercent" suffix="%" />
            </div>
        </div>
    );
}
