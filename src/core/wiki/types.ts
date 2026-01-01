export interface RawCharacterData {
    name: string;
    period?: string; // [絢爛] etc.
    url: string;
    imageUrl?: string;
    rarity?: string; // ☆7, 曉 etc.
    weapon: string;
    weaponRange?: '近' | '遠' | '遠近';
    weaponType?: '物' | '術';
    placement?: '近' | '遠' | '遠近';
    attributes: string[];
    baseStats: {
        hp?: number;
        attack?: number;
        defense?: number;
        range?: number;
        recovery?: number;
        cooldown?: number;
        cost?: number;
        damage_dealt?: number;
        damage_taken?: number;
        attack_speed?: number;
        attack_gap?: number;
        movement_speed?: number;
        retreat?: number;
        target_count?: number;
        ki_gain?: number;
        damage_drain?: number;
        ignore_defense?: number;
    };
    skillTexts: string[];
    strategyTexts: string[];
    specialTexts?: string[];
    specialAttackTexts?: string[];
}

export interface WikiFetchResult {
    success: boolean;
    data?: string; // HTML content
    error?: string;
}
