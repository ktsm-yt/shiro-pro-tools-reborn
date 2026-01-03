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
    benefitsOnlySelf?: boolean;   // 敵デバフだが自分だけが恩恵を受ける（自分のみ）
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
 * 例: "与ダメージ/攻撃速度2.5倍" → ["与ダメージ2.5倍", "攻撃速度2.5倍"]
 */
function expandParallelStats(line: string): string[] {
    // 鼓舞パターン（自身の攻撃と防御の○%...加算）は展開しない
    if (/自身の(?:攻撃|防御)(?:と|・)(?:攻撃|防御)の\d+[%％].*?加算/.test(line)) {
        return [line];
    }

    // 「攻撃N%とM(効果重複)」のパターンを検出・展開
    // 例: "攻撃5%と70(効果重複)" → ["攻撃5%(効果重複)", "攻撃+70"]
    // 効果重複は%部分のみに引き継ぐ
    const percentAndFlatPattern = /(攻撃|防御|射程)(\d+)[%％]と(\d+)([（(]効果重複[）)])?/;
    const percentAndFlatMatch = line.match(percentAndFlatPattern);
    if (percentAndFlatMatch) {
        const stat = percentAndFlatMatch[1];
        const percent = percentAndFlatMatch[2];
        const flat = percentAndFlatMatch[3];
        const duplicate = percentAndFlatMatch[4] || ''; // 効果重複マーカー
        const matchStart = line.indexOf(percentAndFlatMatch[0]);
        const matchEnd = matchStart + percentAndFlatMatch[0].length;
        const remainder = line.slice(matchEnd);
        const prefix = line.slice(0, matchStart);
        return [
            `${prefix}${stat}${percent}%${duplicate}${remainder}`,  // 効果重複は%のみ
            `${prefix}${stat}+${flat}${remainder}`                   // 固定値は効果重複なし
        ];
    }

    // 並列パターンの検出
    // 注意: 長いパターン（攻撃速度、移動速度、与ダメージ）を先に配置すること
    const statPattern = '与ダメ(?:ージ)?|被ダメ(?:ージ)?|攻撃速度|移動速度|攻撃(?:力)?|防御(?:力)?|射程|回復|耐久';
    const parallelPatterns = [
        // 「与ダメージ/攻撃速度」のスラッシュ区切りパターン
        new RegExp(`(?<stat1>${statPattern})(?:/|／)(?<stat2>${statPattern})(?:/|／)?(?<stat3>${statPattern})?(?:が|を)?`, 'g'),
        // 「攻撃と防御」「攻撃・防御」のパターン
        new RegExp(`(?<stat1>${statPattern})(?:と|・|、)(?<stat2>${statPattern})(?:と|・|、)?(?<stat3>${statPattern})?(?:が|を|の)?`, 'g'),
    ];

    for (const pattern of parallelPatterns) {
        const match = pattern.exec(line);
        if (match && match.groups) {
            const stats = [match.groups.stat1, match.groups.stat2, match.groups.stat3].filter(Boolean);
            if (stats.length >= 2) {
                // 残りの部分（数値や効果など）を抽出
                let remainder = line.slice(match.index + match[0].length);
                const prefix = line.slice(0, match.index);

                // 未認識のstat（例: "範囲攻撃の範囲"）で始まる場合、数値部分のみを抽出
                // "範囲攻撃の範囲2倍" → "2倍"
                const unrecognizedPrefixMatch = remainder.match(/^[^0-9]*?(\d+(?:\.\d+)?(?:倍|[%％]))/);
                if (unrecognizedPrefixMatch && unrecognizedPrefixMatch.index === 0) {
                    // 数値部分のみを残す
                    const valueMatch = remainder.match(/(\d+(?:\.\d+)?(?:倍|[%％]).*)/);
                    if (valueMatch) {
                        remainder = valueMatch[1];
                    }
                }

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

// タグ名からConditionTagへのマッピング
const TAG_TO_CONDITION: Record<string, ConditionTag> = {
    '絢爛': 'kenran',
    '夏': 'summer',
    'ハロウィン': 'halloween',
    '学園': 'school',
    '聖夜': 'christmas',
    '正月': 'new_year',
    'お月見': 'moon_viewing',
    '花嫁': 'bride',
    '水': 'water',
    '平': 'plain',
    '山': 'mountain',
    '平山': 'plain_mountain',
    '地獄': 'hell',
};

/**
 * 条件付きタグバフを抽出
 * 例: "攻撃40%、［絢爛］城娘は50%上昇" → 50%のkenran条件付きバフ
 */
function extractTagConditionalBuffs(line: string, baseBuffs: ParsedBuff[]): ParsedBuff[] {
    const additionalBuffs: ParsedBuff[] = [];

    // パターン: ［タグ］城娘は○○%上昇 or ［タグ］は○○%
    const tagPattern = /[［\[]([^\]］]+)[］\]](?:城娘)?(?:は|には)(\d+)[%％]?(?:上昇|増加)?/g;
    let match;

    while ((match = tagPattern.exec(line)) !== null) {
        const tagName = match[1];
        const value = parseInt(match[2]);
        const conditionTag = TAG_TO_CONDITION[tagName];

        if (!conditionTag) continue;

        // 対応する基本バフを探してクローン
        for (const baseBuff of baseBuffs) {
            // 攻撃・防御などのstatに対応するタグ付きバフを生成
            if (baseBuff.stat === 'attack' || baseBuff.stat === 'defense') {
                const newBuff: ParsedBuff = {
                    ...baseBuff,
                    value,
                    conditionTags: [conditionTag],
                    hasCondition: true,
                    conditionText: match[0],
                    note: `${tagName}城娘`,
                };
                additionalBuffs.push(newBuff);
                break; // 1つの基本バフに対して1つの条件付きバフ
            }
        }
    }

    return additionalBuffs;
}

/**
 * 文ごとの条件タグとターゲットを検出
 * 「全近接城娘の」→ melee, 「全架空城の」→ fictional
 */
interface SentenceContext {
    conditionTags: ConditionTag[];
    target: Target | null; // nullの場合はデフォルトのターゲット検出を使う
    isSelfOnly: boolean;
}

function splitByRepeatedConditionHeaders(sentence: string): string[] {
    const headerRegex = /(全?近接(?:城娘)?の|全?遠隔(?:城娘)?の|全?架空(?:城|属性(?:の城娘)?)?の)/g;
    const matches = Array.from(sentence.matchAll(headerRegex));
    if (matches.length <= 1) return [sentence];

    const segments: string[] = [];
    const firstIndex = matches[0]?.index ?? 0;
    if (firstIndex > 0) {
        const prefix = sentence.slice(0, firstIndex).trim();
        if (prefix) segments.push(prefix);
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i]?.index ?? 0;
        const end = i + 1 < matches.length ? (matches[i + 1]?.index ?? sentence.length) : sentence.length;
        const segment = sentence.slice(start, end).trim();
        if (segment) segments.push(segment);
    }

    return segments;
}

function detectSentenceContext(sentence: string): SentenceContext {
    const tags: ConditionTag[] = [];
    let target: Target | null = null;
    let isSelfOnly = false;

    // 「自身の」で始まる文は自分専用
    if (/^自身の/.test(sentence.trim())) {
        isSelfOnly = true;
        target = 'self';
    }

    // 「全近接城娘」「近接城娘」
    if (/全?近接(?:城娘)?の/.test(sentence)) {
        tags.push('melee');
        target = 'range'; // 全○○城娘 は射程内対象
    }
    // 「全遠隔城娘」「遠隔城娘」
    if (/全?遠隔(?:城娘)?の/.test(sentence)) {
        tags.push('ranged');
        target = 'range';
    }
    // 「全架空城」「架空城」「架空属性の城娘」
    if (/全?架空(?:城|属性(?:の城娘)?)?の/.test(sentence)) {
        tags.push('fictional');
        target = 'range';
    }
    // 他の属性も追加可能

    return { conditionTags: tags, target, isSelfOnly };
}

export function parseSkillLine(line: string): ParsedBuff[] {
    // 前処理: 全角→半角、表記揺れ正規化
    const preprocessed = preprocessText(line);

    // 効果重複の検出は文分割前に行う（「攻撃が50%上昇。効果重複」のようなパターン対応）
    const hasDuplicateMarker = /効果重複|同種効果重複|同種効果と重複|重複可|重複可能|割合重複/.test(preprocessed);

    // 文ごとに分割（。や｡で区切る）
    const sentences = preprocessed.split(/[。｡]/);

    const allResults: ParsedBuff[] = [];

    for (const sentence of sentences) {
        if (!sentence.trim()) continue;

        const segments = splitByRepeatedConditionHeaders(sentence);

        for (const segment of segments) {
            if (!segment.trim()) continue;

            // この文のコンテキストを検出
            const sentenceContext = detectSentenceContext(segment);

            // 並列表記を展開して各行を処理
            const expandedLines = expandParallelStats(segment);

            for (const expandedLine of expandedLines) {
                const results = parseSkillLineSingle(expandedLine, segment, sentenceContext, hasDuplicateMarker);
                allResults.push(...results);
            }
        }
    }

    // 条件付きタグバフを追加（「［絢爛］城娘は50%」など）
    const tagBuffs = extractTagConditionalBuffs(preprocessed, allResults);
    allResults.push(...tagBuffs);

    // 重複除去（展開前の並列パターンで既にマッチしている場合を考慮）
    const unique = new Map<string, ParsedBuff>();
    allResults.forEach(r => {
        // conditionTagsも含めてキーを生成
        const tagKey = r.conditionTags?.join(',') ?? '';
        const k = `${r.stat}-${r.target}-${r.value}-${r.mode}-${r.inspireSourceStat ?? ''}-${tagKey}`;
        if (!unique.has(k)) {
            unique.set(k, r);
        }
    });

    return Array.from(unique.values());
}

function parseSkillLineSingle(line: string, originalLine: string, sentenceContext: SentenceContext = { conditionTags: [], target: null, isSelfOnly: false }, hasDuplicateMarker = false): ParsedBuff[] {
    const results: ParsedBuff[] = [];
    const seen = new Set<string>();
    const detectedTarget = detectTarget(line);
    // 効果重複の検出（展開後の行でチェック）
    // 「割合重複」も同じく効果重複として扱う
    // 展開された line から検出（「攻撃5%と70(効果重複)」→「攻撃+70」では検出されない）
    const duplicateMatch = line.match(/効果重複|同種効果重複|同種効果と重複|重複可|重複可能|割合重複/);
    const duplicatePosition = duplicateMatch ? line.indexOf(duplicateMatch[0]) : -1;
    // 元のセグメントに効果重複があったが、展開で除去された場合は hasDuplicateMarker を無効化
    const originalHadDuplicate = /効果重複|同種効果重複|同種効果と重複|重複可|重複可能|割合重複/.test(originalLine);
    const effectiveHasDuplicateMarker = originalHadDuplicate ? duplicatePosition >= 0 : hasDuplicateMarker;
    const isExplicitlyNonDuplicate = /同種効果の重複無し|重複不可/.test(originalLine);
    const nonStacking = /重複なし/.test(originalLine) || isExplicitlyNonDuplicate;
    const stackPenaltyMatch = originalLine.match(/重複時効果(\d+)%減少/);
    const stackPenalty = stackPenaltyMatch ? Number(stackPenaltyMatch[1]) : undefined;
    const requiresAmbush = /伏兵の射程内/.test(originalLine);
    // 「(自分のみ)」「（自分のみ）」検出 - 敵デバフだが自分だけが恩恵を受ける
    const benefitsOnlySelf = /[（(]自分のみ[）)]/.test(originalLine);
    const maxStacksMatch = originalLine.match(/[（(](\d+)回まで[）)]/);
    const maxStacks = maxStacksMatch ? Number(maxStacksMatch[1]) : undefined;
    const stackableTrigger = /(敵撃破(?:毎|ごと)に|巨大化(?:毎|ごと)に|配置(?:毎|ごと)に)/.test(originalLine);

    // 文ごとの条件タグと全体の条件タグをマージ
    const globalConditionTags = extractConditionTags(originalLine);
    // 自身専用文はグローバルタグを適用しない。文ごとのタグがあればそれを優先。
    let conditionTags: ConditionTag[];
    if (sentenceContext.isSelfOnly) {
        conditionTags = []; // 自身専用なのでタグなし
    } else if (sentenceContext.conditionTags.length > 0) {
        conditionTags = sentenceContext.conditionTags;
    } else {
        conditionTags = globalConditionTags;
    }
    const hasCondition = conditionTags.length > 0;

    // 文コンテキストからターゲットを決定（優先順位: sentenceContext.target > pattern.target > detectedTarget）
    const sentenceTarget = sentenceContext.target;

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

            // ターゲット決定の優先順位: 文コンテキスト > パターン固有 > 検出結果
            let parsedTarget: Target = sentenceTarget ?? p.target ?? detectedTarget.target;

            // 「自身の」がバフの直前にある場合は target: self に上書き（文コンテキストより優先）
            const prefixText = line.slice(Math.max(0, match.index - 15), match.index);
            if (/自身の/.test(prefixText)) {
                parsedTarget = 'self';
            }
            // 「敵に与えるダメージ」は攻撃者（自身）の能力
            if (p.stat === 'give_damage' && /敵に与える/.test(line.slice(Math.max(0, match.index - 5), match.index + match[0].length))) {
                parsedTarget = 'self';
            }
            // 「攻撃後の隙」は自身の能力（ただし文コンテキストで明示的にrangeの場合は維持）
            if (p.stat === 'attack_gap' && !sentenceTarget) {
                parsedTarget = 'self';
            }
            // 「(自分のみ)」「（自分のみが対象）」「(最大2.5倍。自分のみ)」などがテキストにある場合は target: self
            // ただし、敵関連stat（enemy_*）には適用しない
            const isEnemyStat = p.stat.startsWith('enemy_');
            if (!isEnemyStat && (/[（(][^）)]*自分(?:のみ)?(?:が対象)?[^）)]*[）)]/.test(originalLine) || /自分のみ/.test(originalLine))) {
                parsedTarget = 'self';
            }

            const dynamicInfo = detectDynamicBuff(line, value);

            // 効果重複はその位置より前のバフにのみ適用
            // hasDuplicateMarker: 文分割前に「効果重複」が検出された場合（別の文にある場合も対応）
            const buffEndPosition = match.index + match[0].length;
            const isDuplicateInSentence = duplicatePosition >= 0 && buffEndPosition <= duplicatePosition;
            const isDuplicate = isDuplicateInSentence || (effectiveHasDuplicateMarker && duplicatePosition < 0);

            // 効果重複バフ（攻撃・防御・射程）は独立した effect_duplicate_* stat として出力
            const duplicateStatMap: Record<string, string> = {
                'attack': 'effect_duplicate_attack',
                'defense': 'effect_duplicate_defense',
                'range': 'effect_duplicate_range',
            };
            const effectiveStat = (isDuplicate && p.stat in duplicateStatMap)
                ? duplicateStatMap[p.stat] as typeof p.stat
                : p.stat;

            const base: ParsedBuff = {
                stat: effectiveStat,
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
                benefitsOnlySelf: benefitsOnlySelf || undefined,  // 敵デバフだが自分だけが恩恵を受ける
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
