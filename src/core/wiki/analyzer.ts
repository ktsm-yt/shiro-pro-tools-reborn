import type { Character, Buff, Target } from '../types';
import type { RawCharacterData } from './types';
import { parseSkillLine } from '../parser/buffParser';
import { convertToRebornBuff } from '../parser/converter';

let buffIdCounter = 0;

/**
 * 射程→攻撃変換パターンを検出する
 * 例: "自身の射程の値を攻撃に加算" → { enabled: true }
 * 例: "射程が1000以上の場合与えるダメージが1.5倍" + 上記 → { enabled: true, threshold: 1000 }
 */
function detectRangeToAttack(texts: string[]): { enabled: boolean; threshold?: number } | undefined {
    if (!texts || texts.length === 0) return undefined;
    const combinedText = texts.join(' ');

    // 射程→攻撃変換パターン
    if (!/射程の?値を攻撃に加算/.test(combinedText)) {
        return undefined;
    }

    // 閾値パターン: "射程が1000以上の場合" など（攻撃加算用）
    // 注: "与えるダメージ" が含まれている場合は別の条件（conditionalGiveDamage）なので除外
    const thresholdMatch = combinedText.match(/射程[がを]?(\d+)以上の?場合(?!.*与えるダメージ)/);
    const threshold = thresholdMatch ? parseInt(thresholdMatch[1], 10) : undefined;

    return { enabled: true, threshold };
}

/**
 * 条件付き与えるダメージを検出する
 * 例: "自身の射程が1000以上の場合与えるダメージが2倍"
 * → [{ rangeThreshold: 1000, multiplier: 2 }]
 */
function detectConditionalGiveDamage(texts: string[]): { rangeThreshold: number; multiplier: number }[] | undefined {
    if (!texts || texts.length === 0) return undefined;
    const combinedText = texts.join(' ');

    const results: { rangeThreshold: number; multiplier: number }[] = [];

    // 射程条件パターン: "射程が○以上の場合与えるダメージが○倍"
    const rangePattern = /射程[がを]?(\d+)以上の?場合.*?与えるダメージ(?:が|を)?\s*(\d+(?:\.\d+)?)倍/g;
    let match;
    while ((match = rangePattern.exec(combinedText)) !== null) {
        results.push({
            rangeThreshold: parseInt(match[1], 10),
            multiplier: parseFloat(match[2]),
        });
    }

    return results.length > 0 ? results : undefined;
}

/**
 * 特殊攻撃テキストから倍率と防御無視フラグを抽出する
 * 例: "攻撃の6倍の防御無視ダメージ" → { multiplier: 6, defenseIgnore: true, cycleN: 3, hits: 1 }
 * 例: "攻撃の2.5倍のダメージを与える攻撃を2連続で行う" → { multiplier: 2.5, hits: 2 }
 * 例: "1.3倍の射程で" → { rangeMultiplier: 1.3 }
 * 例: "ダメージと攻撃上昇量が増加（最大3倍）" → { stackMultiplier: 3 }
 */
