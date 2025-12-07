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

function detectDynamicBuff(text: string, value: number): Partial<ParsedBuff> | null {
    const dynamicPatterns: Array<{ regex: RegExp; type: DynamicBuffType; category: 'formation' | 'combat_situation' }> = [
        { regex: /味方\d*体につき/, type: 'per_ally_other', category: 'formation' },
        { regex: /射程内味方\d*体毎に|射程内味方\d*体ごとに/, type: 'per_ally_in_range', category: 'formation' },
        { regex: /射程内敵\d*体毎に|射程内敵\d*体ごとに/, type: 'per_enemy_in_range', category: 'combat_situation' },
        { regex: /伏兵.*?体につき|伏兵が配置されている/, type: 'per_ambush_deployed', category: 'formation' },
        { regex: /撃破した敵\d*体毎に|敵\d*体撃破するごとに/, type: 'per_enemy_defeated', category: 'combat_situation' },
        { regex: /特定属性の城娘\d*体毎に/, type: 'per_specific_attribute', category: 'formation' },
        { regex: /特定武器種の城娘\d*体毎に/, type: 'per_specific_weapon', category: 'formation' },
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

export function parseSkillLine(line: string): ParsedBuff[] {
    const results: ParsedBuff[] = [];
    const seen = new Set<string>();
    const detectedTarget = detectTarget(line);
    const isDuplicate = /効果重複|同種効果重複|同種効果と重複|重複可|重複可能/.test(line);
    const isExplicitlyNonDuplicate = /同種効果の重複無し|重複不可/.test(line);
    const nonStacking = /重複なし/.test(line) || isExplicitlyNonDuplicate;
    const stackPenaltyMatch = line.match(/重複時効果(\d+)%減少/);
    const stackPenalty = stackPenaltyMatch ? Number(stackPenaltyMatch[1]) : undefined;
    const requiresAmbush = /伏兵の射程内/.test(line);
    const maxStacksMatch = line.match(/[（(](\d+)回まで[）)]/);
    const maxStacks = maxStacksMatch ? Number(maxStacksMatch[1]) : undefined;
    const stackableTrigger = /(敵撃破(?:毎|ごと)に|巨大化(?:毎|ごと)に|配置(?:毎|ごと)に)/.test(line);

    const conditionTags = extractConditionTags(line);
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

    // 自身への倍率適用（自身に対しては効果1.5倍など）
    const selfMultiplierMatch = line.match(/自身(?:に対して)?(?:は|には)?効果(\d+(?:\.\d+)?)倍/);
    if (selfMultiplierMatch) {
        const multiplier = parseFloat(selfMultiplierMatch[1]);
        const transformed: ParsedBuff[] = [];
        results.forEach(buff => {
            if (buff.target === 'field') {
                transformed.push(buff);
                return;
            }
            if (buff.target === 'self') {
                transformed.push({ ...buff, value: buff.value * multiplier });
                return;
            }

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
