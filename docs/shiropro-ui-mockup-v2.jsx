import React, { useState, useMemo } from 'react';

// ========================================
// モックデータ
// ========================================
const ATTRIBUTES = {
  water: { name: '水', color: 'from-blue-600 to-cyan-500', border: 'border-blue-400', bg: 'bg-blue-900/40', text: 'text-blue-300' },
  plain: { name: '平', color: 'from-amber-500 to-yellow-400', border: 'border-amber-400', bg: 'bg-amber-900/40', text: 'text-amber-300' },
  mountain: { name: '山', color: 'from-emerald-600 to-green-400', border: 'border-emerald-400', bg: 'bg-emerald-900/40', text: 'text-emerald-300' },
  plain_mountain: { name: '平山', color: 'from-lime-500 to-yellow-300', border: 'border-lime-400', bg: 'bg-lime-900/40', text: 'text-lime-300' },
  hell: { name: '地獄', color: 'from-purple-600 to-red-500', border: 'border-purple-400', bg: 'bg-purple-900/40', text: 'text-purple-300' },
};

const WEAPONS = {
  sword: { name: '刀', icon: '⚔️', range: 'melee', type: 'physical' },
  spear: { name: '槍', icon: '🔱', range: 'melee', type: 'physical' },
  hammer: { name: '槌', icon: '🔨', range: 'melee', type: 'physical' },
  fist: { name: '拳', icon: '👊', range: 'melee', type: 'physical' },
  bow: { name: '弓', icon: '🏹', range: 'ranged', type: 'physical' },
  gun: { name: '鉄砲', icon: '🔫', range: 'ranged', type: 'physical' },
  crossbow: { name: '石弓', icon: '🎯', range: 'ranged', type: 'physical' },
  magic: { name: '杖', icon: '🪄', range: 'ranged', type: 'magical' },
  fan: { name: '歌舞', icon: '💃', range: 'ranged', type: 'magical' },
  bell: { name: '鈴', icon: '🔔', range: 'ranged', type: 'magical' },
  book: { name: '本', icon: '📖', range: 'ranged', type: 'magical' },
};

