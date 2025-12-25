import { patterns, type ParsedPattern } from './patterns';
import { extractConditionTags } from '../conditions';
import type { ConditionTag, CostBuffType, DynamicBuffType, Priority, Target } from '../types';

export interface ParsedBuff {
    stat: string;
    mode: string;
    target: Target;
    value: number;
    unit?: '+%' | '+' | '×' | '-';
    isSpecial: boolean;
    hasCondition: boolean;
    conditionText?: string;
    conditionTags?: ConditionTag[];
    note?: string;
    rawText: string;
    costType?: CostBuffType;
    inspireSourceStat?: 'attack' | 'defense';
    isDuplicate?: boolean;
    isExplicitlyNonDuplicate?: boolean;
    nonStacking?: boolean;
    stackPenalty?: number;
    stackable?: boolean;
    maxStacks?: number;
    currentStacks?: number;
    priority?: Priority;
    isDynamic?: boolean;
    dynamicType?: DynamicBuffType;
    dynamicCategory?: 'formation' | 'combat_situation';
    unitValue?: number;
    dynamicParameter?: string;
    requiresAmbush?: boolean;
    confidence?: 'certain' | 'inferred' | 'uncertain';
    inferenceReason?: string;
}

type TargetDetectionResult = {
    target: Target;
    note?: string;
    confidence?: 'certain' | 'inferred' | 'uncertain';
    inferenceReason?: string;
};

function detectTarget(text: string): TargetDetectionResult {
    // 範囲サイズ優先判定
    const areaMatch = text.match(/範囲[：:]\s*(超特大|特大|大|中|小)/);
    if (areaMatch) {
        const size = areaMatch[1];
        if (size === '中' || size === '小') {
            return { target: 'ally', note: `範囲：${size}`, confidence: 'certain' };
        }
        return { target: 'range', note: `範囲：${size}`, confidence: 'certain' };
    }

    if (/射程外/.test(text)) return { target: 'out_of_range', confidence: 'certain' };
    if (/射程内|範囲内/.test(text)) return { target: 'range', confidence: 'certain' };
    if (/全(て)?の?城娘|味方全(体|員)|殿|全体/.test(text)) return { target: 'all', confidence: 'certain' };
    if (/対象/.test(text)) return { target: 'ally', confidence: 'certain' };
    if (/味方|城娘/.test(text)) return { target: 'range', confidence: 'inferred', inferenceReason: '「味方」「城娘」表記を射程内と解釈' } as TargetDetectionResult;

    return { target: 'self', confidence: 'inferred', inferenceReason: '対象表記がないため自分と推測' } as TargetDetectionResult;
}

/**
 * 前処理: 全角→半角変換、表記揺れ正規化
 */
function preprocessText(text: string): string {
    let result = text;

    // 全角数字→半角
    result = result.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

    // 全角%→半角
    result = result.replace(/％/g, '%');

    // 全角記号→半角
    result = result.replace(/＋/g, '+');
    result = result.replace(/－/g, '-');
    result = result.replace(/×/g, 'x');
    result = result.replace(/：/g, ':');

    // 表記揺れの正規化
    const normalizations: [RegExp, string][] = [
        [/アップ/g, '上昇'],
        [/ダウン/g, '低下'],
        [/上がる/g, '上昇'],
        [/下がる/g, '低下'],
        [/増加する/g, '増加'],
        [/減少する/g, '減少'],
        [/短縮する/g, '短縮'],
        [/軽減する/g, '軽減'],
    ];

    for (const [pattern, replacement] of normalizations) {
        result = result.replace(pattern, replacement);
    }

    return result;
}

