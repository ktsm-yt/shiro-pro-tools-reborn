import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ========================================
// 定数・データ
// ========================================
const ATTRIBUTES = {
  plain: { name: '平', color: 'bg-green-600', light: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' },
  plain_mountain: { name: '平山', color: 'bg-lime-500', light: 'bg-lime-500/20', text: 'text-lime-400', border: 'border-lime-500' },
  mountain: { name: '山', color: 'bg-amber-700', light: 'bg-amber-700/20', text: 'text-amber-500', border: 'border-amber-600' },
  water: { name: '水', color: 'bg-blue-600', light: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500' },
  hell: { name: '地獄', color: 'bg-purple-600', light: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500' },
};

const WEAPONS = {
  sword: { name: '刀', icon: '⚔', range: 'melee' },
  spear: { name: '槍', icon: '🔱', range: 'melee' },
  hammer: { name: '槌', icon: '🔨', range: 'melee' },
  fist: { name: '拳', icon: '👊', range: 'melee' },
  bow: { name: '弓', icon: '🏹', range: 'ranged' },
  gun: { name: '鉄砲', icon: '🔫', range: 'ranged' },
  crossbow: { name: '石弓', icon: '🎯', range: 'ranged' },
  magic: { name: '杖', icon: '🪄', range: 'ranged' },
  fan: { name: '歌舞', icon: '💃', range: 'ranged' },
  bell: { name: '鈴', icon: '🔔', range: 'ranged' },
  ship: { name: '軍船', icon: '🚢', range: 'ranged' },
};

const WEAPON_FRAMES = {
  '刀': { attack: 19, gap: 22 }, '槍': { attack: 23, gap: 27 }, '槌': { attack: 27, gap: 30 },
  '弓': { attack: 19, gap: 18 }, '鉄砲': { attack: 29, gap: 27 }, '歌舞': { attack: 47, gap: 54 },
  '鈴': { attack: 134, gap: 0 }, '杖': { attack: 37, gap: 30 }, '軍船': { attack: 32, gap: 42 },
};

const BUFF_CATEGORIES = [
  { key: 'resource', name: '気・計略', stats: [{ key: 'cost', name: '気' }, { key: 'cooldown', name: '計略短縮' }] },
  { key: 'offense', name: '攻撃系', stats: [{ key: 'attack', name: '攻撃' }, { key: 'damage_dealt', name: '与ダメ' }, { key: 'range', name: '射程' }] },
  { key: 'defense', name: '防御系', stats: [{ key: 'defense', name: '防御' }, { key: 'damage_taken', name: '被ダメ軽減' }] },
  { key: 'speed', name: '速度系', stats: [{ key: 'attack_speed', name: '攻撃速度' }, { key: 'attack_gap', name: '攻撃後隙' }] },
];

const MOCK_CHARACTERS = [
  { id: '1', name: '大坂城', attribute: 'plain', weapon: 'fan', rarity: 7, cost: 28,
    baseStats: { hp: 3800, attack: 580, defense: 420, range: 280 },
    buffs: [{ stat: 'attack', value: 30, target: 'all', source: 'self' }, { stat: 'defense', value: 30, target: 'all', source: 'self' }],
    skills: [{ name: '天下の名城', description: '全城娘の攻撃と防御が30%上昇' }],
    calcData: { baseAttack: 580, percentBuffs: [{ value: 30, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [], defenseIgnore: false, attackSpeed: 0, gapReduction: 0, inspire: { stat: 'attack', value: 30, range: 280 } }
  },
  { id: '2', name: '姫路城', attribute: 'plain', weapon: 'bow', rarity: 7, cost: 25,
    baseStats: { hp: 3200, attack: 620, defense: 380, range: 320 },
    buffs: [{ stat: 'attack', value: 50, target: 'self', source: 'self' }, { stat: 'range', value: 20, target: 'self', source: 'self' }],
    skills: [{ name: '白鷺の舞', description: '自身の攻撃が50%、射程が20%上昇' }],
    calcData: { baseAttack: 620, percentBuffs: [{ value: 50, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [{ type: 'give_damage', value: 1.2 }], defenseIgnore: false, attackSpeed: 20, gapReduction: 0 }
  },
  { id: '3', name: '安土城', attribute: 'mountain', weapon: 'gun', rarity: 7, cost: 30,
    baseStats: { hp: 3000, attack: 680, defense: 350, range: 300 },
    buffs: [{ stat: 'attack', value: 40, target: 'range', source: 'self' }, { stat: 'damage_dealt', value: 25, target: 'self', source: 'self' }],
    skills: [{ name: '天下布武', description: '射程内の城娘の攻撃が40%上昇' }],
    calcData: { baseAttack: 680, percentBuffs: [{ value: 40, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [{ type: 'attack_multiple', value: 1.5 }, { type: 'give_damage', value: 1.25 }], defenseIgnore: false, attackSpeed: 0, gapReduction: 20 }
  },
  { id: '4', name: '彦根城', attribute: 'water', weapon: 'bell', rarity: 7, cost: 26,
    baseStats: { hp: 3400, attack: 520, defense: 450, range: 260 },
    buffs: [{ stat: 'attack', value: 25, target: 'range', source: 'self' }, { stat: 'defense', value: 30, target: 'range', source: 'self' }],
    skills: [{ name: '井伊の赤備え', description: '射程内の攻撃25%、防御30%上昇' }],
    calcData: { baseAttack: 520, percentBuffs: [{ value: 25, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [], defenseIgnore: false, attackSpeed: 0, gapReduction: 0 }
  },
  { id: '5', name: '江戸城', attribute: 'plain', weapon: 'fan', rarity: 7, cost: 32,
    baseStats: { hp: 3600, attack: 540, defense: 480, range: 270 },
    buffs: [{ stat: 'cost', value: 8, target: 'field', source: 'self' }, { stat: 'attack', value: 20, target: 'all', source: 'self' }],
    skills: [{ name: '徳川の威光', description: '気の自然増加+8、全城娘の攻撃20%上昇' }],
    calcData: { baseAttack: 540, percentBuffs: [{ value: 20, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [], defenseIgnore: false, attackSpeed: 0, gapReduction: 0 }
  },
  { id: '6', name: '熊本城', attribute: 'plain', weapon: 'sword', rarity: 7, cost: 29,
    baseStats: { hp: 3300, attack: 650, defense: 440, range: 150 },
    buffs: [{ stat: 'attack', value: 45, target: 'self', source: 'self' }, { stat: 'damage_dealt', value: 30, target: 'self', source: 'self' }],
    skills: [{ name: '不落の名城', description: '自身の攻撃45%、与ダメ30%上昇' }],
    calcData: { baseAttack: 650, percentBuffs: [{ value: 45, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [{ type: 'give_damage', value: 1.3 }], defenseIgnore: false, attackSpeed: 10, gapReduction: 15 }
  },
  { id: '7', name: '松本城', attribute: 'water', weapon: 'bow', rarity: 6, cost: 22,
    baseStats: { hp: 2800, attack: 550, defense: 360, range: 310 },
    buffs: [{ stat: 'attack', value: 30, target: 'range', source: 'self' }, { stat: 'range', value: 15, target: 'self', source: 'self' }],
    skills: [{ name: '烏城の弓', description: '射程内の攻撃30%上昇、自身の射程15%上昇' }],
    calcData: { baseAttack: 550, percentBuffs: [{ value: 30, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [], defenseIgnore: false, attackSpeed: 0, gapReduction: 0 }
  },
  { id: '8', name: '犬山城', attribute: 'plain_mountain', weapon: 'hammer', rarity: 6, cost: 24,
    baseStats: { hp: 3100, attack: 530, defense: 550, range: 140 },
    buffs: [{ stat: 'defense', value: 50, target: 'self', source: 'self' }, { stat: 'attack', value: 20, target: 'range', source: 'self' }],
    skills: [{ name: '国宝の威光', description: '自身の防御50%上昇、射程内の攻撃20%上昇' }],
    calcData: { baseAttack: 530, percentBuffs: [{ value: 20, type: 'self' }], flatBuffs: [], additiveBuffs: [], duplicateBuffs: [],
      damageMultipliers: [], defenseIgnore: false, attackSpeed: 0, gapReduction: 0 }
  },
];

const ATTRIBUTE_ORDER = ['plain', 'plain_mountain', 'mountain', 'water', 'hell'];
const STORAGE_KEY = 'shiropro-formations';

// ========================================
// ユーティリティ
// ========================================
const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e4 ? `${(n/1e3).toFixed(1)}K` : Math.floor(n).toString();
const fmtFull = (n) => Math.floor(n).toLocaleString();
const maxRule = (buffs) => {
  if (!buffs?.length) return 0;
  const g = buffs.reduce((a, b) => { a[b.type] = a[b.type] || []; a[b.type].push(b.value); return a; }, {});
  return Object.values(g).map(v => Math.max(...v)).reduce((s, m) => s + m, 0);
};

// ダメージ計算
function calcDamage(char, env) {
  if (!char.calcData) return null;
  const cd = char.calcData;
  const base = cd.baseAttack;
  const pct = maxRule(cd.percentBuffs) + env.attackPercent;
  const flat = (cd.flatBuffs || []).reduce((s, v) => s + v, 0);
  const dup = (cd.duplicateBuffs?.reduce((s, v) => s + v, 0) || 0) + env.duplicateBuff;
  const add = ((cd.additiveBuffs || []).reduce((s, b) => s + base * b.value / 100, 0) + env.inspireFlat) * (1 + dup / 100);
  const p1 = ((base * (1 + pct / 100)) + flat + add) * (1 + dup / 100);
  
  let p2 = p1 * (env.damageMultiplier || 1);
  for (const m of (cd.damageMultipliers || [])) p2 *= m.value;
  
  let def = 0;
  if (!cd.defenseIgnore) def = Math.max(0, env.enemyDefense * (1 - env.defenseDebuffPercent / 100) - env.defenseDebuffFlat);
  const p3 = Math.max(1, p2 - def);
  const p4 = Math.floor(p3 * (1 + env.damageDealt / 100) * (1 + env.damageTaken / 100));
  const total = cd.multiHit ? p4 * cd.multiHit : p4;
  
  const weaponName = WEAPONS[char.weapon]?.name || '刀';
  const fr = WEAPON_FRAMES[weaponName] || { attack: 30, gap: 30 };
  const spd = Math.max(cd.attackSpeed || 0, env.attackSpeed);
  const gap = Math.max(cd.gapReduction || 0, env.gapReduction);
  const atkF = fr.attack / (1 + spd / 100);
  const gapF = fr.gap * (1 - gap / 100);
  const aps = 60 / (atkF + gapF);
  const dps = total * aps;
  const insp = cd.inspire?.stat === 'attack' ? p1 * cd.inspire.value / 100 : null;
  
  return { p1, total, dps, insp, atkF, gapF, aps };
}

// ========================================
// LocalStorage 編成管理
// ========================================
const loadFormations = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const saveFormations = (formations) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formations));
};

// ========================================
// タブ切り替えボタン
// ========================================
const TabSwitch = ({ activeTab, onChange }) => (
  <div className="inline-flex bg-gray-800 rounded-full p-1">
    {[{ key: 'matrix', label: 'Buff Matrix' }, { key: 'analysis', label: 'Analysis' }].map(tab => (
      <button key={tab.key} onClick={() => onChange(tab.key)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          activeTab === tab.key ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
        }`}>
        {tab.label}
      </button>
    ))}
  </div>
);

// ========================================
// 左サイドバー: キャラ一覧
// ========================================
const CharacterCard = ({ char, isInFormation, onClick }) => {
  const attr = ATTRIBUTES[char.attribute];
  const weapon = WEAPONS[char.weapon];
  return (
    <button onClick={onClick} disabled={isInFormation}
      className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
        isInFormation ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-800'
      }`}>
      <div className={`w-2 h-2 rounded-full ${attr.color}`} />
      <span className="text-sm text-gray-200 truncate flex-1">{char.name}</span>
      <span className="text-xs text-gray-500">{weapon.icon}</span>
    </button>
  );
};

const Sidebar = ({ characters, formationIds, onCharClick, collapsed, onToggle }) => {
  const grouped = useMemo(() => {
    const g = {};
    ATTRIBUTE_ORDER.forEach(attr => g[attr] = characters.filter(c => c.attribute === attr));
    return g;
  }, [characters]);

  return (
    <aside className={`bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 transition-all ${collapsed ? 'w-12' : 'w-48'}`}>
      <div className="p-2 border-b border-gray-800 flex items-center justify-between">
        {!collapsed && <span className="text-xs font-medium text-gray-400">キャラ一覧</span>}
        <button onClick={onToggle} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs flex items-center justify-center">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {ATTRIBUTE_ORDER.map(attrKey => {
          const chars = grouped[attrKey];
          if (!chars?.length) return null;
          return (
            <div key={attrKey} className="mb-2">
              {!collapsed && (
                <div className="flex items-center gap-1.5 px-1 py-1">
                  <div className={`w-2 h-2 rounded-full ${ATTRIBUTES[attrKey].color}`} />
                  <span className={`text-xs font-medium ${ATTRIBUTES[attrKey].text}`}>{ATTRIBUTES[attrKey].name}</span>
                </div>
              )}
              {collapsed && <div className={`w-full h-1 ${ATTRIBUTES[attrKey].color} rounded mb-1`} />}
              {chars.map(char => (
                collapsed ? (
                  <button key={char.id} onClick={() => onCharClick(char)} disabled={formationIds.includes(char.id)}
                    className={`w-full h-7 flex items-center justify-center rounded hover:bg-gray-800 ${formationIds.includes(char.id) ? 'opacity-30' : ''}`}
                    title={char.name}>
                    <div className={`w-2 h-2 rounded-full ${ATTRIBUTES[char.attribute].color}`} />
                  </button>
                ) : (
                  <CharacterCard key={char.id} char={char} isInFormation={formationIds.includes(char.id)} onClick={() => onCharClick(char)} />
                )
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

// ========================================
// 編成スロット
// ========================================
const FormationSlot = ({ char, onClick }) => {
  const attr = char ? ATTRIBUTES[char.attribute] : null;
  return (
    <div onClick={onClick}
      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative group ${
        char ? `${attr.light} ${attr.border} hover:brightness-110` : 'border-dashed border-gray-700 hover:border-gray-500'
      }`}>
      {char ? (
        <>
          <span className="text-xs text-white font-medium truncate w-full text-center px-1">{char.name}</span>
          <span className="text-[10px] text-gray-400">{WEAPONS[char.weapon]?.name}</span>
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-gray-900/80 rounded text-gray-400 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">✕</div>
        </>
      ) : (
        <span className="text-gray-600 text-lg">+</span>
      )}
    </div>
  );
};

// ========================================
// 右サイドバー
// ========================================
const RightSidebar = ({ collapsed, onToggle, selectedChar, env, onEnvChange, onEnvReset, activeTab }) => {
  const [panel, setPanel] = useState('env'); // 'env' | 'detail'

  const Field = ({ label, name, value, suffix = '' }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" value={value} onChange={e => onEnvChange({ ...env, [name]: +e.target.value })}
          className="w-14 px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white text-right focus:outline-none focus:border-blue-500" />
        {suffix && <span className="text-xs text-gray-500 w-4">{suffix}</span>}
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <aside className="w-10 bg-gray-900 border-l border-gray-800 flex flex-col items-center py-2">
        <button onClick={onToggle} className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs flex items-center justify-center">
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
      {/* ヘッダー */}
      <div className="p-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setPanel('env')}
            className={`px-2 py-1 rounded text-xs ${panel === 'env' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
            環境
          </button>
          <button onClick={() => setPanel('detail')}
            className={`px-2 py-1 rounded text-xs ${panel === 'detail' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
            詳細
          </button>
        </div>
        <button onClick={onToggle} className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs flex items-center justify-center">
          ▶
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-3">
        {panel === 'env' ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-300">⚙ 環境設定</span>
              <button onClick={onEnvReset} className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-gray-700">リセット</button>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">攻撃系</div>
              <Field label="攻撃" name="attackPercent" value={env.attackPercent} suffix="%" />
              <Field label="与ダメ" name="damageDealt" value={env.damageDealt} suffix="%" />
              <Field label="被ダメ" name="damageTaken" value={env.damageTaken} suffix="%" />
              <Field label="倍率" name="damageMultiplier" value={env.damageMultiplier} suffix="×" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">特殊</div>
              <Field label="鼓舞" name="inspireFlat" value={env.inspireFlat} />
              <Field label="効果重複" name="duplicateBuff" value={env.duplicateBuff} suffix="%" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">速度系</div>
              <Field label="攻撃速度" name="attackSpeed" value={env.attackSpeed} suffix="%" />
              <Field label="隙短縮" name="gapReduction" value={env.gapReduction} suffix="%" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">敵</div>
              <Field label="防御力" name="enemyDefense" value={env.enemyDefense} />
              <Field label="防デバフ" name="defenseDebuffPercent" value={env.defenseDebuffPercent} suffix="%" />
              <Field label="防-固定" name="defenseDebuffFlat" value={env.defenseDebuffFlat} />
            </div>
          </div>
        ) : (
          <div>
            {selectedChar ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-base font-medium text-white">{selectedChar.name}</div>
                  <div className="text-xs text-gray-500">{WEAPONS[selectedChar.weapon]?.name} ・ ☆{selectedChar.rarity}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 space-y-1">
                  <div className="text-[10px] text-gray-500">基礎ステータス</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><span className="text-gray-400">HP</span> <span className="text-white">{selectedChar.baseStats?.hp}</span></div>
                    <div><span className="text-gray-400">攻撃</span> <span className="text-white">{selectedChar.baseStats?.attack}</span></div>
                    <div><span className="text-gray-400">防御</span> <span className="text-white">{selectedChar.baseStats?.defense}</span></div>
                    <div><span className="text-gray-400">射程</span> <span className="text-white">{selectedChar.baseStats?.range}</span></div>
                  </div>
                </div>
                {selectedChar.skills?.map((skill, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-2">
                    <div className="text-xs font-medium text-white">{skill.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{skill.description}</div>
                  </div>
                ))}
                {selectedChar.buffs?.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500 mb-1">バフ</div>
                    {selectedChar.buffs.map((buff, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`px-1 py-0.5 rounded text-[10px] ${
                          buff.target === 'self' ? 'bg-blue-900/50 text-blue-300' :
                          buff.target === 'range' ? 'bg-green-900/50 text-green-300' :
                          buff.target === 'all' ? 'bg-purple-900/50 text-purple-300' : 'bg-gray-700 text-gray-300'
                        }`}>
                          {buff.target === 'self' ? '自身' : buff.target === 'range' ? '射程' : buff.target === 'all' ? '全体' : 'フィールド'}
                        </span>
                        <span className="text-white">{buff.stat} +{buff.value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-8">
                キャラをクリックで詳細表示
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

// ========================================
// 編成セーブモーダル
// ========================================
const SaveModal = ({ isOpen, onClose, formations, onSave, onLoad, onDelete, currentFormation }) => {
  const [newName, setNewName] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newName.trim()) return;
    const charIds = currentFormation.filter(Boolean).map(c => c.id);
    onSave({ name: newName.trim(), charIds, createdAt: Date.now() });
    setNewName('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-80 max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-white">編成セーブ/ロード</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        {/* 新規保存 */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="編成名"
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500" />
            <button onClick={handleSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white">
              保存
            </button>
          </div>
        </div>

        {/* 保存済み一覧 */}
        <div className="p-3 max-h-60 overflow-y-auto">
          {formations.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-4">保存された編成がありません</div>
          ) : (
            <div className="space-y-2">
              {formations.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-2">
                  <div>
                    <div className="text-sm text-white">{f.name}</div>
                    <div className="text-[10px] text-gray-500">{f.charIds?.length || 0}体</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onLoad(f)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white">
                      読込
                    </button>
                    <button onClick={() => onDelete(i)} className="px-2 py-1 bg-gray-700 hover:bg-red-600 rounded text-xs text-gray-400 hover:text-white">
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ========================================
// バフマトリックス
// ========================================
const BuffMatrix = ({ formation, onCharClick }) => {
  const activeChars = formation.filter(Boolean);
  
  const buffData = useMemo(() => {
    const data = {};
    BUFF_CATEGORIES.forEach(cat => {
      cat.stats.forEach(stat => {
        data[stat.key] = {};
        activeChars.forEach(char => {
          const buff = char.buffs?.find(b => b.stat === stat.key);
          data[stat.key][char.id] = buff ? { value: buff.value, target: buff.target, source: buff.source } : null;
        });
      });
    });
    return data;
  }, [activeChars]);

  if (activeChars.length === 0) {
    return <div className="text-center text-gray-500 py-8">キャラを編成してください</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium w-24">項目</th>
            {activeChars.map(char => (
              <th key={char.id} className="text-center py-2 px-2 min-w-[80px]">
                <button onClick={() => onCharClick(char)} className="text-xs text-white hover:text-blue-400">{char.name}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BUFF_CATEGORIES.map(cat => (
            <React.Fragment key={cat.key}>
              <tr className="bg-gray-800/30">
                <td colSpan={activeChars.length + 1} className="py-1.5 px-3 text-xs font-medium text-gray-500">{cat.name}</td>
              </tr>
              {cat.stats.map(stat => (
                <tr key={stat.key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2 px-3 text-gray-400 text-xs">{stat.name}</td>
                  {activeChars.map(char => {
                    const buff = buffData[stat.key]?.[char.id];
                    return (
                      <td key={char.id} className="text-center py-2 px-2">
                        {buff ? (
                          <div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                              <div className={`h-full ${buff.source === 'self' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${Math.min(buff.value, 100)}%` }} />
                            </div>
                            <span className="text-xs text-white font-medium">+{buff.value}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ========================================
// Analysisタブ（ダメージ計算グリッド）
// ========================================
const DamageCard = ({ char, res, prevRes, onClick }) => {
  if (!res) return null;
  const hasDiff = prevRes && (prevRes.total !== res.total || prevRes.dps !== res.dps);
  
  return (
    <div onClick={() => onClick(char)} className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 hover:border-gray-500 cursor-pointer">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">{char.name}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-400">
        <span>{WEAPONS[char.weapon]?.icon}</span>
        <span>{WEAPONS[char.weapon]?.name}</span>
        {char.calcData?.multiHit && <span className="px-1 bg-purple-500/30 text-purple-300 rounded">×{char.calcData.multiHit}</span>}
        {char.calcData?.defenseIgnore && <span className="px-1 bg-red-500/30 text-red-300 rounded">防無</span>}
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-lg font-bold text-white">{fmt(res.total)}</span>
          {hasDiff && res.total !== prevRes.total && (
            <span className={`text-xs ml-1 ${res.total > prevRes.total ? 'text-green-400' : 'text-red-400'}`}>
              {res.total > prevRes.total ? '↑' : '↓'}{Math.abs((res.total - prevRes.total) / prevRes.total * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500">DPS </span>
          <span className="text-sm font-semibold text-yellow-400">{fmt(res.dps)}</span>
        </div>
      </div>
      {hasDiff && <div className="text-xs text-gray-500 mt-1">前: {fmt(prevRes.total)} / DPS {fmt(prevRes.dps)}</div>}
      {res.insp && <div className="text-xs text-green-400 mt-1">🎺 鼓舞 +{fmtFull(res.insp)}</div>}
    </div>
  );
};

const AnalysisTab = ({ formation, env, baseEnv, onCharClick }) => {
  const activeChars = formation.filter(Boolean);
  
  const results = useMemo(() => {
    const r = {};
    activeChars.forEach(c => r[c.id] = calcDamage(c, env));
    return r;
  }, [activeChars, env]);

  const baseResults = useMemo(() => {
    const r = {};
    activeChars.forEach(c => r[c.id] = calcDamage(c, baseEnv));
    return r;
  }, [activeChars, baseEnv]);

  const totalDPS = useMemo(() => Object.values(results).reduce((s, r) => s + (r?.dps || 0), 0), [results]);
  const baseTotalDPS = useMemo(() => Object.values(baseResults).reduce((s, r) => s + (r?.dps || 0), 0), [baseResults]);

  if (activeChars.length === 0) {
    return <div className="text-center text-gray-500 py-8">キャラを編成してください</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-gray-400">合計DPS <span className="text-yellow-400 font-medium">{fmt(totalDPS)}</span></span>
        {baseTotalDPS !== totalDPS && <span className="text-gray-500">(前: {fmt(baseTotalDPS)})</span>}
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {activeChars.map(c => (
          <DamageCard key={c.id} char={c} res={results[c.id]} prevRes={baseResults[c.id]} onClick={onCharClick} />
        ))}
      </div>
    </div>
  );
};

// ========================================
// メインアプリ
// ========================================
export default function ShiroProToolsIntegrated() {
  const [formation, setFormation] = useState(Array(8).fill(null));
  const [activeTab, setActiveTab] = useState('matrix');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedFormations, setSavedFormations] = useState([]);
  
  const [env, setEnv] = useState({
    attackPercent: 0, damageDealt: 0, damageTaken: 50, damageMultiplier: 1,
    inspireFlat: 500, duplicateBuff: 20, attackSpeed: 0, gapReduction: 0,
    enemyDefense: 300, defenseDebuffPercent: 20, defenseDebuffFlat: 0,
  });
  
  const baseEnv = useMemo(() => ({
    attackPercent: 0, damageDealt: 0, damageTaken: 0, damageMultiplier: 1,
    inspireFlat: 0, duplicateBuff: 0, attackSpeed: 0, gapReduction: 0,
    enemyDefense: 0, defenseDebuffPercent: 0, defenseDebuffFlat: 0,
  }), []);

  // 初回ロード
  useEffect(() => {
    setSavedFormations(loadFormations());
  }, []);

  const formationCharIds = formation.filter(Boolean).map(c => c.id);

  const handleCharClick = (char) => {
    if (formationCharIds.includes(char.id)) return;
    const emptyIndex = formation.findIndex(slot => slot === null);
    if (emptyIndex !== -1) {
      const newFormation = [...formation];
      newFormation[emptyIndex] = char;
      setFormation(newFormation);
    }
  };

  const handleSlotClick = (index) => {
    if (formation[index]) {
      const newFormation = [...formation];
      newFormation[index] = null;
      setFormation(newFormation);
    }
  };

  const handleSaveFormation = (f) => {
    const updated = [...savedFormations, f];
    setSavedFormations(updated);
    saveFormations(updated);
  };

  const handleLoadFormation = (f) => {
    const newFormation = Array(8).fill(null);
    f.charIds?.forEach((id, i) => {
      if (i < 8) {
        const char = MOCK_CHARACTERS.find(c => c.id === id);
        if (char) newFormation[i] = char;
      }
    });
    setFormation(newFormation);
    setSaveModalOpen(false);
  };

  const handleDeleteFormation = (index) => {
    const updated = savedFormations.filter((_, i) => i !== index);
    setSavedFormations(updated);
    saveFormations(updated);
  };

  // 編成サマリー
  const summary = useMemo(() => {
    const active = formation.filter(Boolean);
    const weapons = { melee: 0, ranged: 0 };
    const attrs = {};
    active.forEach(c => {
      weapons[WEAPONS[c.weapon]?.range || 'melee']++;
      const a = ATTRIBUTES[c.attribute]?.name || '?';
      attrs[a] = (attrs[a] || 0) + 1;
    });
    return { weapons, attrs, count: active.length };
  }, [formation]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左サイドバー */}
      <Sidebar characters={MOCK_CHARACTERS} formationIds={formationCharIds} onCharClick={handleCharClick}
        collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ヘッダー */}
        <header className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-base font-bold">ShiroPro Tools</h1>
              <p className="text-[10px] text-gray-500">御城プロジェクト:RE 統合計算ツール</p>
            </div>
            <TabSwitch activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>近 <span className="text-white font-medium">{summary.weapons.melee}</span></span>
              <span>遠 <span className="text-white font-medium">{summary.weapons.ranged}</span></span>
              <span className="text-gray-700">|</span>
              {Object.entries(summary.attrs).map(([a, c]) => (
                <span key={a}>{a} <span className="text-white font-medium">{c}</span></span>
              ))}
              <span className="text-gray-700">|</span>
              <span><span className="text-white font-medium">{summary.count}</span>/8</span>
            </div>
            <button onClick={() => setFormation(Array(8).fill(null))} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800">Clear</button>
            <button onClick={() => setSaveModalOpen(true)} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800">💾 Save</button>
            <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium">Import</button>
          </div>
        </header>

        {/* 編成スロット - Buff Matrixタブのみ */}
        {activeTab === 'matrix' && (
          <section className="px-4 py-3 border-b border-gray-800">
            <div className="grid grid-cols-8 gap-2">
              {formation.map((char, i) => (
                <FormationSlot key={i} char={char} onClick={() => handleSlotClick(i)} />
              ))}
            </div>
          </section>
        )}

        {/* タブコンテンツ */}
        <section className="flex-1 overflow-auto p-4">
          {activeTab === 'matrix' ? (
            <BuffMatrix formation={formation} onCharClick={setSelectedChar} />
          ) : (
            <AnalysisTab formation={formation} env={env} baseEnv={baseEnv} onCharClick={setSelectedChar} />
          )}
        </section>
      </main>

      {/* 右サイドバー */}
      <RightSidebar
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed(!rightCollapsed)}
        selectedChar={selectedChar}
        env={env}
        onEnvChange={setEnv}
        onEnvReset={() => setEnv({ ...baseEnv })}
        activeTab={activeTab}
      />

      {/* セーブモーダル */}
      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        formations={savedFormations}
        onSave={handleSaveFormation}
        onLoad={handleLoadFormation}
        onDelete={handleDeleteFormation}
        currentFormation={formation}
      />
    </div>
  );
}
