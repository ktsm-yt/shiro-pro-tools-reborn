import React, { useState } from 'react';
import { fetchWikiPage } from '../../core/wiki/fetcher';
import { parseWikiHtml } from '../../core/wiki/parser';
import { analyzeCharacter } from '../../core/wiki/analyzer';
import type { Character } from '../../core/types';

interface Props {
    onImport: (character: Character) => void;
}

export const WikiImport: React.FC<Props> = ({ onImport }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewChar, setPreviewChar] = useState<Character | null>(null);

    const handleImport = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        setPreviewChar(null);

        try {
            // 1. Fetch
            const fetchResult = await fetchWikiPage(url);
            if (!fetchResult.success || !fetchResult.data) {
                throw new Error(fetchResult.error || 'Failed to fetch Wiki page');
            }

            // 2. Parse
            const rawData = parseWikiHtml(fetchResult.data, url);

            // 3. Analyze
            const character = analyzeCharacter(rawData);
            setPreviewChar(character);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (previewChar) {
            onImport(previewChar);
            setPreviewChar(null);
            setUrl('');
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-2 text-slate-700">Wikiからインポート</h3>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="WikiのURL (例: https://scre.swiki.jp/...)"
                    className="flex-1 border border-slate-300 rounded px-3 py-1 text-sm"
                />
                <button
                    onClick={handleImport}
                    disabled={loading || !url}
                    className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? '解析中...' : '解析'}
                </button>
            </div>

            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}

            {previewChar && (
                <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-2">
                    <div className="font-bold text-sm mb-1">{previewChar.name} ({previewChar.weapon}/{previewChar.attributes.join(',')})</div>
                    <div className="text-xs text-slate-600 mb-2">
                        特技: {previewChar.skills.length}個, 計略: {previewChar.strategies.length}個
                    </div>
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700"
                    >
                        このキャラを編成に追加
                    </button>
                </div>
            )}
        </div>
    );
};
