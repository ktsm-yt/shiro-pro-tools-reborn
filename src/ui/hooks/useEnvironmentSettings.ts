/**
 * 環境設定Hook
 * 
 * 環境設定の状態管理とLocalStorageへの保存
 */

import { useState, useEffect } from 'react';
import type { EnvironmentSettings } from '../../core/types';

const STORAGE_KEY = 'shiro-pro-damage-calculator-environment';

const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
    inspireFlat: 0,
    duplicateBuff: 0,
    attackSpeed: 0,
    gapReduction: 0,
    enemyDefense: 0,
    defenseDebuffPercent: 0,
    defenseDebuffFlat: 0,
    damageTaken: 0,
    enemyHpPercent: 100,
};

export function useEnvironmentSettings() {
    const [settings, setSettings] = useState<EnvironmentSettings>(() => {
        // LocalStorageから読み込み
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load environment settings:', error);
        }
        return DEFAULT_ENVIRONMENT;
    });

    // 設定が変更されたらLocalStorageに保存
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save environment settings:', error);
        }
    }, [settings]);

    const reset = () => {
        setSettings(DEFAULT_ENVIRONMENT);
    };

    return {
        settings,
        setSettings,
        reset,
    };
}
