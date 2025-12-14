import type { BuffMode, CostBuffType, Stat, Target } from '../types';

export interface ParsedPattern {
    stat: Stat;
    mode: BuffMode;
    regex: RegExp;
    unit?: '+%' | '+' | '×' | '-';
    valueTransform?: (match: RegExpExecArray) => number;
    target?: Target;
    costType?: CostBuffType;
    inspireSourceStat?: 'attack' | 'defense';
    note?: string;
}

export const targetMap: Record<string, Target> = {
    自身: 'self',
    対象: 'ally',
    射程内: 'range',
    範囲内: 'range',
    味方: 'range',
    城娘: 'range',
    全: 'all',
    全体: 'all',
    全て: 'all',
    射程外: 'out_of_range',
};

const asPercentFromMultiplier = (m: RegExpExecArray) => (parseFloat(m[1]) - 1) * 100;

// 半角・全角両対応のパーセント記号
const PCT = '[%％]';

export const patterns: ParsedPattern[] = [
    // 1. 攻撃系
    // 「攻撃と防御1.2倍」「攻撃と攻撃速度10%」のような複合パターン
    { stat: 'attack', mode: 'percent_max', regex: new RegExp(`攻撃(?:力)?(?:と[^0-9]+)?(\\d+(?:\\.\\d+)?)倍`), unit: '×', valueTransform: asPercentFromMultiplier },
    { stat: 'attack', mode: 'percent_max', regex: new RegExp(`攻撃(?:力)?(?:と[^0-9]+)?(\\d+)${PCT}(?:上昇|増加|アップ)?`) },
    { stat: 'attack', mode: 'percent_max', regex: new RegExp(`攻撃(?:力)?(?:が|を|\\+)?\\s*(\\d+)${PCT}(?:上昇|増加|アップ)?`) },
    { stat: 'attack', mode: 'flat_sum', regex: /攻撃(?:力)?(?:が|を|\+)\s*(\d+)(?![0-9]*[%％.])(?:上昇|増加|アップ)?/ },  // が|を|+ 必須、小数点も除外
    { stat: 'enemy_attack', mode: 'percent_max', regex: new RegExp(`敵の?攻撃(?:力)?(?:と[^0-9]*)?(?:が|を)?\\s*(\\d+)${PCT}(?:低下|減少|ダウン)`) },
    { stat: 'enemy_attack', mode: 'flat_sum', regex: /敵の?攻撃(?:力)?(?:と[^0-9]*)?(?:が|を)?\s*(\d+)(?![%％.])(?:低下|減少|ダウン)/ },

    // 2. 防御系
    // 「攻撃と防御1.2倍」のような複合パターン
    { stat: 'defense', mode: 'percent_max', regex: new RegExp(`防御(?:力)?(\\d+(?:\\.\\d+)?)倍`), unit: '×', valueTransform: asPercentFromMultiplier },
    { stat: 'defense', mode: 'percent_max', regex: new RegExp(`防御(?:力)?(?:が|を|\\+)?\\s*(\\d+)${PCT}(?:上昇|増加|アップ)?`) },
    { stat: 'defense', mode: 'flat_sum', regex: /防御(?:力)?(?:が|を|\+)\s*(\d+)(?![0-9]*[%％.])(?:上昇|増加|アップ)?/ },  // が|を|+ 必須、小数点も除外
    { stat: 'enemy_defense', mode: 'percent_max', regex: new RegExp(`敵の?防御(?:力)?(?:が|を)?\\s*(\\d+)${PCT}低下`) },
    { stat: 'enemy_defense', mode: 'flat_sum', regex: /敵の?防御(?:力)?(?:が|を)?\s*(\d+)(?![%％])(?:低下|減少|ダウン)/ },
    { stat: 'enemy_defense_ignore_complete', mode: 'flat_sum', regex: /防御[を]?無視/, valueTransform: () => 1 },
    { stat: 'enemy_defense_ignore_percent', mode: 'percent_max', regex: new RegExp(`防御[を]?\\s*(\\d+)${PCT}無視`) },

    // 3. ダメージ系
    { stat: 'give_damage', mode: 'percent_max', regex: /(\d+(?:\.\d+)?)倍のダメージを与える/, valueTransform: asPercentFromMultiplier, unit: '×' },
    { stat: 'give_damage', mode: 'percent_max', regex: /攻撃の?(\d+(?:\.\d+)?)倍のダメージ/, valueTransform: asPercentFromMultiplier, unit: '×' },
    { stat: 'damage_dealt', mode: 'percent_max', regex: new RegExp(`与ダメ(?:ージ)?(?:が|を)?\\s*(\\d+)${PCT}`) },
    { stat: 'give_damage', mode: 'percent_max', regex: new RegExp(`^与えるダメージ(?:が|を)?\\s*(\\d+)${PCT}`) },
    { stat: 'enemy_damage_taken', mode: 'percent_max', regex: new RegExp(`被ダメ(?:ージ)?(?:が|を)?\\s*(\\d+)${PCT}(?:増加|上昇|アップ)`) },  // 敵の被ダメ上昇（攻撃貢献）
    { stat: 'damage_taken', mode: 'percent_max', regex: new RegExp(`被ダメ(?:ージ)?(?:が|を)?\\s*(\\d+)${PCT}(?:軽減|低下|減少)`) },  // 自分の被ダメ軽減（防御）
    { stat: 'enemy_damage_dealt', mode: 'percent_max', regex: new RegExp(`敵の?.*?与ダメ(?:ージ)?(?:が|を)?\\s*(\\d+)${PCT}(?:低下|減少|ダウン)`) },  // 敵の与ダメ低下（防御貢献）
    { stat: 'damage_recovery', mode: 'percent_max', regex: new RegExp(`与ダメの?(\\d+)${PCT}.*?回復`) },
    { stat: 'critical_bonus', mode: 'absolute_set', regex: new RegExp(`直撃ボーナスが(\\d+)${PCT}に上昇`) },
    { stat: 'critical_bonus', mode: 'percent_max', regex: new RegExp(`直撃ボーナスが(\\d+)${PCT}上昇`) },

    // 4. 射程・対象数系
    { stat: 'enemy_range', mode: 'percent_max', regex: new RegExp(`射程(?:が|を)?\\s*(\\d+)${PCT}?(?:低下|減少|ダウン)`) },
    { stat: 'range', mode: 'percent_max', regex: /射程(?:が|を)?\s*(\d+(?:\.\d+)?)倍/, unit: '×', valueTransform: asPercentFromMultiplier },
    { stat: 'range', mode: 'percent_max', regex: new RegExp(`射程(?:が|を)?\\s*([+-]?\\d+)${PCT}`) },
    { stat: 'range', mode: 'flat_sum', regex: /射程(?:が|を)\s*([+-]?\d+)(?![%％.])/ },  // が|を 必須、小数点も除外
    { stat: 'target_count', mode: 'flat_sum', regex: /対象(?:が)?\s*([+-]?\d+)増加/ },
    { stat: 'attack_count', mode: 'flat_sum', regex: /攻撃回数(?:が)?\s*([+-]?\d+)/ },

    // 5. 速度・隙系
    { stat: 'attack_speed', mode: 'percent_max', regex: new RegExp(`攻撃速度(?:が)?\\s*(\\d+)${PCT}`) },
    { stat: 'attack_speed', mode: 'percent_max', regex: new RegExp(`攻撃速度(?:が)?\\s*(\\d+)${PCT}(?:低下|減少)`), valueTransform: m => -Number(m[1]) },
    { stat: 'attack_gap', mode: 'percent_reduction', regex: new RegExp(`隙(?:が)?\\s*(\\d+)${PCT}(?:短縮|減少)`) },
    { stat: 'attack_gap', mode: 'percent_max', regex: new RegExp(`隙(?:が)?\\s*(\\d+)${PCT}増加`) },

    // 6. 気・計略系
    { stat: 'cost', mode: 'flat_sum', regex: /自然に気(?:が)?\s*(\d+)増加/, costType: 'natural' },
    { stat: 'cost', mode: 'flat_sum', regex: /気トークン(?:が)?\s*(\d+)増加/, costType: 'natural' },
    { stat: 'cost', mode: 'flat_sum', regex: /敵.*?撃破.*?気(?:が)?\s*(\d+)/, costType: 'enemy_defeat' },
    { stat: 'cost', mode: 'flat_sum', regex: /城娘.*?(?:撃破|撤退).*?気(?:が)?\s*(\d+)/, costType: 'ally_defeat' },
    { stat: 'cost', mode: 'flat_sum', regex: /徐々に.*?気(?:が)?\s*(\d+)/, costType: 'gradual' },
    { stat: 'cost', mode: 'percent_reduction', regex: new RegExp(`消費気(?:が)?\\s*(\\d+)${PCT}減少`), costType: 'giant_cost' },
    { stat: 'cost', mode: 'flat_sum', regex: /計略.*?消費気.*?(\d+)減少/, costType: 'strategy_cost' },
    { stat: 'strategy_cooldown', mode: 'percent_reduction', regex: new RegExp(`計略.*?再使用.*?(\\d+)${PCT}短縮`) },

    // 7. 敵デバフその他
    { stat: 'enemy_movement', mode: 'percent_max', regex: new RegExp(`移動速度(?:が)?\\s*(\\d+)${PCT}低下`) },
    { stat: 'enemy_retreat', mode: 'flat_sum', regex: /(\d+)マス?後退/ },

    // 8. 回復系
    { stat: 'recovery', mode: 'flat_sum', regex: /回復(?:が)?\s*(\d+)上昇/ },
    { stat: 'recovery', mode: 'percent_max', regex: /回復(?:が)?\s*(\d+(?:\.\d+)?)倍/, unit: '×', valueTransform: asPercentFromMultiplier },

    // 9. 鼓舞系（特殊）
    { stat: 'inspire', mode: 'percent_max', regex: new RegExp(`自身の攻撃の(\\d+)${PCT}.*?加算`), inspireSourceStat: 'attack' },
    { stat: 'inspire', mode: 'percent_max', regex: new RegExp(`自身の防御の(\\d+)${PCT}.*?加算`), inspireSourceStat: 'defense' },
    { stat: 'inspire', mode: 'percent_max', regex: new RegExp(`自身の攻撃と防御の(\\d+)${PCT}.*?加算`), inspireSourceStat: 'attack' }, // defenseも別途扱う
];
