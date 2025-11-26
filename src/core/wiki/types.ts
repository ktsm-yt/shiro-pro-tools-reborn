export interface RawCharacterData {
    name: string;
    url: string;
    imageUrl?: string;
    weapon: string;
    attributes: string[];
    baseStats: {
        attack?: number;
        defense?: number;
        range?: number;
        cooldown?: number;
        cost?: number;
    };
    skillTexts: string[];
    strategyTexts: string[];
}

export interface WikiFetchResult {
    success: boolean;
    data?: string; // HTML content
    error?: string;
}
