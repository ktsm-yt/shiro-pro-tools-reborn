import { useState, useCallback } from 'react';
import type { Character } from '../../core/types';

const STORAGE_KEY = 'shiropro_reborn_compare_list';

function loadCompareIds(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as string[];
    } catch {
        return [];
    }
}

function saveCompareIds(ids: string[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // ignore storage errors
    }
}

export interface UseCompareListReturn {
    compareIds: string[];
    addToCompare: (charId: string) => void;
    removeFromCompare: (charId: string) => void;
    clearCompareList: () => void;
    isInCompareList: (charId: string) => boolean;
    toggleCompare: (charId: string) => void;
}

export function useCompareList(): UseCompareListReturn {
    const [compareIds, setCompareIds] = useState<string[]>(() => loadCompareIds());

    const addToCompare = useCallback((charId: string) => {
        setCompareIds(prev => {
            if (prev.includes(charId)) return prev;
            const updated = [...prev, charId];
            saveCompareIds(updated);
            return updated;
        });
    }, []);

    const removeFromCompare = useCallback((charId: string) => {
        setCompareIds(prev => {
            const updated = prev.filter(id => id !== charId);
            saveCompareIds(updated);
            return updated;
        });
    }, []);

    const clearCompareList = useCallback(() => {
        setCompareIds([]);
        saveCompareIds([]);
    }, []);

    const isInCompareList = useCallback((charId: string): boolean => {
        return compareIds.includes(charId);
    }, [compareIds]);

    const toggleCompare = useCallback((charId: string) => {
        setCompareIds(prev => {
            const updated = prev.includes(charId)
                ? prev.filter(id => id !== charId)
                : [...prev, charId];
            saveCompareIds(updated);
            return updated;
        });
    }, []);

    return {
        compareIds,
        addToCompare,
        removeFromCompare,
        clearCompareList,
        isInCompareList,
        toggleCompare,
    };
}
