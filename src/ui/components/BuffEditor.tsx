import React, { useState } from 'react';
import type { Buff, Stat, BuffMode, Target, ConditionTag, DynamicBuffType } from '../../core/types';
import {
    STAT_LABELS,
    BUFF_MODE_LABELS,
    TARGET_LABELS,
    CONDITION_TAG_LABELS,
    DYNAMIC_TYPE_LABELS,
    CONFIDENCE_LABELS,
    STAT_GROUPS,
} from '../constants/conditionTagLabels';
import { createBuffId } from '../../core/parser/converter';

interface BuffEditorProps {
    buffs: Buff[];
    groupLabel: string;
    onChange: (buffs: Buff[]) => void;
    rawTexts?: string[];
}

const ALL_CONDITION_TAGS = Object.keys(CONDITION_TAG_LABELS) as ConditionTag[];
const ALL_TARGETS = Object.keys(TARGET_LABELS) as Target[];
const ALL_MODES = Object.keys(BUFF_MODE_LABELS) as BuffMode[];
const ALL_DYNAMIC_TYPES = Object.keys(DYNAMIC_TYPE_LABELS) as DynamicBuffType[];

const inputClass = 'px-2 py-1 bg-[#0b101b] border border-[#1f2a3d] rounded text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60';
const selectClass = `${inputClass} appearance-none`;

