/**
 * 環境設定パネル
 * 
 * ダメージ計算の環境パラメータを設定するコンポーネント
 */

import type { EnvironmentSettings } from '../../core/types';

interface EnvironmentPanelProps {
    settings: EnvironmentSettings;
    onChange: (settings: EnvironmentSettings) => void;
    onReset: () => void;
}

export function EnvironmentPanel({ settings, onChange, onReset }: EnvironmentPanelProps) {
    const handleChange = (key: keyof EnvironmentSettings, value: number) => {
        onChange({
            ...settings,
            [key]: value,
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">環境設定</h2>
                <button
                    onClick={onReset}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                    リセット
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 鼓舞 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        鼓舞（固定値）
                    </label>
                    <input
                        type="number"
                        value={settings.inspireFlat}
                        onChange={(e) => handleChange('inspireFlat', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 被ダメ% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        被ダメ (%)
                    </label>
                    <input
                        type="number"
                        value={settings.damageTaken}
                        onChange={(e) => handleChange('damageTaken', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 効果重複% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        効果重複 (%)
                    </label>
                    <input
                        type="number"
                        value={settings.duplicateBuff}
                        onChange={(e) => handleChange('duplicateBuff', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 攻撃速度% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        攻撃速度 (%)
                    </label>
                    <input
                        type="number"
                        value={settings.attackSpeed}
                        onChange={(e) => handleChange('attackSpeed', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 隙短縮% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        隙短縮 (%)
                    </label>
                    <input
                        type="number"
                        value={settings.gapReduction}
                        onChange={(e) => handleChange('gapReduction', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 敵防御力 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        敵防御力
                    </label>
                    <input
                        type="number"
                        value={settings.enemyDefense}
                        onChange={(e) => handleChange('enemyDefense', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 防御デバフ% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        防御デバフ (%)
                    </label>
                    <input
                        type="number"
                        value={settings.defenseDebuffPercent}
                        onChange={(e) => handleChange('defenseDebuffPercent', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 防御デバフ固定値 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        防御デバフ（固定値）
                    </label>
                    <input
                        type="number"
                        value={settings.defenseDebuffFlat}
                        onChange={(e) => handleChange('defenseDebuffFlat', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 敵HP% */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        敵HP (%)
                    </label>
                    <input
                        type="number"
                        value={settings.enemyHpPercent}
                        onChange={(e) => handleChange('enemyHpPercent', Number(e.target.value))}
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );
}
