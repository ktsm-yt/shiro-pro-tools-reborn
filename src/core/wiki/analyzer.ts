import type { Character, Buff, Target } from '../types';
import type { RawCharacterData } from './types';
import { parseSkillLine } from '../parser/buffParser';
import { convertToRebornBuff } from '../parser/converter';

let buffIdCounter = 0;

/**
 * 計略テキストの最後の()から対象を抽出する
 * 例: "30秒間対象の射程が1.3倍（自分のみが対象）" → 'self'
 * 例: "対象の攻撃20%上昇（射程内の城娘が対象）" → 'range'
 */
function extractStrategyTarget(text: string): Target | null {
    // 最後の（）または()を抽出
    const match = text.match(/[（(]([^）)]+)[）)](?:[^（()）]*)?$/);
    if (!match) return null;

    const targetText = match[1];

    // 自分のみ / 自身 → 'self'
    if (/自分|自身/.test(targetText)) {
        return 'self';
    }
    // 射程内 / 範囲内 → 'range'
    if (/射程内|範囲内/.test(targetText)) {
        return 'range';
    }
    // 対象 / 味方 → 'ally' (デフォルト)
    if (/対象|味方/.test(targetText)) {
        return 'ally';
    }

    return null;
}

export function analyzeBuffText(text: string): Omit<Buff, 'id' | 'source' | 'isActive'>[] {
    if (!text || text.trim() === '') return [];

    // グローバルなターゲット倍率を抽出（「自身に対しては効果○倍」など）
    // これは全文の末尾に出現し、すべてのセンテンスに適用される
    const globalMultiplierMatch = text.match(/(自身|対象|射程内(?:の)?(?:城娘)?|範囲内(?:の)?(?:城娘)?)(?:に対して)?(?:は|には)?効果(\d+(?:\.\d+)?)倍/);
    let globalTarget: Target | null = null;
    let globalMultiplier: number = 1;

    if (globalMultiplierMatch) {
        const targetKeyword = globalMultiplierMatch[1];
        globalMultiplier = parseFloat(globalMultiplierMatch[2]);

        // ターゲットキーワードをTarget型にマッピング
        if (targetKeyword === '自身') {
            globalTarget = 'self';
        } else if (targetKeyword === '対象') {
            globalTarget = 'ally';
        } else if (/射程内/.test(targetKeyword) || /範囲内/.test(targetKeyword)) {
            globalTarget = 'range';
        }
    }

    // グローバル倍率の記述を削除してから文分割
    // 重要: 文の区切り（。）を保持するため、マッチした部分を「。」に置き換える
    let processedText = text;
    if (globalMultiplierMatch) {
        processedText = processedText.replace(/[。．]?\s*((?:自身|対象|射程内(?:の)?(?:城娘)?|範囲内(?:の)?(?:城娘)?)(?:に対して)?(?:は|には)?効果\d+(?:\.\d+)?倍)[。．]?/g, '。');
    }

    // 「巨大化毎に」の前で分割（句点がない場合に対応）
    // 「巨大化毎に」は分割後の後半に含める
    processedText = processedText.replace(/(巨大化(?:する)?(?:度|ごと|毎|毎に|たび))/g, '。$1');

    const sentences = processedText.split(/[。．]/);
    const allBuffs: Omit<Buff, 'id' | 'source' | 'isActive'>[] = [];

    // 「巨大化毎に」の効果は次の条件マーカーまで継続する
    let isPerGiantScope = false;

    for (const sentence of sentences) {
        if (!sentence.trim()) continue;

        // 新しい条件マーカー（最大化時など）でスコープをリセット
        const isNewCondition = /最大化時|配置時|撤退時|敵撃破時/.test(sentence);
        if (isNewCondition) {
            isPerGiantScope = false;
        }

        // 「巨大化毎に」が出現したらスコープ開始
        if (/巨大化(する)?(度|ごと|毎|毎に|たび)/.test(sentence)) {
            isPerGiantScope = true;
        }

        const parsed = parseSkillLine(sentence);

        if (import.meta.env?.VITE_DEBUG_BUFF === '1') {
            // eslint-disable-next-line no-console
            console.log('[DEBUG_BUFF]', sentence, parsed, { isPerGiantScope });
        }

        parsed.map(convertToRebornBuff).forEach(b => {
            const buff = { ...b };
            if (isPerGiantScope && typeof buff.value === 'number') {
                buff.value = Number((buff.value * 5).toFixed(6));
            }
            allBuffs.push(buff);
        });
    }

    // グローバル倍率を適用
    if (globalTarget && globalMultiplier !== 1) {
        const transformed: Omit<Buff, 'id' | 'source' | 'isActive'>[] = [];

        allBuffs.forEach(buff => {
            if (buff.target === 'field') {
                transformed.push(buff);
                return;
            }

            if (buff.target === globalTarget) {
                // すでに対象が一致している場合は倍率を適用
                transformed.push({ ...buff, value: Number((buff.value * globalMultiplier).toFixed(6)) });
                return;
            }

            // globalTarget='self'の場合、全体/範囲バフを分割
            if (globalTarget === 'self') {
                // 元のバフは自分以外用に残す
                const updatedTags = new Set(buff.conditionTags ?? []);
                updatedTags.add('exclude_self');
                transformed.push({
                    ...buff,
                    conditionTags: Array.from(updatedTags),
                });

                // 自分用のバフを追加（倍率適用）
                transformed.push({
                    ...buff,
                    target: 'self',
                    value: Number((buff.value * globalMultiplier).toFixed(6)),
                    conditionTags: (buff.conditionTags ?? []).filter(tag => tag !== 'exclude_self'),
                });
            } else {
                // 他のケースはそのまま
                transformed.push(buff);
            }
        });

        allBuffs.length = 0;
        allBuffs.push(...transformed);
    }

    // 重複除去
    const uniq = new Map<string, Omit<Buff, 'id' | 'source' | 'isActive'>>();
    allBuffs.forEach(buff => {
        const key = `${buff.stat}-${buff.mode}-${buff.value}-${buff.target}-${buff.costType ?? ''}-${buff.inspireSourceStat ?? ''}`;
        if (!uniq.has(key)) uniq.set(key, buff);
    });

    return Array.from(uniq.values());
}

