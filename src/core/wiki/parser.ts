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
    // Wikiのタイトルは "江戸城 - 御城プロジェクトRE..." のようになっていることが多い
    const title = doc.querySelector('title')?.textContent || '';
    const name = title.split('-')[0].trim() || 'Unknown';

    // 2. 武器種 & 属性
    // 通常はテーブル内の特定のセルにある。
    // 構造が変動しやすいため、テキスト検索でヒューリスティックに探す
    // 例: "平山属性" "刀" などのキーワードを含むリンクを探す
    const weapon = extractWeapon(doc);
    const attributes = extractAttributes(doc);

    // 3. 特技 & 計略
    // "特技" "計略" というヘッダーを持つテーブルを探す
    const skillTexts = extractSectionText(doc, '特技');
    const strategyTexts = extractSectionText(doc, '計略');

    return {
        name,
        url,
        weapon,
        attributes,
        baseStats: extractBaseStats(doc),
        skillTexts,
        strategyTexts,
    };
}

function extractBaseStats(doc: Document): Record<string, number> {
    const stats: Record<string, number> = {
        hp: 0,
        attack: 0,
        defense: 0,
        range: 0,
        recovery: 0, // 回復
    };

    // ステータスが含まれる可能性のあるテーブルセルを探す
    // 一般的なWikiの構造: <th>耐久</th><td>1234</td>...
    const ths = Array.from(doc.querySelectorAll('th'));

    const statMap: Record<string, string> = {
        '耐久': 'hp',
        '攻撃': 'attack',
        '防御': 'defense',
        '射程': 'range',
        '回復': 'recovery',
    };

    ths.forEach(th => {
        const headerText = th.textContent?.trim() || '';

        // ヘッダーがステータス名のいずれかを含むかチェック
        for (const [key, statKey] of Object.entries(statMap)) {
            if (headerText === key || headerText.startsWith(key)) {
                // 対応する値セルを探す
                // パターン1: 隣のtd (<tr><th>耐久</th><td>1000</td></tr>)
                let targetTd = th.nextElementSibling as HTMLElement;

                // パターン2: 同じインデックスの行違い (縦持ちテーブルの場合)
                // これは複雑なので一旦パターン1のみ対応

                if (targetTd && targetTd.tagName === 'TD') {
                    // 数値を抽出
                    const valueText = targetTd.textContent?.trim() || '';
                    // "1234" や "1234(2468)" のような形式から最初の数値を抽出
                    const match = valueText.match(/(\d+)/);
                    if (match) {
                        const value = parseInt(match[1], 10);
                        // 既に値が入っている場合は上書きしない（最初の出現を優先）
                        // ただし、値が極端に小さい（レベル1）か大きい（最大レベル）かの判断は難しい
                        // ここでは単純に最初の有効な値を採用
                        if (stats[statKey] === 0) {
                            stats[statKey] = value;
                        }
                    }
                }
            }
        }
    });

    // 射程が見つからない場合、武器種から推測するロジックも考えられるが、
    // extractWeaponで取得した武器種を使って補完するのは呼び出し元の責任とするか、
    // ここで簡易的に補完するか。一旦抽出のみに専念。

    return stats;
}

function extractWeapon(doc: Document): string {
    // 武器種リンクを探す (例: hrefが "武器/刀" を含むなど)
    const weaponLinks = Array.from(doc.querySelectorAll('a')).filter(a =>
        a.href.includes('武器') || a.textContent?.match(/^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝)$/)
    );

    if (weaponLinks.length > 0) {
        // 最初のマッチを採用（精査が必要かも）
        return weaponLinks[0].textContent?.trim() || 'Unknown';
    }
    return 'Unknown';
}

function extractAttributes(doc: Document): string[] {
    const attrs: string[] = [];
    const attrKeywords = ['平', '平山', '山', '水', '地獄', '無'];

    // 属性リンクを探す
    const links = Array.from(doc.querySelectorAll('a'));
    links.forEach(a => {
        const text = a.textContent?.trim();
        if (text && attrKeywords.includes(text)) {
            // 重複排除
            if (!attrs.includes(text)) {
                attrs.push(text);
            }
        }
    });

    // 属性が見つからない場合、本文から探すなどのフォールバックが必要だが一旦シンプルに
    return attrs;
}

function extractSectionText(doc: Document, sectionName: string): string[] {
    const texts: string[] = [];

    // thに sectionName を含むテーブルを探す
    const ths = Array.from(doc.querySelectorAll('th'));
    const targetTh = ths.find(th => th.textContent?.includes(sectionName));

    if (targetTh) {
        // そのテーブルの行からテキストを抽出
        // 構造: 
        // | 特技 | 特技名 | 説明 |
        // | ...  | ...    | ...  |
        const table = targetTh.closest('table');
        if (table) {
            const tds = Array.from(table.querySelectorAll('td'));
            tds.forEach(td => {
                // 説明文っぽい長いテキストを抽出
                const text = td.textContent?.trim();
                if (text && text.length > 10) { // 短すぎるのは除外（名前など）
                    texts.push(text);
                }
            });
        }
    }

    return texts;
}
