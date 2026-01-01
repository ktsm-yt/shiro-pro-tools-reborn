import React, { useEffect, useState } from 'react';
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
    const [showDebug, setShowDebug] = useState(false);
    const manualAttributeOptions = ['平', '山', '水', '平山', '地獄', '架空', '無属性'];

    const handleClose = () => {
        setUrlInput('');
        setHtmlInput('');
        setError(null);
        setPreviewCharacter(null);
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

    const toggleBuff = (kind: 'skills' | 'strategies', id: string) => {
        setPreviewCharacter(prev => {
            if (!prev) return prev;
            const cloned = { ...prev } as Character;
            const list = cloned[kind] || [];
            cloned[kind] = list.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b) as any;
            return cloned;
        });
    };

    const toggleAttribute = (attr: string) => {
        setPreviewCharacter(prev => {
            if (!prev) return prev;
            const current = new Set(prev.attributes ?? []);
            if (current.has(attr)) {
                current.delete(attr);
            } else {
                current.add(attr);
            }
            return { ...prev, attributes: Array.from(current) };
        });
    };

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
                                WikiページのURL
                            </label>
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://scre.swiki.jp/index.php?江戸城"
                                className="w-full px-3 py-2 bg-[#0b101b] border border-[#1f2a3d] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 text-gray-100 placeholder:text-gray-500"
                            />
                            <p className="text-xs text-gray-500">
                                例: https://scre.swiki.jp/index.php?キャラ名
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

                    {/* プレビュー */}
                    {previewCharacter && (
                        <div className="mt-6 space-y-4">
                            <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold">プレビュー</h3>
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={showDebug}
                                            onChange={(e) => setShowDebug(e.target.checked)}
                                        />
                                        デバッグ表示
                                    </label>
                                </div>
                                <div className="bg-[#111a2d] p-4 rounded-lg border border-[#1f2a3d] flex flex-col md:flex-row gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div>
                                            <span className="text-sm text-gray-400">名前:</span>{' '}
                                            <strong>
                                                {previewCharacter.period ? `［${previewCharacter.period}］` : ''}
                                                {previewCharacter.name}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-400">武器種:</span>{' '}
                                            {previewCharacter.weapon}
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-400">属性:</span>{' '}
                                            {previewCharacter.attributes.join(', ')}
                                        </div>
                                        <div>
                                            <details className="mt-1 text-xs">
                                                <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
                                                    属性補正（手動）
                                                </summary>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                    {manualAttributeOptions.map(attr => {
                                                        const checked = previewCharacter.attributes.includes(attr);
                                                        return (
                                                            <label key={attr} className="inline-flex items-center gap-1 text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleAttribute(attr)}
                                                                />
                                                                {attr}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    Wikiから取得できない属性はここで追加してください
                                                </p>
                                            </details>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-400">ステータス:</span>
                                            <ul className="ml-4 text-sm text-gray-100">
                                                <li>攻撃: {previewCharacter.baseStats.attack ?? 'N/A'}</li>
                                                <li>防御: {previewCharacter.baseStats.defense ?? 'N/A'}</li>
                                                <li>射程: {previewCharacter.baseStats.range ?? 'N/A'}</li>
                                                <li>再配置短縮: {previewCharacter.baseStats.cooldown ?? 'N/A'}</li>
                                                <li>コスト: {previewCharacter.baseStats.cost ?? 'N/A'}</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-400">特技テキスト数:</span>{' '}
                                            {previewCharacter.rawSkillTexts?.length ?? 0}
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-400">計略テキスト数:</span>{' '}
                                            {previewCharacter.rawStrategyTexts?.length ?? 0}
                                        </div>
                                    </div>
                                    {previewCharacter.imageUrl && (
                                        <div className="shrink-0">
                                            <div className="w-32 h-32 md:w-48 md:h-full relative bg-gray-800 rounded-lg overflow-hidden border border-[#1f2a3d]">
                                                <img
                                                    src={previewCharacter.imageUrl}
                                                    alt={previewCharacter.name}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {showDebug && (
                                    <div className="mt-4 bg-[#0b101b] border border-[#1f2a3d] rounded-lg p-4 text-sm space-y-3 text-gray-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <h4 className="font-bold text-gray-100 mb-1">特技テキスト（採用）</h4>
                                                <ul className="list-disc list-inside space-y-1 text-gray-200 text-xs">
                                                    {(previewCharacter.rawSkillTexts ?? []).length === 0 && <li className="text-gray-500">なし</li>}
                                                    {(previewCharacter.rawSkillTexts ?? []).map((t, i) => (
                                                        <li key={`raw-skill-${i}`}>{t}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-100 mb-1">計略テキスト（採用）</h4>
                                                <ul className="list-disc list-inside space-y-1 text-gray-200 text-xs">
                                                    {(previewCharacter.rawStrategyTexts ?? []).length === 0 && <li className="text-gray-500">なし</li>}
                                                    {(previewCharacter.rawStrategyTexts ?? []).map((t, i) => (
                                                        <li key={`raw-strategy-${i}`}>{t}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-100 mb-1">特殊能力テキスト（採用）</h4>
                                                <ul className="list-disc list-inside space-y-1 text-gray-200 text-xs">
                                                    {(previewCharacter.rawSpecialTexts ?? []).length === 0 && <li className="text-gray-500">なし</li>}
                                                    {(previewCharacter.rawSpecialTexts ?? []).map((t, i) => (
                                                        <li key={`raw-special-${i}`}>{t}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-gray-100 mb-1">解析済みバフ</h4>
                                            <div className="overflow-x-auto text-xs">
                                                <table className="min-w-full border border-[#1f2a3d]">
                                                    <thead className="bg-[#111a2d]">
                                                        <tr>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">種別</th>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">stat</th>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">mode</th>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">value</th>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">target</th>
                                                            <th className="px-2 py-1 border border-[#1f2a3d] text-gray-200">active</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewCharacter.skills.length === 0 && previewCharacter.strategies.length === 0 && (previewCharacter.specialAbilities ?? []).length === 0 && (
                                                            <tr><td colSpan={6} className="text-center text-gray-500 py-2">なし</td></tr>
                                                        )}
                                                        {previewCharacter.skills.map((b, i) => (
                                                            <tr key={`skill-buff-${b.id}`} className="border-t border-[#1f2a3d]">
                                                                <td className="px-2 py-1 text-gray-100">特技#{i + 1}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.stat}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.mode}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.value}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.target}</td>
                                                                <td className="px-2 py-1 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={b.isActive}
                                                                        onChange={() => toggleBuff('skills', b.id)}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {previewCharacter.strategies.map((b, i) => (
                                                            <tr key={`strategy-buff-${b.id}`} className="border-t border-[#1f2a3d]">
                                                                <td className="px-2 py-1 text-gray-100">計略#{i + 1}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.stat}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.mode}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.value}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.target}</td>
                                                                <td className="px-2 py-1 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={b.isActive}
                                                                        onChange={() => toggleBuff('strategies', b.id)}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {(previewCharacter.specialAbilities ?? []).map((b, i) => (
                                                            <tr key={`special-buff-${b.id}`} className="border-t border-[#1f2a3d] bg-purple-900/20">
                                                                <td className="px-2 py-1 text-gray-100">特殊#{i + 1}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.stat}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.mode}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.value}</td>
                                                                <td className="px-2 py-1 text-gray-100">{b.target}</td>
                                                                <td className="px-2 py-1 text-center">
                                                                    <input type="checkbox" checked={b.isActive} disabled />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-1">※ 特技・計略・特殊能力すべて発動前提でON</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 登録ボタン */}
                            <button
                                onClick={handleRegister}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors shadow-lg shadow-green-900/25"
                            >
                                編成に登録
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
