/**
 * ダメージ計算Hook
 * 
 * キャラクターと環境設定からダメージを計算し、差分も自動計算する
 */

import { useState, useEffect } from 'react';
import type { Character, EnvironmentSettings, DamageCalculationResult, DamageComparison } from '../../core/types';
import { calculateDamage, calculateDamageComparison } from '../../core/logic/damageCalculator';

export function useDamageCalculation(
    characters: Character[],
    environment: EnvironmentSettings
) {
    const [results, setResults] = useState<Record<string, DamageCalculationResult>>({});
    const [comparisons, setComparisons] = useState<Record<string, DamageComparison>>({});
    const [previousEnvironment, setPreviousEnvironment] = useState(environment);

    useEffect(() => {
        // 全キャラクターのダメージを計算
        const newResults: Record<string, DamageCalculationResult> = {};

        for (const character of characters) {
            newResults[character.id] = calculateDamage(character, environment);
        }

        setResults(newResults);

        // 差分を計算
        if (previousEnvironment) {
            const newComparisons: Record<string, DamageComparison> = {};

            for (const character of characters) {
                const beforeResult = calculateDamage(character, previousEnvironment);
                const afterResult = newResults[character.id];

                newComparisons[character.id] = calculateDamageComparison(beforeResult, afterResult);
            }

            setComparisons(newComparisons);
        }

        setPreviousEnvironment(environment);
    }, [characters, environment]);

    return { results, comparisons };
}
