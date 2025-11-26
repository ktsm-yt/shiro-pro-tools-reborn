import React, { useState } from 'react';
import { fetchWikiPage, parseDirectHtml } from '../../core/wiki/fetcher';
import { parseWikiHtml } from '../../core/wiki/parser';
import { analyzeCharacter } from '../../core/wiki/analyzer';
import type { Character } from '../../core/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCharacterImported: (character: Character) => void;
}

type InputMode = 'url' | 'html';

export const WikiImporter: React.FC<Props> = ({ isOpen, onClose, onCharacterImported }) => {
    const [inputMode, setInputMode] = useState<InputMode>('url');
    const [urlInput, setUrlInput] = useState('');
    const [htmlInput, setHtmlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);

    if (!isOpen) return null;

    const handleImport = async () => {
        setError(null);
        setIsLoading(true);
        setPreviewCharacter(null);

        try {
            let fetchResult;

            if (inputMode === 'url') {
                if (!urlInput.trim()) {
                    setError('URLを入力してください');
                    setIsLoading(false);
                    return;
                }
                fetchResult = await fetchWikiPage(urlInput);
            } else {
                if (!htmlInput.trim()) {
                    setError('HTMLソースを入力してください');
                    setIsLoading(false);
                    return;
                }
                fetchResult = parseDirectHtml(htmlInput);
            }

            if (!fetchResult.success || !fetchResult.data) {
                setError(fetchResult.error || 'データの取得に失敗しました');
                setIsLoading(false);
                return;
            }

            // パースしてキャラクター情報を抽出
            const rawData = parseWikiHtml(fetchResult.data, urlInput || 'direct-input');
            const character = analyzeCharacter(rawData);

            setPreviewCharacter(character);
        } catch (err) {
            setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = () => {
        if (previewCharacter) {
            onCharacterImported(previewCharacter);
            handleClose();
        }
    };

    const handleClose = () => {
        setUrlInput('');
        setHtmlInput('');
        setError(null);
        setPreviewCharacter(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* ヘッダー */}
                <div className="flex justify-between items-center p-4 border-b shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span>📥</span>
                        Wiki インポーター
                    </h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 flex-grow overflow-y-auto">
                    {/* タブ切り替え */}
                    <div className="flex gap-2 mb-4 border-b">
                        <button
                            onClick={() => setInputMode('url')}
                            className={`px-4 py-2 font-medium transition-colors ${inputMode === 'url'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            URL入力
                        </button>
                        <button
                            onClick={() => setInputMode('html')}
                            className={`px-4 py-2 font-medium transition-colors ${inputMode === 'html'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            HTML直接入力
                        </button>
                    </div>

                    {/* URL入力モード */}
                    {inputMode === 'url' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                WikiページのURL
                            </label>
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://scre.swiki.jp/index.php?江戸城"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500">
                                例: https://scre.swiki.jp/index.php?キャラ名
                            </p>
                        </div>
                    )}

                    {/* HTML直接入力モード */}
                    {inputMode === 'html' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                HTMLソース
                            </label>
                            <textarea
                                value={htmlInput}
                                onChange={(e) => setHtmlInput(e.target.value)}
                                placeholder="WikiページのHTMLソースをペーストしてください..."
                                rows={10}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
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
                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                        {isLoading ? '解析中...' : '解析実行'}
                    </button>

                    {/* エラー表示 */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <strong>エラー:</strong> {error}
                        </div>
                    )}

                    {/* プレビュー */}
                    {previewCharacter && (
                        <div className="mt-6 space-y-4">
                            <div className="border-t pt-4">
                                <h3 className="text-lg font-bold mb-3">プレビュー</h3>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <div>
                                        <span className="text-sm text-gray-500">名前:</span>{' '}
                                        <strong>{previewCharacter.name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">武器種:</span>{' '}
                                        {previewCharacter.weapon}
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">属性:</span>{' '}
                                        {previewCharacter.attributes.join(', ')}
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">ステータス:</span>
                                        <ul className="ml-4 text-sm">
                                            <li>耐久: {previewCharacter.baseStats.hp || 'N/A'}</li>
                                            <li>攻撃: {previewCharacter.baseStats.attack || 'N/A'}</li>
                                            <li>防御: {previewCharacter.baseStats.defense || 'N/A'}</li>
                                            <li>射程: {previewCharacter.baseStats.range || 'N/A'}</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">スキル数:</span>{' '}
                                        {previewCharacter.skills.length}
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">計略数:</span>{' '}
                                        {previewCharacter.strategies.length}
                                    </div>
                                </div>
                            </div>

                            {/* 登録ボタン */}
                            <button
                                onClick={handleRegister}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                編成に登録
                            </button>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};
