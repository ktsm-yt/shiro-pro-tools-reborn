/**
 * 武器種マッピング
 *
 * 武器種から射程タイプ・攻撃タイプ・配置タイプを導出するためのマッピングテーブル。
 * parser.ts や conditions.ts など複数箇所で使用される共通定義。
 */

export interface WeaponInfo {
    range: '近' | '遠';
    type: '物' | '術';
    placement: '近' | '遠' | '遠近';
}

export const weaponMapping: Record<string, WeaponInfo> = {
    // 近接物理
    刀: { range: '近', type: '物', placement: '近' },
    槍: { range: '近', type: '物', placement: '近' },
    槌: { range: '近', type: '物', placement: '近' },
    盾: { range: '近', type: '物', placement: '近' },
    拳: { range: '近', type: '物', placement: '近' },
    鎌: { range: '近', type: '物', placement: '近' },
    戦棍: { range: '近', type: '物', placement: '近' },
    双剣: { range: '近', type: '物', placement: '近' },
    ランス: { range: '近', type: '物', placement: '近' },

    // 遠隔物理
    弓: { range: '遠', type: '物', placement: '遠' },
    石弓: { range: '遠', type: '物', placement: '遠' },
    鉄砲: { range: '遠', type: '物', placement: '遠' },

    // 遠隔術
    歌舞: { range: '遠', type: '術', placement: '遠' },
    法術: { range: '遠', type: '術', placement: '遠' },
    杖: { range: '遠', type: '術', placement: '遠' },
    鈴: { range: '遠', type: '術', placement: '遠' },
    祓串: { range: '遠', type: '術', placement: '遠' },
    本: { range: '遠', type: '術', placement: '遠' },
    その他: { range: '遠', type: '術', placement: '遠' },  // シバルバー等

    // 遠近両用物理
    投剣: { range: '遠', type: '物', placement: '遠近' },
    鞭: { range: '近', type: '物', placement: '遠近' },
    茶器: { range: '近', type: '物', placement: '遠近' },
    大砲: { range: '遠', type: '物', placement: '遠近' },
    軍船: { range: '遠', type: '物', placement: '遠近' },

    // 遠近両用術
    陣貝: { range: '遠', type: '術', placement: '遠近' },
};

/**
 * 武器種から情報を取得（未知の武器種はundefinedを返す）
 */
export function getWeaponInfo(weapon: string): WeaponInfo | undefined {
    return weaponMapping[weapon];
}

/**
 * 物理武器かどうかを判定
 */
export function isPhysicalWeapon(weapon: string): boolean {
    const info = weaponMapping[weapon];
    return info ? info.type === '物' : true; // 不明な場合は物理として扱う
}

/**
 * 術武器かどうかを判定
 */
export function isMagicalWeapon(weapon: string): boolean {
    const info = weaponMapping[weapon];
    return info ? info.type === '術' : false;
}

/**
 * 近接武器かどうかを判定
 */
export function isMeleeWeapon(weapon: string): boolean {
    const info = weaponMapping[weapon];
    if (!info) return false;
    return info.placement === '近' || info.placement === '遠近';
}

/**
 * 遠隔武器かどうかを判定
 */
export function isRangedWeapon(weapon: string): boolean {
    const info = weaponMapping[weapon];
    if (!info) return false;
    return info.placement === '遠' || info.placement === '遠近';
}
