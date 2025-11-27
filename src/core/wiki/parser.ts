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

    let weapon = 'Unknown';
    const attributes: string[] = [];
    const baseStats: Record<string, number> = {
        hp: 0,
        attack: 0,
        defense: 0,
        range: 0,
        recovery: 0,
    };
    const skillTexts: string[] = [];
    const strategyTexts: string[] = [];

    tables.forEach(table => {
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
                header = tds[0].textContent?.trim() || '';
                value = tds[1].textContent?.trim() || '';
                valueTd = tds[1];
            } else if (tds.length === 1) {
                // tdのみのパターン（リンクのみの場合など）
                // ヘッダーなしとして扱うが、値はチェックする
                value = tds[0].textContent?.trim() || '';
                valueTd = tds[0];
            }

            // --- 情報抽出ロジック ---

            // 武器種
            // ヘッダーがある場合はそれを信頼、ない場合は値から推測
            if (header === '武器属性' || header.includes('武器') || !header) {
                // "刀" や "刀(詳細)" のような形式から抽出
                const cleanWeapon = value.replace(/\(.+?\)/g, '').trim();
                // 一般的な武器種リストに含まれるかチェック
                if (/^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)$/.test(cleanWeapon)) {
                    // 既に武器種が判明している場合は上書きしない（ヘッダーありを優先したいが、現状は単純に）
                    if (weapon === 'Unknown') {
                        weapon = cleanWeapon;
                    }
                }
            }

            // 城属性
            // ヘッダーがある場合はそれを信頼、ない場合は値から推測
            if (header === '城属性' || header.includes('属性') || !header) {
                // テキストからの抽出
                const attrText = value.replace(/\s+/g, '').replace(/属性/g, '');
                if (attrText.includes('平山')) {
                    if (!attributes.includes('平山')) attributes.push('平山');
                } else {
                    if (attrText.includes('平') && !attributes.includes('平')) attributes.push('平');
                    if (attrText.includes('山') && !attributes.includes('山')) attributes.push('山');
                    if (attrText.includes('水') && !attributes.includes('水')) attributes.push('水');
                }
                if (attrText.includes('地獄') && !attributes.includes('地獄')) attributes.push('地獄');
                // 無属性判定は慎重に行う（他の属性がない場合のみ）
                if (attrText.includes('無') && attributes.length === 0) {
                    // "無"という文字は一般的すぎるので、"無属性"という明確な表記か、ヘッダーが属性の場合のみ
                    if (header.includes('属性') || attrText.includes('無属性')) {
                        attributes.push('無属性');
                    }
                }

                // 画像(alt)からの抽出（フォールバック）
                if (valueTd) {
                    const imgs = Array.from(valueTd.querySelectorAll('img'));
                    imgs.forEach(img => {
                        const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                        if (alt.includes('平山')) {
                            if (!attributes.includes('平山')) attributes.push('平山');
                        } else {
                            if (alt.includes('平') && !attributes.includes('平')) attributes.push('平');
                            if (alt.includes('山') && !attributes.includes('山')) attributes.push('山');
                            if (alt.includes('水') && !attributes.includes('水')) attributes.push('水');
                        }
                        if (alt.includes('地獄') && !attributes.includes('地獄')) attributes.push('地獄');
                    });
                }
            }

            // ステータス
            const statMap: Record<string, string> = {
                '耐久': 'hp',
                '攻撃': 'attack',
                '防御': 'defense',
                '射程': 'range',
                '回復': 'recovery',
            };

            for (const [key, statKey] of Object.entries(statMap)) {
                if (header === key || header.startsWith(key)) {
                    const match = value.match(/(\d+)/);
                    if (match) {
                        const val = parseInt(match[1], 10);
                        if (baseStats[statKey] === 0) {
                            baseStats[statKey] = val;
                        }
                    }
                }
            }

            // 特技・計略
            // headerに [無印] や [改壱] が含まれる場合、または "特技" "計略" という単語が含まれる場合
            const isSkillOrStrategy =
                header.includes('[無印]') || header.includes('[改壱]') || header.includes('[改弐]') ||
                header.includes('特技') || header.includes('計略');

            if (isSkillOrStrategy) {
                // 計略判定: "気:" や "秒" が含まれる、またはヘッダーに"計略"が含まれる
                const isStrategy = header.includes('気:') || header.includes('秒') || header.includes('計略');

                // 説明文の抽出: 値セルだけでなく、その行の他のセルもチェック
                // 構造: | ヘッダー | 名前 | 説明 |
                let description = value;

                // 行内のすべてのセルをチェックして、最も説明文らしいもの（長くて、計略パラメータでない）を探す
                let bestCandidate = description;
                let maxLength = 0;

                tds.forEach(td => {
                    const text = td.textContent?.trim() || '';
                    // 計略パラメータ（気:xx, 秒:xx）は除外
                    if (text.includes('気:') || text.includes('秒:')) return;

                    if (text.length > maxLength) {
                        maxLength = text.length;
                        bestCandidate = text;
                    }
                });

                // ある程度の長さがある場合、それを説明文として採用
                if (maxLength > 5) {
                    description = bestCandidate;
                }

                if (description.length > 5 && !description.includes('気:') && !description.includes('秒:')) {
                    if (isStrategy) {
                        strategyTexts.push(description);
                    } else {
                        skillTexts.push(description);
                    }
                }
            }
        });
    });

    return {
        name,
        url,
        weapon,
        attributes,
        baseStats,
        skillTexts: [...new Set(skillTexts)], // 重複排除
        strategyTexts: [...new Set(strategyTexts)], // 重複排除
    };
}
