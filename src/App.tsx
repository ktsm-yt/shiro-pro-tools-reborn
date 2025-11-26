import { useState } from 'react';
import { FormationGrid } from './ui/components/FormationGrid';
import { BuffMatrix } from './ui/components/BuffMatrix';
import { AttackerAnalysisModal } from './ui/components/AttackerAnalysisModal';
import { WikiImporter } from './ui/components/WikiImporter';
import { MOCK_FORMATION } from './core/mock/data';
import { calcBuffMatrix } from './core/logic/buffs';
import type { Character, Formation } from './core/types';

function App() {
  // 編成データ
  const [formation, setFormation] = useState<Formation>(MOCK_FORMATION);

  // 選択されたキャラクター（分析用）
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // Wikiインポーターの状態
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  const handleCharacterClick = (char: Character) => {
    setSelectedCharacter(char);
    setIsAnalysisModalOpen(true);
  };

  const handleCharacterImported = (character: Character) => {
    // 編成に空きスロットがあればキャラクターを追加
    const emptyIndex = formation.slots.findIndex(slot => slot === null);
    if (emptyIndex !== -1) {
      const newSlots = [...formation.slots];
      newSlots[emptyIndex] = character;
      setFormation({ ...formation, slots: newSlots });
    } else {
      alert('編成が満杯です。既存のキャラクターを削除してから追加してください。');
    }
  };

  // バフマトリックスを再計算
  const buffMatrix = calcBuffMatrix(formation);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">ShiroPro Tools (Reborn)</h1>
            <p className="text-slate-600">御城プロジェクト:RE 統合計算ツール</p>
          </div>
          <button
            onClick={() => setIsImporterOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>📥</span>
            Wiki インポート
          </button>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-slate-700">編成 & バフ・マトリックス</h2>
          <div className="space-y-6">
            <FormationGrid
              formation={formation}
              onCharacterClick={handleCharacterClick}
            />
            <BuffMatrix formation={formation} matrix={buffMatrix} />
          </div>
        </section>
      </div>

      <AttackerAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        character={selectedCharacter}
      />

      <WikiImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onCharacterImported={handleCharacterImported}
      />
    </div>
  );
}

export default App;
