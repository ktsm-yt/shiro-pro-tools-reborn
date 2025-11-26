/**
 * Wiki解析の中間データ型定義
 */

/**
 * WikiのHTMLから抽出した生データ
 * まだバフ解析前の状態
 */
export interface RawCharacterData {
    name: string;
    weapon: string;
    attributes: string[]; // 平、水、山など
    baseStats: {
        attack?: number;
        defense?: number;
        range?: number;
        cooldown?: number;
        cost?: number;
    };
    skillTexts: string[]; // 特技の説明文（そのまま）
    strategyTexts: string[]; // 計略の説明文（そのまま）
}

/**
 * Wiki解析のエラー情報
 */
export interface WikiParseError {
    message: string;
    url?: string;
}
