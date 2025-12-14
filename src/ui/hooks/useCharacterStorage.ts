import { useState, useCallback } from 'react';
import type { Character } from '../../core/types';
import { loadCharacters, addCharacterToStorage, removeCharacterFromStorage } from '../../core/storage';

export function useCharacterStorage() {
    const [savedCharacters, setSavedCharacters] = useState<Character[]>(() => loadCharacters());

    // Initial Load - Removed as we load synchronously now
    // useEffect(() => {
    //     setSavedCharacters(loadCharacters());
    // }, []);

    const addCharacter = useCallback((char: Character) => {
        const updated = addCharacterToStorage(char);
        setSavedCharacters(updated);
    }, []);

    const removeCharacter = useCallback((charId: string) => {
        const updated = removeCharacterFromStorage(charId);
        setSavedCharacters(updated);
    }, []);

    return {
        savedCharacters,
        addCharacter,
        removeCharacter
    };
}
