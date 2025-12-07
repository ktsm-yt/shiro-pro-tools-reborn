# ShiroPro Tools (Reborn) - ダメージ計算機能仕様書

**Version**: 1.0  
**Last Updated**: 2025-12-07  
**Purpose**: 簡易ダメージ計算機能の完全な仕様定義

---

## 📋 目次

1. [機能概要](#機能概要)
2. [ダメージ計算仕様](#ダメージ計算仕様)
3. [UI設計](#ui設計)
4. [DPS計算](#dps計算)
5. [データ構造](#データ構造)
6. [実装ガイドライン](#実装ガイドライン)

---

## 機能概要

### コンセプト

アタッカーを一覧表示し、環境パラメータを変更することで各キャラクターのダメージとDPSがリアルタイムに変動する簡易ダメージ計算ツール。

### 主要機能

1. **環境設定パネル**
   - 鼓舞（固定値加算）
   - 被ダメージ%
   - 効果重複バフ%
   - 敵防御力
   - 攻撃速度%、隙短縮%

2. **アタッカー一覧（カード表示）**
   - 超コンパクトカード（デスクトップ6列グリッド）
   - 最終ダメージと差分表示
   - DPSと差分表示
   - 鼓舞量の表示（該当キャラのみ）
   - ドラッグ&ドロップで順番入れ替え

3. **詳細パネル**
   - 各フェーズのブレークダウン表示
   - バフの適用状況詳細

4. **編成管理**
   - パーサーで解析したキャラを登録
   - 編成の保存・読み込み
   - キャラの追加・削除

---

## ダメージ計算仕様

### 計算フェーズの全体像

```
Phase 1: 攻撃力の確定
  ↓
Phase 2: ダメージ倍率の適用
  ↓
Phase 3: 防御力による減算
  ↓
Phase 4: 与ダメ・被ダメによる増減
  ↓
Phase 5: 連撃による乗算（レアケース）
  ↓
最終ダメージ
```

### Phase 1: 攻撃力の確定

```
finalAttack = [(baseAttack × (1 + Σ percentBuffs / 100)) + Σ flatBuffs + Σ additiveBuffs] × (1 + Σ duplicateBuffs / 100)
```

**重要ルール:**
- 割合バフ: **同種は最大値のみ適用**（加算されない）
- 固定値バフ: すべて加算
- 加算バフ: **基礎攻撃力を参照**して計算（複数の場合は合計と仮定）
- 割合重複バフ: すべて加算してから最後に乗算

**特殊な挙動: 射程内重複バフと加算バフの相互作用**

加算バフ城娘を配置した後に射程内重複バフを発動すると、**加算バフ自体も重複バフで乗算される**。

```
例: 基礎攻撃1000、加算バフ40%、重複バフ1.2倍
→ (1000 × 1.2) + (1000 × 0.4 × 1.2) = 1200 + 480 = 1680
```

### Phase 2: ダメージ倍率の適用

```
damage = finalAttack × multiplier₁ × multiplier₂ × ... × multiplierₙ
```

**すべての倍率は個別に乗算**される（加算ではない）。

倍率の種類:
- 「攻撃の◯倍のダメージ」
- 「与えるダメージが◯倍」
- 「直撃ボーナス」（与えるダメージと同種）
- 条件付きダメージ倍率（「耐久50%以下で◯倍」など）

### Phase 3: 防御力による減算

```
effectiveDefense = max(0, (enemyDefense × (1 - percentDebuffs / 100)) - flatDebuffs)
damage = max(1, damage - effectiveDefense)
```

**計算順序:** 割合デバフを先に適用 → 固定値を引く

### Phase 4: 与ダメ・被ダメによる増減

```
finalDamage = damage × (1 + max(damageDealt)) × (1 + max(damageTaken))
```

**重要:** 与ダメ同士、被ダメ同士はそれぞれ**最大値のみ適用**（加算されない）

### Phase 5: 連撃による乗算

```
totalDamage = damage × attackCount
```

レアケース（聖夜ダノターの5連撃など）

---

## UI設計

### レスポンシブグリッドレイアウト

```
デスクトップ（1920px以上）: 6列
大画面（1280px-1919px）: 4列
タブレット（768px-1279px）: 3列
モバイル（480px-767px）: 2列
小型モバイル（479px以下）: 1列
```

### 超コンパクトカードデザイン

**カードサイズ:** 約180px × 200px

```
┌──────────────┐
│ ドレッドノート │  ← キャラ名（6文字まで）
├──────────────┤
│ 🚢 Lv120     │  ← 武器アイコン + レベル
│              │
│   15.2K      │  ← 最終ダメージ（コンパクト表示）
│   ↑ 14%      │  ← 差分
│              │
│ ⚡ 206        │  ← DPS
│              │
│ 🎯×5         │  ← バッジ（連撃・鼓舞）
│              │
│  📊    🗑️    │  ← アクション（詳細・削除）
└──────────────┘
```

### 環境設定パネル

```
┌────────────────────────────────────────────────────┐
│ 環境設定                        [リセット] [保存]   │
├────────────────────────────────────────────────────┤
│ 鼓舞: [+500] │ 被ダメ: [50]% │ 重複: [20]%         │
│ 攻速: [30]%  │ 隙短縮: [40]% │                     │
│ 敵防御: [300] │ 防デバフ: [20]% [-100]             │
└────────────────────────────────────────────────────┘
```

### ドラッグ&ドロップ機能

**実装方法:**

```typescript
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ソート可能なカードコンポーネント
function SortableCharacterCard({ character, ...props }: CharacterCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: character.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CompactCharacterCard character={character} {...props} />
    </div>
  );
}

// メインコンポーネント
function DamageCalculator() {
  const [characters, setCharacters] = useState<Character[]>([]);
  
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={characters.map(c => c.id)}
        strategy={rectSortingStrategy}
      >
        <div className="card-grid">
          {characters.map((character) => (
            <SortableCharacterCard
              key={character.id}
              character={character}
              result={results[character.id]}
              comparison={comparisons[character.id]}
              onShowDetails={() => showDetails(character.id)}
              onRemove={() => removeCharacter(character.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### 詳細パネル

```
┌──────────────────────────────────────┐
│ 絢爛ダノター城 - ダメージ詳細         │
├──────────────────────────────────────┤
│ Phase 1: 攻撃力の確定                │
│   基礎攻撃: 1,000                    │
│   + 自己割合バフ: 40% (最大値)       │
│   + 固定値バフ: +100                 │
│   + 環境鼓舞: +500                   │
│   × 自己重複: 1.2                    │
│   × 環境重複: 1.2                    │
│   = 2,880                            │
│                                      │
│ Phase 2: ダメージ倍率                │
│   × 攻撃の2倍                        │
│   × 耐久50%以下 1.5倍                │
│   × 与えるダメージ 1.3倍             │
│   × 耐久依存 2.5倍 (最大)            │
│   = 28,080                           │
│                                      │
│ Phase 3: 防御力減算                  │
│   敵防御: 300 × 0.8 - 0 = 240       │
│   = 27,840                           │
│                                      │
│ Phase 4: 与ダメ・被ダメ              │
│   × 被ダメ: 1.5 (最大値)             │
│   = 41,760                           │
│                                      │
│ Phase 5: 連撃                        │
│   × 5連撃                            │
│   = 208,800                          │
│                                      │
│ DPS計算                              │
│   攻撃フレーム: 19 / 1.3 = 14.6f     │
│   隙フレーム: 22 × 0.6 = 13.2f       │
│   合計: 27.8f                        │
│   攻撃/秒: 60 / 27.8 = 2.16          │
│   DPS: 208,800 × 2.16 = 451,008      │
└──────────────────────────────────────┘
```

---

## DPS計算

### 武器種別フレームデータ

```typescript
const WEAPON_FRAMES: Record<string, WeaponFrameData> = {
  '刀': { attack: 19, gap: 22, total: 41 },
  '槍': { attack: 23, gap: 27, total: 50 },
  '槌': { attack: 27, gap: 30, total: 57 },
  '盾': { attack: 24, gap: 30, total: 54 },
  '拳': { attack: 37, gap: 18, total: 55 },
  '鎌': { attack: 22, gap: 22, total: 44 },
  '戦棍': { attack: 27, gap: 25, total: 52 },
  '双剣': { attack: 29, gap: 21, total: 50 },
  'ランス': { attack: 27, gap: 27, total: 54 },
  '弓': { attack: 19, gap: 18, total: 37 },
  '石弓': { attack: 24, gap: 24, total: 48 },
  '鉄砲': { attack: 29, gap: 27, total: 56 },
  '大砲': { attack: 42, gap: 42, total: 84 },
  '歌舞': { attack: 47, gap: 54, total: 101 },
  '法術': { attack: 42, gap: 30, total: 72 },
  '鈴': { attack: 134, gap: 0, total: 134, multiHit: 12, note: '12連撃（1撃は攻撃値の1/12）' },
  '杖': { attack: 37, gap: 30, total: 67 },
  '祓串': { attack: 32, gap: 27, total: 59 },
  '投剣': { attack: 24, gap: 18, total: 42 },
  '鞭': { attack: 24, gap: 21, total: 45 },
  '陣貝': { attack: 218, gap: 0, total: 218, multiHit: 18, note: '18連撃＋範囲回復' },
  '軍船': { attack: 32, gap: 42, total: 74 },
};

interface WeaponFrameData {
  attack: number;   // 攻撃フレーム
  gap: number;      // 隙フレーム
  total: number;    // 合計フレーム
  multiHit?: number; // 連撃数（鈴・陣貝のみ）
  note?: string;    // 備考
}
```

### DPS計算式

```typescript
function calculateDPS(
  result: DamageCalculationResult,
  character: Character,
  environment: EnvironmentSettings
): number {
  const frameData = WEAPON_FRAMES[character.weaponType];
  if (!frameData) return 0;
  
  // 速度バフを合算（最大値ルールを適用）
  const attackSpeedBuff = Math.max(
    character.selfBuffs.attackSpeed || 0,
    environment.attackSpeed || 0
  );
  
  const gapReductionBuff = Math.max(
    character.selfBuffs.gapReduction || 0,
    environment.gapReduction || 0
  );
  
  // フレーム計算
  // 攻撃フレーム = 基礎攻撃フレーム / (1 + 攻撃速度%)
  const attackFrames = frameData.attack / (1 + attackSpeedBuff / 100);
  
  // 隙フレーム = 基礎隙フレーム × (1 - 隙短縮%)
  const gapFrames = frameData.gap * (1 - gapReductionBuff / 100);
  
  const totalFrames = attackFrames + gapFrames;
  
  // 1秒あたりの攻撃回数（60FPS想定）
  const attacksPerSecond = 60 / totalFrames;
  
  // DPS計算
  // 連撃はPhase 5で既にtotalDamageに含まれているため、そのまま使用
  const dps = result.totalDamage * attacksPerSecond;
  
  return dps;
}
```

### DPS差分計算

```typescript
interface DPSComparison {
  before: number;
  after: number;
  diff: number;
  diffPercent: number;
}

function calculateDPSComparison(
  beforeResult: DamageCalculationResult,
  afterResult: DamageCalculationResult,
  character: Character,
  beforeEnv: EnvironmentSettings,
  afterEnv: EnvironmentSettings
): DPSComparison {
  const beforeDPS = calculateDPS(beforeResult, character, beforeEnv);
  const afterDPS = calculateDPS(afterResult, character, afterEnv);
  
  return {
    before: beforeDPS,
    after: afterDPS,
    diff: afterDPS - beforeDPS,
    diffPercent: beforeDPS > 0 ? ((afterDPS - beforeDPS) / beforeDPS) * 100 : 0,
  };
}
```

---

## データ構造

### キャラクター

```typescript
interface Character {
  id: string;
  name: string;
  weaponType: string;
  level: number;
  
  // 基礎ステータス
  stats: {
    baseAttack: number;
  };
  
  // 自己バフ
  selfBuffs: {
    // Phase 1: 攻撃力バフ
    percentBuffs: BuffValue[];     // 割合バフ（複数ある場合）
    flatBuffs: number[];           // 固定値バフ
    additiveBuffs: AdditiveValue[]; // 加算バフ
    duplicateBuffs: number[];      // 重複バフ
    
    // Phase 2: ダメージ倍率
    damageMultipliers: DamageMultiplier[];
    
    // Phase 3: 防御無視
    defenseIgnore: boolean;
    
    // Phase 外: 速度バフ
    attackSpeed?: number;   // 攻撃速度%
    gapReduction?: number;  // 隙短縮%
    
    // Phase 外: 鼓舞
    inspire?: {
      stat: 'attack' | 'defense';
      value: number; // %
      range: number; // 射程
    };
  };
  
  // 連撃
  multiHit?: number;
}

interface BuffValue {
  value: number;
  type: string; // バフの種類識別用（最大値ルール適用のため）
}

interface AdditiveValue {
  value: number;
  source: 'deployment' | 'tactic'; // 配置特技 or 計略
}

interface DamageMultiplier {
  type: 'attack_multiple' | 'give_damage' | 'conditional';
  value: number;
  condition?: string; // 条件の説明
}
```

### 環境設定

```typescript
interface EnvironmentSettings {
  // 共通バフ
  inspireFlat: number;           // 鼓舞（固定値）
  duplicateBuff: number;         // 効果重複%
  
  // 速度バフ
  attackSpeed: number;           // 攻撃速度%
  gapReduction: number;          // 隙短縮%
  
  // 敵ステータス
  enemyDefense: number;          // 敵防御力
  defenseDebuffPercent: number;  // 防御デバフ%
  defenseDebuffFlat: number;     // 防御デバフ固定値
  
  // ダメージバフ
  damageTaken: number;           // 被ダメ%
  
  // 条件設定
  enemyHpPercent: number;        // 敵HP% (条件付きバフ用)
}
```

### 計算結果

```typescript
interface DamageCalculationResult {
  characterId: string;
  
  // 各フェーズの結果
  phase1Attack: number;
  phase2Damage: number;
  phase3Damage: number;
  phase4Damage: number;
  totalDamage: number;
  
  // DPS
  dps: number;
  
  // 鼓舞量（該当キャラのみ）
  inspireAmount?: number;
  
  // 詳細情報（デバッグ/表示用）
  breakdown: {
    phase1: {
      baseAttack: number;
      percentBuffApplied: number;
      flatBuffApplied: number;
      additiveBuffApplied: number;
      duplicateBuffApplied: number;
      finalAttack: number;
    };
    phase2: {
      multipliers: Array<{ type: string; value: number }>;
      damage: number;
    };
    phase3: {
      enemyDefense: number;
      effectiveDefense: number;
      damage: number;
    };
    phase4: {
      damageDealt: number;
      damageTaken: number;
      damage: number;
    };
    phase5?: {
      attackCount: number;
      totalDamage: number;
    };
    dps: {
      attackFrames: number;
      gapFrames: number;
      totalFrames: number;
      attacksPerSecond: number;
      dps: number;
    };
  };
}
```

### 差分比較

```typescript
interface DamageComparison {
  characterId: string;
  before: DamageCalculationResult;
  after: DamageCalculationResult;
  
  diff: {
    totalDamage: number;
    totalDamagePercent: number;
    dps: number;
    dpsPercent: number;
    inspireAmount?: number;
  };
}
```

### 編成データ

```typescript
interface Formation {
  id: string;
  name: string;
  characters: Character[];
  environmentSettings: EnvironmentSettings;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 実装ガイドライン

### コンポーネント構成

```
DamageCalculator/
├── components/
│   ├── EnvironmentPanel.tsx          # 環境設定パネル
│   ├── CharacterGrid.tsx             # キャラクターグリッド（ドラッグ対応）
│   ├── CompactCharacterCard.tsx      # コンパクトカード
│   ├── DetailPanel.tsx               # 詳細パネル
│   ├── DiffIndicator.tsx             # 差分表示
│   └── FormationManager.tsx          # 編成管理
├── hooks/
│   ├── useDamageCalculation.ts       # ダメージ計算ロジック
│   ├── useDPSCalculation.ts          # DPS計算ロジック
│   └── useEnvironmentSettings.ts     # 環境設定管理
├── utils/
│   ├── damageCalculator.ts           # Phase 1-5の計算
│   ├── dpsCalculator.ts              # DPS計算
│   ├── formatters.ts                 # 数値フォーマット
│   └── constants.ts                  # 定数（フレームデータなど）
└── types/
    └── index.ts                      # 型定義
```

### 計算フローの実装

```typescript
// メインの計算フック
function useDamageCalculation(
  characters: Character[],
  environment: EnvironmentSettings
) {
  const [results, setResults] = useState<Record<string, DamageCalculationResult>>({});
  const [comparisons, setComparisons] = useState<Record<string, DamageComparison>>({});
  const [previousEnvironment, setPreviousEnvironment] = useState(environment);

  useEffect(() => {
    // 全キャラクターのダメージを計算
    const newResults: Record<string, DamageCalculationResult> = {};
    
    for (const character of characters) {
      newResults[character.id] = calculateDamage(character, environment);
    }
    
    setResults(newResults);
    
    // 差分を計算
    if (previousEnvironment) {
      const newComparisons: Record<string, DamageComparison> = {};
      
      for (const character of characters) {
        const beforeResult = calculateDamage(character, previousEnvironment);
        const afterResult = newResults[character.id];
        
        newComparisons[character.id] = {
          characterId: character.id,
          before: beforeResult,
          after: afterResult,
          diff: {
            totalDamage: afterResult.totalDamage - beforeResult.totalDamage,
            totalDamagePercent: ((afterResult.totalDamage - beforeResult.totalDamage) / beforeResult.totalDamage) * 100,
            dps: afterResult.dps - beforeResult.dps,
            dpsPercent: ((afterResult.dps - beforeResult.dps) / beforeResult.dps) * 100,
          },
        };
      }
      
      setComparisons(newComparisons);
    }
    
    setPreviousEnvironment(environment);
  }, [characters, environment]);

  return { results, comparisons };
}
```

### ユーティリティ関数

```typescript
// 数値を短縮表示（15234 → 15.2K）
function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// 名前を短縮（「絢爛ダノター城」→「絢爛ダノ」）
function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength);
}

// 差分インジケーター
function DiffIndicator({ value, percent }: { value: number; percent: number }) {
  if (Math.abs(percent) < 0.1) {
    return <span className="diff-indicator neutral">-</span>;
  }
  
  const isPositive = percent > 0;
  const className = `diff-indicator ${isPositive ? 'positive' : 'negative'}`;
  
  return (
    <span className={className}>
      {isPositive ? '↑' : '↓'} {Math.abs(percent).toFixed(1)}%
    </span>
  );
}
```

### 重要な計算ルールの実装

```typescript
// 最大値ルールの適用
function applyMaxValueRule(buffs: BuffValue[]): number {
  if (buffs.length === 0) return 0;
  
  // 同種バフごとにグループ化
  const grouped = buffs.reduce((acc, buff) => {
    if (!acc[buff.type]) {
      acc[buff.type] = [];
    }
    acc[buff.type].push(buff.value);
    return acc;
  }, {} as Record<string, number[]>);
  
  // 各グループの最大値を取得して合計
  return Object.values(grouped)
    .map(values => Math.max(...values))
    .reduce((sum, max) => sum + max, 0);
}

// 加算バフと重複バフの特殊相互作用
function applyAdditiveWithDuplicate(
  baseAttack: number,
  additiveBuffs: AdditiveValue[],
  duplicateBuff: number
): number {
  const totalAdditive = additiveBuffs.reduce((sum, buff) => {
    const baseValue = baseAttack * (buff.value / 100);
    // 射程内重複バフがある場合、加算バフも乗算される
    return sum + (baseValue * (1 + duplicateBuff / 100));
  }, 0);
  
  return totalAdditive;
}
```

### パフォーマンス最適化

```typescript
// メモ化された計算
const memoizedCalculateDamage = useMemo(() => {
  return (character: Character, environment: EnvironmentSettings) => {
    return calculateDamage(character, environment);
  };
}, []);

// デバウンス処理（環境設定の変更時）
const debouncedUpdateEnvironment = useMemo(
  () => debounce((newSettings: EnvironmentSettings) => {
    setEnvironment(newSettings);
  }, 300),
  []
);
```

---

## 変更履歴

### v1.0 (2025-12-07)
- 初版作成
- ダメージ計算仕様の完全定義
- UI設計（コンパクトカード、6列グリッド）
- DPS計算（フレームデータ、速度バフ対応）
- ドラッグ&ドロップ機能
- データ構造の定義

---

*Last Updated: 2025-12-07*  
*Version: 1.0*  
*Document Status: Complete*
