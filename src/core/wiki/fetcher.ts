import type { WikiFetchResult } from './types';

const PROXY_BASE_URL = 'https://api.allorigins.win/get?url=';

/**
 * Wikiのページを取得する
 * @param wikiUrl WikiのURL (例: https://scre.swiki.jp/index.php?%E6%B1%9F%E6%88%B8%E5%9F%8E)
 */
export async function fetchWikiPage(wikiUrl: string): Promise<WikiFetchResult> {
    try {
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
