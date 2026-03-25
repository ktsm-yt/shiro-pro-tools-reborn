import React, { useEffect, useState } from 'react';
import { fetchWikiPage, parseDirectHtml } from '../../core/wiki/fetcher';
import { parseWikiHtml } from '../../core/wiki/parser';
import { analyzeCharacter } from '../../core/wiki/analyzer';
import type { Character, Buff } from '../../core/types';
import { BuffEditor } from './BuffEditor';
import { upsertCharacter } from '../../core/database/characters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCharacterImported: (character: Character) => void;
}

type InputMode = 'url' | 'html';

interface ParseResult {
    url: string;
    character: Character | null;
    error?: string;
    selected: boolean;
}

export const WikiImporter: React.FC<Props> = ({ isOpen, onClose, onCharacterImported }) => {
    const [inputMode, setInputMode] = useState<InputMode>('url');
    const [urlInput, setUrlInput] = useState('');
    const [htmlInput, setHtmlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parseResults, setParseResults] = useState<ParseResult[]>([]);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const manualAttributeOptions = ['平', '山', '水', '平山', '地獄', '架空', '無属性'];

    const handleClose = () => {
        setUrlInput('');
        setHtmlInput('');
        setError(null);
        setParseResults([]);
        setExpandedIndex(null);
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        const listener = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, [isOpen]);

    const updateBuffs = (resultIndex: number, kind: 'skills' | 'strategies' | 'specialAbilities', buffs: Buff[]) => {
        setParseResults(prev => prev.map((result, i) => {
            if (i !== resultIndex || !result.character) return result;
            return { ...result, character: { ...result.character, [kind]: buffs } };
        }));
    };

    const toggleAttribute = (resultIndex: number, attr: string) => {
        setParseResults(prev => prev.map((result, i) => {
            if (i !== resultIndex || !result.character) return result;
            const current = new Set(result.character.attributes ?? []);
            if (current.has(attr)) {
                current.delete(attr);
            } else {
                current.add(attr);
            }
            return { ...result, character: { ...result.character, attributes: Array.from(current) } };
        }));
    };

    const toggleSelected = (resultIndex: number) => {
        setParseResults(prev => prev.map((result, i) =>
            i === resultIndex ? { ...result, selected: !result.selected } : result
        ));
    };

    if (!isOpen) return null;

    const handleImport = async () => {
        setError(null);
        setIsLoading(true);
        setParseResults([]);
        setExpandedIndex(null);

        try {
            if (inputMode === 'url') {
                // 改行で分割して複数URLを処理
                const urls = urlInput
                    .split('\n')
                    .map(u => u.trim())
                    .filter(u => u.length > 0);

                if (urls.length === 0) {
                    setError('URLを入力してください');
                    setIsLoading(false);
                    return;
                }

                // 並列で全URLを処理
                const results = await Promise.all(
                    urls.map(async (url): Promise<ParseResult> => {
                        try {
                            const fetchResult = await fetchWikiPage(url);
                            if (!fetchResult.success || !fetchResult.data) {
                                return { url, character: null, error: fetchResult.error || '取得失敗', selected: false };
                            }
                            const rawData = parseWikiHtml(fetchResult.data, url);
                            const character = analyzeCharacter(rawData);
                            return { url, character, selected: true };
                        } catch (err) {
                            return { url, character: null, error: err instanceof Error ? err.message : '解析エラー', selected: false };
                        }
                    })
                );

                setParseResults(results);

                // 全て失敗した場合のみエラー表示
                const successCount = results.filter(r => r.character).length;
                if (successCount === 0) {
                    setError('全てのURLの解析に失敗しました');
                }
            } else {
                // HTML直接入力は従来通り1件のみ
                if (!htmlInput.trim()) {
                    setError('HTMLソースを入力してください');
                    setIsLoading(false);
                    return;
                }
                const fetchResult = parseDirectHtml(htmlInput);
                if (!fetchResult.success || !fetchResult.data) {
                    setError(fetchResult.error || 'データの取得に失敗しました');
                    setIsLoading(false);
                    return;
                }
                const rawData = parseWikiHtml(fetchResult.data, 'direct-input');
                const character = analyzeCharacter(rawData);
                setParseResults([{ url: 'direct-input', character, selected: true }]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = () => {
        const selectedEntries = parseResults
            .filter(r => r.selected && r.character);

        if (selectedEntries.length === 0) return;

        // 選択されたキャラクターを順次登録（localStorage即時）
        selectedEntries.forEach(entry => {
            onCharacterImported(entry.character!);
            // バックグラウンドでSupabaseに同期
            const wikiUrl = entry.url !== 'direct-input' ? entry.url : undefined;
            upsertCharacter(entry.character!, wikiUrl).catch(err =>
                console.warn('Cloud sync failed:', err)
            );
        });
        handleClose();
    };

    const selectedCount = parseResults.filter(r => r.selected && r.character).length;
    const successCount = parseResults.filter(r => r.character).length;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col bg-[#0f1626] text-gray-100 border border-[#1f2a3d] rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
                {/* ヘッダー */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-[#1f2a3d] shrink-0 bg-[#111a2d] rounded-t-2xl">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span>📥</span>
                        Wiki インポーター
                    </h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl transition-colors">
                        &times;
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 flex-grow overflow-y-auto">
                    {/* タブ切り替え */}
                    <div className="flex gap-2 mb-4 border-b border-[#1f2a3d]">
                        <button
                            onClick={() => setInputMode('url')}
                            className={`px-4 py-2 font-medium transition-colors ${inputMode === 'url'
                                ? 'border-b-2 border-blue-400 text-blue-300'
                                : 'text-gray-500 hover:text-gray-200'
                                }`}
                        >
                            URL入力
                        </button>
                        <button
                            onClick={() => setInputMode('html')}
                            className={`px-4 py-2 font-medium transition-colors ${inputMode === 'html'
                                ? 'border-b-2 border-blue-400 text-blue-300'
                                : 'text-gray-500 hover:text-gray-200'
                                }`}
                        >
                            HTML直接入力
                        </button>
                    </div>

                    {/* URL入力モード */}
                    {inputMode === 'url' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-300">
                                WikiページのURL（複数可：改行区切り）
                            </label>
                            <textarea
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder={`https://scre.swiki.jp/index.php?江戸城\nhttps://scre.swiki.jp/index.php?大坂城\nhttps://scre.swiki.jp/index.php?姫路城`}
                                rows={5}
                                className="w-full px-3 py-2 bg-[#0b101b] border border-[#1f2a3d] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 text-gray-100 placeholder:text-gray-500 font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500">
                                1行に1つのURLを入力してください（複数キャラを一括でインポートできます）
                            </p>
                        </div>
                    )}

                    {/* HTML直接入力モード */}
                    {inputMode === 'html' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-300">
                                HTMLソース
                            </label>
                            <textarea
                                value={htmlInput}
                                onChange={(e) => setHtmlInput(e.target.value)}
                                placeholder="WikiページのHTMLソースをペーストしてください..."
                                rows={10}
                                className="w-full px-3 py-2 bg-[#0b101b] border border-[#1f2a3d] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 font-mono text-xs text-gray-100 placeholder:text-gray-500"
                            />
                            <p className="text-xs text-gray-500">
                                ブラウザでWikiページを開き、「ページのソースを表示」からHTMLをコピーしてください
                            </p>
                        </div>
                    )}

                    {/* インポートボタン */}
                    <button
                        onClick={handleImport}
                        disabled={isLoading}
                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-700 transition-colors shadow-lg shadow-blue-900/25"
                    >
                        {isLoading ? '解析中...' : '解析実行'}
                    </button>

                    {/* エラー表示 */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
                            <strong>エラー:</strong> {error}
                        </div>
                    )}

                    {/* 解析結果一覧 */}
                    {parseResults.length > 0 && (
                        <div className="mt-6 space-y-4">
                            <div className="border-t border-[#1f2a3d] pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold">
                                        解析結果
                                        <span className="ml-2 text-sm font-normal text-gray-400">
                                            ({successCount}件成功 / {parseResults.length}件中)
                                        </span>
                                    </h3>
                                </div>

                                {/* キャラクター一覧 */}
                                <div className="space-y-2">
                                    {parseResults.map((result, idx) => (
                                        <div
                                            key={idx}
                                            className={`bg-[#111a2d] rounded-lg border ${result.character
                                                ? result.selected ? 'border-green-600/50' : 'border-[#1f2a3d]'
                                                : 'border-red-800/50'
                                                }`}
                                        >
                                            {/* ヘッダー行 */}
                                            <div
                                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#1a2540]"
                                                onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                                            >
                                                {result.character ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={result.selected}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelected(idx);
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                ) : (
                                                    <span className="w-4 h-4 text-red-500 text-center">✗</span>
                                                )}

                                                {result.character?.imageUrl && (
                                                    <img
                                                        src={result.character.imageUrl}
                                                        alt=""
                                                        className="w-10 h-10 object-cover rounded border border-[#1f2a3d]"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    {result.character ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold truncate">
                                                                {result.character.period ? `［${result.character.period}］` : ''}
                                                                {result.character.name}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{result.character.weapon}</span>
                                                            <span className="text-xs text-gray-500">
                                                                攻{result.character.baseStats.attack} / 防{result.character.baseStats.defense}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-red-400 text-sm truncate">
                                                            {result.error || '解析エラー'}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-500 truncate">{result.url}</div>
                                                </div>

                                                <span className="text-gray-500 text-sm">
                                                    {expandedIndex === idx ? '▲' : '▼'}
                                                </span>
                                            </div>

                                            {/* 展開時の詳細 */}
                                            {expandedIndex === idx && result.character && (
                                                <div className="border-t border-[#1f2a3d] p-4 space-y-3">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-gray-400">属性:</span>{' '}
                                                            {result.character.attributes.join(', ') || 'なし'}
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">射程:</span>{' '}
                                                            {result.character.baseStats.range ?? 'N/A'}
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">特技:</span>{' '}
                                                            {result.character.skills.length}件
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">計略:</span>{' '}
                                                            {result.character.strategies.length}件
                                                        </div>
                                                    </div>

                                                    {/* 属性手動補正 */}
                                                    <details className="text-xs">
                                                        <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
                                                            属性補正（手動）
                                                        </summary>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {manualAttributeOptions.map(attr => (
                                                                <label key={attr} className="inline-flex items-center gap-1 text-gray-200">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={result.character!.attributes.includes(attr)}
                                                                        onChange={() => toggleAttribute(idx, attr)}
                                                                    />
                                                                    {attr}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </details>

                                                    {/* バフ編集 */}
                                                    <div className="space-y-4">
                                                        <BuffEditor
                                                            buffs={result.character.skills}
                                                            groupLabel="特技"
                                                            onChange={(buffs) => updateBuffs(idx, 'skills', buffs)}
                                                            rawTexts={result.character.rawSkillTexts}
                                                        />
                                                        <BuffEditor
                                                            buffs={result.character.strategies}
                                                            groupLabel="計略"
                                                            onChange={(buffs) => updateBuffs(idx, 'strategies', buffs)}
                                                            rawTexts={result.character.rawStrategyTexts}
                                                        />
                                                        {((result.character.specialAbilities ?? []).length > 0 || (result.character.rawSpecialTexts ?? []).length > 0) && (
                                                            <BuffEditor
                                                                buffs={result.character.specialAbilities ?? []}
                                                                groupLabel="特殊能力"
                                                                onChange={(buffs) => updateBuffs(idx, 'specialAbilities', buffs)}
                                                                rawTexts={result.character.rawSpecialTexts}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 登録ボタン */}
                            <button
                                onClick={handleRegister}
                                disabled={selectedCount === 0}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-900/25"
                            >
                                {selectedCount > 0
                                    ? `${selectedCount}件を編成に登録`
                                    : '登録するキャラを選択してください'}
                            </button>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-[#1f2a3d] bg-[#111a2d] flex justify-end shrink-0 rounded-b-2xl">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700 transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};