function SingleBuffEditor({
    buff,
    onUpdate,
    onRemove,
}: {
    buff: Buff;
    onUpdate: (updated: Buff) => void;
    onRemove: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const confidence = buff.confidence ?? 'certain';
    const confidenceMeta = CONFIDENCE_LABELS[confidence] ?? CONFIDENCE_LABELS.certain;

    const update = <K extends keyof Buff>(key: K, value: Buff[K]) => {
        onUpdate({ ...buff, [key]: value });
    };

    const toggleConditionTag = (tag: ConditionTag) => {
        const current = new Set(buff.conditionTags ?? []);
        if (current.has(tag)) {
            current.delete(tag);
        } else {
            current.add(tag);
        }
        update('conditionTags', Array.from(current));
    };

    const summaryText = `${STAT_LABELS[buff.stat] ?? buff.stat} ${buff.mode === 'flat_sum' ? '+' : ''}${buff.value}${buff.mode === 'percent_max' || buff.mode === 'percent_reduction' ? '%' : ''} (${TARGET_LABELS[buff.target] ?? buff.target})`;

    return (
        <div className={`border rounded-lg ${buff.isActive ? 'border-[#1f2a3d]' : 'border-[#1f2a3d]/50 opacity-60'}`}>
            {/* Header row */}
            <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#1a2540] rounded-t-lg"
                onClick={() => setExpanded(!expanded)}
            >
                <input
                    type="checkbox"
                    checked={buff.isActive}
                    onChange={(e) => {
                        e.stopPropagation();
                        update('isActive', !buff.isActive);
                    }}
                    className="w-3.5 h-3.5 shrink-0"
                />
                <span className="text-xs font-medium text-gray-200 flex-1 truncate">
                    {summaryText}
                </span>
                <span className={`text-[10px] ${confidenceMeta.color}`}>
                    {confidenceMeta.label}
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="text-gray-500 hover:text-red-400 text-xs px-1"
                    title="削除"
                >
                    ×
                </button>
                <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
                <div className="border-t border-[#1f2a3d] px-3 py-3 space-y-3">
                    {/* Raw text display */}
                    {buff.rawText && (
                        <div className="text-[11px] text-gray-400 bg-[#0b101b] rounded px-2 py-1.5 border border-[#1f2a3d]">
                            <span className="text-gray-500 mr-1">元テキスト:</span>
                            {buff.rawText}
                        </div>
                    )}

                    {/* Main fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Stat */}
                        <label className="space-y-0.5">
                            <span className="text-[10px] text-gray-500">Stat</span>
                            <select
                                value={buff.stat}
                                onChange={(e) => update('stat', e.target.value as Stat)}
                                className={selectClass + ' w-full'}
                            >
                                {STAT_GROUPS.map(group => (
                                    <optgroup key={group.label} label={group.label}>
                                        {group.stats.map(s => (
                                            <option key={s} value={s}>{STAT_LABELS[s]}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>

                        {/* Mode */}
                        <label className="space-y-0.5">
                            <span className="text-[10px] text-gray-500">Mode</span>
                            <select
                                value={buff.mode}
                                onChange={(e) => update('mode', e.target.value as BuffMode)}
                                className={selectClass + ' w-full'}
                            >
                                {ALL_MODES.map(m => (
                                    <option key={m} value={m}>{BUFF_MODE_LABELS[m]}</option>
                                ))}
                            </select>
                        </label>

                        {/* Value */}
                        <label className="space-y-0.5">
                            <span className="text-[10px] text-gray-500">Value</span>
                            <input
                                type="number"
                                value={buff.value}
                                onChange={(e) => update('value', parseFloat(e.target.value) || 0)}
                                className={inputClass + ' w-full'}
                                step="any"
                            />
                        </label>

                        {/* Target */}
                        <label className="space-y-0.5">
                            <span className="text-[10px] text-gray-500">Target</span>
                            <select
                                value={buff.target}
                                onChange={(e) => update('target', e.target.value as Target)}
                                className={selectClass + ' w-full'}
                            >
                                {ALL_TARGETS.map(t => (
                                    <option key={t} value={t}>{TARGET_LABELS[t]}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-500">信頼度:</span>
                        {(['certain', 'inferred', 'uncertain'] as const).map(c => (
                            <label key={c} className="flex items-center gap-1 text-xs">
                                <input
                                    type="radio"
                                    name={`confidence-${buff.id}`}
                                    checked={confidence === c}
                                    onChange={() => update('confidence', c)}
                                    className="w-3 h-3"
                                />
                                <span className={CONFIDENCE_LABELS[c].color}>
                                    {CONFIDENCE_LABELS[c].label}
                                </span>
                            </label>
                        ))}
                    </div>

                    {/* Condition tags */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-500">条件タグ:</span>
                        <div className="flex flex-wrap gap-1">
                            {ALL_CONDITION_TAGS.map(tag => {
                                const active = (buff.conditionTags ?? []).includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleConditionTag(tag)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                            active
                                                ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                                                : 'bg-transparent border-[#1f2a3d] text-gray-500 hover:text-gray-300 hover:border-gray-500'
                                        }`}
                                    >
                                        {CONDITION_TAG_LABELS[tag]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Advanced settings */}
                    <details
                        open={showAdvanced}
                        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
                    >
                        <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300">
                            詳細設定
                        </summary>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {/* Duplicate */}
                            <label className="flex items-center gap-1.5 text-xs text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={buff.isDuplicate ?? false}
                                    onChange={(e) => update('isDuplicate', e.target.checked)}
                                    className="w-3 h-3"
                                />
                                効果重複
                            </label>

                            {buff.isDuplicate && (
                                <label className="space-y-0.5">
                                    <span className="text-[10px] text-gray-500">重複効率(%)</span>
                                    <input
                                        type="number"
                                        value={buff.duplicateEfficiency ?? 100}
                                        onChange={(e) => update('duplicateEfficiency', parseFloat(e.target.value) || 100)}
                                        className={inputClass + ' w-full'}
                                    />
                                </label>
                            )}

                            {/* NonStacking */}
                            <label className="flex items-center gap-1.5 text-xs text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={buff.nonStacking ?? false}
                                    onChange={(e) => update('nonStacking', e.target.checked)}
                                    className="w-3 h-3"
                                />
                                重複なし
                            </label>

                            {/* Stackable */}
                            <label className="flex items-center gap-1.5 text-xs text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={buff.stackable ?? false}
                                    onChange={(e) => update('stackable', e.target.checked)}
                                    className="w-3 h-3"
                                />
                                スタック可能
                            </label>

                            {buff.stackable && (
                                <label className="space-y-0.5">
                                    <span className="text-[10px] text-gray-500">最大スタック</span>
                                    <input
                                        type="number"
                                        value={buff.maxStacks ?? 1}
                                        onChange={(e) => update('maxStacks', parseInt(e.target.value) || 1)}
                                        className={inputClass + ' w-full'}
                                        min={1}
                                    />
                                </label>
                            )}

                            {/* Dynamic */}
                            <label className="flex items-center gap-1.5 text-xs text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={buff.isDynamic ?? false}
                                    onChange={(e) => update('isDynamic', e.target.checked)}
                                    className="w-3 h-3"
                                />
                                動的バフ
                            </label>

                            {buff.isDynamic && (
                                <>
                                    <label className="space-y-0.5">
                                        <span className="text-[10px] text-gray-500">動的タイプ</span>
                                        <select
                                            value={buff.dynamicType ?? ''}
                                            onChange={(e) => update('dynamicType', e.target.value as DynamicBuffType)}
                                            className={selectClass + ' w-full'}
                                        >
                                            <option value="">選択...</option>
                                            {ALL_DYNAMIC_TYPES.map(dt => (
                                                <option key={dt} value={dt}>{DYNAMIC_TYPE_LABELS[dt]}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-0.5">
                                        <span className="text-[10px] text-gray-500">単位あたり値</span>
                                        <input
                                            type="number"
                                            value={buff.unitValue ?? 0}
                                            onChange={(e) => update('unitValue', parseFloat(e.target.value) || 0)}
                                            className={inputClass + ' w-full'}
                                            step="any"
                                        />
                                    </label>
                                </>
                            )}

                            {/* Note */}
                            <label className="space-y-0.5 col-span-full">
                                <span className="text-[10px] text-gray-500">メモ</span>
                                <input
                                    type="text"
                                    value={buff.note ?? ''}
                                    onChange={(e) => update('note', e.target.value || undefined)}
                                    className={inputClass + ' w-full'}
                                    placeholder="補足情報..."
                                />
                            </label>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}

export const BuffEditor: React.FC<BuffEditorProps> = ({ buffs, groupLabel, onChange, rawTexts }) => {
    const handleUpdate = (index: number, updated: Buff) => {
        const next = [...buffs];
        next[index] = updated;
        onChange(next);
    };

    const handleRemove = (index: number) => {
        onChange(buffs.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        const sourceMap: Record<string, Buff['source']> = {
            '特技': 'self_skill',
            '計略': 'strategy',
            '特殊能力': 'special_ability',
        };
        const groupMap: Record<string, Buff['buffGroup']> = {
            '特技': 'skills',
            '計略': 'strategies',
            '特殊能力': 'specialAbilities',
        };
        const newBuff: Buff = {
            id: createBuffId(),
            stat: 'attack',
            mode: 'percent_max',
            value: 0,
            source: sourceMap[groupLabel] ?? 'self_skill',
            target: 'self',
            isActive: true,
            confidence: 'certain',
            buffGroup: groupMap[groupLabel],
        };
        onChange([...buffs, newBuff]);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-300">
                    {groupLabel}バフ
                    <span className="ml-1.5 text-xs text-gray-500">({buffs.length}件)</span>
                </h4>
                <button
                    onClick={handleAdd}
                    className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/30 rounded hover:bg-blue-600/20 transition-colors"
                >
                    + 追加
                </button>
            </div>

            {/* Raw texts display */}
            {rawTexts && rawTexts.length > 0 && (
                <details className="text-[11px]">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                        元テキスト ({rawTexts.length}件)
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-gray-400 bg-[#0b101b] rounded px-2 py-1.5 border border-[#1f2a3d]">
                        {rawTexts.map((t, i) => (
                            <li key={i}>{t}</li>
                        ))}
                    </ul>
                </details>
            )}

            {buffs.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">バフなし</p>
            ) : (
                <div className="space-y-1.5">
                    {buffs.map((buff, i) => (
                        <SingleBuffEditor
                            key={buff.id}
                            buff={buff}
                            onUpdate={(updated) => handleUpdate(i, updated)}
                            onRemove={() => handleRemove(i)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