function detectDynamicBuff(text: string, value: number): Partial<ParsedBuff> | null {
    const dynamicPatterns: Array<{ regex: RegExp; type: DynamicBuffType; category: 'formation' | 'combat_situation' }> = [
        // 味方関連
        { regex: /味方\d*体につき/, type: 'per_ally_other', category: 'formation' },
        { regex: /味方の城娘\d*体につき/, type: 'per_ally_other', category: 'formation' },
        { regex: /編成している城娘\d*体につき/, type: 'per_ally_other', category: 'formation' },
        { regex: /他の城娘\d*体につき/, type: 'per_ally_other', category: 'formation' },

        // 射程内味方
        { regex: /射程内(?:の)?味方\d*体(?:毎|ごと)に/, type: 'per_ally_in_range', category: 'formation' },
        { regex: /射程内(?:の)?城娘\d*体(?:毎|ごと)に/, type: 'per_ally_in_range', category: 'formation' },
        { regex: /範囲内(?:の)?味方\d*体(?:毎|ごと)に/, type: 'per_ally_in_range', category: 'formation' },

        // 射程内敵
        { regex: /射程内(?:の)?敵\d*体(?:毎|ごと)に/, type: 'per_enemy_in_range', category: 'combat_situation' },
        { regex: /範囲内(?:の)?敵\d*体(?:毎|ごと)に/, type: 'per_enemy_in_range', category: 'combat_situation' },
        { regex: /攻撃対象(?:の)?敵\d*体(?:毎|ごと)に/, type: 'per_enemy_in_range', category: 'combat_situation' },

        // 伏兵関連
        { regex: /伏兵\d*体につき/, type: 'per_ambush_deployed', category: 'formation' },
        { regex: /配置(?:された|している)伏兵\d*体につき/, type: 'per_ambush_deployed', category: 'formation' },
        { regex: /伏兵が配置されている/, type: 'per_ambush_deployed', category: 'formation' },

        // 敵撃破
        { regex: /撃破(?:した)?敵\d*体(?:毎|ごと)に/, type: 'per_enemy_defeated', category: 'combat_situation' },
        { regex: /敵\d*体撃破(?:する)?(?:毎|ごと)に/, type: 'per_enemy_defeated', category: 'combat_situation' },
        { regex: /敵を撃破(?:する)?(?:毎|ごと)に/, type: 'per_enemy_defeated', category: 'combat_situation' },

        // 属性・武器種
        { regex: /(?:同じ|同一)?属性(?:の)?城娘\d*体(?:毎|ごと|につき)/, type: 'per_specific_attribute', category: 'formation' },
        { regex: /(?:同じ|同一)?武器種(?:の)?城娘\d*体(?:毎|ごと|につき)/, type: 'per_specific_weapon', category: 'formation' },
        { regex: /水属性(?:の)?城娘\d*体(?:毎|ごと|につき)/, type: 'per_specific_attribute', category: 'formation' },
        { regex: /平属性(?:の)?城娘\d*体(?:毎|ごと|につき)/, type: 'per_specific_attribute', category: 'formation' },
        { regex: /山属性(?:の)?城娘\d*体(?:毎|ごと|につき)/, type: 'per_specific_attribute', category: 'formation' },
    ];

    for (const pattern of dynamicPatterns) {
        const m = text.match(pattern.regex);
        if (m) {
            return {
                isDynamic: true,
                dynamicType: pattern.type,
                dynamicCategory: pattern.category,
                unitValue: value,
                dynamicParameter: m[0],
            };
        }
    }
    return null;
}

/**
 * 並列表記を展開する
 * 例: "攻撃と防御が30%上昇" → ["攻撃が30%上昇", "防御が30%上昇"]
 * 例: "防御・移動速度が30%低下" → ["防御が30%低下", "移動速度が30%低下"]
 */
