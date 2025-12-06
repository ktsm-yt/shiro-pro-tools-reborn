# ShiroPro Tools (Reborn) - 統合設計書

## 1. プロジェクト全体像

### 1.1 目的
城プロREの編成管理、バフ可視化、ダメージ計算を行うWebアプリ。
旧ツール（buffParser.js）の資産を活かしつつ、TypeScript + React で堅牢に再構築。

### 1.2 コア原則
1. **Core/UI分離**: 計算ロジックはReact非依存の純粋関数
2. **型安全**: すべてのデータにTypeScript型定義
3. **テスタブル**: Vitestでロジックを徹底テスト
4. **段階的移植**: 旧ツールのロジックを少しずつ移植

---

## 2. データモデル設計

### 2.1 現行 Reborn 型定義（types/index.ts）

```typescript
// ステータス種別
type Stat = 'attack' | 'defense' | 'range' | 'cooldown' | 'cost' | 'damage_dealt' | 'damage_taken';

// バフ適用モード
type BuffMode = 'percent_max' | 'flat_sum';

// バフ定義
interface Buff {
  id: string;
  stat: Stat;
  mode: BuffMode;
  value: number;
  source: 'self_skill' | 'ally_skill' | 'strategy' | 'formation_skill';
  target: 'self' | 'range' | 'all';
  conditionTags?: ConditionTag[];
  isActive: boolean;
}
```

### 2.2 旧ツール（buffParser.js）の出力形式

```javascript
// parseSkillLine の出力例
{
  type: '攻撃割合',      // → Stat へ変換
  target: '自身',        // → target へ変換
  value: 30,
  unit: '+%',           // → BuffMode へ変換
  isSpecial: false,
  hasCondition: false,
  note: ''
}
```

### 2.3 型変換マッピング

| 旧ツール (type)       | Reborn (Stat)    | 備考 |
|----------------------|------------------|------|
| `攻撃割合`           | `attack`         | percent_max |
| `攻撃固定`           | `attack`         | flat_sum |
| `防御割合`           | `defense`        | percent_max |
| `射程割合`           | `range`          | percent_max |
| `射程固定`           | `range`          | flat_sum |
| `攻撃速度割合`       | `cooldown`       | percent_max (攻撃速度=再攻撃短縮) |
| `与ダメ割合`         | `damage_dealt`   | percent_max |
| `被ダメ割合`         | `damage_taken`   | percent_max |

| 旧ツール (target)    | Reborn (target)  |
|----------------------|------------------|
| `自身`               | `self`           |
| `射程内`             | `range`          |
| `全`                 | `all`            |
| `城娘`               | `all`            |
| `近接`               | `melee`（条件付き）|
| `遠隔`               | `ranged`（条件付き）|

---

## 3. アーキテクチャ

### 3.1 ディレクトリ構成（目標）

```
src/
├── core/                      # ピュアロジック（React非依存）
│   ├── types/
│   │   └── index.ts           # 型定義
│   ├── parser/
│   │   ├── buffParser.ts      # 旧buffParser.jsのTS移植
│   │   ├── patterns.ts        # 正規表現パターン定義
│   │   ├── converter.ts       # 旧形式→Reborn形式変換
│   │   └── __tests__/
│   │       └── buffParser.test.ts
│   ├── logic/
│   │   ├── buffs.ts           # バフ計算ロジック
│   │   ├── damage.ts          # ダメージ計算（将来）
│   │   └── __tests__/
│   │       └── buffs.test.ts
│   ├── data/
│   │   └── weaponMapping.ts   # 武器種マッピング
│   └── mock/
│       └── data.ts            # テスト用データ
│
├── features/                  # 機能モジュール
│   └── wiki/
│       ├── fetcher.ts         # HTML取得
│       ├── parser.ts          # HTML→RawData
│       └── analyzer.ts        # RawData→Character
│
├── ui/                        # Reactコンポーネント
│   ├── components/
│   │   ├── FormationGrid.tsx
│   │   ├── BuffMatrix.tsx
│   │   ├── BuffStackBar.tsx   # 積み上げバー（新規）
│   │   ├── ReferenceGauge.tsx # 理想値ゲージ（新規）
│   │   └── AttackerAnalysis.tsx
│   ├── hooks/
│   │   └── useFormation.ts
│   └── contexts/
│       └── FormationContext.tsx
│
├── App.tsx
└── main.tsx
```

### 3.2 データフロー

```
[Wiki URL]
    ↓
[Fetcher] ─────────────────────────────────────────────┐
    ↓ HTML                                              │
[Wiki Parser] (parseWikiHTML)                          │
    ↓ RawData { skillsText, strategiesText }           │
[Buff Parser] (parseSkillLine) ← 旧buffParser移植       │
    ↓ ParsedBuff[]                                      │
[Converter] (convertToRebornBuff)                      │
    ↓ Buff[]                                            │
[Character Builder]                                    │
    ↓ Character                                         │
[Formation State] ←─────────────────────────────────────┘
    ↓
[calcBuffMatrix] (ピュア関数)
    ↓ BuffMatrixResult
[React Components] → 表示
```

---

## 4. 移植計画

### Phase 1: buffParserの移植（優先度：最高）

#### 4.1 移植対象（buffParser.js より）