function parseSpecialAttackText(texts: string[]): { multiplier: number; hits: number; defenseIgnore: boolean; cycleN: number; rangeMultiplier?: number; stackMultiplier?: number } | undefined {
    if (!texts || texts.length === 0) return undefined;

    const combinedText = texts.join(' ');

    // 攻撃の○倍 パターン
    const multiplierMatch = combinedText.match(/攻撃(?:力)?の?(\d+(?:\.\d+)?)倍/);
    if (!multiplierMatch) return undefined;

    const multiplier = parseFloat(multiplierMatch[1]);

    // 連撃数パターン（デフォルト: 1）
    // 例: "2連続で行う", "2連撃", "3連続攻撃"
    let hits = 1;
    const hitsMatch = combinedText.match(/(\d+)連(?:続|撃)/);
    if (hitsMatch) {
        hits = parseInt(hitsMatch[1], 10);
    }

    // 防御無視 判定
    const defenseIgnore = /防御[を]?無視/.test(combinedText);

    // N回に1回 パターン（デフォルト: 3）
    let cycleN = 3;
    const cycleMatch = combinedText.match(/(\d+)回(?:に|ごとに)1回/);
    if (cycleMatch) {
        cycleN = parseInt(cycleMatch[1], 10);
    }

    // 射程倍率 パターン（例: "1.3倍の射程で" or "射程が1.3倍"）
    let rangeMultiplier: number | undefined;
    const rangeMatch = combinedText.match(/(\d+(?:\.\d+)?)倍の射程/) || combinedText.match(/射程[がを]?(\d+(?:\.\d+)?)倍/);
    if (rangeMatch) {
        rangeMultiplier = parseFloat(rangeMatch[1]);
    }

    // スタック倍率 パターン（例: "最大3倍" "（最大3倍）"）
    // ストック消費時の最大倍率を検出
    let stackMultiplier: number | undefined;
    const stackMatch = combinedText.match(/[（(]?最大(\d+(?:\.\d+)?)倍[）)]?/);
    if (stackMatch) {
        stackMultiplier = parseFloat(stackMatch[1]);
    }

    return { multiplier, hits, defenseIgnore, cycleN, rangeMultiplier, stackMultiplier };
}

/**
 * 伏兵配置情報を検出する（千賀地氏城など）
 * 例: "伏兵を配置（2体まで）" + "配置中、自身の攻撃と攻撃速度が40%上昇（同種効果と重複）"
 * → { maxCount: 2, attackMultiplier: 1.4, attackSpeedMultiplier: 1.4, isMultiplicative: true }
 */