function expandParallelStats(line: string): string[] {
    // 並列パターンの検出
    // 注意: 長いパターン（攻撃速度、移動速度）を先に配置すること
    const statPattern = '攻撃速度|移動速度|攻撃(?:力)?|防御(?:力)?|射程|回復|耐久|与ダメ(?:ージ)?|被ダメ(?:ージ)?';
    const parallelPatterns = [
        // 「攻撃と防御」「攻撃・防御」のパターン
        new RegExp(`(?<stat1>${statPattern})(?:と|・|、)(?<stat2>${statPattern})(?:と|・|、)?(?<stat3>${statPattern})?(?:が|を|の)?`, 'g'),
    ];

    for (const pattern of parallelPatterns) {
        const match = pattern.exec(line);
        if (match && match.groups) {
            const stats = [match.groups.stat1, match.groups.stat2, match.groups.stat3].filter(Boolean);
            if (stats.length >= 2) {
                // 残りの部分（数値や効果など）を抽出
                const remainder = line.slice(match.index + match[0].length);
                const prefix = line.slice(0, match.index);

                // 各statに対して個別の行を生成
                return stats.map(stat => {
                    // 「が」「を」などの助詞を適切に追加
                    const connector = /[がをの]$/.test(match[0]) ? '' : 'が';
                    return `${prefix}${stat}${connector}${remainder}`;
                });
            }
        }
    }

    return [line];
}

export function parseSkillLine(line: string): ParsedBuff[] {
    // 前処理: 全角→半角、表記揺れ正規化
    const preprocessed = preprocessText(line);

    // 並列表記を展開して各行を処理
    const expandedLines = expandParallelStats(preprocessed);

    const allResults: ParsedBuff[] = [];

    for (const expandedLine of expandedLines) {
        const results = parseSkillLineSingle(expandedLine, line);
        allResults.push(...results);
    }

    // 重複除去（展開前の並列パターンで既にマッチしている場合を考慮）
    const unique = new Map<string, ParsedBuff>();
    allResults.forEach(r => {
        const k = `${r.stat}-${r.target}-${r.value}-${r.mode}-${r.inspireSourceStat ?? ''}`;
        if (!unique.has(k)) {
            unique.set(k, r);
        }
    });

    return Array.from(unique.values());
}