/**
 * RawCharacterDataをCharacterオブジェクトに変換する
 * @param rawData Wiki解析で得られた生データ
 * @returns Character オブジェクト
 */
export function analyzeCharacter(rawData: RawCharacterData): Character {
    const skills: Buff[] = [];
    const strategies: Buff[] = [];
    const specials: Buff[] = [];
    const seasonAttributes: string[] = [];
    const periodLabel = rawData.period ?? '';

    const addSeasonIfMatched = (keyword: string) => {
        if (periodLabel.includes(keyword) && !seasonAttributes.includes(keyword)) {
            seasonAttributes.push(keyword);
        }
    };

    ['夏', '絢爛', 'ハロウィン', '学園', '聖夜', '正月', 'お月見', '花嫁'].forEach(addSeasonIfMatched);
    // 特技テキストを解析（特技は常時発動なのでisActive: true）
    for (const skillText of rawData.skillTexts) {
        const buffTemplates = analyzeBuffText(skillText);
        for (const template of buffTemplates) {
            skills.push({
                id: `buff_${buffIdCounter++}`,
                ...template,
                source: 'self_skill',
                isActive: true,
            });
        }
    }

    // 計略テキストを解析（発動前提でisActive: true）
    for (const strategyText of rawData.strategyTexts) {
        // 計略の対象は最後の()内の文章で決まる
        // 例: "30秒間対象の射程が1.3倍（自分のみが対象）" → target = 'self'
        const strategyTargetOverride = extractStrategyTarget(strategyText);

        const buffTemplates = analyzeBuffText(strategyText);
        for (const template of buffTemplates) {
            // 計略の()内で「自分」指定の場合、targetを'self'に上書き
            const finalTarget = strategyTargetOverride === 'self' ? 'self' : template.target;
            strategies.push({
                id: `buff_${buffIdCounter++}`,
                ...template,
                target: finalTarget,
                source: 'strategy',
                isActive: true,
            });
        }
    }

    // 特殊能力テキストを解析（特殊能力も常時発動なのでisActive: true）
    if (rawData.specialTexts) {
        for (const specialText of rawData.specialTexts) {
            const buffTemplates = analyzeBuffText(specialText);
            for (const template of buffTemplates) {
                specials.push({
                    id: `buff_${buffIdCounter++}`,
                    ...template,
                    source: 'special_ability',
                    isActive: true,
                });
            }
        }
    }

    return {
        id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: rawData.name,
        imageUrl: rawData.imageUrl,
        rarity: rawData.rarity,
        period: rawData.period,
        seasonAttributes,
        type: 'castle_girl',
        weapon: rawData.weapon,
        weaponRange: rawData.weaponRange,
        weaponType: rawData.weaponType,
        placement: rawData.placement,
        attributes: rawData.attributes,
        baseStats: {
            hp: rawData.baseStats.hp ?? 0,
            attack: rawData.baseStats.attack ?? 0,
            defense: rawData.baseStats.defense ?? 0,
            range: rawData.baseStats.range ?? 0,
            recovery: rawData.baseStats.recovery ?? 0,
            cooldown: rawData.baseStats.cooldown ?? 0,
            cost: rawData.baseStats.cost ?? 0,
            damage_dealt: rawData.baseStats.damage_dealt ?? 0,
            damage_taken: rawData.baseStats.damage_taken ?? 0,
            attack_speed: rawData.baseStats.attack_speed ?? 0,
            attack_gap: rawData.baseStats.attack_gap ?? 0,
            movement_speed: rawData.baseStats.movement_speed ?? 0,
            retreat: rawData.baseStats.retreat ?? 0,
            target_count: rawData.baseStats.target_count ?? 0,
            ki_gain: rawData.baseStats.ki_gain ?? 0,
            damage_drain: rawData.baseStats.damage_drain ?? 0,
            ignore_defense: rawData.baseStats.ignore_defense ?? 0,
        },
        skills,
        strategies,
        specialAbilities: specials,
        rawSkillTexts: rawData.skillTexts,
        rawStrategyTexts: rawData.strategyTexts,
        rawSpecialTexts: rawData.specialTexts,
    };
}