function detectAmbushPlacement(
    strategyTexts: string[],
    skillTexts?: string[]
): {
    maxCount: number;
    attackMultiplier?: number;
    attackSpeedMultiplier?: number;
    isMultiplicative: boolean;
} | undefined {
    const allTexts = [...(strategyTexts || []), ...(skillTexts || [])];
    if (allTexts.length === 0) return undefined;

    const combinedText = allTexts.join(' ');
    const strategyText = (strategyTexts || []).join(' ');

    // 伏兵配置パターン（計略から）
    // パターン1: 「伏兵を配置（2体まで）」
    // パターン2: 「最大2体配置可能」（伏兵テキスト内）
    let ambushMatch = strategyText.match(/伏兵(?:を)?配置[^（(]*[（(](\d+)体まで[）)]/);

    // パターン2: 伏兵情報として「最大N体配置可能」が記載されている場合
    if (!ambushMatch) {
        // 伏兵関連のテキストであることを確認
        if (/伏兵/.test(combinedText) || /敵から狙われ(?:ない|ず)/.test(strategyText)) {
            ambushMatch = strategyText.match(/最大(\d+)体配置(?:可能)?/);
        }
    }

    if (!ambushMatch) return undefined;

    const maxCount = parseInt(ambushMatch[1], 10);

    // 配置中のバフを探す（計略から）
    // 例: "配置中、自身の攻撃と攻撃速度が40%上昇（同種効果と重複）"
    const buffMatch = strategyText.match(/配置中[、,]?[^。]*(?:攻撃(?:と攻撃速度)?(?:が|を)?(\d+)[%％]上昇)/);

    let attackMultiplier: number | undefined;
    let attackSpeedMultiplier: number | undefined;

    if (buffMatch) {
        const buffPercent = parseInt(buffMatch[1], 10);
        attackMultiplier = 1 + buffPercent / 100; // 40% → 1.4

        // 攻撃速度も含むかチェック
        const hasAttackSpeed = /攻撃と攻撃速度/.test(strategyText) || /攻撃速度[がを]?\d+[%％]上昇/.test(strategyText);
        attackSpeedMultiplier = hasAttackSpeed ? attackMultiplier : undefined;
    }

    // 同種効果と重複 → 累乗計算
    const isMultiplicative = /同種効果(?:と)?重複/.test(combinedText);

    return {
        maxCount,
        attackMultiplier,
        attackSpeedMultiplier,
        isMultiplicative,
    };
}

/**
 * 計略ダメージテキストから計略発動時の攻撃情報を抽出する
 * 例: "1.5倍の射程で射程内全敵に攻撃の2倍の5連続攻撃"
 *     → { multiplier: 2, hits: 5, rangeMultiplier: 1.5, ... }
 * 例: "敵の耐久が低い程与えるダメージ上昇(最大2.5倍)"
 *     → { maxMultiplier: 2.5 }
 */
function parseStrategyDamageText(texts: string[]): {
    multiplier: number;
    hits: number;
    maxMultiplier?: number;
    defenseIgnore: boolean;
    rangeMultiplier?: number;
    cycleDuration: number;
    buffDuration?: number;
    buffGiveDamage?: number;    // 与えるダメージ（Phase 2乗算）
    buffDamageDealt?: number;   // 与ダメ（Phase 4最大値）
    buffAttackSpeed?: number;
    buffAttackGap?: number;     // 攻撃後の隙短縮（%）
} | undefined {
    if (!texts || texts.length === 0) return undefined;

    const combinedText = texts.join(' ');

    // 「攻撃の○倍の○連続攻撃」パターン
    const strategyDamageMatch = combinedText.match(/攻撃(?:力)?の?(\d+(?:\.\d+)?)倍の?(\d+)連(?:続)?攻撃/);
    if (!strategyDamageMatch) return undefined;

    const multiplier = parseFloat(strategyDamageMatch[1]);
    const hits = parseInt(strategyDamageMatch[2], 10);

    // 防御無視 判定
    const defenseIgnore = /防御[を]?無視/.test(combinedText);

    // 射程倍率 パターン
    let rangeMultiplier: number | undefined;
    const rangeMatch = combinedText.match(/(\d+(?:\.\d+)?)倍の射程/) || combinedText.match(/射程[がを]?(\d+(?:\.\d+)?)倍/);
    if (rangeMatch) {
        rangeMultiplier = parseFloat(rangeMatch[1]);
    }

    // 最大倍率（HP依存等） パターン: "最大○倍" or "最大○.○倍"
    let maxMultiplier: number | undefined;
    const maxMatch = combinedText.match(/最大(\d+(?:\.\d+)?)倍/);
    if (maxMatch) {
        maxMultiplier = parseFloat(maxMatch[1]);
    }

    // 効果時間（バフ持続） パターン: "○秒間"
    let buffDuration: number | undefined;
    const durationMatch = combinedText.match(/(\d+)秒間/);
    if (durationMatch) {
        buffDuration = parseInt(durationMatch[1], 10);
    }

    // サイクル時間（デフォルトはバフ持続時間、なければ10秒）
    const cycleDuration = buffDuration || 10;

    // 与えるダメージ（Phase 2乗算）と与ダメ（Phase 4最大値）を区別
    let buffGiveDamage: number | undefined;   // 与えるダメージ（Phase 2）
    let buffDamageDealt: number | undefined;  // 与ダメ（Phase 4）
    let buffAttackSpeed: number | undefined;

    // 複合パターン: "与ダメ/攻撃速度○倍" → 与ダメ（Phase 4）
    const comboMatch = combinedText.match(/与ダメ[/／]攻撃速度[がを]?(\d+(?:\.\d+)?)倍/);
    if (comboMatch) {
        buffDamageDealt = parseFloat(comboMatch[1]);  // 与ダメはPhase 4
        buffAttackSpeed = parseFloat(comboMatch[1]);
    } else {
        // 「与えるダメージ」を先にチェック（Phase 2乗算）
        const giveDamageMatch = combinedText.match(/与えるダメージ[がを]?(\d+(?:\.\d+)?)倍/);
        if (giveDamageMatch) {
            buffGiveDamage = parseFloat(giveDamageMatch[1]);
        }

        // 「与ダメ」単独パターン（Phase 4最大値）
        // 「与えるダメージ」にマッチしなかった場合のみ
        if (!giveDamageMatch) {
            const damageDealtMatch = combinedText.match(/与ダメ(?:ージ)?[がを]?(\d+(?:\.\d+)?)倍/);
            if (damageDealtMatch) {
                buffDamageDealt = parseFloat(damageDealtMatch[1]);
            }
        }

        // 攻撃速度倍率 パターン: "攻撃速度○倍"
        const speedMatch = combinedText.match(/攻撃速度[がを]?(\d+(?:\.\d+)?)倍/);
        if (speedMatch) {
            buffAttackSpeed = parseFloat(speedMatch[1]);
        }
    }

    // 攻撃後の隙短縮 パターン: "隙○%短縮" or "攻撃後の隙○%短縮"
    let buffAttackGap: number | undefined;
    const gapMatch = combinedText.match(/(?:攻撃後の)?隙[がを]?\s*(\d+)[%％](?:短縮|減少)/);
    if (gapMatch) {
        buffAttackGap = parseInt(gapMatch[1], 10);
    }

    return {
        multiplier,
        hits,
        maxMultiplier,
        defenseIgnore,
        rangeMultiplier,
        cycleDuration,
        buffDuration,
        buffGiveDamage,
        buffDamageDealt,
        buffAttackSpeed,
        buffAttackGap,
    };
}

/**
 * 特殊能力モード（計略発動中の通常攻撃置換）を検出する
 * 例: ［竜焔］仙台城の計略
 * "60秒間自身の攻撃後の隙80%短縮、与えるダメージ1.2倍
 *  自身の攻撃の2.5倍のダメージを与える攻撃を2連続で行う"
 * → { replacedAttack: { multiplier: 2.5, hits: 2 }, giveDamage: 20, gapReduction: 80, duration: 60, cooldown: 60 }
 */
function detectAbilityMode(strategyTexts: string[]): {
    replacedAttack: { multiplier: number; hits: number };
    giveDamage?: number;
    gapReduction?: number;
    duration: number;
    cooldown: number;
} | undefined {
    if (!strategyTexts || strategyTexts.length === 0) return undefined;

    const combinedText = strategyTexts.join(' ');

    // 「○秒間」パターン（必須）
    const durationMatch = combinedText.match(/(\d+)秒間/);
    if (!durationMatch) return undefined;
    const duration = parseInt(durationMatch[1], 10);

    // 「隙○%短縮」パターン（置換モードの強い指標）
    let gapReduction: number | undefined;
    const gapMatch = combinedText.match(/(?:攻撃後の)?隙[がを]?\s*(\d+)[%％](?:短縮|減少)/);
    if (gapMatch) {
        gapReduction = parseInt(gapMatch[1], 10);
    }

    // 「与えるダメージ○倍」パターン（Phase 2 give_damage）
    let giveDamage: number | undefined;
    const giveDamageMatch = combinedText.match(/与(?:える)?ダメージ[がを]?\s*(\d+(?:\.\d+)?)倍/);
    if (giveDamageMatch) {
        const multiplier = parseFloat(giveDamageMatch[1]);
        giveDamage = Math.round((multiplier - 1) * 100); // 1.2倍 → 20%
    }

    // 「攻撃の○倍のダメージを与える攻撃を○連続で行う」パターン
    // これは計略中の「置換攻撃」（特殊攻撃とは別）
    const replacedAttackMatch = combinedText.match(
        /攻撃(?:力)?の?\s*(\d+(?:\.\d+)?)倍(?:の)?ダメージ(?:を与える攻撃)?[をが]?\s*(\d+)連(?:続|撃)(?:で(?:行う)?)?/
    );
    if (!replacedAttackMatch) {
        // 隙短縮があってもreplacedAttackがなければabilityModeではない
        return undefined;
    }

    const replacedAttack = {
        multiplier: parseFloat(replacedAttackMatch[1]),
        hits: parseInt(replacedAttackMatch[2], 10),
    };

    // CT（再使用時間）= duration と同じと仮定（Wikiに記載されている場合は抽出）
    // TODO: CTが異なる場合の対応
    const cooldown = duration;

    return {
        replacedAttack,
        giveDamage,
        gapReduction,
        duration,
        cooldown,
    };
}

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

    // 効果重複の検出は parseSkillLine 内で位置ベースで行われる
    // （「攻撃2.5倍(効果重複), 射程1.3倍」のような括弧付きパターンも正しく処理）

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

            // 効果重複の処理は parseSkillLine で位置ベースで行われるため、
            // ここでの変換は不要（括弧付きの効果重複は直前のバフにのみ適用される）

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
        const tagKey = buff.conditionTags?.join(',') ?? '';
        const key = `${buff.stat}-${buff.mode}-${buff.value}-${buff.target}-${buff.costType ?? ''}-${buff.inspireSourceStat ?? ''}-${tagKey}`;
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
    for (const skillText of (rawData.skillTexts ?? [])) {
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
    for (const strategyText of (rawData.strategyTexts ?? [])) {
        // 計略の対象は最後の()内の文章で決まる
        // 例: "30秒間対象の射程が1.3倍（自分のみが対象）" → target = 'self'
        const strategyTargetOverride = extractStrategyTarget(strategyText);

        const buffTemplates = analyzeBuffText(strategyText);
        for (const template of buffTemplates) {
            // 計略の()内で「自分」指定の場合、targetを'self'に上書き
            // ただし敵デバフ（enemy_*）は射程内の敵が対象なので上書きしない
            const isEnemyDebuff = template.stat.startsWith('enemy_');
            const finalTarget = (strategyTargetOverride === 'self' && !isEnemyDebuff) ? 'self' : template.target;
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

    // 特殊攻撃情報を解析
    const specialAttack = parseSpecialAttackText(rawData.specialAttackTexts ?? []);

    // 射程→攻撃変換を検出（特技テキストから）
    const rangeToAttack = detectRangeToAttack(rawData.skillTexts ?? []);

    // 条件付き与えるダメージを検出（特技・計略テキストから）
    const allTextsForConditional = [
        ...(rawData.skillTexts ?? []),
        ...(rawData.strategyTexts ?? []),
    ];
    const conditionalGiveDamage = detectConditionalGiveDamage(allTextsForConditional);

    // 特殊攻撃の射程倍率をバフとして追加
    if (specialAttack?.rangeMultiplier && specialAttack.rangeMultiplier > 1) {
        const rangePercentBuff = (specialAttack.rangeMultiplier - 1) * 100;
        specials.push({
            id: `buff_${buffIdCounter++}`,
            stat: 'range',
            mode: 'percent_max',
            value: rangePercentBuff,
            target: 'self',
            source: 'special_ability',
            isActive: true,
            note: '特殊攻撃射程',
        });
    }

    // 計略ダメージ情報を解析
    const strategyDamage = parseStrategyDamageText(rawData.strategyTexts ?? []);

    // 特殊能力モード（計略発動中の通常攻撃置換）を検出
    const abilityMode = detectAbilityMode(rawData.strategyTexts ?? []);

    // 伏兵配置情報を解析（計略・特技テキストから）
    const ambushInfo = detectAmbushPlacement(
        rawData.strategyTexts ?? [],
        rawData.skillTexts ?? []
    );

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
        specialAttack,
        rangeToAttack: rangeToAttack || undefined,
        conditionalGiveDamage: conditionalGiveDamage || undefined,
        strategyDamage,
        abilityMode: abilityMode || undefined,
        ambushInfo: ambushInfo || undefined,
        rawSkillTexts: rawData.skillTexts,
        rawStrategyTexts: rawData.strategyTexts,
        rawSpecialTexts: rawData.specialTexts,
    };
}
