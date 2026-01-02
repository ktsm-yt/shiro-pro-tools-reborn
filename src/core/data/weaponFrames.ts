/**
 * 武器種別フレームデータ
 * 
 * 各武器種の攻撃フレーム、隙フレーム、合計フレームを定義します。
 * DPS計算に使用されます。
 * 
 * @see docs/DAMAGE_CALCULATOR_SPEC.md
 */

export interface WeaponFrameData {
    attack: number;   // 攻撃フレーム
    gap: number;      // 隙フレーム
    total: number;    // 合計フレーム
    multiHit?: number; // 連撃数（鈴・陣貝のみ）
    note?: string;    // 備考
}

export const WEAPON_FRAMES: Record<string, WeaponFrameData> = {
    '刀': { attack: 19, gap: 22, total: 41 },
    '槍': { attack: 23, gap: 27, total: 50 },
    '槌': { attack: 27, gap: 30, total: 57 },
    '盾': { attack: 24, gap: 30, total: 54 },
    '拳': { attack: 37, gap: 18, total: 55 },
    '鎌': { attack: 22, gap: 22, total: 44 },
    '戦棍': { attack: 27, gap: 25, total: 52 },
    '双剣': { attack: 29, gap: 21, total: 50 },
    'ランス': { attack: 27, gap: 27, total: 54 },
    '弓': { attack: 19, gap: 18, total: 37 },
    '石弓': { attack: 24, gap: 24, total: 48 },
    '鉄砲': { attack: 29, gap: 27, total: 56 },
    '大砲': { attack: 42, gap: 42, total: 84 },
    '歌舞': { attack: 47, gap: 54, total: 101 },
    '法術': { attack: 42, gap: 30, total: 72 },
    '鈴': { attack: 134, gap: 0, total: 134, multiHit: 12, note: '12連撃（1撃は攻撃値の1/12）' },
    '杖': { attack: 37, gap: 30, total: 67 },
    '祓串': { attack: 32, gap: 27, total: 59 },
    '投剣': { attack: 24, gap: 18, total: 42 },
    '鞭': { attack: 24, gap: 21, total: 45 },
    '陣貝': { attack: 218, gap: 0, total: 218, multiHit: 18, note: '18連撃＋範囲回復' },
    '軍船': { attack: 32, gap: 42, total: 74 },
    'その他': { attack: 37, gap: 30, total: 67, note: '杖と同じフレーム' },  // シバルバー等
};