1. **正規表現パターン** (~50個)
   - 攻撃バフ、防御バフ、射程バフ...
   - 条件付きバフ（巨大化時、〇〇属性の城娘...）

2. **parseSkillLine 関数**
   - 特技テキスト → ParsedBuff[] への変換

3. **weaponMapping**
   - 武器種 → { range, type, placement }

4. **targetMapping / legacyTargetMapping**
   - ターゲット表記の正規化

#### 4.2 移植手順

```
Step 1: patterns.ts
  - 正規表現パターンをTypeScriptで定義
  - パターンごとに対応するStat/BuffModeを明記

Step 2: buffParser.ts
  - parseSkillLine を移植
  - 戻り値型を ParsedBuff として定義

Step 3: converter.ts
  - ParsedBuff → Buff への変換関数
  - 旧表記→新表記のマッピング

Step 4: テスト作成
  - 既知の特技テキストで期待値を確認
  - 「攻撃が30%上昇」→ { stat: 'attack', value: 30, mode: 'percent_max' }
```

### Phase 2: ロジック完成（buffs.ts）

1. `isBuffApplicable` の射程判定実装
2. 条件タグ（ConditionTag）の判定ロジック
3. 巨大化バフの処理

### Phase 3: テスト充実

1. 各パターンの単体テスト
2. 複合バフのテスト
3. 実際のキャラデータでの結合テスト

### Phase 4: UI実装

1. BuffStackBar コンポーネント
2. ReferenceGauge コンポーネント
3. AttackerAnalysis 画面

---

## 5. 型定義の拡張案

### 5.1 ParsedBuff（パーサー出力型）

```typescript
// parser/types.ts
export interface ParsedBuff {
  type: string;          // '攻撃割合', '防御固定' など
  target: string;        // '自身', '射程内', '城娘' など
  value: number;
  unit: string;          // '+%', '+' など
  isSpecial: boolean;    // 特殊条件付きか
  hasCondition: boolean; // 条件付きか
  conditionText?: string; // 条件の説明テキスト
  note: string;
  rawText: string;       // 元のテキスト（デバッグ用）
}
```

### 5.2 WeaponInfo

```typescript
// data/weaponMapping.ts
export interface WeaponInfo {
  range: 'melee' | 'ranged';
  type: 'physical' | 'magical';
  placement: 'ground' | 'water' | 'both';
}

export const weaponMapping: Record<string, WeaponInfo> = {
  '刀': { range: 'melee', type: 'physical', placement: 'ground' },
  '槍': { range: 'melee', type: 'physical', placement: 'ground' },
  '弓': { range: 'ranged', type: 'physical', placement: 'ground' },
  '法術': { range: 'ranged', type: 'magical', placement: 'ground' },
  '鉄砲': { range: 'ranged', type: 'physical', placement: 'ground' },
  '歌舞': { range: 'ranged', type: 'magical', placement: 'ground' },
  // ... 続く
};
```

### 5.3 ConditionTag の拡張

```typescript
export type ConditionTag =
  // 武器系
  | 'melee' | 'ranged'
  // 属性系
  | 'water' | 'mountain' | 'flat' | 'flatMountain' | 'hell'
  // 状態系
  | 'hp_below_50' | 'hp_above_50'
  | 'giant_1' | 'giant_2' | 'giant_3' | 'giant_4' | 'giant_5'
  | 'strategy_active'
  // 特殊
  | 'same_weapon' | 'different_weapon';
```

---

## 6. テスト戦略

### 6.1 単体テスト（パーサー）

```typescript
// parser/__tests__/buffParser.test.ts
describe('parseSkillLine', () => {
  test.each([
    ['攻撃が30%上昇', { stat: 'attack', value: 30, mode: 'percent_max' }],
    ['攻撃が50上昇', { stat: 'attack', value: 50, mode: 'flat_sum' }],
    ['射程内の城娘の攻撃が20%上昇', { stat: 'attack', value: 20, target: 'range' }],
    ['自身の攻撃速度が15%上昇', { stat: 'cooldown', value: 15 }],
  ])('"%s" → %o', (input, expected) => {
    const result = parseSkillLine(input);
    expect(result[0]).toMatchObject(expected);
  });
});
```

### 6.2 結合テスト（編成計算）

```typescript
describe('calcBuffMatrix with real data', () => {
  test('江戸城の全体バフが全員に適用される', () => {
    // ...
  });
});
```

---

## 7. 次のアクション

### 今すぐやること
1. ✅ 設計書作成（本ドキュメント）
2. 🔲 buffParser.js をアップロードしてもらう
3. 🔲 patterns.ts の作成開始

### buffParser.js が必要な理由
- 正規表現パターン（約50個）の正確な移植
- parseSkillLine の実装詳細確認
- エッジケースの把握

---

## 8. 参考：UI設計（仕様書より）

### BuffMatrix のセル表示
```
┌─────────────────────────────┐
│ ● ◯ ●  (誰からバフを受けているか) │
│ [■■□□] 30% (自20% + 味方10%)    │
└─────────────────────────────┘
```

### リファレンスゲージ
```
[====|=====|===] 75%
 赤(不足) 緑(適正) 青(過剰)
```

---

*Last Updated: 2025-01-XX*
