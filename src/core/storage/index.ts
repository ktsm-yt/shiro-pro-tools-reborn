import { STORAGE_KEYS } from './types';
import type { StoredCharacter, StoredFormation } from './types';
import type { EnvironmentSettings, Character, Formation } from '../types';

// Generic Helpers
function saveItem<T>(key: string, value: T): void {
    try {
        const json = JSON.stringify(value);
        localStorage.setItem(key, json);
    } catch (e) {
        console.error(`Failed to save to localStorage [${key}]:`, e);
    }
}

function loadItem<T>(key: string, defaultValue: T): T {
    try {
        const json = localStorage.getItem(key);
        if (!json) return defaultValue;
        return JSON.parse(json) as T;
    } catch (e) {
        console.error(`Failed to load from localStorage [${key}]:`, e);
        return defaultValue;
    }
}

// Characters
export function saveCharacters(chars: Character[]): void {
    const stored: StoredCharacter[] = chars.map(c => ({
        ...c,
        savedAt: (c as any).savedAt || Date.now()
    }));
    saveItem(STORAGE_KEYS.CHARACTERS, stored);
}

export function loadCharacters(): StoredCharacter[] {
    return loadItem<StoredCharacter[]>(STORAGE_KEYS.CHARACTERS, []);
}

export function addCharacterToStorage(char: Character): Character[] {
    const current = loadCharacters();
    // Prevent duplicates by ID
    const exists = current.some(c => c.id === char.id);
    if (exists) return current;

    const newChar: StoredCharacter = { ...char, savedAt: Date.now() };
    const next = [...current, newChar];
    saveCharacters(next);
    return next;
}

export function removeCharacterFromStorage(charId: string): Character[] {
    const current = loadCharacters();
    const next = current.filter(c => c.id !== charId);
    saveCharacters(next);
    return next;
}

export function updateCharacterInStorage(char: Character): Character[] {
    const current = loadCharacters();
    const next = current.map(c => c.id === char.id ? { ...c, ...char, savedAt: (c as any).savedAt || Date.now() } : c);
    saveCharacters(next);
    return next;
}

// Formations
export function saveFormations(formations: StoredFormation[]): void {
    saveItem(STORAGE_KEYS.FORMATIONS, formations);
}

export function loadFormations(): StoredFormation[] {
    return loadItem<StoredFormation[]>(STORAGE_KEYS.FORMATIONS, []);
}

export function saveLastActiveFormationId(id: string | null): void {
    saveItem(STORAGE_KEYS.LAST_FORMATION, id);
}

export function loadLastActiveFormationId(): string | null {
    return loadItem<string | null>(STORAGE_KEYS.LAST_FORMATION, null);
}

// Helper to convert simple Formation to StoredFormation
export function createStoredFormation(name: string, formation: Formation): StoredFormation {
    return {
        id: `fmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name,
        slotIds: formation.slots.map(c => c ? c.id : null),
        updatedAt: Date.now(),
    };
}

// Environment
export function saveEnvironment(env: EnvironmentSettings): void {
    saveItem(STORAGE_KEYS.ENVIRONMENT, env);
}

export function loadEnvironment(defaultEnv: EnvironmentSettings): EnvironmentSettings {
    return loadItem<EnvironmentSettings>(STORAGE_KEYS.ENVIRONMENT, defaultEnv);
}
