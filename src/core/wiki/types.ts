export interface RawCharacterData {
    name: string;
    period?: string; // [絢爛] etc.
    url: string;
    imageUrl?: string;
    weapon: string;
    weaponRange?: '近' | '遠' | '遠近';
    weaponType?: '物' | '術';
    placement?: '近' | '遠' | '遠近';
    attributes: string[];
    baseStats: {
        attack?: number;
        defense?: number;
        range?: number;
        cooldown?: number;
        cost?: number;
        damage_dealt?: number;
        damage_taken?: number;
    };
    skillTexts: string[];
    strategyTexts: string[];
}

export interface WikiFetchResult {
    success: boolean;
    data?: string; // HTML content
    error?: string;
}
