/**
 * ダメージ計算Hook
 * 
 * キャラクターと環境設定からダメージを計算し、差分も自動計算する
 */

import { useState, useEffect } from 'react';
import type { Character, EnvironmentSettings, DamageCalculationResult, DamageComparison } from '../../core/types';
import { calculateDamage, calculateDamageComparison } from '../../core/logic/damageCalculator';
import { DEFAULT_ENVIRONMENT } from './useEnvironmentSettings';

export function useDamageCalculation(
    characters: Character[],
    environment: EnvironmentSettings
) {
    const [results, setResults] = useState<Record<string, DamageCalculationResult>>({});
    const [comparisons, setComparisons] = useState<Record<string, DamageComparison>>({});
    // No longer needing previousEnvironmentRef if we always compare to Default.

    // For manual snapshotting if we wanted it later, we could keep it, but for now enforcing Base comparison.
    // actually, let's keep the hook api stable.

    useEffect(() => {
        // 全キャラクターのダメージを計算
        const newResults: Record<string, DamageCalculationResult> = {};

        for (const character of characters) {
            newResults[character.id] = calculateDamage(character, environment);
        }

        setResults(newResults);

        // 差分を計算 (常に基準値=デフォルト環境と比較)
        const newComparisons: Record<string, DamageComparison> = {};

        for (const character of characters) {
            // Base = Default Environment (No buffs)
            const beforeResult = calculateDamage(character, DEFAULT_ENVIRONMENT);
            const afterResult = newResults[character.id];

            newComparisons[character.id] = calculateDamageComparison(beforeResult, afterResult);
        }

        setComparisons(newComparisons);
    }, [characters, environment]);

    return { results, comparisons };
}
