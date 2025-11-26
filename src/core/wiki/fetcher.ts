import type { WikiFetchResult } from './types';

const PROXY_BASE_URL = 'https://api.allorigins.win/get?url=';

/**
 * Wikiのページを取得する
 * @param wikiUrl WikiのURL (例: https://scre.swiki.jp/index.php?江戸城)
 * @param useViteProxy 開発環境でViteプロキシを使用するか（デフォルト: true）
 */
export async function fetchWikiPage(
    wikiUrl: string,
    useViteProxy: boolean = true
): Promise<WikiFetchResult> {
    try {
        // 開発環境でViteプロキシが有効な場合
        if (import.meta.env.DEV && useViteProxy && wikiUrl.startsWith('https://scre.swiki.jp')) {
            const fetchUrl = wikiUrl.replace('https://scre.swiki.jp', '/api/wiki');
            const response = await fetch(fetchUrl);

            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP Error: ${response.status} ${response.statusText}`,
                };
            }

            const html = await response.text();
            return { success: true, data: html };
        }

        // 本番環境またはViteプロキシが使えない場合はalloriginsを使用
        const targetUrl = encodeURIComponent(wikiUrl);
        const response = await fetch(`${PROXY_BASE_URL}${targetUrl}`);

        if (!response.ok) {
            return { success: false, error: `Network response was not ok: ${response.status}` };
        }

        const json = await response.json();

        if (!json.contents) {
            return { success: false, error: 'No content found in proxy response' };
        }

        return { success: true, data: json.contents };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * HTMLソースを直接受け取る（CORSが解決できない場合のフォールバック）
 * @param html HTMLソース
 * @returns 取得結果
 */
export function parseDirectHtml(html: string): WikiFetchResult {
    if (!html || html.trim().length === 0) {
        return {
            success: false,
            error: 'HTMLソースが空です',
        };
    }

    return {
        success: true,
        data: html,
    };
}
