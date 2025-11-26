import { useMemo } from 'react';
import { FormationGrid } from './ui/components/FormationGrid';
import { BuffMatrix } from './ui/components/BuffMatrix';
import { MOCK_CHARS } from './core/mock/data';
import { calcBuffMatrix } from './core/logic/buffs';
import type { Formation } from './core/types';

function App() {
  // Mock Formation (8 slots)
  const formation: Formation = useMemo(() => ({
    slots: [
      MOCK_CHARS[0], // 江戸
      MOCK_CHARS[1], // 彦根
      MOCK_CHARS[2], // 大阪
      null, null, null, null, null
    ]
  }), []);

  const buffMatrix = useMemo(() => calcBuffMatrix(formation), [formation]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ShiroPro Tools (Reborn)</h1>
        <p className="text-slate-600">Phase 1: Core Logic & Basic UI Verification</p>
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
