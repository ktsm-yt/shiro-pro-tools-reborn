import { useEffect, useRef } from 'react';

type Props = {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
};

export function ConfirmModal({
    isOpen,
    title,
    description,
    confirmLabel = 'OK',
    cancelLabel = 'キャンセル',
    onConfirm,
    onClose,
}: Props) {
    const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            confirmBtnRef.current?.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onConfirm();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onConfirm, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl border border-[#1f2a3d] bg-[#101827] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {description && <p className="mt-2 text-sm text-gray-300 leading-relaxed">{description}</p>}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 shadow-lg shadow-red-900/25"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
