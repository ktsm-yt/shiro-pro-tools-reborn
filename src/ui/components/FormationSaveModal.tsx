import { useEffect, useState } from 'react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    suggestedName?: string;
};

export function FormationSaveModal({ isOpen, onClose, onSave, suggestedName = '現在の編成' }: Props) {
    const [name, setName] = useState(suggestedName);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(suggestedName);
            setError(null);
        }
    }, [isOpen, suggestedName]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, name]);

    const handleSave = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('編成名を入力してください');
            return;
        }
        onSave(trimmed);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl border border-[#1f2a3d] bg-[#101827] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Save Formation</p>
                        <h2 className="text-lg font-bold text-white">編成を保存</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 transition-colors hover:text-white"
                        aria-label="閉じる"
                    >
                        &times;
                    </button>
                </div>

                <label className="mb-2 block text-sm font-medium text-gray-200">編成名</label>
                <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: 山属性バフ特化"
                    className="w-full rounded-lg border border-[#1f2a3d] bg-[#0b101b] px-3 py-2 text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/60"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSave();
                        }
                    }}
                />
                <p className="mt-2 text-xs text-gray-500">Ctrl/Cmd + Enter でも保存できます。</p>

                {error && (
                    <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-200">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-900/25"
                    >
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}
