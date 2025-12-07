/**
 * 差分インジケーター
 * 
 * ダメージやDPSの変化を視覚的に表示するコンポーネント
 */

interface DiffIndicatorProps {
    value: number;
    percent: number;
    className?: string;
}

export function DiffIndicator({ percent, className = '' }: DiffIndicatorProps) {
    // 変化がほとんどない場合
    if (Math.abs(percent) < 0.1) {
        return <span className={`text-gray-400 text-sm ${className}`}>-</span>;
    }

    const isPositive = percent > 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const arrow = isPositive ? '↑' : '↓';

    return (
        <span className={`${colorClass} text-sm font-medium ${className}`}>
            {arrow} {Math.abs(percent).toFixed(1)}%
        </span>
    );
}
