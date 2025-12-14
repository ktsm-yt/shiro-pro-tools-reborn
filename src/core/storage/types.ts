import type { Character, EnvironmentSettings } from '../types';

export interface StoredCharacter extends Character {
    savedAt: number;
}

export interface StoredFormation {
    id: string;
    name: string;
    description?: string;
    slotIds: (string | null)[]; // Character IDs
    updatedAt: number;
}

export interface StorageSchema {
    characters: StoredCharacter[];
    formations: StoredFormation[];
    lastActiveFormationId?: string;
    environment: EnvironmentSettings;
}

export const STORAGE_KEYS = {
    CHARACTERS: 'shiropro_reborn_characters',
    FORMATIONS: 'shiropro_reborn_formations',
    LAST_FORMATION: 'shiropro_reborn_last_formation',
    ENVIRONMENT: 'shiropro_reborn_environment',
} as const;
