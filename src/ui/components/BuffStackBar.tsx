import React from 'react';

interface Props {
    base: number;
    selfBuff: number;
    allyBuff: number;
    reference: number; // 目標値（ゲージの最大幅の基準）
    label?: string;
}

export const BuffStackBar: React.FC<Props> = ({ base, selfBuff, allyBuff, reference, label }) => {
    const total = base + selfBuff + allyBuff;

    // ゲージの最大値は、目標値か合計値の大きい方（少し余裕を持たせる）
    const maxValue = Math.max(reference, total) * 1.1;

    const getWidth = (val: number) => `${(val / maxValue) * 100}%`;

    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] mb-0.5 text-slate-500">
                <span>{label}</span>
                <span className="font-bold text-slate-700">{total}</span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden flex">
                {/* 基礎値 */}
                <div
                    className="h-full bg-slate-400"
                    style={{ width: getWidth(base) }}
                    title={`基礎: ${base}`}
                />
                {/* 自前バフ */}
                <div
                    className="h-full bg-blue-500"
                    style={{ width: getWidth(selfBuff) }}
                    title={`自前: +${selfBuff}`}
                />
                {/* 味方バフ */}
                <div
                    className="h-full bg-green-500"
                    style={{ width: getWidth(allyBuff) }}
                    title={`味方: +${allyBuff}`}
                />

                {/* 目標ライン */}
                <div
                    className="absolute top-0 bottom-0 border-r border-red-400 border-dashed"
                    style={{ left: `${(reference / maxValue) * 100}%` }}
                    title={`目標: ${reference}`}
                />
            </div>
        </div>
    );
};
