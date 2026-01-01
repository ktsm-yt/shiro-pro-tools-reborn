/**
 * ダメージ計算画面（統合UI版）
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Character, DamageCalculationResult, Formation } from '../../core/types';
import { EnvironmentPanel } from '../components/EnvironmentPanel';
import { CompactCharacterCard } from '../components/CompactCharacterCard';
import { CharacterSidebar } from '../components/CharacterSidebar';
import { MOCK_CHARS } from '../../core/mock/data';
import { getWeaponMeta } from '../constants/meta';
import { useEnvironmentSettings } from '../hooks/useEnvironmentSettings';
import { useDamageCalculation } from '../hooks/useDamageCalculation';

interface DamageCalculatorProps {
  formation?: Formation;
}

const fmt = (n: number) => Math.floor(n).toLocaleString();
const fmtFull = (n: number) => Math.floor(n).toLocaleString();

const DetailModal = ({
  character,
  result,
  prevResult,
  onClose,
}: {
  character: Character | null;
  result?: DamageCalculationResult;
  prevResult?: DamageCalculationResult;
  onClose: () => void;
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!character || !result) return null;

  const Row = ({ l, v, prev }: { l: string; v: string | number; prev?: string | number }) => (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{l}</span>
      <div className="text-right">
        <span className="text-white">{typeof v === 'number' ? fmtFull(v) : v}</span>
        {prev !== undefined && prev !== v && (
          <span className="text-gray-500 text-xs ml-2">(前: {typeof prev === 'number' ? fmtFull(prev) : prev})</span>
        )}
      </div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="mb-3">
      <div className="text-xs text-gray-500 mb-1.5">{title}</div>
      <div className="bg-gray-800/50 rounded-lg p-2.5 space-y-1">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-96 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <span className="text-base font-medium text-white">{character.name}</span>
          <span className="text-xs text-gray-500">ESC で閉じる</span>
        </div>
        <div className="p-4">
          <div className="flex justify-around mb-4 text-center">
            <div>
              <div className="text-xl font-bold text-white">{fmt(result.totalDamage)}</div>
              {prevResult && prevResult.totalDamage !== result.totalDamage && (
                <div className="text-xs text-gray-500">前: {fmt(prevResult.totalDamage)}</div>
              )}
              <div className="text-xs text-gray-500">Damage</div>
            </div>
            <div>
              <div className="text-xl font-bold text-yellow-400">{fmt(result.dps)}</div>
              {prevResult && prevResult.dps !== result.dps && (
                <div className="text-xs text-gray-500">前: {fmt(prevResult.dps)}</div>
              )}
              <div className="text-xs text-gray-500">DPS</div>
            </div>
            {result.inspireAmount && (
              <div>
                <div className="text-xl font-bold text-green-400">+{fmt(result.inspireAmount)}</div>
                {prevResult?.inspireAmount && prevResult.inspireAmount !== result.inspireAmount && (
                  <div className="text-xs text-gray-500">前: +{fmt(prevResult.inspireAmount)}</div>
                )}
                <div className="text-xs text-gray-500">鼓舞</div>
              </div>
            )}
          </div>

          <Section title="Phase1: 攻撃力の確定">
            <Row l="基礎攻撃" v={result.breakdown.phase1.baseAttack} />
            <Row l="割合バフ" v={`+${result.breakdown.phase1.percentBuffApplied}%`} />
            {result.breakdown.phase1.flatBuffApplied > 0 && <Row l="固定値" v={`+${fmtFull(result.breakdown.phase1.flatBuffApplied)}`} />}
            {result.breakdown.phase1.additiveBuffApplied > 0 && (
              <Row
                l="加算"
                v={`+${fmtFull(result.breakdown.phase1.additiveBuffApplied)}`}
                prev={
                  prevResult?.breakdown.phase1.additiveBuffApplied
                    ? `+${fmtFull(prevResult.breakdown.phase1.additiveBuffApplied)}`
                    : undefined
                }
              />
            )}
            {result.breakdown.phase1.duplicateBuffApplied > 0 && <Row l="効果重複" v={`×${(1 + result.breakdown.phase1.duplicateBuffApplied / 100).toFixed(2)}`} />}
            <Row l="最終攻撃力" v={result.breakdown.phase1.finalAttack} prev={prevResult?.breakdown.phase1.finalAttack} />
          </Section>

          <Section title="Phase2: 倍率適用">
            {result.breakdown.phase2.multipliers.map((m, i) => (
              <Row key={i} l={`× ${m.type}`} v={`×${m.value}`} />
            ))}
            <Row l="ダメージ" v={result.breakdown.phase2.damage} prev={prevResult?.breakdown.phase2.damage} />
          </Section>

          <Section title="Phase3: 防御減算">
            <Row l="有効防御" v={result.breakdown.phase3.effectiveDefense} prev={prevResult?.breakdown.phase3.effectiveDefense} />
            <Row l="ダメージ" v={result.breakdown.phase3.damage} prev={prevResult?.breakdown.phase3.damage} />
          </Section>

          <Section title="Phase4: 与/被ダメ">
            <Row l="ダメージ" v={result.breakdown.phase4.damage} prev={prevResult?.breakdown.phase4.damage} />
          </Section>

          {result.breakdown.phase5 && (
            <Section title="Phase5: 連撃">
              <Row l="連撃数" v={`×${result.breakdown.phase5.attackCount}`} />
              <Row l="合計" v={result.breakdown.phase5.totalDamage} prev={prevResult?.breakdown.phase5?.totalDamage} />
            </Section>
          )}

          <Section title="DPS計算">
            <Row l="攻撃F" v={`${result.breakdown.dps.attackFrames.toFixed(1)}f`} prev={prevResult ? `${prevResult.breakdown.dps.attackFrames.toFixed(1)}f` : undefined} />
            <Row l="隙F" v={`${result.breakdown.dps.gapFrames.toFixed(1)}f`} prev={prevResult ? `${prevResult.breakdown.dps.gapFrames.toFixed(1)}f` : undefined} />
            <Row l="攻撃/秒" v={result.breakdown.dps.attacksPerSecond.toFixed(2)} prev={prevResult?.breakdown.dps.attacksPerSecond.toFixed(2)} />
            <Row l="DPS" v={result.breakdown.dps.dps} prev={prevResult?.breakdown.dps.dps} />
          </Section>
        </div>
      </div>
    </div>
  );
};

export function DamageCalculator({ formation }: DamageCalculatorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (formation) {
      const validCharacters = formation.slots.filter((c): c is Character => c !== null);
      setCharacters([...validCharacters]);
    }
  }, [formation]);

  const formationIds = useMemo(() => characters.map((c) => c.id), [characters]);

  const addCharacter = (char: Character) => {
    if (formationIds.includes(char.id)) return;
    setCharacters((prev) => [...prev, char]);
  };

  const { settings, setSettings, reset } = useEnvironmentSettings();
  const { results, comparisons } = useDamageCalculation(characters, settings);

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) || null;
  const selectedResult = selectedCharacter ? results[selectedCharacter.id] : undefined;
  const selectedPrev = selectedCharacter ? comparisons[selectedCharacter.id]?.before : undefined;

  const totalDPS = useMemo(() => Object.values(results).reduce((sum, r) => sum + (r?.dps || 0), 0), [results]);
  const baseTotalDPS = useMemo(() => {
    const comps = Object.values(comparisons);
    if (!comps.length) return totalDPS;
    return comps.reduce((sum, c) => sum + (c.before?.dps || 0), 0);
  }, [comparisons, totalDPS]);

  const counts = useMemo(() => {
    let melee = 0;
    let ranged = 0;
    const attrs: Record<string, number> = {};
    characters.forEach((c) => {
      const meta = getWeaponMeta(c.weapon);
      if (meta.range === 'ranged') ranged += 1;
      else melee += 1;
      const attrKey = c.attributes?.[0] ?? '';
      attrs[attrKey] = (attrs[attrKey] || 0) + 1;
    });
    return { melee, ranged, attrs, total: characters.length };
  }, [characters]);

  const handleClear = () => {
    setCharacters([]);
    setSelectedCharacterId(null);
  };

  const handleSave = () => {
    try {
      localStorage.setItem('shiropro-damage-formation', JSON.stringify(characters));
    } catch {
      // noop
    }
  };

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      <CharacterSidebar
        characters={MOCK_CHARS}
        formationIds={formationIds}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((v) => !v)}
        onSelect={addCharacter}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-400">ShiroPro Tools (Reborn)</p>
              <h1 className="text-2xl font-bold">ダメージ計算</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>近 <span className="text-white font-medium">{counts.melee}</span></span>
              <span className="text-gray-700">|</span>
              <span>遠 <span className="text-white font-medium">{counts.ranged}</span></span>
              <span className="text-gray-700">|</span>
              <span>平 <span className="text-white font-medium">{counts.attrs['plain'] || 0}</span></span>
              <span>平山 <span className="text-white font-medium">{counts.attrs['plain_mountain'] || 0}</span></span>
              <span className="text-gray-700">|</span>
              <span><span className="text-white font-medium">{counts.total}</span>/8</span>
              <span className="text-gray-700">|</span>
              <span>
                合計DPS <span className="text-yellow-400 font-medium">{fmt(totalDPS)}</span>
                {baseTotalDPS !== totalDPS && (
                  <span className="text-gray-500 ml-1">(前: {fmt(baseTotalDPS)})</span>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button onClick={handleClear} className="text-gray-500 hover:text-white">Clear</button>
            <button onClick={handleSave} className="flex items-center gap-1 text-gray-500 hover:text-white">
              💾 Save
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium">
              Import
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex flex-col lg:flex-row gap-5">
            <section className="flex-1 min-w-0">
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm">アタッカー一覧</h2>
                  <p className="text-xs text-gray-500">クリックで詳細・🗑で削除</p>
                </div>
                {characters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {characters.map((character) => (
                      <CompactCharacterCard
                        key={character.id}
                        character={character}
                        result={results[character.id]}
                        comparison={comparisons[character.id]}
                        onShowDetails={() => setSelectedCharacterId(character.id)}
                        onRemove={() => setCharacters((prev) => prev.filter((c) => c.id !== character.id))}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center text-gray-500">
                    左のキャラ一覧から追加してください
                  </div>
                )}
              </div>
            </section>
            <aside className="w-full lg:w-80 shrink-0">
              <EnvironmentPanel settings={settings} onChange={setSettings} onReset={reset} />
            </aside>
          </div>
        </main>
      </div>

      <DetailModal
        character={selectedCharacter}
        result={selectedResult}
        prevResult={selectedPrev}
        onClose={() => setSelectedCharacterId(null)}
      />
    </div>
  );
}
