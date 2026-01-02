import { useMemo, useState, useEffect, useRef } from 'react';
import type { Character, Formation } from './core/types';
import { CharacterSidebar } from './ui/components/CharacterSidebar';
import { FormationSlot } from './ui/components/FormationSlot';
import { BuffMatrix } from './ui/components/BuffMatrix';
import { CharacterModal } from './ui/components/CharacterModal';
import { WikiImporter } from './ui/components/WikiImporter';
import { RightSidebar } from './ui/components/RightSidebar';
import { DamageAnalysis } from './ui/components/DamageAnalysis';
import { buildVisualBuffMatrix } from './ui/utils/visualBuffMatrix';
import { useEnvironmentSettings } from './ui/hooks/useEnvironmentSettings';
import { useDamageCalculation } from './ui/hooks/useDamageCalculation';
import { useCharacterStorage } from './ui/hooks/useCharacterStorage';
import { useFormationStorage } from './ui/hooks/useFormationStorage';
import { getAttributeMeta, isRangedWeapon } from './ui/constants/meta';
import { loadCharacters } from './core/storage';
import { FormationSaveModal } from './ui/components/FormationSaveModal';
import { ConfirmModal } from './ui/components/ConfirmModal';
import { checkMapConstraints, type MapConstraints } from './core/logic/mapConstraints';

// Simple Formation Saver UI Component
import { Save, FolderOpen, Trash2, AlertTriangle, Users, ChevronDown } from 'lucide-react';

type ActiveTab = 'matrix' | 'analysis';

const SESSION_KEY = 'shiropro_reborn_session';

