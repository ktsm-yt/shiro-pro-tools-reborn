import { useState, useMemo } from 'react';
import { FormationGrid } from './ui/components/FormationGrid';
import { BuffMatrix } from './ui/components/BuffMatrix';
import { WikiImport } from './ui/components/WikiImport';
import { MOCK_CHARS } from './core/mock/data';
import { calcBuffMatrix } from './core/logic/buffs';
import type { Formation, Character } from './core/types';

function App() {
  // Formation State
  const [formation, setFormation] = useState<Formation>({
    slots: [
      MOCK_CHARS[0], // 江戸
      MOCK_CHARS[1], // 彦根
      MOCK_CHARS[2], // 大阪
      null, null, null, null, null
    ]
  });

  const buffMatrix = useMemo(() => calcBuffMatrix(formation), [formation]);

  const handleImportCharacter = (char: Character) => {
    // 空いているスロットを探して追加
    const emptyIndex = formation.slots.findIndex(slot => slot === null);
    if (emptyIndex !== -1) {
      const newSlots = [...formation.slots];
      newSlots[emptyIndex] = char;
      setFormation({ slots: newSlots });
    } else {
      alert('編成枠がいっぱいです');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">ShiroPro Tools (Reborn)</h1>
          <p className="text-slate-600">Phase 2: Wiki Import Integration</p>
        </div>
        <div className="w-96">
          <WikiImport onImport={handleImportCharacter} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-l-4 border-blue-500 pl-3">編成 (Formation)</h2>
          <FormationGrid formation={formation} />
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 border-l-4 border-blue-500 pl-3">バフ・マトリックス (Buff Matrix)</h2>
          <BuffMatrix formation={formation} matrix={buffMatrix} />
        </section>
      </main>
    </div>
  );
}

export default App;