function parseSkillLineSingle(line: string, originalLine: string): ParsedBuff[] {
    const results: ParsedBuff[] = [];
    const seen = new Set<string>();
    const detectedTarget = detectTarget(line);
    // 効果重複の位置を検出（その位置より前のバフにのみ適用）
    const duplicateMatch = originalLine.match(/効果重複|同種効果重複|同種効果と重複|重複可|重複可能/);
    const duplicatePosition = duplicateMatch ? originalLine.indexOf(duplicateMatch[0]) : -1;
    const isExplicitlyNonDuplicate = /同種効果の重複無し|重複不可/.test(originalLine);
    const nonStacking = /重複なし/.test(originalLine) || isExplicitlyNonDuplicate;
    const stackPenaltyMatch = originalLine.match(/重複時効果(\d+)%減少/);
    const stackPenalty = stackPenaltyMatch ? Number(stackPenaltyMatch[1]) : undefined;
    const requiresAmbush = /伏兵の射程内/.test(originalLine);
    const maxStacksMatch = originalLine.match(/[（(](\d+)回まで[）)]/);
    const maxStacks = maxStacksMatch ? Number(maxStacksMatch[1]) : undefined;
    const stackableTrigger = /(敵撃破(?:毎|ごと)に|巨大化(?:毎|ごと)に|配置(?:毎|ごと)に)/.test(originalLine);

    const conditionTags = extractConditionTags(originalLine);
    const hasCondition = conditionTags.length > 0;

    patterns.forEach((p: ParsedPattern) => {
        let match: RegExpExecArray | null;
        const regex = new RegExp(p.regex, 'g');
        while ((match = regex.exec(line)) !== null) {
            const rawVal = match[1] ?? '0';
            const value = p.valueTransform ? p.valueTransform(match) : Number(rawVal);
            if (p.mode === 'flat_sum' && match[0].includes('%')) continue; // %表記はflat除外
            const key = `${p.stat}-${match.index}-${match[0]}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const parsedTarget: Target = p.target ?? detectedTarget.target;

            const dynamicInfo = detectDynamicBuff(line, value);

            // 効果重複はその位置より前のバフにのみ適用
            const buffEndPosition = match.index + match[0].length;
            const isDuplicate = duplicatePosition >= 0 && buffEndPosition <= duplicatePosition;

            const base: ParsedBuff = {
                stat: p.stat,
                mode: p.mode,
                target: parsedTarget,
                value,
                unit: p.unit,
                isSpecial: false,
                hasCondition,
                conditionText: hasCondition ? line : undefined,
                conditionTags: conditionTags.length ? conditionTags : undefined,
                note: detectedTarget.note ?? p.note,
                rawText: match[0],
                costType: p.costType,
                inspireSourceStat: p.inspireSourceStat,
                isDuplicate,
                isExplicitlyNonDuplicate,
                nonStacking,
                stackPenalty,
                stackable: stackableTrigger || Boolean(maxStacks),
                maxStacks,
                requiresAmbush: requiresAmbush || /伏兵/.test(match[0]) || dynamicInfo?.dynamicType === 'per_ambush_deployed',
                confidence: detectedTarget.confidence,
                inferenceReason: detectedTarget.inferenceReason,
                ...dynamicInfo,
            };

            if (base.stackable && base.maxStacks) {
                base.value = base.value * base.maxStacks;
                const stackNote = `最大${base.maxStacks}回スタック時の値`;
                base.note = base.note ? `${base.note}／${stackNote}` : stackNote;
            }

            // 気バフは常にフィールド対象
            if (base.stat === 'cost') {
                base.target = 'field';
            }

            results.push(base);

            // 鼓舞: 攻撃と防御の両方を加算する場合に防御分も生成
            if (p.stat === 'inspire' && p.inspireSourceStat === 'attack' && /攻撃と防御/.test(match[0])) {
                results.push({
                    ...base,
                    inspireSourceStat: 'defense',
                });
            }
        }
    });

    // 対象への倍率適用（自身に対しては効果1.5倍、対象には効果2倍など）
    const targetMultiplierMatch = line.match(/(自身|対象|射程内(?:の)?(?:城娘)?|範囲内(?:の)?(?:城娘)?)(?:に対して)?(?:は|には)?効果(\d+(?:\.\d+)?)倍/);
    if (targetMultiplierMatch) {
        const targetKeyword = targetMultiplierMatch[1];
        const multiplier = parseFloat(targetMultiplierMatch[2]);

        // 対象キーワードをTarget型にマッピング
        let multiplierTarget: Target = 'self';
        if (targetKeyword === '対象') {
            multiplierTarget = 'ally';
        } else if (/射程内/.test(targetKeyword) || /範囲内/.test(targetKeyword)) {
            multiplierTarget = 'range';
        }

        const transformed: ParsedBuff[] = [];
        results.forEach(buff => {
            if (buff.target === 'field') {
                transformed.push(buff);
                return;
            }
            if (buff.target === multiplierTarget) {
                transformed.push({ ...buff, value: buff.value * multiplier });
                return;
            }

            // multiplierTarget以外の対象はそのまま
            if (multiplierTarget === 'self') {
                const updatedTags = new Set(buff.conditionTags ?? []);
                updatedTags.add('exclude_self');

                transformed.push({
                    ...buff,
                    conditionTags: Array.from(updatedTags),
                });

                transformed.push({
                    ...buff,
                    target: 'self',
                    value: buff.value * multiplier,
                    conditionTags: (buff.conditionTags ?? []).filter(tag => tag !== 'exclude_self'),
                    rawText: `${buff.rawText}(自身効果${multiplier}倍)`,
                });
            } else {
                transformed.push(buff);
            }
        });
        results.length = 0;
        results.push(...transformed);
    }

    // 重複除去（内容が同じものは1つにまとめる）
    const unique = new Map<string, ParsedBuff>();
    results.forEach(r => {
        const k = `${r.stat}-${r.target}-${r.rawText}-${r.inspireSourceStat ?? ''}`;
        const existing = unique.get(k);
        if (!existing) {
            unique.set(k, r);
            return;
        }
        // 優先度: percent_max > percent_reduction > flat_sum
        const rank = (m: string) => {
            if (m === 'absolute_set') return 3;
            if (m === 'percent_max') return 2;
            if (m === 'percent_reduction') return 1;
            return 0;
        };
        if (rank(r.mode) > rank(existing.mode)) {
            unique.set(k, r);
        }
    });

    return Array.from(unique.values());
}
