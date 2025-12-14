/**
 * 環境設定Hook
 * 
 * 環境設定の状態管理とLocalStorageへの保存
 */

import { useState, useEffect } from 'react';
import type { EnvironmentSettings } from '../../core/types';
import { loadEnvironment, saveEnvironment } from '../../core/storage';

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
    inspireFlat: 0,
    duplicateBuff: 0,
    attackPercent: 0,
    damageDealt: 0,
    damageMultiplier: 1,
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
        return loadEnvironment(DEFAULT_ENVIRONMENT);
    });

    // 設定が変更されたらLocalStorageに保存
    useEffect(() => {
        saveEnvironment(settings);
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