// サンプルキャラクター（詳細情報追加）
const MOCK_CHARACTERS = [
  { 
    id: '1', name: '大坂城', attribute: 'plain', weapon: 'fan',
    rarity: 7, cost: 28,
    baseStats: { attack: 98, defense: 85, range: 280 },
    skills: [
      { name: '天下の名城', description: '全城娘の攻撃と防御が30%上昇' },
    ],
    strategies: [
      { name: '黄金の茶室', description: '範囲内の城娘の攻撃が50%上昇（20秒）', cooldown: 60 },
    ],
    buffs: [
      { stat: 'attack', value: 30, target: 'all', source: 'self' },
      { stat: 'defense', value: 30, target: 'all', source: 'self' },
    ],
    wikiId: '大坂城',
  },
  { 
    id: '2', name: '姫路城', attribute: 'plain', weapon: 'bow',
    rarity: 7, cost: 25,
    baseStats: { attack: 120, defense: 72, range: 320 },
    skills: [
      { name: '白鷺の舞', description: '自身の攻撃が50%、射程が20%上昇' },
    ],
    strategies: [
      { name: '不戦勝', description: '敵の攻撃を30%低下（25秒）', cooldown: 45 },
    ],
    buffs: [
      { stat: 'attack', value: 50, target: 'self', source: 'self' },
      { stat: 'range', value: 20, target: 'self', source: 'self' },
    ],
    wikiId: '姫路城',
  },
  { 
    id: '3', name: '安土城', attribute: 'mountain', weapon: 'gun',
    rarity: 7, cost: 30,
    baseStats: { attack: 135, defense: 68, range: 300 },
    skills: [
      { name: '天下布武', description: '射程内の城娘の攻撃が40%上昇' },
    ],
    strategies: [
      { name: '三段撃ち', description: '自身の与ダメが100%上昇（15秒）', cooldown: 50 },
    ],
    buffs: [
      { stat: 'attack', value: 40, target: 'range', source: 'self' },
      { stat: 'damage_dealt', value: 25, target: 'self', source: 'self' },
    ],
    wikiId: '安土城',
  },
  { 
    id: '4', name: '彦根城', attribute: 'water', weapon: 'bell',
    rarity: 7, cost: 26,
    baseStats: { attack: 88, defense: 90, range: 260 },
    skills: [
      { name: '井伊の赤備え', description: '射程内の攻撃25%、防御30%上昇' },
    ],
    strategies: [
      { name: '招き猫', description: '気が+15（即時）', cooldown: 40 },
    ],
    buffs: [
      { stat: 'attack', value: 25, target: 'range', source: 'self' },
      { stat: 'defense', value: 30, target: 'range', source: 'self' },
    ],
    wikiId: '彦根城',
  },
  { 
    id: '5', name: '江戸城', attribute: 'plain', weapon: 'fan',
    rarity: 7, cost: 32,
    baseStats: { attack: 92, defense: 95, range: 270 },
    skills: [
      { name: '徳川の威光', description: '気の自然増加+8、全城娘の攻撃20%上昇' },
    ],
    strategies: [
      { name: '天下普請', description: '計略再使用時間30%短縮（30秒）', cooldown: 70 },
    ],
    buffs: [
      { stat: 'cost', value: 8, target: 'field', source: 'self' },
      { stat: 'attack', value: 20, target: 'all', source: 'self' },
    ],
    wikiId: '江戸城',
  },
  { 
    id: '6', name: '名古屋城', attribute: 'plain', weapon: 'spear',
    rarity: 7, cost: 27,
    baseStats: { attack: 115, defense: 105, range: 160 },
    skills: [
      { name: '金鯱の守護', description: '自身の攻撃35%、防御40%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 35, target: 'self', source: 'self' },
      { stat: 'defense', value: 40, target: 'self', source: 'self' },
    ],
    wikiId: '名古屋城',
  },
  { 
    id: '7', name: '熊本城', attribute: 'plain', weapon: 'sword',
    rarity: 7, cost: 29,
    baseStats: { attack: 128, defense: 88, range: 150 },
    skills: [
      { name: '不落の名城', description: '自身の攻撃45%、与ダメ30%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 45, target: 'self', source: 'self' },
      { stat: 'damage_dealt', value: 30, target: 'self', source: 'self' },
    ],
    wikiId: '熊本城',
  },
  { 
    id: '8', name: '松本城', attribute: 'water', weapon: 'bow',
    rarity: 6, cost: 22,
    baseStats: { attack: 105, defense: 70, range: 310 },
    skills: [
      { name: '烏城の弓', description: '射程内の攻撃30%上昇、自身の射程15%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 30, target: 'range', source: 'self' },
      { stat: 'range', value: 15, target: 'self', source: 'self' },
    ],
    wikiId: '松本城',
  },
  { 
    id: '9', name: '犬山城', attribute: 'plain_mountain', weapon: 'hammer',
    rarity: 6, cost: 24,
    baseStats: { attack: 100, defense: 110, range: 140 },
    skills: [
      { name: '国宝の威光', description: '自身の防御50%上昇、射程内の攻撃20%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'defense', value: 50, target: 'self', source: 'self' },
      { stat: 'attack', value: 20, target: 'range', source: 'self' },
    ],
    wikiId: '犬山城',
  },
  { 
    id: '10', name: '首里城', attribute: 'water', weapon: 'magic',
    rarity: 6, cost: 23,
    baseStats: { attack: 95, defense: 75, range: 290 },
    skills: [
      { name: '琉球の祈り', description: '全城娘の攻撃25%上昇、射程内の回復30%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 25, target: 'all', source: 'self' },
      { stat: 'recovery', value: 30, target: 'range', source: 'self' },
    ],
    wikiId: '首里城',
  },
  { 
    id: '11', name: '鶴ヶ城', attribute: 'mountain', weapon: 'spear',
    rarity: 6, cost: 24,
    baseStats: { attack: 108, defense: 92, range: 155 },
    skills: [
      { name: '白虎の槍', description: '自身の攻撃35%上昇、射程内の防御25%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 35, target: 'self', source: 'self' },
      { stat: 'defense', value: 25, target: 'range', source: 'self' },
    ],
    wikiId: '鶴ヶ城',
  },
  { 
    id: '12', name: '小田原城', attribute: 'mountain', weapon: 'sword',
    rarity: 6, cost: 25,
    baseStats: { attack: 112, defense: 85, range: 145 },
    skills: [
      { name: '難攻不落', description: '自身の攻撃40%上昇、射程内の攻撃15%上昇' },
    ],
    strategies: [],
    buffs: [
      { stat: 'attack', value: 40, target: 'self', source: 'self' },
      { stat: 'attack', value: 15, target: 'range', source: 'self' },
    ],
    wikiId: '小田原城',
  },
];

// バフ項目をカテゴリ分け
const BUFF_CATEGORIES = [
  {
    key: 'resource',
    name: '気・計略',
    icon: '⚡',
    stats: [
      { key: 'cost', name: '気', icon: '⚡' },
      { key: 'cooldown', name: '計略短縮', icon: '⏱' },
    ],
  },
  {
    key: 'offense',
    name: '攻撃系',
    icon: '⚔',
    stats: [
      { key: 'attack', name: '攻撃', icon: '⚔' },
      { key: 'damage_dealt', name: '与ダメ', icon: '💥' },
      { key: 'range', name: '射程', icon: '◎' },
    ],
  },
  {
    key: 'defense',
    name: '防御系',
    icon: '🛡',
    stats: [
      { key: 'defense', name: '防御', icon: '🛡' },
      { key: 'damage_taken', name: '被ダメ軽減', icon: '🔰' },
    ],
  },
  {
    key: 'speed',
    name: '速度系',
    icon: '💨',
    stats: [
      { key: 'attack_speed', name: '攻撃速度', icon: '⚡' },
      { key: 'attack_gap', name: '攻撃隙', icon: '⏳' },
    ],
  },
  {
    key: 'utility',
    name: 'その他',
    icon: '✨',
    stats: [
      { key: 'recovery', name: '回復', icon: '💚' },
      { key: 'target_count', name: '対象数', icon: '🎯' },
    ],
  },
];

// ========================================
// コンポーネント
// ========================================

// キャラカード（サイドバー用）
const CharacterCard = ({ char, isSelected, isInFormation, onClick }) => {
  const attr = ATTRIBUTES[char.attribute];
  const weapon = WEAPONS[char.weapon];
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-2 rounded-lg border-2 transition-all duration-200
        flex items-center gap-2 text-left
        ${isInFormation 
          ? 'opacity-40 cursor-not-allowed border-gray-600' 
          : isSelected 
            ? `${attr.border} bg-gradient-to-r ${attr.color} shadow-lg shadow-white/10` 
            : `border-gray-700 hover:border-gray-500 ${attr.bg} hover:bg-opacity-60`
        }
      `}
      disabled={isInFormation}
    >
      <span className="text-lg">{weapon.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-white truncate">{char.name}</div>
        <div className="text-xs text-gray-400">{attr.name}・{weapon.name}</div>
      </div>
      {isInFormation && <span className="text-xs text-gray-500">編成中</span>}
    </button>
  );
};

// 編成スロット
const FormationSlot = ({ index, char, isSelected, onClick, onRightClick }) => {
  const attr = char ? ATTRIBUTES[char.attribute] : null;
  const weapon = char ? WEAPONS[char.weapon] : null;
  
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (char && onRightClick) onRightClick(char);
  };
  
  return (
    <button
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`
        relative w-full aspect-[4/3] rounded-xl border-2 transition-all duration-200
        flex flex-col items-center justify-center gap-1
        ${char 
          ? `bg-gradient-to-br ${attr.color} ${isSelected ? 'border-white shadow-lg shadow-white/20 scale-105' : 'border-transparent hover:border-white/50'}` 
          : `border-dashed border-gray-600 bg-gray-800/50 hover:border-gray-400 hover:bg-gray-800`
        }
      `}
    >
      {char ? (
        <>
          <span className="text-2xl">{weapon.icon}</span>
          <span className="font-bold text-white text-sm drop-shadow-lg">{char.name}</span>
          <span className="absolute top-1 right-2 text-xs bg-black/40 px-1.5 rounded">
            {attr.name}
          </span>
        </>
      ) : (
        <>
          <span className="text-3xl text-gray-600">+</span>
          <span className="text-xs text-gray-500">スロット {index + 1}</span>
        </>
      )}
    </button>
  );
};

// バフドット
const BuffDots = ({ sources, total }) => {
  if (total === 0) return <span className="text-gray-600">—</span>;
  
  return (
    <div className="flex gap-0.5 justify-center">
      {sources.map((s, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            s.type === 'self' ? 'bg-blue-400' :
            s.type === 'ally' ? 'bg-green-400' :
            'bg-purple-400'
          }`}
          title={`${s.from}: +${s.value}%`}
        />
      ))}
    </div>
  );
};

// スタックバー
const StackBar = ({ self, ally, strategy, max = 100 }) => {
  const total = self + ally + strategy;
  
  return (
    <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden flex">
      {self > 0 && (
        <div 
          className="bg-blue-500 h-full" 
          style={{ width: `${Math.min((self / max) * 100, 100)}%` }}
        />
      )}
      {ally > 0 && (
        <div 
          className="bg-green-500 h-full" 
          style={{ width: `${Math.min((ally / max) * 100, 100)}%` }}
        />
      )}
      {strategy > 0 && (
        <div 
          className="bg-purple-500 h-full" 
          style={{ width: `${Math.min((strategy / max) * 100, 100)}%` }}
        />
      )}
    </div>
  );
};

// 折りたたみカテゴリヘッダー
const CategoryHeader = ({ category, isExpanded, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-2 py-2 px-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
  >
    <span className="text-lg">{category.icon}</span>
    <span className="font-medium text-white flex-1 text-left">{category.name}</span>
    <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
      ▼
    </span>
  </button>
);

// バフマトリックス（カテゴリ別折りたたみ）
const BuffMatrix = ({ formation, onCharClick }) => {
  const activeChars = formation.filter(Boolean);
  const [expandedCategories, setExpandedCategories] = useState(
    Object.fromEntries(BUFF_CATEGORIES.map(c => [c.key, true]))
  );
  
  const toggleCategory = (key) => {
    setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // バフ計算
  const calculateBuffs = useMemo(() => {
    const result = {};
    const allStats = BUFF_CATEGORIES.flatMap(c => c.stats);
    
    activeChars.forEach(char => {
      result[char.id] = {};
      allStats.forEach(stat => {
        result[char.id][stat.key] = { self: 0, ally: 0, strategy: 0, sources: [] };
      });
    });
    
    activeChars.forEach(sourceChar => {
      sourceChar.buffs.forEach(buff => {
        if (buff.target === 'self') {
          if (result[sourceChar.id]?.[buff.stat]) {
            result[sourceChar.id][buff.stat].self += buff.value;
            result[sourceChar.id][buff.stat].sources.push({ 
              from: sourceChar.name, value: buff.value, type: 'self' 
            });
          }
        } else if (buff.target === 'all' || buff.target === 'range') {
          activeChars.forEach(targetChar => {
            if (result[targetChar.id]?.[buff.stat]) {
              if (targetChar.id === sourceChar.id) {
                result[targetChar.id][buff.stat].self += buff.value;
                result[targetChar.id][buff.stat].sources.push({ 
                  from: sourceChar.name, value: buff.value, type: 'self' 
                });
              } else {
                result[targetChar.id][buff.stat].ally += buff.value;
                result[targetChar.id][buff.stat].sources.push({ 
                  from: sourceChar.name, value: buff.value, type: 'ally' 
                });
              }
            }
          });
        }
      });
    });
    
    return result;
  }, [activeChars]);
  
  if (activeChars.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📋</div>
          <div>左のキャラ一覧からキャラを選択して編成に追加</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-gray-900 z-10">
        <div className="w-24 text-xs text-gray-400">項目</div>
        <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${activeChars.length}, minmax(100px, 1fr))` }}>
          {activeChars.map(char => {
            const attr = ATTRIBUTES[char.attribute];
            const weapon = WEAPONS[char.weapon];
            return (
              <button
                key={char.id}
                onClick={() => onCharClick?.(char)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gradient-to-r ${attr.color} hover:opacity-80 transition-opacity`}
              >
                <span className="text-sm">{weapon.icon}</span>
                <span className="font-medium text-white text-xs truncate">{char.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* カテゴリ別 */}
      {BUFF_CATEGORIES.map(category => (
        <div key={category.key} className="bg-gray-800/50 rounded-xl overflow-hidden">
          <CategoryHeader
            category={category}
            isExpanded={expandedCategories[category.key]}
            onToggle={() => toggleCategory(category.key)}
          />
          
          {expandedCategories[category.key] && (
            <div className="px-3 pb-2">
              {category.stats.map(stat => (
                <div key={stat.key} className="flex items-center gap-2 py-2 border-t border-gray-700/50 first:border-t-0">
                  <div className="w-24 flex items-center gap-1.5 text-sm text-gray-300">
                    <span>{stat.icon}</span>
                    <span>{stat.name}</span>
                  </div>
                  <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${activeChars.length}, minmax(100px, 1fr))` }}>
                    {activeChars.map(char => {
                      const buffData = calculateBuffs[char.id]?.[stat.key] || { self: 0, ally: 0, strategy: 0, sources: [] };
                      const total = buffData.self + buffData.ally + buffData.strategy;
                      
                      return (
                        <div key={char.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <BuffDots sources={buffData.sources} total={total} />
                            <span className={`text-xs font-mono ${total > 0 ? 'text-white' : 'text-gray-600'}`}>
                              {total > 0 ? `+${total}%` : '—'}
                            </span>
                          </div>
                          <StackBar 
                            self={buffData.self} 
                            ally={buffData.ally} 
                            strategy={buffData.strategy}
                            max={100}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// キャラ詳細パネル（右ペイン）
const CharacterDetail = ({ char, onClose }) => {
  if (!char) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">👆</div>
          <div className="text-sm">キャラをクリックで詳細表示</div>
        </div>
      </div>
    );
  }
  
  const attr = ATTRIBUTES[char.attribute];
  const weapon = WEAPONS[char.weapon];
  const wikiUrl = `https://scre.swiki.jp/index.php?${encodeURIComponent(char.wikiId)}`;
  
  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className={`p-4 bg-gradient-to-r ${attr.color} relative`}>
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          ✕
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{weapon.icon}</span>
          <div>
            <h3 className="text-xl font-bold text-white drop-shadow">{char.name}</h3>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span>{attr.name}</span>
              <span>・</span>
              <span>{weapon.name}</span>
              <span>・</span>
              <span>☆{char.rarity}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 基礎ステータス */}
        <section>
          <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">基礎ステータス</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">攻撃</div>
              <div className="text-lg font-bold text-white">{char.baseStats.attack}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">防御</div>
              <div className="text-lg font-bold text-white">{char.baseStats.defense}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">射程</div>
              <div className="text-lg font-bold text-white">{char.baseStats.range}</div>
            </div>
          </div>
        </section>
        
        {/* 特技 */}
        <section>
          <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">特技</h4>
          {char.skills.map((skill, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3">
              <div className="font-medium text-white mb-1">{skill.name}</div>
              <div className="text-sm text-gray-300">{skill.description}</div>
            </div>
          ))}
        </section>
        
        {/* 計略 */}
        {char.strategies.length > 0 && (
          <section>
            <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">計略</h4>
            {char.strategies.map((strategy, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">{strategy.name}</span>
                  <span className="text-xs text-gray-400">CT: {strategy.cooldown}秒</span>
                </div>
                <div className="text-sm text-gray-300">{strategy.description}</div>
              </div>
            ))}
          </section>
        )}
        
        {/* 提供バフ一覧 */}
        <section>
          <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">提供バフ</h4>
          <div className="space-y-1">
            {char.buffs.map((buff, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm text-white">
                  {buff.stat === 'attack' && '⚔ 攻撃'}
                  {buff.stat === 'defense' && '🛡 防御'}
                  {buff.stat === 'range' && '◎ 射程'}
                  {buff.stat === 'damage_dealt' && '💥 与ダメ'}
                  {buff.stat === 'cost' && '⚡ 気'}
                  {buff.stat === 'recovery' && '💚 回復'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    buff.target === 'self' ? 'bg-blue-900 text-blue-300' :
                    buff.target === 'range' ? 'bg-green-900 text-green-300' :
                    buff.target === 'all' ? 'bg-purple-900 text-purple-300' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {buff.target === 'self' && '自身'}
                    {buff.target === 'range' && '射程内'}
                    {buff.target === 'all' && '全体'}
                    {buff.target === 'field' && 'フィールド'}
                  </span>
                  <span className="font-mono text-white">+{buff.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      
      {/* フッター - Wikiリンク */}
      <div className="p-3 border-t border-gray-700">
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
        >
          <span>📖</span>
          <span>Wikiで詳細を見る</span>
          <span className="text-gray-400">↗</span>
        </a>
      </div>
    </div>
  );
};

// 編成サマリー（コンパクト版）
const FormationSummary = ({ formation }) => {
  const activeChars = formation.filter(Boolean);
  
  const summary = useMemo(() => {
    const weapons = { melee: 0, ranged: 0 };
    const attributes = {};
    
    activeChars.forEach(char => {
      const weapon = WEAPONS[char.weapon];
      weapons[weapon.range]++;
      
      const attrName = ATTRIBUTES[char.attribute].name;
      attributes[attrName] = (attributes[attrName] || 0) + 1;
    });
    
    return { weapons, attributes };
  }, [activeChars]);
  
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">近</span>
        <span className="font-mono text-white bg-gray-700 px-1.5 py-0.5 rounded">{summary.weapons.melee}</span>
        <span className="text-gray-400">遠</span>
        <span className="font-mono text-white bg-gray-700 px-1.5 py-0.5 rounded">{summary.weapons.ranged}</span>
      </div>
      <div className="w-px h-4 bg-gray-600" />
      {Object.entries(summary.attributes).map(([attr, count]) => (
        <span key={attr} className="flex items-center gap-1">
          <span className="text-gray-400">{attr}</span>
          <span className="font-mono text-white bg-gray-700 px-1.5 py-0.5 rounded">{count}</span>
        </span>
      ))}
      <div className="w-px h-4 bg-gray-600" />
      <span className="text-gray-400">
        <span className="text-white font-mono">{activeChars.length}</span>/8
      </span>
    </div>
  );
};

// 凡例
const Legend = () => (
  <div className="flex items-center gap-3 text-xs text-gray-400">
    <div className="flex items-center gap-1">
      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
      <span>自前</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
      <span>味方</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
      <span>計略</span>
    </div>
  </div>
);

// ========================================
// メインアプリ
// ========================================
export default function ShiroProToolsV2() {
  const [formation, setFormation] = useState(Array(8).fill(null));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [detailChar, setDetailChar] = useState(null);
  
  const formationCharIds = formation.filter(Boolean).map(c => c.id);
  
  const handleCharClick = (char) => {
    if (formationCharIds.includes(char.id)) return;
    
    if (selectedSlot !== null) {
      const newFormation = [...formation];
      newFormation[selectedSlot] = char;
      setFormation(newFormation);
      setSelectedSlot(null);
    } else {
      const emptyIndex = formation.findIndex(slot => slot === null);
      if (emptyIndex !== -1) {
        const newFormation = [...formation];
        newFormation[emptyIndex] = char;
        setFormation(newFormation);
      }
    }
  };
  
  const handleSlotClick = (index) => {
    if (formation[index]) {
      const newFormation = [...formation];
      newFormation[index] = null;
      setFormation(newFormation);
    } else {
      setSelectedSlot(selectedSlot === index ? null : index);
    }
  };
  
  const clearFormation = () => {
    setFormation(Array(8).fill(null));
    setSelectedSlot(null);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左サイドバー：キャラ一覧 */}
      <aside className="w-56 bg-gray-850 border-r border-gray-700 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-700">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <span>🏯</span>
            キャラ一覧
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {MOCK_CHARACTERS.map(char => (
            <CharacterCard
              key={char.id}
              char={char}
              isSelected={false}
              isInFormation={formationCharIds.includes(char.id)}
              onClick={() => handleCharClick(char)}
            />
          ))}
        </div>
      </aside>
      
      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ヘッダー */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">ShiroPro Tools <span className="text-blue-400">(Reborn)</span></h1>
            </div>
            <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
              📥 Wikiインポート
            </button>
          </div>
        </header>
        
        {/* 編成エリア */}
        <section className="bg-gray-800/50 border-b border-gray-700 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-sm">編成</h2>
              <FormationSummary formation={formation} />
            </div>
            <button 
              onClick={clearFormation}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              🗑 クリア
            </button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {formation.map((char, index) => (
              <FormationSlot
                key={index}
                index={index}
                char={char}
                isSelected={selectedSlot === index}
                onClick={() => handleSlotClick(index)}
                onRightClick={setDetailChar}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            💡 クリックで解除 ・ 右クリックで詳細表示
          </p>
        </section>
        
        {/* バフマトリックス */}
        <section className="flex-1 overflow-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">バフ・マトリックス</h2>
            <Legend />
          </div>
          <BuffMatrix formation={formation} onCharClick={setDetailChar} />
        </section>
      </main>
      
      {/* 右ペイン：キャラ詳細 */}
      <aside className={`w-72 bg-gray-850 border-l border-gray-700 flex-shrink-0 transition-all duration-300 ${detailChar ? 'translate-x-0' : 'translate-x-full hidden'}`}>
        <CharacterDetail char={detailChar} onClose={() => setDetailChar(null)} />
      </aside>
      
      {/* 詳細未選択時の右ペイン */}
      {!detailChar && (
        <aside className="w-64 bg-gray-850 border-l border-gray-700 flex-shrink-0">
          <CharacterDetail char={null} onClose={() => {}} />
        </aside>
      )}
    </div>
  );
}
