import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    saveCharacters,
    loadCharacters,
    addCharacterToStorage,
    removeCharacterFromStorage,
    saveFormations,
    loadFormations,
    createStoredFormation,
    saveEnvironment,
    loadEnvironment,
    saveLastActiveFormationId,
    loadLastActiveFormationId,
} from './index';
import { STORAGE_KEYS } from './types';
import type { Character, Formation, EnvironmentSettings } from '../types';

// モック用キャラクター作成ヘルパー
const createMockChar = (id: string, name: string): Character => ({
    id,
    name,
    weapon: '刀',
    attributes: ['平'],
    baseStats: {
        hp: 1000,
        attack: 100,
        defense: 50,
        range: 200,
        recovery: 0,
        cooldown: 30,
        cost: 10,
        damage_dealt: 0,
        damage_taken: 0,
        attack_speed: 0,
        attack_gap: 0,
        movement_speed: 0,
        knockback: 0,
        target_count: 0,
        ki_gain: 0,
        damage_drain: 0,
        ignore_defense: 0,
    },
    skills: [],
    strategies: [],
    specialAbilities: [],
});

// モック localStorage
const createMockLocalStorage = () => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
    };
};

describe('storage', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;

    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
    });

    describe('Characters', () => {
        it('should save and load characters', () => {
            const char1 = createMockChar('c1', '江戸城');
            const char2 = createMockChar('c2', '大阪城');

            saveCharacters([char1, char2]);
            const loaded = loadCharacters();

            expect(loaded).toHaveLength(2);
            expect(loaded[0].name).toBe('江戸城');
            expect(loaded[1].name).toBe('大阪城');
            expect(loaded[0].savedAt).toBeDefined();
        });

        it('should return empty array when no characters saved', () => {
            const loaded = loadCharacters();
            expect(loaded).toEqual([]);
        });

        it('should add character to storage without duplicates', () => {
            const char1 = createMockChar('c1', '江戸城');

            const result1 = addCharacterToStorage(char1);
            expect(result1).toHaveLength(1);

            // 同じIDで再度追加しても増えない
            const result2 = addCharacterToStorage(char1);
            expect(result2).toHaveLength(1);
        });

        it('should add different characters', () => {
            const char1 = createMockChar('c1', '江戸城');
            const char2 = createMockChar('c2', '大阪城');

            addCharacterToStorage(char1);
            const result = addCharacterToStorage(char2);

            expect(result).toHaveLength(2);
        });

        it('should remove character from storage', () => {
            const char1 = createMockChar('c1', '江戸城');
            const char2 = createMockChar('c2', '大阪城');

            addCharacterToStorage(char1);
            addCharacterToStorage(char2);

            const result = removeCharacterFromStorage('c1');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('c2');
        });

        it('should handle removing non-existent character', () => {
            const char1 = createMockChar('c1', '江戸城');
            addCharacterToStorage(char1);

            const result = removeCharacterFromStorage('non-existent');

            expect(result).toHaveLength(1);
        });
    });

    describe('Formations', () => {
        it('should save and load formations', () => {
            const formations = [
                { id: 'f1', name: '編成1', slotIds: ['c1', 'c2', null], updatedAt: Date.now() },
                { id: 'f2', name: '編成2', slotIds: ['c3', null, null], updatedAt: Date.now() },
            ];

            saveFormations(formations);
            const loaded = loadFormations();

            expect(loaded).toHaveLength(2);
            expect(loaded[0].name).toBe('編成1');
            expect(loaded[1].name).toBe('編成2');
        });

        it('should return empty array when no formations saved', () => {
            const loaded = loadFormations();
            expect(loaded).toEqual([]);
        });

        it('should create stored formation from formation', () => {
            const char1 = createMockChar('c1', '江戸城');
            const char2 = createMockChar('c2', '大阪城');
            const formation: Formation = {
                slots: [char1, char2, null, null, null, null, null, null],
            };

            const stored = createStoredFormation('テスト編成', formation);

            expect(stored.name).toBe('テスト編成');
            expect(stored.slotIds).toEqual(['c1', 'c2', null, null, null, null, null, null]);
            expect(stored.id).toMatch(/^fmt_/);
            expect(stored.updatedAt).toBeDefined();
        });
    });

    describe('Last Active Formation', () => {
        it('should save and load last active formation id', () => {
            saveLastActiveFormationId('f1');
            const loaded = loadLastActiveFormationId();
            expect(loaded).toBe('f1');
        });

        it('should return null when no last formation saved', () => {
            const loaded = loadLastActiveFormationId();
            expect(loaded).toBeNull();
        });

        it('should save null to clear last formation', () => {
            saveLastActiveFormationId('f1');
            saveLastActiveFormationId(null);
            const loaded = loadLastActiveFormationId();
            expect(loaded).toBeNull();
        });
    });

    describe('Environment', () => {
        const defaultEnv: EnvironmentSettings = {
            inspire: 0,
            attackPercent: 0,
            defensePercent: 0,
            damageDealtPercent: 0,
            damageTakenPercent: 0,
            rangeFlat: 0,
            cooldownPercent: 0,
            attackSpeedPercent: 0,
            kiGainPercent: 0,
            enemyDefense: 0,
            enemyDamageDealtPercent: 0,
            enemyDamageTakenPercent: 0,
        };

        it('should save and load environment settings', () => {
            const customEnv: EnvironmentSettings = {
                ...defaultEnv,
                inspire: 100,
                attackPercent: 50,
            };

            saveEnvironment(customEnv);
            const loaded = loadEnvironment(defaultEnv);

            expect(loaded.inspire).toBe(100);
            expect(loaded.attackPercent).toBe(50);
        });

        it('should return default when no environment saved', () => {
            const loaded = loadEnvironment(defaultEnv);
            expect(loaded).toEqual(defaultEnv);
        });
    });

    describe('Error handling', () => {
        it('should handle localStorage errors gracefully on save', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });

            // エラーが発生してもクラッシュしない
            expect(() => saveCharacters([createMockChar('c1', 'Test')])).not.toThrow();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle invalid JSON gracefully on load', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockStorage.getItem.mockReturnValue('invalid json {{{');

            const result = loadCharacters();

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('Storage Keys', () => {
        it('should use correct storage keys', () => {
            expect(STORAGE_KEYS.CHARACTERS).toBe('shiropro_reborn_characters');
            expect(STORAGE_KEYS.FORMATIONS).toBe('shiropro_reborn_formations');
            expect(STORAGE_KEYS.LAST_FORMATION).toBe('shiropro_reborn_last_formation');
            expect(STORAGE_KEYS.ENVIRONMENT).toBe('shiropro_reborn_environment');
        });
    });
});
