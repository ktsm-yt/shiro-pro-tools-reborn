/**
 * ダメージ計算画面
 * 
 * ダメージ計算機能のメイン画面
 */

import { useEffect, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { Character, Formation } from '../../core/types';
import { EnvironmentPanel } from '../components/EnvironmentPanel';
import { SortableCharacterCard } from '../components/SortableCharacterCard';
import { DetailPanel } from '../components/DetailPanel';
import { useEnvironmentSettings } from '../hooks/useEnvironmentSettings';
import { useDamageCalculation } from '../hooks/useDamageCalculation';

interface DamageCalculatorProps {
    formation?: Formation;
}

export function DamageCalculator({ formation }: DamageCalculatorProps) {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

    // 編成データが変更されたらキャラクターリストを更新
    useEffect(() => {
        if (formation) {
            const validCharacters = formation.slots.filter((c): c is Character => c !== null);
            setCharacters([...validCharacters]);
        }
    }, [formation]);

    const { settings, setSettings, reset } = useEnvironmentSettings();
    const { results, comparisons } = useDamageCalculation(characters, settings);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCharacters((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const selectedResult = selectedCharacterId ? results[selectedCharacterId] : null;
    const selectedCharacter = characters.find((c) => c.id === selectedCharacterId);

    const handleRemoveCharacter = (id: string) => {
        setCharacters((prev) => prev.filter((c) => c.id !== id));
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* ヘッダー */}
                <header className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">ダメージ計算</h1>
                    <p className="text-gray-600 mt-2">
                        環境設定を変更して、各キャラクターのダメージとDPSを確認できます
                    </p>
                </header>

                {/* 環境設定パネル */}
                <EnvironmentPanel
                    settings={settings}
                    onChange={setSettings}
                    onReset={reset}
                />

                {/* キャラクター一覧 */}
                {characters.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={characters.map((c) => c.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                {characters.map((character) => (
                                    <SortableCharacterCard
                                        key={character.id}
                                        character={character}
                                        result={results[character.id]}
                                        comparison={comparisons[character.id]}
                                        onShowDetails={() => setSelectedCharacterId(character.id)}
                                        onRemove={() => handleRemoveCharacter(character.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            キャラクターが登録されていません
                        </p>
                        <p className="text-gray-400 mt-2">
                            編成画面からキャラクターを追加してください
                        </p>
                    </div>
                )}

                {/* 詳細パネル */}
                {selectedResult && selectedCharacter && (
                    <DetailPanel
                        result={selectedResult}
                        characterName={selectedCharacter.name}
                        onClose={() => setSelectedCharacterId(null)}
                    />
                )}
            </div>
        </div>
    );
}
