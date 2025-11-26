import { useState } from 'react';
import { FormationGrid } from './ui/components/FormationGrid';
import { BuffMatrix } from './ui/components/BuffMatrix';
import { AttackerAnalysisModal } from './ui/components/AttackerAnalysisModal';
import { MOCK_FORMATION, MOCK_BUFF_MATRIX } from './core/mock/data';
import type { Character } from './core/types';

function App() {
  // 選択されたキャラクター（分析用）
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  const handleCharacterClick = (char: Character) => {
    setSelectedCharacter(char);
    setIsAnalysisModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-800">ShiroPro Tools (Reborn)</h1>
          <p className="text-slate-600">御城プロジェクト:RE 統合計算ツール</p>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-slate-700">編成 & バフ・マトリックス</h2>
          <div className="space-y-6">
            <FormationGrid
              formation={MOCK_FORMATION}
              onCharacterClick={handleCharacterClick}
            />
            <BuffMatrix formation={MOCK_FORMATION} matrix={MOCK_BUFF_MATRIX} />
          </div>
        </section>
      </div>

      <AttackerAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        character={selectedCharacter}
        analysisData={selectedCharacter ? MOCK_BUFF_MATRIX[selectedCharacter.id] : undefined}
      />
    </div>
  );
}

export default App;
