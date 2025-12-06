import type { RawCharacterData } from './types';

/**
 * HTML文字列からキャラクター情報を抽出する
 * @param html WikiページのHTML
 * @param url 元のURL
 */
export function parseWikiHtml(html: string, url: string): RawCharacterData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. 名前 (h1 or title)
    const title = doc.querySelector('title')?.textContent || '';
    // タイトル形式: "江戸城 - 御城プロジェクトRE Wiki" -> "江戸城"
    // 期間イベント等の接頭辞対応: "［絢爛］江戸城 - ..." -> "江戸城"
    let name = title.split('-')[0].trim() || 'Unknown';
    const periodMatch = name.match(/^［(.+?)］(.+)$/);
    if (periodMatch) {
        name = periodMatch[2].trim();
    }

    // 2. テーブル解析による情報抽出
    // Wikiの構造は揺れが大きいため、全てのテーブルを走査して情報を集める
    const tables = Array.from(doc.querySelectorAll('table'));

    // 城娘の基本情報が入っているメインテーブル（城属性を含むもの）
    const hasText = (el: Element | null, keyword: string) => (el?.textContent || '').includes(keyword);

    // 候補: 武器属性セルを含むテーブル（子テーブルの有無は許可、親テーブルでも許可）
    const mainInfoTable = (() => {
        let chosen: HTMLTableElement | null = null;
        for (let i = tables.length - 1; i >= 0; i--) {
            const table = tables[i] as HTMLTableElement;
            const cells = Array.from(table.querySelectorAll('th,td'));
            if (cells.some(c => hasText(c, '武器属性'))) {
                chosen = table;
                break;
            }
        }
        return chosen;
    })();

    let weapon = 'Unknown';
    const attributes: string[] = [];
    let attributesLocked = false;
    const baseStats: Record<string, number> = {
        hp: 0,
        attack: 0,
        defense: 0,
        range: 0,
        recovery: 0,
        cooldown: 0,
        cost: 0,
        damage_dealt: 0,
        damage_taken: 0,
        attack_speed: 0,
        attack_gap: 0,
        movement_speed: 0,
        knockback: 0,
        target_count: 0,
        ki_gain: 0,
        damage_drain: 0,
        ignore_defense: 0,
    };
    const skillCandidates: { text: string; header: string }[] = [];
    const strategyCandidates: { text: string; header: string }[] = [];
    const specialCandidates: { text: string; header: string }[] = [];

    const fallbackTable = mainInfoTable ? null : tables[0];
    let currentSection: 'skill' | 'strategy' | 'special' | null = null;

    tables.forEach(table => {
        const isMainInfoTable = mainInfoTable ? table === mainInfoTable : false;
        const allowWeaponOrAttrParse = isMainInfoTable || (!mainInfoTable && table === fallbackTable);
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach(row => {
            // ヘッダーと値を抽出
            let header = '';
            let value = '';
            let valueTd: HTMLElement | null = null;

            const th = row.querySelector('th');
            const tds = Array.from(row.querySelectorAll('td'));

            if (th && tds.length > 0) {
                // th + td パターン
                header = th.textContent?.trim() || '';
                value = tds[0].textContent?.trim() || '';
                valueTd = tds[0];
            } else if (tds.length >= 2) {
                // td + td パターン（最初のtdをヘッダーとみなす）
                // ただし、画像のみの場合はヘッダーではない可能性が高い
                const firstTdText = tds[0].textContent?.trim();
                if (firstTdText) {
                    header = firstTdText;
                    value = tds[1].textContent?.trim() || '';
                    valueTd = tds[1];

                    // "初期/巨大化" のように同じステータスが2列並ぶ場合、右側を優先
                    // 例: [耐久][1068/2205][耐久][2242/4630]
                    if (tds.length >= 4) {
                        const thirdTdText = tds[2].textContent?.trim() || '';
                        if (thirdTdText && thirdTdText.replace(/\s+/g, '') === header.replace(/\s+/g, '')) {
                            value = tds[3].textContent?.trim() || value;
                            valueTd = tds[3];
                        }
                    }
                }
            } else if (tds.length === 1) {
                // tdのみのパターン
                value = tds[0].textContent?.trim() || '';
                valueTd = tds[0];
            }

            // --- 情報抽出ロジック ---

            // 武器種
            // ヘッダー・値の両方をチェックする（ヘッダーなしのテーブル対応）
            const checkWeapon = (text: string) => {
                const cleanWeapon = text.replace(/\(.+?\)/g, '').trim();
                if (/^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)$/.test(cleanWeapon)) {
                    if (weapon === 'Unknown') {
                        weapon = cleanWeapon;
                    }
                }
            };
            const isWeaponRow =
                /武器/.test(header) ||
                /武器/.test(value) ||
                /^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)/.test(header) ||
                /^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)/.test(value) ||
                (!header && !!value);
            if (allowWeaponOrAttrParse && weapon === 'Unknown' && isWeaponRow) {
                checkWeapon(header);
                checkWeapon(value);
            }

            // 画像からの抽出（フォールバック）
            if (allowWeaponOrAttrParse && valueTd && weapon === 'Unknown' && isWeaponRow) {
                const imgs = Array.from(valueTd.querySelectorAll('img'));
                for (const img of imgs) {
                    const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                    const match = alt.match(/^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)/);
                    if (match) {
                        weapon = match[1];
                        break;
                    }
                }
            }

            // 城属性
            // ヘッダー・値の両方をチェック
            const checkAttr = (text: string) => {
                // "属性"などの単語を除去して判定
                const cleanText = text.replace(/\s+/g, '').replace(/属性/g, '');

                if (cleanText.includes('平山')) {
                    if (!attributes.includes('平山')) attributes.push('平山');
                } else {
                    if (cleanText.includes('平') && !attributes.includes('平')) attributes.push('平');
                    if (cleanText.includes('山') && !attributes.includes('山')) attributes.push('山');
                    if (cleanText.includes('水') && !attributes.includes('水')) attributes.push('水');
                }
                if (cleanText.includes('地獄') && !attributes.includes('地獄')) attributes.push('地獄');

                // 無属性判定
                if (cleanText.includes('無') && attributes.length === 0) {
                    if (text.includes('属性') || cleanText.includes('無属性') || cleanText === '無') {
                        attributes.push('無属性');
                    }
                }
            };

            const attrPattern = /(平山|平水|平|山|水|地獄|無属性|無)/;
            const isAttrRow = /属性/.test(header) || /属性/.test(value) || attrPattern.test(header) || attrPattern.test(value) || (!header && !!value);

            if (allowWeaponOrAttrParse && !attributesLocked && isAttrRow) {
                const before = attributes.length;
                checkAttr(header);
                checkAttr(value);
                if (attributes.length > before) {
                    attributesLocked = true; // メインテーブルで取得できたら以降のテーブルでは追加しない
                }
            }

            // 画像(alt/title)からの抽出（フォールバック）
            if (allowWeaponOrAttrParse && valueTd && !attributesLocked && isAttrRow) {
                const imgs = Array.from(valueTd.querySelectorAll('img'));
                imgs.forEach(img => {
                    const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                    checkAttr(alt);
                });
                if (attributes.length > 0) attributesLocked = true;
            }

            // ステータス
            const statMap: Record<string, string> = {
                '耐久': 'hp',
                '攻撃': 'attack',
                '防御': 'defense',
                '射程': 'range',
                '回復': 'recovery',
                '気': 'cost',
            };

            if (isMainInfoTable || !mainInfoTable) {
                for (const [key, statKey] of Object.entries(statMap)) {
                    if (header === key || header.startsWith(key)) {
                        const parseFirstNumber = (text: string | undefined | null) => {
                            if (!text) return undefined;
                            const clean = text.replace(/,/g, '');
                            const m = clean.match(/(\d+(?:\.\d+)?)/);
                            return m ? parseFloat(m[1]) : undefined;
                        };

                        // デフォルトは左列を参照しつつ、右列(巨大化5回)があれば優先
                        let val: number | undefined = parseFirstNumber(value);

                        if (tds.length >= 4) {
                            const rightVal = parseFirstNumber(tds[3].textContent?.trim() || '');
                            if (rightVal !== undefined) {
                                val = rightVal; // 巨大化5回の値を採用
                            }
                        }

                        if (val !== undefined && val > 0) {
                            baseStats[statKey] = val;
                        }
                    }
                }
            }

            // --- State Tracking for Sections ---
            if (tds.length === 1 && header === '') {
                // Section Header (e.g., "特殊能力", "特技", "計略")
                const text = tds[0].textContent?.trim() || '';
                if (text === '特技') currentSection = 'skill';
                else if (text === '計略') currentSection = 'strategy';
                else if (text === '特殊能力') currentSection = 'special';
            }

            // 特技・計略・特殊能力
            // headerに [無印] や [改壱] が含まれる場合、または "特技" "計略" "特殊能力" という単語が含まれる場合
            const isSkillOrStrategy =
                header.includes('[無印]') || header.includes('[改壱]') || header.includes('[改弐]') ||
                header.includes('特技') || header.includes('計略') || header.includes('特殊能力') || currentSection === 'special';

            if (isSkillOrStrategy) {
                // 計略判定: "気:" や "秒" が含まれる、またはヘッダーに"計略"が含まれる
                // NOTE: 特殊能力も "気:" を含むことがあるため、currentSection または header で除外する
                const isStrategy = currentSection === 'strategy' || header.includes('気:') || header.includes('秒') || header.includes('計略');
                const isSpecial = currentSection === 'special' || header.includes('特殊能力');

                // 説明文の抽出: 値セルだけでなく、その行の他のセルもチェック
                // 構造: | ヘッダー | 名前 | 説明 |

                // 行内のすべてのセルをチェックして、最も説明文らしいもの（長くて、計略パラメータでない）を探す
                let bestCandidate = '';
                let maxLength = 0;

                tds.forEach(td => {
                    // <br>で分割して、それぞれの行を候補として扱う
                    const html = td.innerHTML;
                    const parts = html.split(/<br\s*\/?>/i);

                    parts.forEach(part => {
                        // HTMLタグを除去
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = part;
                        const text = tempDiv.textContent?.trim() || '';

                        // 計略パラメータ（気:xx, 秒:xx）は除外
                        // 短すぎるものも除外（名前など）
                        if (text.includes('気:') || text.includes('秒:') || text.length < 5) return;

                        if (text.length > maxLength) {
                            maxLength = text.length;
                            bestCandidate = text;
                        }
                    });
                });

                // ある程度の長さがある場合、それを説明文として採用
                if (maxLength > 5) {
                    const bucket = isSpecial ? specialCandidates : (isStrategy ? strategyCandidates : skillCandidates);
                    // 重複防止
                    if (!bucket.some(c => c.text === bestCandidate)) {
                        bucket.push({ text: bestCandidate, header });
                    }
                }
            }
        });
    });

    // 武器種マッピングテーブル
    const weaponMapping: Record<string, { range: '近' | '遠' | '遠近'; type: '物' | '術'; placement: '近' | '遠' | '遠近' }> = {
        "弓": { range: "遠", type: "物", placement: "遠" },
        "鉄砲": { range: "遠", type: "物", placement: "遠" },
        "石弓": { range: "遠", type: "物", placement: "遠" },
        "投剣": { range: "遠", type: "物", placement: "遠近" },
        "軍船": { range: "遠", type: "物", placement: "遠近" },
        "槍": { range: "近", type: "物", placement: "近" },
        "刀": { range: "近", type: "物", placement: "近" },
        "盾": { range: "近", type: "物", placement: "近" },
        "ランス": { range: "近", type: "物", placement: "近" },
        "双剣": { range: "近", type: "物", placement: "近" },
        "拳": { range: "近", type: "物", placement: "近" },
        "鞭": { range: "近", type: "物", placement: "遠近" },
        "茶器": { range: "近", type: "物", placement: "遠近" },
        "歌舞": { range: "遠", type: "術", placement: "遠" },
        "本": { range: "遠", type: "術", placement: "遠" },
        "法術": { range: "遠", type: "術", placement: "遠" },
        "鈴": { range: "遠", type: "術", placement: "遠" },
        "杖": { range: "遠", type: "術", placement: "遠" },
        "札": { range: "遠", type: "術", placement: "遠" },
        "大砲": { range: "遠", type: "物", placement: "遠近" },
        "陣貝": { range: "遠", type: "術", placement: "遠近" }
    };

    let weaponRange: '近' | '遠' | '遠近' | undefined;
    let weaponType: '物' | '術' | undefined;
    let placement: '近' | '遠' | '遠近' | undefined;
    let period: string | undefined;

    if (periodMatch) {
        period = periodMatch[1];
    }

    if (weapon !== 'Unknown' && weaponMapping[weapon]) {
        weaponRange = weaponMapping[weapon].range;
        weaponType = weaponMapping[weapon].type;
        placement = weaponMapping[weapon].placement;
    }

    // 改壱があればそれを優先して採用
    const pickTexts = (arr: { text: string; header: string }[]) => {
        const kai = arr.filter(c => c.header.includes('改壱') || c.header.includes('改弐'));
        const src = kai.length > 0 ? kai : arr;
        return src.map(c => c.text);
    };

    const skillTexts = pickTexts(skillCandidates);
    const strategyTexts = pickTexts(strategyCandidates);
    const specialTexts = pickTexts(specialCandidates);

    return {
        name,
        period,
        url,
        weapon,
        weaponRange,
        weaponType,
        placement,
        attributes: [...new Set(attributes)],
        baseStats,
        skillTexts: [...new Set(skillTexts)], // 重複排除
        strategyTexts: [...new Set(strategyTexts)], // 重複排除
        specialTexts: [...new Set(specialTexts)],
    };
}