export default function App() {
  // --- State ---
  const [formation, setFormation] = useState<Formation>({ slots: Array(8).fill(null) });
  const [activeTab, setActiveTab] = useState<ActiveTab>('matrix');
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false); // For matrix detail
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isDeleteCharacterConfirmOpen, setIsDeleteCharacterConfirmOpen] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [mapConstraint, setMapConstraint] = useState<MapConstraints | null>(null);
  const [terrainSlots, setTerrainSlots] = useState<Record<string, number | null>>({});
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const mapSettingsRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  const loadMenuRef = useRef<HTMLDivElement | null>(null);
  const isSessionRestoredRef = useRef(false);

  // Persistence Hooks
  const { savedCharacters, addCharacter: saveCharacter, removeCharacter: deleteCharacterFromStorage, updateCharacter: updateCharacterInStorage } = useCharacterStorage();
  const { savedFormations, saveFormation: saveFormationToStorage, deleteFormation: deleteFormationFromStorage } = useFormationStorage();

  // Environment & Calc
  const { settings: env, setSettings: setEnv, reset: resetEnv } = useEnvironmentSettings();

  // All characters from storage
  const allCharacters = useMemo(() => savedCharacters, [savedCharacters]);

  const savedCharacterIds = useMemo(() => new Set(savedCharacters.map(c => c.id)), [savedCharacters]);

  // Load last formation on mount (Auto-load)
  useEffect(() => {
    const savedSlotsJson = localStorage.getItem('shiropro_reborn_current_slots');
    if (savedSlotsJson) {
      try {
        const slotIds = JSON.parse(savedSlotsJson) as (string | null)[];

        // Hydrate from storage
        const chars = loadCharacters();
        const map = new Map<string, Character>();
        chars.forEach(c => map.set(c.id, c));

        const finalSlots = slotIds.map(id => {
          if (!id) return null;
          return map.get(id) || null;
        });
        setFormation({ slots: finalSlots });
      } catch (e) {
        console.error("Failed to auto-load slots", e);
      }
    }
  }, []);

  // Auto-save slots
  useEffect(() => {
    const slotIds = formation.slots.map(c => c?.id || null);
    localStorage.setItem('shiropro_reborn_current_slots', JSON.stringify(slotIds));
  }, [formation]);

  // --- Session Persistence (UI state, selected char, tab) ---
  useEffect(() => {
    if (isSessionRestoredRef.current) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        activeTab?: ActiveTab;
        isLeftSidebarCollapsed?: boolean;
        isRightSidebarCollapsed?: boolean;
        selectedCharacterId?: string | null;
      };

      if (data.activeTab) setActiveTab(data.activeTab);
      if (typeof data.isLeftSidebarCollapsed === 'boolean') setIsLeftSidebarCollapsed(data.isLeftSidebarCollapsed);
      if (typeof data.isRightSidebarCollapsed === 'boolean') setIsRightSidebarCollapsed(data.isRightSidebarCollapsed);

      if (data.selectedCharacterId) {
        const found = allCharacters.find(c => c.id === data.selectedCharacterId) || null;
        setSelectedCharacter(found);
      }
    } catch (e) {
      console.error('Failed to restore session', e);
    } finally {
      isSessionRestoredRef.current = true;
    }
  }, [allCharacters]);

  useEffect(() => {
    const payload = {
      activeTab,
      isLeftSidebarCollapsed,
      isRightSidebarCollapsed,
      selectedCharacterId: selectedCharacter?.id ?? null,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to persist session', e);
    }
  }, [activeTab, isLeftSidebarCollapsed, isRightSidebarCollapsed, selectedCharacter]);


  // Derived
  const activeChars = useMemo(() => formation.slots.filter((c): c is Character => Boolean(c)), [formation]);
  const formationIds = useMemo(() => activeChars.map(c => c.id), [activeChars]);
  const visualMatrix = useMemo(() => buildVisualBuffMatrix(formation), [formation]);

  // マップ制約チェック
  const constraintResult = useMemo(() => {
    if (!mapConstraint) return null;
    return checkMapConstraints(formation, mapConstraint);
  }, [formation, mapConstraint]);

  // Damage Calculation
  const { results, comparisons } = useDamageCalculation(activeChars, env);

  // --- Handlers ---

  const handleEnvReset = () => {
    resetEnv();
  };

  const addCharacter = (char: Character) => {
    if (formationIds.includes(char.id)) return;
    const emptyIndex = formation.slots.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      alert('編成が満杯です。既存キャラを外してください。');
      return;
    }
    setFormation((prev) => {
      const slots = [...prev.slots];
      slots[emptyIndex] = char;
      return { ...prev, slots };
    });
  };

  const removeCharacter = (indexOrId: number | string) => {
    setFormation((prev) => {
      const slots = [...prev.slots];
      if (typeof indexOrId === 'number') {
        slots[indexOrId] = null;
      } else {
        const idx = slots.findIndex(c => c?.id === indexOrId);
        if (idx !== -1) slots[idx] = null;
      }
      return { ...prev, slots };
    });
  };

  const requestDeleteCharacter = (character: Character) => {
    if (!savedCharacterIds.has(character.id)) return;
    setCharacterToDelete(character);
    setIsDeleteCharacterConfirmOpen(true);
  };

  const closeDeleteCharacterConfirm = () => {
    setIsDeleteCharacterConfirmOpen(false);
    setCharacterToDelete(null);
  };

  const confirmDeleteCharacter = () => {
    if (!characterToDelete) return;

    deleteCharacterFromStorage(characterToDelete.id);
    removeCharacter(characterToDelete.id); // Remove from current formation if present
    if (selectedCharacter?.id === characterToDelete.id) setSelectedCharacter(null);

    closeDeleteCharacterConfirm();
  };

  const clearFormation = () => {
    setFormation({ slots: Array(8).fill(null) });
    setSelectedCharacter(null);
    setIsClearConfirmOpen(false);
  };

  const handleCharacterImported = (character: Character) => {
    saveCharacter(character); // Save to storage
    addCharacter(character);
    setIsImporterOpen(false);
  };

  // キャラクター更新ハンドラ（ストレージと編成の両方を更新）
  const handleUpdateCharacter = (updated: Character) => {
    // ストレージを更新
    updateCharacterInStorage(updated);
    // 編成内のキャラクターも更新
    setFormation((prev) => ({
      ...prev,
      slots: prev.slots.map(slot =>
        slot?.id === updated.id ? updated : slot
      ),
    }));
  };

  // Formation Load/Save Handlers
  const handleSaveFormation = (name: string) => {
    saveFormationToStorage(name, formation);
    setIsSaveModalOpen(false);
  };

  const handleLoadFormation = (id: string) => {
    const target = savedFormations.find(f => f.id === id);
    if (!target) return;

    const newSlots = target.slotIds.map(charId => {
      if (!charId) return null;
      return allCharacters.find(c => c.id === charId) || null;
    });
    setFormation({ slots: newSlots });
    setIsLoadMenuOpen(false);
  };

  const onCharClick = (char: Character) => {
    setSelectedCharacter(char);
    // 右サイドバーが閉じている場合は開く（詳細を表示するため）
    if (isRightSidebarCollapsed) {
      setIsRightSidebarCollapsed(false);
    }

    // Matrixモードでかつモーダルで見たい場合のレガシーサポート（必要なら残す、今回は右サイドバー統合なので基本使わないが、Matrixでクリックしたときはモーダルがいい？）
    // → 要望に従い右ペイン推奨だが、Matrixのクリック時の挙動は右サイドバーに表示させることにする
    // ただし、CharacterModalも残しておき、必要に応じて使えるようにする
    // setIsModalOpen(true); 
  };

  // Tab Switcher Component
  const TabSwitcher = () => (
    <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
      <button
        onClick={() => setActiveTab('matrix')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'matrix'
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
          }`}
      >
        編成 & Matrix
      </button>
      <button
        onClick={() => setActiveTab('analysis')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analysis'
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
          }`}
      >
        Analysis
      </button>
    </div>
  );

  // Summary logic
  const summary = useMemo(() => {
    let melee = 0;
    let ranged = 0;
    const attrs: Record<string, number> = {};
    activeChars.forEach((c) => {
      if (isRangedWeapon(c.weapon)) ranged++;
      else melee++;
      const meta = getAttributeMeta(c).meta;
      attrs[meta.label] = (attrs[meta.label] || 0) + 1;
    });
    return { melee, ranged, attrs, total: activeChars.length };
  }, [activeChars]);

  const suggestedFormationName = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const timeLabel = `${mm}/${dd} ${hh}:${mi}`;
    if (activeChars.length === 0) return `新規編成 ${timeLabel}`;
    const names = activeChars.slice(0, 3).map(c => c.name).join('・');
    return `${names}${activeChars.length > 3 ? '…' : ''} ${timeLabel}`;
  }, [activeChars]);

  // Close load dropdown on outside click / Esc
  useEffect(() => {
    if (!isLoadMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!loadMenuRef.current) return;
      if (!loadMenuRef.current.contains(e.target as Node)) {
        setIsLoadMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLoadMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isLoadMenuOpen]);

  // Close map settings on outside click / Esc
  useEffect(() => {
    if (!isMapSettingsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!mapSettingsRef.current) return;
      if (!mapSettingsRef.current.contains(e.target as Node)) {
        setIsMapSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMapSettingsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMapSettingsOpen]);

  // Close summary on outside click / Esc
  useEffect(() => {
    if (!isSummaryOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!summaryRef.current) return;
      if (!summaryRef.current.contains(e.target as Node)) {
        setIsSummaryOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSummaryOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isSummaryOpen]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden font-sans">

      {/* Full Width Header */}
      <header className="px-4 py-2 border-b border-gray-800 bg-[#0f1626] flex flex-wrap items-center gap-3 shadow-sm z-20">
        {/* Left: Title */}
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">ShiroPro Tools Reborn</p>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {activeTab === 'matrix' ? '編成 & バフマトリックス' : 'ダメージ計算 & 分析'}
            </h1>
          </div>
        </div>

        {/* Center: TabSwitcher */}
        <div className="shrink-0">
          <TabSwitcher />
        </div>

        {/* Spacer to push right content */}
        <div className="flex-1 min-w-0"></div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Formation Summary - Full version for large screens */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-800">
            <span className="flex items-center gap-1">近 <span className="text-white font-medium">{summary.melee}</span></span>
            <span className="w-px h-3 bg-gray-700"></span>
            <span className="flex items-center gap-1">遠 <span className="text-white font-medium">{summary.ranged}</span></span>
            <span className="w-px h-3 bg-gray-700"></span>
            <div className="flex items-center gap-2">
              {Object.entries(summary.attrs).map(([label, count]) => (
                <span key={label} className="flex items-center gap-1">
                  {label} <span className="text-white font-medium">{count}</span>
                </span>
              ))}
            </div>
            <span className="w-px h-3 bg-gray-700"></span>
            <span><span className="text-white font-medium">{summary.total}</span>/8</span>
          </div>

          {/* Formation Summary - Compact version for smaller screens */}
          <div className="lg:hidden relative" ref={summaryRef}>
            <button
              onClick={() => setIsSummaryOpen(!isSummaryOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition-colors ${
                isSummaryOpen
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Users size={14} />
              <span className="font-medium">{summary.total}/8</span>
              <ChevronDown size={12} className={`transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSummaryOpen && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 z-50 min-w-[140px]">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">近</span>
                    <span className="text-white font-medium">{summary.melee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">遠</span>
                    <span className="text-white font-medium">{summary.ranged}</span>
                  </div>
                  {Object.entries(summary.attrs).length > 0 && (
                    <div className="border-t border-gray-700 pt-2 space-y-1">
                      {Object.entries(summary.attrs).map(([label, count]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-white font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Map Settings Button + Popover */}
          <div className="relative" ref={mapSettingsRef}>
            <button
              onClick={() => setIsMapSettingsOpen(!isMapSettingsOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition-colors ${
                isMapSettingsOpen
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>🗺️</span>
              <span>マップ</span>
              {constraintResult && !constraintResult.isValid && (
                <AlertTriangle size={12} className="text-red-400" />
              )}
            </button>
            {isMapSettingsOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 z-50 min-w-[180px]">
                <div className="text-xs text-gray-400 mb-2">配置制約</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-300 w-6">近</span>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={mapConstraint?.meleeSlots ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        if (val === null && !mapConstraint?.rangedSlots) {
                          setMapConstraint(null);
                        } else {
                          setMapConstraint(prev => ({ meleeSlots: val ?? 0, rangedSlots: prev?.rangedSlots ?? 0 }));
                        }
                      }}
                      placeholder="−"
                      className="w-12 bg-gray-900 border border-gray-600 text-xs text-center text-gray-200 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-300 w-6">遠</span>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={mapConstraint?.rangedSlots ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        if (val === null && !mapConstraint?.meleeSlots) {
                          setMapConstraint(null);
                        } else {
                          setMapConstraint(prev => ({ meleeSlots: prev?.meleeSlots ?? 0, rangedSlots: val ?? 0 }));
                        }
                      }}
                      placeholder="−"
                      className="w-12 bg-gray-900 border border-gray-600 text-xs text-center text-gray-200 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-2">
                  <div className="text-xs text-gray-400 mb-2">地形スロット</div>
                  <div className="grid grid-cols-2 gap-2">
                    {['平', '平山', '山', '水', '無'].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-300 w-6">{t}</span>
                        <input
                          type="number"
                          min={0}
                          max={8}
                          value={terrainSlots[t] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            setTerrainSlots(prev => ({ ...prev, [t]: val }));
                          }}
                          placeholder="−"
                          className="w-12 bg-gray-900 border border-gray-600 text-xs text-center text-gray-200 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-700 flex items-center justify-between">
                  {constraintResult ? (
                    <span className={`text-xs ${constraintResult.isValid ? 'text-green-400' : 'text-red-400'}`}>
                      {constraintResult.isValid ? '✓ 配置OK' : constraintResult.warnings.join(', ')}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">未設定</span>
                  )}
                  <button
                    onClick={() => {
                      setMapConstraint(null);
                      setTerrainSlots({});
                    }}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    リセット
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save/Load Controls */}
            <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700 mr-2" ref={loadMenuRef}>
              <button
                onClick={() => setIsSaveModalOpen(true)}
                title="編成を保存"
                className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
              >
                <Save size={16} />
              </button>
              <div className="relative">
                <button
                  title="編成を読み込み"
                  onClick={() => setIsLoadMenuOpen((v) => !v)}
                  className={`p-1.5 rounded transition-colors ${isLoadMenuOpen
                    ? 'text-green-400 bg-gray-700/70'
                    : 'text-gray-400 hover:text-green-400 hover:bg-gray-700/50'
                    }`}
                >
                  <FolderOpen size={16} />
                </button>
                {/* Dropdown for Load */}
                {isLoadMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="py-1 max-h-72 overflow-y-auto">
                      {savedFormations.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">保存された編成はありません</div>}
                      {savedFormations.map(f => (
                        <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-700 cursor-pointer group/item">
                          <span onClick={() => handleLoadFormation(f.id)} className="text-xs truncate flex-1">{f.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('削除しますか？')) deleteFormationFromStorage(f.id); }}
                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsClearConfirmOpen(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg text-xs font-medium transition-colors border border-gray-700 hover:border-red-900/50"
            >
              Clear
            </button>
            <button
              onClick={() => setIsImporterOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-blue-900/20"
            >
              Import
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Area (Sidebars + Content) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar */}
        <CharacterSidebar
          characters={allCharacters}
          formationIds={formationIds}
          collapsed={isLeftSidebarCollapsed}
          onToggle={() => setIsLeftSidebarCollapsed(prev => !prev)}
          onSelect={addCharacter}
          savedCharacterIds={savedCharacterIds}
          onDelete={requestDeleteCharacter}
        />

        {/* Center Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0b101b] relative z-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-[1600px] mx-auto space-y-6">

              {activeTab === 'matrix' && (
                <>
                  <section>
                    <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                      {formation.slots.map((char, index) => (
                        <FormationSlot
                          key={index}
                          index={index}
                          character={char}
                          onRemove={removeCharacter}
                          onOpenDetail={onCharClick}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="bg-[#131b2b] border border-[#1f2a3d] rounded-2xl p-5 shadow-xl shadow-black/20">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-sm text-gray-300 flex items-center gap-2">
                        <span>📊</span> バフ・マトリックス
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />味方にも</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />効果重複</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />自分だけ</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />計略</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />伏兵</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />動的</span>
                      </div>
                    </div>
                    <BuffMatrix formation={formation} matrix={visualMatrix} onCharClick={onCharClick} />
                  </section>
                </>
              )}

              {activeTab === 'analysis' && (
                <section className="h-full">
                  <DamageAnalysis
                    characters={activeChars}
                    results={results}
                    comparisons={comparisons}
                    env={env}
                    onCharClick={onCharClick}
                    onRemove={(id) => removeCharacter(id)}
                    onUpdateCharacter={handleUpdateCharacter}
                  />
                </section>
              )}
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          collapsed={isRightSidebarCollapsed}
          onToggle={() => setIsRightSidebarCollapsed(prev => !prev)}
          selectedChar={selectedCharacter}
          env={env}
          onEnvChange={setEnv}
          onEnvReset={handleEnvReset}
          activeTab={activeTab}
        />
      </div>

      {/* Modals */}
      <WikiImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onCharacterImported={handleCharacterImported}
      />

      <FormationSaveModal
        isOpen={isSaveModalOpen}
        suggestedName={suggestedFormationName}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveFormation}
      />

      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="編成をクリアしますか？"
        description="現在の編成スロットを空にします。この操作は取り消せません。"
        confirmLabel="クリアする"
        onConfirm={clearFormation}
        onClose={() => setIsClearConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteCharacterConfirmOpen}
        title="登録キャラを削除しますか？"
        description={
          characterToDelete
            ? `「${characterToDelete.name}」を一覧と保存データから削除します。編成中の場合は自動で外れます。保存済み編成に含まれている場合、読み込み時に空欄になります。`
            : undefined
        }
        confirmLabel="削除する"
        onConfirm={confirmDeleteCharacter}
        onClose={closeDeleteCharacterConfirm}
      />

      {/* Legacy Modal (Optionally used) */}
      <CharacterModal
        character={selectedCharacter}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedCharacter(null); }}
        currentBuffs={selectedCharacter ? visualMatrix[selectedCharacter.id] : undefined}
      />

    </div>
  );
}
