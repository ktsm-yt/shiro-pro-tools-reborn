# ShiroPro Tools (Reborn) - パースルール完全仕様書

**Version**: 1.0  
**Status**: 仕様確定 ✅  
**Last Updated**: 2025-12-06

---

## 📋 目的

城プロREのWikiテキストから、バフ情報を正確に抽出するためのパースルールの完全な定義です。

このドキュメントは、buffParser.tsの実装時に参照する最も重要なガイドラインとなります。城プロ公式の暗黙のルール、表記揺れ、複雑な文構造への対処方法を、豊富な具体例とともに説明します。

### なぜこのドキュメントが必要か

城プロREのWikiテキストは、人間が読むことを前提に書かれており、プログラムで解析するには多くの課題があります。公式自体が表記を統一しておらず、同じ意味でも異なる書き方がされています。また、文法的な区切りが曖昧で、どこまでが一つのバフなのか、どの修飾語がどの効果にかかるのかが不明瞭なケースが多数存在します。

これらの問題に対処するため、過去の試行錯誤で得られた知見を集約し、明文化したものがこのドキュメントです。実装者がこれを読めば、どんな複雑なテキストでも、正しくバフに分割できるようになることを目指しています。

---

## 🎯 設計思想

### 1. 段階的な処理

テキストパースは、一度に全てを解決しようとせず、段階的に処理を進めます。各段階で、明確な責務を持つ処理を行うことで、複雑さを管理します。

処理の流れは大きく分けて以下の段階になります。まず前処理として、全角・半角の統一や、明らかな誤字の修正などを行います。次に文の分割として、句読点や接続詞を基準に、テキストを意味のある単位に分割します。そして範囲の検出として、各文から「誰に効くか」という範囲情報を抽出します。続いて効果の抽出として、「何が」「どれだけ」変化するかを抽出します。最後に条件の抽出として、括弧内や文脈から、適用条件を抽出します。

この段階的な処理により、各ステップでの判断基準が明確になり、デバッグも容易になります。

### 2. 文脈の保持

テキストパースでは、現在処理している部分だけでなく、前後の文脈も考慮する必要があります。範囲指定が省略されている場合は、前の文の範囲を継承します。接頭辞の影響範囲を判定するために、次に出現するキーワードまで先読みする必要もあります。

そのため、パーサーは常に「現在の状態」を保持しながら処理を進めます。現在の範囲、現在の接頭辞、現在の条件など、状態を管理することで、文脈に応じた正しい解釈が可能になります。

### 3. 優先順位に基づく判定

複数のルールが競合する場合は、優先順位に基づいて判定します。例えば、括弧内の明示的な条件は、文脈から推測される暗黙の条件よりも優先されます。

また、より具体的なパターンマッチを、より一般的なパターンより先に試すことで、誤検出を防ぎます。例えば、「与えるダメージ」という完全一致パターンは、「与ダメ」という部分一致パターンより先にチェックします。

### 4. エラー耐性

公式の表記揺れや、予期しないパターンに対しても、可能な限り解釈を試みます。ただし、確信が持てない場合は、安全側に倒します。不明なバフとして記録し、手動確認を促すことで、誤った情報の伝播を防ぎます。

---

## 🔄 パースの全体フロー

城プロWikiのテキストから、Buffオブジェクトを生成するまでの全体的な流れを説明します。

### ステップ1: 前処理（Preprocessing）

入力テキストをクリーンアップし、後続の処理を容易にします。

#### 1-1. 全角・半角の統一

全角数字を半角に、全角記号を半角に統一します。これにより、正規表現パターンがシンプルになります。

```typescript
// 変換例
"３０％" → "30%"
"＋５０" → "+50"
"１．５倍" → "1.5倍"
```

#### 1-2. 表記揺れの正規化

同じ意味で異なる表記がされているものを統一します。

```typescript
// 上昇系
"アップ" → "上昇"
"UP" → "上昇"
"増加" → "上昇"  // ※ただし「被ダメージ増加」は例外

// 低下系
"ダウン" → "低下"
"DOWN" → "低下"
"減少" → "低下"  // ※ただし「消費気減少」は例外

// パーセント
"％" → "%"
```

重要な注意点として、文脈によって意味が変わる場合は、単純な置換をしてはいけません。例えば、「被ダメージ増加」は敵へのデバフであり、「攻撃上昇」とは意味が異なります。また、「消費気減少」は軽減効果であり、「攻撃低下」とは計算式が異なります。

これらは後続のパターンマッチで、文脈を考慮して正しく解釈します。

#### 1-3. 不要な情報の除去

効果時間など、編成パズルに関係ない情報を削除します。

```typescript
// 除去するパターン
/効果時間[：:]\s*\d+秒/  → ""
/\d+秒間/  → ""
```

ただし、「巨大化する度に」のような、計算に影響する情報は除去しません。

### ステップ2: 文の分割（Segmentation）

テキストを意味のある単位に分割します。分割の基準は、句読点、接続詞、そして範囲指定の変化です。

#### 2-1. 句読点による分割

「。」や「、」を基準に分割しますが、全ての句読点で分割するわけではありません。括弧内の句読点や、並列表記の区切り（「と」「・」など）では分割しません。

```typescript
// 例: "攻撃と防御が30%上昇。射程が50上昇"
// → ["攻撃と防御が30%上昇", "射程が50上昇"]
```

#### 2-2. 範囲指定の変化による分割

新しい範囲指定が出現した場合、そこで分割します。

```typescript
// 例: "射程内の敵の防御が低下全ての敵の移動速度が低下"
// → ["射程内の敵の防御が低下", "全ての敵の移動速度が低下"]
```

範囲指定のキーワードには、「射程内」「全て」「自身」などがあります。これらが検出されたら、新しいセグメントの開始と判定します。

#### 2-3. 接頭辞による分節

「巨大化する度に」「巨大化毎に」のような接頭辞が複数回出現する場合、それぞれで分節します。

```typescript
// 例: "巨大化する度に攻撃が上昇巨大化毎に防御が上昇"
// → ["巨大化する度に攻撃が上昇", "巨大化毎に防御が上昇"]
```

### ステップ3: 範囲の検出と継続（Target Detection）

各セグメントから、「誰に効くか」という範囲情報を抽出します。

#### 3-1. 明示的な範囲指定

テキストに明示的に書かれている範囲を検出します。

```typescript
// パターンと対応するtarget
/^自身/ → 'self'
/射程(?:内|範囲)/ → 'range'
/全(?:て|体)?/ → 'all'
```

#### 3-2. 範囲の継続ルール

**これは最も重要なルールの一つです。**

範囲指定がない場合、前のセグメントの範囲を継承します。明示的に新しい範囲が指定されるか、新しい接頭辞が出現するまで、範囲は継続します。

```typescript
// 例: "射程内の敵の防御と移動速度が低下、射程が低下"
// 
// セグメント1: "射程内の敵の防御と移動速度が低下"
// → target: 'range'
// 
// セグメント2: "射程が低下"
// → 範囲指定なし → 前のセグメントの 'range' を継承
```

この継続ルールにより、城プロの自然な日本語表記（範囲を繰り返さない簡潔な書き方）を正しく解釈できます。

#### 3-3. 対象種別の検出

範囲に加えて、対象種別（味方、敵）も検出します。

```typescript
// 味方を示すキーワード
/城娘/ → 対象は味方
/味方/ → 対象は味方
/殿/ → 対象は味方（特殊）

// 敵を示すキーワード
/敵/ → 対象は敵
```

対象種別は、targetではなくStatの選択に影響します。例えば、「攻撃低下」でも、対象が味方なら通常はあり得ず（デバフ）、対象が敵なら`enemy_attack`になります。

### ステップ4: 効果の抽出（Effect Extraction）

「何が」「どれだけ」変化するかを抽出します。

#### 4-1. Statの検出

正規表現パターンマッチで、どのStatに該当するかを判定します。パターンは、TYPE_CONVERSION_MAPPING.mdで定義されたものを使用します。

重要なのは、パターンマッチの優先順位です。より具体的なパターンを先にチェックします。

```typescript
// ✅ 正しい順序
if (/^与えるダメージ/.test(text)) {
  stat = 'give_damage';
} else if (/与ダメ/.test(text)) {
  stat = 'damage_dealt';
}

// ❌ 間違った順序（「与えるダメージ」も「与ダメ」にマッチしてしまう）
if (/与ダメ/.test(text)) {
  stat = 'damage_dealt';
} else if (/^与えるダメージ/.test(text)) {
  stat = 'give_damage'; // ここに到達しない
}
```

#### 4-2. 数値の抽出

正規表現で数値を抽出します。整数、小数、パーセントに対応します。

```typescript
// パターン
/(\d+(?:\.\d+)?)%/  // パーセント: "30%"
/(\d+(?:\.\d+)?)倍/  // 倍率: "1.5倍"
/(\d+)/             // 整数: "50"
```

#### 4-3. BuffModeの決定

数値の単位や文脈から、BuffModeを決定します。

```typescript
// '%' がある → percent_max
// '倍' がある → percent_max（値は変換必要: 1.5倍 → 50%）
// 数値のみ → flat_sum

// 例外: 「短縮」「軽減」「減少」がある場合
if (/短縮|軽減/.test(text)) {
  mode = 'percent_reduction';
}
```

### ステップ5: 条件の抽出（Condition Extraction）

括弧内や文脈から、適用条件を抽出します。

#### 5-1. 括弧内の条件

括弧内のテキストから、ConditionTagや特殊フラグを抽出します。

```typescript
// 効果重複の検出
if (/(効果重複|重複可|重複可能)/.test(bracketText)) {
  isDuplicate = true;
}

// ConditionTagの検出（CONDITION_TAG_SPEC.mdのルールに従う）
const conditionTags = extractConditionTags(bracketText);
```

#### 5-2. 括弧のスコープ判定

**これも非常に重要なルールです。**

括弧内の情報が、どの効果にかかるかを判定します。

```typescript
// 原則: 括弧は直前の効果にのみかかる
// 
// 例: "防御と移動速度が低下(効果重複)、射程が低下"
// → 効果重複は「防御と移動速度の低下」のみ
// → 「射程の低下」には効果重複は適用されない
```

特殊なケースとして、「(自身のみ)」などの対象を限定する括弧は、「対象」というキーワードを含む部分にのみかかります。

```typescript
// 例: "対象の射程が上昇。射程内の城娘の攻撃が上昇(自身のみ)"
// 
// "(自身のみ)" は「対象の射程が上昇」にかかり、
// 「射程内の城娘の攻撃が上昇」にはかからない
```

### ステップ6: 並列表記の展開（Parallel Expansion）

「攻撃と防御が30%上昇」のような並列表記を、個別のバフに分割します。

#### 6-1. 「と」による並列

最も一般的な並列表記です。

```typescript
// 例: "攻撃と防御が30%上昇"
// → "攻撃が30%上昇" と "防御が30%上昇"
```

#### 6-2. 「・」（中黒）による並列

敵デバフでよく使われます。

```typescript
// 例: "射程・移動速度が30%低下"
// → "射程が30%低下" と "移動速度が30%低下"
```

#### 6-3. 展開時の情報の継承

並列表記を展開する際、範囲、数値、モード、条件などは全て継承されます。

```typescript
// 例: "射程内の敵の防御と移動速度が6%低下(効果重複)"
// 
// 展開後:
// 1. "射程内の敵の防御が6%低下(効果重複)"
// 2. "射程内の敵の移動速度が6%低下(効果重複)"
// 
// 両方に target: 'range', isDuplicate: true が設定される
```

### ステップ7: 特殊処理（Special Processing）

通常のパターンマッチでは扱えない、特殊なケースの処理です。

#### 7-1. 鼓舞の処理

【鼓舞】というマーカーがある場合、特殊な処理フローに入ります。

```typescript
// 例: "【鼓舞】自身の攻撃と防御の30%を射程内に加算"
// 
// 処理:
// 1. 【鼓舞】マーカーを検出
// 2. 参照元のStat（攻撃、防御）を抽出
// 3. 各Statに対して、inspireバフを生成
```

詳細は後述の「鼓舞の処理ルール」セクションで説明します。

#### 7-2. 巨大化倍率の適用

「巨大化する度に」という接頭辞がある場合、値を5倍にします。

```typescript
// 例: "巨大化する度に攻撃が6%上昇"
// → value: 6 × 5 = 30
```

ただし、一部のStatは巨大化倍率の適用対象外です（skipGiantMultiplier）。詳細は後述します。

#### 7-3. 倍率の変換

「1.5倍」のような倍率表記を、パーセントに変換します。

```typescript
// 変換式: (倍率 - 1) × 100
// 
// 1.5倍 → (1.5 - 1) × 100 = 50%
// 2倍 → (2 - 1) × 100 = 100%
// 0.8倍 → (0.8 - 1) × 100 = -20%
```

### ステップ8: バフオブジェクトの生成（Buff Creation）

抽出した情報を元に、Buffオブジェクトを生成します。

```typescript
const buff: Buff = {
  id: generateId(),
  stat: detectedStat,
  mode: detectedMode,
  value: detectedValue,
  target: detectedTarget,
  conditionTags: extractedConditions,
  isDuplicate: detectedDuplicate,
  source: isFromStrategy ? 'strategy' : 'self_skill',
  isActive: true,
  // 特殊フィールド（必要に応じて）
  costType: detectedCostType,
  inspireSourceStat: detectedInspireSource
};
```

---

## 📊 型定義の拡張（v1.2）

v1.1からさらに拡張し、より複雑なパターンに対応します。

### 新しいStat

```typescript
// 敵デバフ系に追加
type EnemyDebuffStat =
  | 'enemy_attack'
  | 'enemy_defense'
  | 'enemy_defense_ignore_percent'
  | 'enemy_defense_ignore_complete'
  | 'enemy_movement'
  | 'enemy_knockback'
  | 'enemy_range';              // ★新規追加（敵の射程低下）

// ダメージ計算系に追加
type DamageMultiplierStat =
  | 'damage_dealt'
  | 'give_damage'
  | 'damage_taken'
  | 'damage_recovery'
  | 'critical_bonus';            // ★新規追加（直撃ボーナス）
```

### 新しいBuffMode

```typescript
type BuffMode = 
  | 'percent_max'
  | 'flat_sum'
  | 'percent_reduction'
  | 'absolute_set';              // ★新規追加（絶対値設定）
```

**absolute_setの用途**: 「直撃ボーナスが300%に上昇」のような、最終的な値を指定する場合に使用します。

### targetの拡張

射程外の城娘に効果があるバフ、およびフィールド全体に影響を与えるバフを表現するため、新しいターゲットを追加します。

```typescript
type BaseTarget = 'self' | 'range' | 'all' | 'out_of_range' | 'field';
```

**各ターゲットの意味**:

- **self**: 自身のキャラクター
- **range**: 自身の射程内の味方城娘
- **all**: 編成内の全ての城娘
- **out_of_range**: 自身の射程外にいる味方城娘（甲府城の例で使用）
- **field**: フィールド全体への効果（気などの共有リソース）

**fieldターゲットの重要性**:

城プロREでは、気（フィールドコスト）は個別のキャラクターが持つリソースではなく、編成全体で共有されるフィールドリソースです。このため、気に関するバフは特定のキャラクターへの効果ではなく、フィールド全体への効果として扱う必要があります。

気は時間経過で自然に増加し、城娘の配置、巨大化、計略発動、特殊能力使用などに消費されます。気に関するバフ（自然増加量の上昇、敵撃破時の獲得気増加など）は、全てフィールド全体に影響を与えるため、`target: 'field'`として表現します。

### Buffインターフェースの拡張（完全版）

```typescript
interface Buff {
  id: string;
  stat: Stat;
  mode: BuffMode;
  value: number;
  source: 'self_skill' | 'ally_skill' | 'strategy' | 'formation_skill';
  target: 'self' | 'range' | 'all' | 'out_of_range';
  conditionTags?: ConditionTag[];
  isActive: boolean;

  // 特殊フラグ
  isDuplicate?: boolean;
  isExplicitlyNonDuplicate?: boolean;

  // ★v1.2で新規追加: スタック関連の高度な制御
  stackable?: boolean;           // スタック可能かどうか
  maxStacks?: number;            // 最大スタック回数
  currentStacks?: number;        // 現在のスタック数（実行時に使用）
  stackPenalty?: number;         // スタック時のペナルティ（0.5 = 半減）
  nonStacking?: boolean;         // 重複しない（最大値のみ適用）

  // ★v1.2で新規追加: UI表示優先度
  priority?: 'high' | 'normal' | 'low';  // 表示優先度

  // ★v2.0で廃止: costType は使用しない
  // 気バフは分離したStatで管理: cost, cost_gradual, cost_giant,
  // cost_enemy_defeat, cost_defeat_bonus, cost_strategy
  // costType?: CostBuffType;  // 廃止

  // inspire専用フィールド
  inspireSourceStat?: Stat;

  // 備考
  note?: string;
}
```

**新しいフィールドの詳細説明**:

- **stackPenalty**: 「重複時効果減少」に対応します。値は減少率を表します（0.5 = 50%減、つまり半減）。同じバフが複数スタックした場合、2つ目以降の効果にこのペナルティが適用されます。

- **nonStacking**: 「重複なし」に対応します。このフラグがtrueの場合、複数のキャラが同じstatのバフを持っていても、最大値のものだけが適用されます。

- **priority**: UI表示の優先度を示します。甲府城のような「射程内と射程外で効果が異なる」バフで、射程内のバフを優先的に表示するために使用します。

### 新しいConditionTag

```typescript
type ConditionTag = 
  // ... 既存のタグ
  
  // ★新規追加: 特殊条件
  | 'on_water'              // 水上（【水上】特技）
  | 'exclude_self'          // 自身を除く
  | 'hp_dependent'          // HP/耐久依存（高いほど効果大）
  | 'on_placement';         // 配置時（【配置】特技）
```

**重要な統一**: 「耐久依存」と「HP依存」は同じ意味なので、一つのタグ`hp_dependent`に統一します。

### GradualCostIncreaseの特殊型（検討中）

徐々に気が増加する系の複雑なルールを表現するため、専用の型を検討しています。

```typescript
interface GradualCostIncrease {
  type: 'gradual_cost';
  interval: number;       // 増加間隔（秒）
  amount: number;         // 増加量
  rule: 'basic' | 'explicit' | 'giant_dependent';  // 適用されたルール
  note?: string;          // ルールの説明
}
```

**注意**: これは通常のBuffとは異なる構造を持つため、別の型として扱うか、Buffの拡張として扱うか、設計の検討が必要です。

---

## 📋 基本ルール

ここからは、各処理ステップの詳細なルールを説明します。

### ルール1: 範囲の検出と継続

#### 1-1. 範囲指定のキーワード

以下のキーワードが検出された場合、対応するtargetを設定します。

```typescript
const TARGET_PATTERNS = [
  // 自身
  { pattern: /^自身/, target: 'self' },
  { pattern: /自分/, target: 'self' },
  
  // 射程内
  { pattern: /射程(?:内|範囲)/, target: 'range' },
  { pattern: /範囲(?:内)?/, target: 'range' },  // 文脈依存
  
  // 全体
  { pattern: /全(?:て|体)?/, target: 'all' },
];
```

#### 1-2. 範囲の継続条件

以下の条件を全て満たす場合、前のセグメントの範囲を継承します。

条件A: 現在のセグメントに範囲指定キーワードがない
条件B: 新しい接頭辞（「巨大化する度に」など）が出現していない
条件C: 文の終わり（「。」）に達していない

```typescript
// 例1: 継続する場合
// "射程内の敵の防御と移動速度が低下、射程が低下"
// 
// セグメント1: "射程内の敵の防御と移動速度が低下"
// → target: 'range'
// 
// セグメント2: "、射程が低下"
// → 条件A: 範囲指定なし ✓
// → 条件B: 新しい接頭辞なし ✓
// → 条件C: 文は続いている ✓
// → 結果: target: 'range' を継承

// 例2: 継続しない場合
// "射程内の敵の防御が低下。全ての敵の移動速度が低下"
// 
// セグメント1: "射程内の敵の防御が低下。"
// → target: 'range'
// 
// セグメント2: "全ての敵の移動速度が低下"
// → 条件A: 「全ての敵」という範囲指定あり ✗
// → 結果: target: 'all' に変更
```

#### 1-3. 「対象」キーワードの特殊処理

「対象」というキーワードは、文末の括弧（「(自身のみ)」など）によって、その参照先が決定されます。

```typescript
// パターン1: (自身のみ) がある場合
// "対象の射程が上昇(自身のみ)"
// → target: 'self'

// パターン2: 括弧がない場合
// "対象の射程が上昇"
// → target: 'self'（デフォルト）

// パターン3: (自身のみ) が他の効果にかかる場合
// "対象の射程が上昇。射程内の城娘の攻撃が上昇(自身のみ)"
// 
// 効果1: "対象の射程が上昇"
// → "(対象" を含むので、"(自身のみ)" が適用される
// → target: 'self'
// 
// 効果2: "射程内の城娘の攻撃が上昇"
// → "対象" を含まないので、"(自身のみ)" は適用されない
// → target: 'range'
```

### ルール2: 接頭辞のスコープ

接頭辞（「巨大化する度に」など）は、どこまでの範囲に影響するかを判定する必要があります。

#### 2-1. 接頭辞の影響範囲

接頭辞は、以下のいずれかが出現するまで継続します。

終了条件A: 明示的な分節（「。」）
終了条件B: 新しい接頭辞の出現
終了条件C: 新しい範囲指定の出現（※設計決定が必要）

**設計決定1: 「全ての敵」と「巨大化する度に」の関係**

引き継ぎドキュメントで指摘されていた重要な設計決定です。

```typescript
// 問題のテキスト:
// "巨大化する度に射程内の敵の防御が6%低下...全ての敵の防御が8%低下"
// 
// 解釈A: 「全ての敵」も「巨大化する度に」の影響を受ける
// → 防御が 8% × 5 = 40% 低下
// 
// 解釈B: 「全ての敵」で新しい分節が始まる
// → 防御が 8% 低下（倍率なし）
```

ゲームの実際の動作を確認する必要がありますが、ここでは以下のルールを採用します。

**採用するルール**: 新しい範囲指定（「全ての敵」「射程内」など）が出現した場合でも、明示的な分節（「。」）または新しい接頭辞が出現するまで、接頭辞の影響は継続する。

理由：
- 城プロの文法では、範囲の変更は接頭辞のスコープをリセットしない
- 同じ文の中であれば、同じ接頭辞の影響下にあると解釈するのが自然
- 実際のゲームでも、多くの場合この解釈が正しい

ただし、実装時には`giantMultiplierScope`のような設定フラグを用意し、将来的に解釈を切り替えられるようにします。

#### 2-2. 接頭辞の種類

```typescript
const PREFIX_PATTERNS = [
  // 巨大化系（値を5倍にする）
  { pattern: /巨大化(?:する)?度(?:に|ごとに)/, multiplier: 5 },
  { pattern: /巨大化毎に/, multiplier: 5 },
  
  // その他の接頭辞（将来の拡張用）
  // { pattern: /.../, effect: '...' },
];
```

### ルール3: 括弧の扱い

括弧内の情報は、前段の説明にかかりますが、そのスコープは文脈によって異なります。

#### 3-1. 括弧の種類

括弧内のテキストから、その種類を判定します。

```typescript
// 効果重複
if (/(効果重複|重複可|重複可能)/.test(bracketText)) {
  type = 'duplicate';
  isDuplicate = true;
}

// 重複無し（効果重複の逆）
if (/(同種効果の重複無し|重複不可)/.test(bracketText)) {
  type = 'non_duplicate';
  isExplicitlyNonDuplicate = true;
}

// 対象の限定
if (/(自身のみ|自分のみ)/.test(bracketText)) {
  type = 'target_restriction';
  targetOverride = 'self';
}

// 条件
if (hasConditionKeyword(bracketText)) {
  type = 'condition';
  conditionTags = extractConditionTags(bracketText);
}
```

**設計決定2: 「同種効果の重複無し」のフラグ表現**

引き継ぎドキュメントで指摘されていた設計決定です。以下の方法を採用します。

**採用する方法**: 新しいフラグ`isExplicitlyNonDuplicate`を追加する

```typescript
interface Buff {
  // ... 既存のフィールド
  isDuplicate?: boolean;               // 効果重複
  isExplicitlyNonDuplicate?: boolean;  // 明示的に重複無し
}
```

理由：
- 「明示的に重複無し」という情報は、将来的に役立つ可能性がある
- UIで「このバフは重複しません」と注意書きを表示できる
- デフォルト（isDuplicate: falseかつisExplicitlyNonDuplicate: undefined）と区別できる

#### 3-2. 括弧のスコープ

括弧は、原則として直前の効果にのみかかります。

```typescript
// 例1: 並列表記の場合
// "防御と移動速度が6%低下(効果重複)、射程が7%低下"
// 
// セグメント1: "防御と移動速度が6%低下(効果重複)"
// → "防御が6%低下(効果重複)" と "移動速度が6%低下(効果重複)"
// → 両方に isDuplicate: true
// 
// セグメント2: "、射程が7%低下"
// → 括弧がない
// → isDuplicate: false（デフォルト）

// 例2: 「対象」キーワードの場合
// "対象の射程が上昇。射程内の城娘の攻撃が上昇(自身のみ)"
// 
// セグメント1: "対象の射程が上昇"
// → "対象" を含む
// → "(自身のみ)" が適用される
// → target: 'self'
// 
// セグメント2: "射程内の城娘の攻撃が上昇"
// → "対象" を含まない
// → "(自身のみ)" は適用されない
// → target: 'range'
```

### ルール4: 並列表記の分割

並列表記を個別のバフに展開します。

#### 4-1. 「と」による並列

```typescript
// パターン: "AとBが○○"
// → "Aが○○" と "Bが○○"

// 検出正規表現
const PARALLEL_PATTERN = /(.+?)と(.+?)が/;

// 例:
"攻撃と防御が30%上昇"
→ match[1] = "攻撃", match[2] = "防御"
→ ["攻撃が30%上昇", "防御が30%上昇"]
```

3つ以上の並列も処理します。

```typescript
// パターン: "AとBとCが○○"
// → "Aが○○" と "Bが○○" と "Cが○○"

// 例:
"攻撃と防御と射程が上昇"
→ ["攻撃が上昇", "防御が上昇", "射程が上昇"]
```

#### 4-2. 「・」（中黒）による並列

敵デバフで使用される、中黒区切りの並列表記です。

```typescript
// パターン: "A・Bが○○"
// → "Aが○○" と "Bが○○"

// 例:
"射程・移動速度が30%低下"
→ ["射程が30%低下", "移動速度が30%低下"]
```

#### 4-3. 展開時の情報の継承

並列表記を展開する際、以下の情報を全てのバフに継承します。

- target（範囲）
- mode（適用方式）
- value（数値）
- conditionTags（条件）
- isDuplicate（効果重複フラグ）
- その他の特殊フラグ

```typescript
// 例: 複雑なケース
// "射程内の敵の防御と移動速度が6%低下(効果重複)"
// 
// 展開前の情報:
// - target: 'range'
// - value: 6
// - mode: 'percent_max'
// - isDuplicate: true
// 
// 展開後:
// [
//   {
//     stat: 'enemy_defense',
//     target: 'range',
//     value: 6,
//     mode: 'percent_max',
//     isDuplicate: true
//   },
//   {
//     stat: 'enemy_movement',
//     target: 'range',
//     value: 6,
//     mode: 'percent_max',
//     isDuplicate: true
//   }
// ]
```

---

### 特殊7: スタック可能バフの処理

「敵撃破毎に」「○回まで」のような、スタック可能なバフの処理です。

#### 検出パターン

```typescript
// 発動トリガー
const TRIGGER_PATTERNS = [
  { pattern: /敵撃破(?:毎|ごと)に/, trigger: 'enemy_defeat' },
  { pattern: /巨大化(?:毎|ごと)に/, trigger: 'giant' },  // 既存
  { pattern: /配置(?:毎|ごと)に/, trigger: 'placement' },
];

// 最大スタック数
const MAX_STACKS_PATTERN = /[（(](\d+)回まで[）)]/;
```

#### 処理ロジック

```typescript
function parseStackableBuff(text: string) {
  // 最大スタック数を検出
  const stacksMatch = text.match(MAX_STACKS_PATTERN);
  const maxStacks = stacksMatch ? parseInt(stacksMatch[1]) : undefined;
  
  // 発動トリガーを検出
  let trigger = undefined;
  for (const pattern of TRIGGER_PATTERNS) {
    if (pattern.pattern.test(text)) {
      trigger = pattern.trigger;
      break;
    }
  }
  
  // バフを生成
  const buff = parseBasicBuff(text);
  
  if (maxStacks) {
    buff.stackable = true;
    buff.maxStacks = maxStacks;
    
    // 編成パズル用: 表示値を最大スタック時の値に調整
    buff.value = buff.value * maxStacks;
    buff.note = `最大${maxStacks}回スタック時の値`;
  }
  
  return buff;
}
```

#### 例

```typescript
// 入力: "敵撃破毎に自身の攻撃5%上昇(効果重複、20回まで)"
{
  stat: 'attack',
  mode: 'percent_max',
  value: 100,  // 5 × 20
  stackable: true,
  maxStacks: 20,
  isDuplicate: true,
  note: '最大20回スタック時の値'
}
```

### 特殊8: 明示されない鼓舞の検出

【鼓舞】マーカーがなくても、鼓舞として処理すべきパターンを検出します。

#### 検出パターン

```typescript
// パターン: "自身の○○の○%の値を...に加算"
const IMPLICIT_INSPIRE_PATTERN = 
  /自身の(攻撃|防御|射程|回復)(?:の|が)?(\d+)%(?:の値)?を(.+?)(?:に|へ)加算/;
```

#### 処理ロジック

```typescript
function detectImplicitInspire(text: string): Buff[] | null {
  const match = text.match(IMPLICIT_INSPIRE_PATTERN);
  if (!match) return null;
  
  const [_, statText, percentText, targetText] = match;
  
  // Statを決定
  const statMap = {
    '攻撃': 'attack',
    '防御': 'defense',
    '射程': 'range',
    '回復': 'recovery'
  };
  const sourceStat = statMap[statText];
  
  // ターゲットを決定
  const target = detectTarget(targetText);
  
  // 除外条件を検出
  const excludeSelf = /自身を除く/.test(targetText);
  const conditionTags = excludeSelf ? ['exclude_self'] : [];
  
  // 鼓舞バフを生成
  return [{
    stat: 'inspire',
    inspireSourceStat: sourceStat,
    mode: 'percent_max',
    value: parseInt(percentText),
    target,
    conditionTags,
    source: 'self_skill',
    isActive: true
  }];
}
```

#### 例

```typescript
// 入力: "自身を除く射程内城娘に自身の攻撃の30%の値を加算"
{
  stat: 'inspire',
  inspireSourceStat: 'attack',
  mode: 'percent_max',
  value: 30,
  target: 'range/ally',
  conditionTags: ['exclude_self']
}
```

### 特殊9: 直撃ボーナスの処理

直撃ボーナスは「○%に上昇」（絶対値）と「○%上昇」（加算）の2パターンがあります。

#### 検出パターン

```typescript
// パターンA: 絶対値設定
const CRITICAL_ABSOLUTE_PATTERN = /直撃ボーナスが(\d+)%に上昇/;

// パターンB: 加算
const CRITICAL_ADDITIVE_PATTERN = /直撃ボーナスが(\d+)%上昇/;
```

#### 処理ロジック

```typescript
function parseCriticalBonus(text: string): Buff | null {
  // 絶対値パターンを先にチェック（より具体的）
  let match = text.match(CRITICAL_ABSOLUTE_PATTERN);
  if (match) {
    return {
      stat: 'critical_bonus',
      mode: 'absolute_set',  // 絶対値設定
      value: parseInt(match[1]),
      target: 'self',
      source: 'strategy',
      isActive: true
    };
  }
  
  // 加算パターン
  match = text.match(CRITICAL_ADDITIVE_PATTERN);
  if (match) {
    return {
      stat: 'critical_bonus',
      mode: 'percent_max',  // 加算
      value: parseInt(match[1]),
      target: 'self',
      source: 'strategy',
      isActive: true
    };
  }
  
  return null;
}
```

### 特殊10: 自己適用倍率の処理

「自身に対しては効果1.5倍」のような、自己適用時の倍率を処理します。

#### 検出パターン

```typescript
const SELF_MULTIPLIER_PATTERN = /自身(?:に対して)?(?:は|には)?効果(\d+(?:\.\d+)?)倍/;
```

#### 処理ロジック

```typescript
function applySelfMultiplier(buffs: Buff[], text: string): Buff[] {
  const match = text.match(SELF_MULTIPLIER_PATTERN);
  if (!match) return buffs;
  
  const multiplier = parseFloat(match[1]);
  const result: Buff[] = [];
  
  for (const buff of buffs) {
    // 元のバフ（自身を除く全員に適用）
    result.push({
      ...buff,
      conditionTags: [...(buff.conditionTags || []), 'exclude_self']
    });
    
    // 自身用のバフ（倍率適用）
    result.push({
      ...buff,
      target: 'self',
      value: buff.value * multiplier,
      conditionTags: [],  // 自身なので除外条件は不要
      id: generateId()  // 新しいIDを生成
    });
  }
  
  return result;
}
```

#### 例

```typescript
// 入力: "全城娘の攻撃が50上昇。自身に対しては効果1.5倍。"
// 
// 生成されるバフ:
[
  // 他の城娘へのバフ
  {
    stat: 'attack',
    target: 'all',
    value: 50,
    conditionTags: ['exclude_self']
  },
  // 自身へのバフ
  {
    stat: 'attack',
    target: 'self',
    value: 75  // 50 × 1.5
  }
]
```

### 特殊11: 「○倍のダメージを与える」パターン

「与えるダメージ」の別表記を検出します。

#### 検出パターン

```typescript
// パターン1: "○倍のダメージを与える"
const DAMAGE_MULTIPLIER_PATTERN = /(\d+(?:\.\d+)?)倍のダメージを与える/;

// パターン2: "攻撃の○倍のダメージ"
const ATTACK_MULTIPLIER_PATTERN = /攻撃の(\d+(?:\.\d+)?)倍のダメージ/;
```

#### 処理ロジック

```typescript
function parseGiveDamagePattern(text: string): Buff | null {
  // パターン1
  let match = text.match(DAMAGE_MULTIPLIER_PATTERN);
  if (match) {
    const multiplier = parseFloat(match[1]);
    const percent = (multiplier - 1) * 100;
    
    return {
      stat: 'give_damage',
      mode: 'percent_max',
      value: percent,
      target: 'self',
      source: detectSource(text),
      isActive: true
    };
  }
  
  // パターン2
  match = text.match(ATTACK_MULTIPLIER_PATTERN);
  if (match) {
    const multiplier = parseFloat(match[1]);
    const percent = (multiplier - 1) * 100;
    
    return {
      stat: 'give_damage',
      mode: 'percent_max',
      value: percent,
      target: 'self',
      source: detectSource(text),
      isActive: true,
      note: '攻撃力依存のダメージ'
    };
  }
  
  return null;
}
```

### 特殊12: 効果重複の検出（表記揺れ対応）

「効果重複」には複数の表記のバリエーションがあります。これらは全て同じ意味であり、`isDuplicate: true`として扱います。

#### 表記のバリエーション

城プロREでは、効果重複を示す表記に以下のようなバリエーションがあります。これらは全て同じ概念を指しており、実装上は同一のフラグとして扱う必要があります。

- 「効果重複」（最も一般的）
- 「重複可」
- 「重複可能」
- 「同種効果と重複」（大坂城の例で見られる）

#### 検出パターン

```typescript
const DUPLICATE_PATTERNS = [
  /効果重複/,
  /重複可能?/,
  /同種効果(?:と|の)重複/
];

function checkDuplicate(text: string): boolean {
  return DUPLICATE_PATTERNS.some(pattern => pattern.test(text));
}
```

#### 処理ロジック

全てのバリエーションを統一的に処理します。検出された場合は`isDuplicate: true`を設定します。

```typescript
// 例1: "攻撃が30%上昇(効果重複)"
{
  stat: 'attack',
  mode: 'percent_max',
  value: 30,
  isDuplicate: true
}

// 例2: "攻撃と防御1.2倍(同種効果と重複)"
// → 並列展開後、両方に isDuplicate: true
[
  {
    stat: 'attack',
    mode: 'percent_max',
    value: 20,
    isDuplicate: true
  },
  {
    stat: 'defense',
    mode: 'percent_max',
    value: 20,
    isDuplicate: true
  }
]
```

#### 重要な理解

「同種効果と重複」という表記を見ると、「同種のバフと重複する」という特別な意味があるように思えますが、実際にはこれは単なる表記のバリエーションです。城プロの公式テキストは表記が統一されていないため、同じ概念を異なる言葉で表現していることがよくあります。

この理解は重要です。なぜなら、もし「同種効果と重複」を別の概念として扱ってしまうと、不必要に型定義が複雑になり、実装も煩雑になってしまうからです。実際のゲームの動作を理解している人からの情報によって、これらは同じものだと確認できました。

---

## 🔧 特殊処理

通常のパターンマッチでは扱えない、特殊なケースの処理方法を説明します。

### 特殊1: 鼓舞の処理

【鼓舞】というマーカーがある場合、通常のバフとは異なる処理フローに入ります。

#### 鼓舞の検出

```typescript
// 検出パターン
const INSPIRE_PATTERN = /【鼓舞】/;

if (INSPIRE_PATTERN.test(text)) {
  // 鼓舞処理フローへ
  return parseInspire(text);
}
```

#### 鼓舞のパースロジック

鼓舞は、「自身のどのステータスを」「何%」「誰に加算するか」を抽出します。

```typescript
// パターン1: 単一ステータス
// "【鼓舞】自身の攻撃の30%を射程内に加算"
// 
// 抽出:
// - inspireSourceStat: 'attack'
// - value: 30
// - target: 'range'

// パターン2: 複数ステータス
// "【鼓舞】自身の攻撃と防御の30%を射程内の城娘に加算"
// 
// 抽出:
// - inspireSourceStats: ['attack', 'defense']
// - value: 30
// - target: 'range/ally'
```

複数ステータスの場合、**別々のBuffとして生成**します。

```typescript
// "自身の攻撃と防御の30%を射程内に加算"
// 
// 生成されるバフ:
[
  {
    id: generateId(),
    stat: 'inspire',
    inspireSourceStat: 'attack',
    mode: 'percent_max',
    value: 30,
    target: 'range/ally',
    source: 'self_skill',
    isActive: true
  },
  {
    id: generateId(),
    stat: 'inspire',
    inspireSourceStat: 'defense',
    mode: 'percent_max',
    value: 30,
    target: 'range/ally',
    source: 'self_skill',
    isActive: true
  }
]
```

#### 鼓舞のStat検出パターン

```typescript
const INSPIRE_STAT_PATTERNS = [
  { pattern: /攻撃/, stat: 'attack' },
  { pattern: /防御/, stat: 'defense' },
  { pattern: /射程/, stat: 'range' },
  // 他のStatも同様
];
```

### 特殊2: 巨大化倍率の適用

「巨大化する度に」という接頭辞がある場合、値を5倍にします。

#### 適用対象の判定

全てのStatに巨大化倍率が適用されるわけではありません。一部のStatは適用対象外です。

```typescript
// 巨大化倍率の適用対象外（skipGiantMultiplier）
const SKIP_GIANT_MULTIPLIER_STATS = [
  'strategy_cooldown',  // 計略再使用時間（既にパーセント減少）
  'inspire',            // 鼓舞（パーセント指定）
  // その他、パーセント指定のStatは対象外
];
```

#### 適用ロジック

```typescript
function applyGiantMultiplier(value: number, stat: Stat, hasGiantPrefix: boolean): number {
  if (!hasGiantPrefix) {
    return value;
  }
  
  if (SKIP_GIANT_MULTIPLIER_STATS.includes(stat)) {
    return value;
  }
  
  return value * 5;
}

// 例:
// "巨大化する度に攻撃が6%上昇"
// → value: 6 * 5 = 30

// "巨大化する度に計略の再使用時間が5%短縮"
// → value: 5（倍率適用なし）
```

### 特殊3: 倍率の変換

「1.5倍」のような倍率表記を、パーセントに変換します。

```typescript
// 検出パターン
const MULTIPLIER_PATTERN = /(\d+(?:\.\d+)?)倍/;

// 変換関数
function convertMultiplierToPercent(multiplier: number): number {
  return (multiplier - 1) * 100;
}

// 例:
// "攻撃が1.5倍"
// → multiplier = 1.5
// → percent = (1.5 - 1) * 100 = 50
// → stat: 'attack', mode: 'percent_max', value: 50

// "攻撃が2倍(効果重複)"
// → multiplier = 2
// → percent = (2 - 1) * 100 = 100
// → stat: 'attack', mode: 'percent_max', value: 100, isDuplicate: true
```

### 特殊4: 条件付きバフの倍率

**設計決定3: 条件付きバフの表現方法**

引き継ぎドキュメントで指摘されていた設計決定です。以下の方法を採用します。

```typescript
// 問題のテキスト:
// "射程内の城娘の攻撃が400上昇、巨大化段階が5以上の城娘は効果1.5倍"
```

**採用する方法**: 別々のバフとして生成（方法A）

理由：
- 型定義がシンプルに保てる
- バフの適用判定ロジックが明確
- 将来的にON/OFF制御が容易

```typescript
// 生成されるバフ:
[
  // 基本バフ（条件なし）
  {
    id: 'buff-001',
    stat: 'attack',
    mode: 'flat_sum',
    value: 400,
    target: 'range/ally',
    conditionTags: [],
    source: 'strategy',
    isActive: true
  },
  
  // 条件付きバフ（巨大化5段階以上）
  {
    id: 'buff-002',
    stat: 'attack',
    mode: 'flat_sum',
    value: 600,  // 400 * 1.5
    target: 'range/ally',
    conditionTags: ['giant_5'],
    source: 'strategy',
    isActive: true
  }
]
```

実際の適用時は、キャラクターの巨大化段階に応じて、どちらか一方のバフが適用されます。

```typescript
// 巨大化4段階のキャラ → 基本バフ（400）が適用
// 巨大化5段階のキャラ → 条件付きバフ（600）が適用
```

### 特殊5: 継続回復・継続ダメージの扱い

**設計決定4: 継続回復や継続ダメージの扱い**

引き継ぎドキュメントで指摘されていた設計決定です。以下の方法を採用します。

```typescript
// 問題のテキスト:
// "射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える"
```

**採用する方法**: 備考フィールドに記録し、パースはスキップ

理由：
- 編成パズルやダメージ計算では扱えない時間経過効果
- 無視すると情報が失われる
- 将来的に拡張する可能性を残す

```typescript
interface Buff {
  // ... 既存のフィールド
  note?: string;  // 備考フィールド（継続効果などを記録）
}

// パース時の処理
if (/継続(?:回復|ダメージ)/.test(text)) {
  // Buffオブジェクトは生成せず、noteとして記録
  return {
    type: 'note',
    text: text,
    note: '継続効果（編成パズルでは扱いません）'
  };
}
```

### 特殊6: 特技効果の倍率

**設計決定5: 特技効果の倍率の扱い**

引き継ぎドキュメントで指摘されていた設計決定です。以下の方法を採用します。

```typescript
// 問題のテキスト:
// "特技効果が1.25倍"
```

**採用する方法**: 計略の特殊効果として別途管理

理由：
- これはバフではなく、既存のバフへの倍率効果
- Buff型では表現できない
- 計略専用の拡張が必要

```typescript
// 新しい型定義（将来の拡張用）
interface Strategy {
  id: string;
  name: string;
  buffs: Buff[];
  specialEffects?: SpecialEffect[];
}

interface SpecialEffect {
  type: 'skill_multiplier' | 'continuous_heal' | 'continuous_damage';
  value?: number;
  description: string;
}

// 例:
{
  id: 'strategy-001',
  name: '室町第の計略',
  buffs: [ /* 通常のバフ */ ],
  specialEffects: [
    {
      type: 'skill_multiplier',
      value: 1.25,
      description: '特技効果が1.25倍'
    },
    {
      type: 'continuous_heal',
      description: '射程内の殿と城娘を継続回復'
    }
  ]
}
```

ただし、この拡張は現時点では実装しません。PARSING_RULES.mdでは、このようなケースの存在を記録し、将来の拡張時の指針とします。

---

## 📝 表記揺れの正規化

城プロ公式は表記が統一されておらず、同じ意味でも異なる表記がされています。これらを正規化するルールを定義します。

### 正規化1: 上昇・低下系

```typescript
// 上昇系の統一
const INCREASE_SYNONYMS = ['アップ', 'UP', '増加'];
const INCREASE_NORMALIZED = '上昇';

// 低下系の統一
const DECREASE_SYNONYMS = ['ダウン', 'DOWN', '減少'];
const DECREASE_NORMALIZED = '低下';

// 正規化関数
function normalizeText(text: string): string {
  let normalized = text;
  
  for (const synonym of INCREASE_SYNONYMS) {
    normalized = normalized.replace(new RegExp(synonym, 'g'), INCREASE_NORMALIZED);
  }
  
  for (const synonym of DECREASE_SYNONYMS) {
    normalized = normalized.replace(new RegExp(synonym, 'g'), DECREASE_NORMALIZED);
  }
  
  return normalized;
}
```

**重要な例外**: 文脈によって意味が異なる場合は、単純な置換をしない

```typescript
// ✗ 置換してはいけない例
"被ダメージ増加" → "被ダメージ上昇" （意味は同じだが、慣例として「増加」を使う）
"消費気減少" → "消費気低下" （意味が変わる可能性がある）

// ○ 置換して良い例
"攻撃アップ" → "攻撃上昇"
"防御ダウン" → "防御低下"
```

### 正規化2: パーセント・記号

```typescript
// 全角 → 半角
"％" → "%"
"＋" → "+"
"－" → "-"
"×" → "×"  // ※これは全角のまま（倍率記号）

// 数字の全角 → 半角
"１２３" → "123"
"３０％" → "30%"
```

### 正規化3: 範囲指定

```typescript
// 射程内の表記揺れ
const RANGE_SYNONYMS = ['射程内', '射程範囲', '範囲内'];
const RANGE_NORMALIZED = '射程内';

// ただし、「範囲内」は文脈依存なので注意
// "攻撃範囲内の敵" → "射程内の敵" （置換OK）
// "一定範囲内で効果発動" → そのまま （置換NG）
```

### 正規化4: 味方・敵

```typescript
// 味方の表記揺れ
const ALLY_SYNONYMS = ['味方', '城娘', '殿'];

// ただし、「城娘」と「殿」は対象が異なるので、単純に統一しない
// 文脈を考慮して、conditionTagsで区別する
```

---

### 例3: ゴールデン・ハインド（新パターンの宝庫）

この例は、v1.0では未カバーだった多数の新しいパターンを含んでいます。

#### 特技のテキスト

```
【配置】敵撃破毎に自身の攻撃5%と70(効果重複)、射程7上昇(20回まで)。最大化時、自身を除く射程内城娘に自身の攻撃の30%の値を加算。【水上】自身の巨大化気を半減
```

#### 段階的なパース処理

**ステップ1: 特殊マーカーの検出**

【配置】と【水上】という2つのマーカーがあります。これらは異なる意味を持ちます。

```typescript
// 【配置】の検出
if (/【配置】/.test(text)) {
  // これはデフォルトで適用される特技
  // 特別な条件タグは不要
}

// 【水上】の検出
if (/【水上】/.test(text)) {
  // これは水上配置時のみ適用される条件付き特技
  conditionTag = 'on_water';
}
```

**ステップ2: セグメント分割**

句点（。）と特殊マーカーで分割します。

```typescript
[
  "【配置】敵撃破毎に自身の攻撃5%と70(効果重複)、射程7上昇(20回まで)",
  "最大化時、自身を除く射程内城娘に自身の攻撃の30%の値を加算",
  "【水上】自身の巨大化気を半減"
]
```

**ステップ3: セグメント1の処理**

「【配置】敵撃破毎に自身の攻撃5%と70(効果重複)、射程7上昇(20回まで)」

発動トリガーの検出:
```typescript
trigger = 'enemy_defeat';  // 敵撃破毎に
```

最大スタック数の検出:
```typescript
maxStacks = 20;  // (20回まで)
```

編成パズルでは、最大スタック時の値を表示します。

攻撃バフの処理:
```typescript
// "自身の攻撃5%と70(効果重複)"
// → "攻撃が5%上昇" と "攻撃が70上昇" の2つのバフ

// バフ1: 攻撃パーセント
{
  stat: 'attack',
  target: 'self',
  mode: 'percent_max',
  value: 5,
  isDuplicate: true,
  stackable: true,
  maxStacks: 20,
  // 編成パズルでの表示値: 5 × 20 = 100%
  source: 'self_skill'
}

// バフ2: 攻撃固定値
{
  stat: 'attack',
  target: 'self',
  mode: 'flat_sum',
  value: 70,
  isDuplicate: true,
  stackable: true,
  maxStacks: 20,
  // 編成パズルでの表示値: 70 × 20 = 1400
  source: 'self_skill'
}
```

射程バフの処理:
```typescript
// "射程7上昇(20回まで)"
{
  stat: 'range',
  target: 'self',
  mode: 'flat_sum',
  value: 7,
  isDuplicate: false,  // 効果重複の括弧は前のバフにのみ
  stackable: true,
  maxStacks: 20,
  // 編成パズルでの表示値: 7 × 20 = 140
  source: 'self_skill'
}
```

**重要な発見**: 「(効果重複)」は直前のバフにのみかかり、「(20回まで)」は全てのバフにかかります。これは括弧のスコープが異なることを示しています。

**ステップ4: セグメント2の処理**

「最大化時、自身を除く射程内城娘に自身の攻撃の30%の値を加算」

これは【鼓舞】マーカーがない鼓舞バフです。

検出パターン:
```typescript
// "自身の○○の○%の値を...に加算"
// または
// "自身の○○の○%を...に加算"
```

除外条件の検出:
```typescript
excludeSelf = true;  // "自身を除く" から
```

条件の検出:
```typescript
condition = 'giant_5';  // "最大化時" から
```

生成されるバフ:
```typescript
{
  stat: 'inspire',
  inspireSourceStat: 'attack',
  mode: 'percent_max',
  value: 30,
  target: 'range/ally',
  conditionTags: ['giant_5', 'exclude_self'],
  source: 'self_skill'
}
```

**ステップ5: セグメント3の処理**

「【水上】自身の巨大化気を半減」

これは水上配置時のみ適用される条件付きバフです。気はフィールド全体で共有されるリソースなので、`target: 'field'`として表現します。

```typescript
{
  stat: 'cost',
  costType: 'giant_cost',
  target: 'field',  // ★フィールド全体への効果
  mode: 'percent_reduction',
  value: 50,  // 半減 = 50%減少
  conditionTags: ['on_water'],
  note: '水上配置時、巨大化の消費気が軽減される（フィールド全体の効果）',
  source: 'self_skill'
}
```

#### 計略のテキスト

```
30秒間対象の水上特技が発動し、射程1.2倍直撃ボーナスが300%に上昇、爆風範囲と爆風ダメージ2倍(自分のみ)
```

#### 段階的なパース処理

**ステップ1: 前処理**

効果時間を除去します。

```typescript
// 前処理後
"対象の水上特技が発動し、射程1.2倍直撃ボーナスが300%に上昇、爆風範囲と爆風ダメージ2倍(自分のみ)"
```

**ステップ2: 特殊効果の検出**

「水上特技が発動」は特殊効果として扱います。

```typescript
specialEffect = {
  type: 'activate_conditional_skill',
  condition: 'on_water',
  description: '水上特技が発動'
};
```

**ステップ3: 通常バフのパース**

セグメントに分割:
```typescript
[
  "対象の射程1.2倍",
  "直撃ボーナスが300%に上昇",
  "爆風範囲と爆風ダメージ2倍(自分のみ)"
]
```

セグメント1: 「対象の射程1.2倍」

```typescript
{
  stat: 'range',
  target: 'self',  // "対象" かつ "(自分のみ)" から
  mode: 'percent_max',
  value: 20,  // 1.2倍 → 20%
  source: 'strategy'
}
```

セグメント2: 「直撃ボーナスが300%に上昇」

**重要**: 「○%に上昇」という表記は、絶対値設定を意味します。

```typescript
{
  stat: 'critical_bonus',
  target: 'self',
  mode: 'absolute_set',  // ★新しいモード
  value: 300,
  source: 'strategy'
}
```

セグメント3: 「爆風範囲と爆風ダメージ2倍」

これらはダメージ計算では無視してよい情報です。

```typescript
{
  type: 'note',
  note: '爆風範囲と爆風ダメージ2倍（ダメージ計算では無視）'
}
```

### 例4: 大坂城（自己適用倍率の例）

この例は、「自身に対しては効果1.5倍」という新しいパターンを含んでいます。

#### 特技のテキスト

```
巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇、被ダメージ9%軽減。全城娘の射程が10、攻撃が50上昇。自身に対しては効果1.5倍。
```

#### 段階的なパース処理

**ステップ1: セグメント分割**

```typescript
[
  "巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇、被ダメージ9%軽減",
  "全城娘の射程が10、攻撃が50上昇",
  "自身に対しては効果1.5倍"
]
```

**ステップ2: セグメント1の処理**

「巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇、被ダメージ9%軽減」

```typescript
// 接頭辞
hasGiantPrefix = true;
giantMultiplier = 5;

// 並列展開: "攻撃と攻撃速度10%上昇"
// サブセグメント1: "攻撃10%上昇"
{
  stat: 'attack',
  target: 'range/ally',
  mode: 'percent_max',
  value: 10 * 5 = 50,
  source: 'self_skill'
}

// サブセグメント2: "攻撃速度10%上昇"
{
  stat: 'attack_speed',
  target: 'range/ally',
  mode: 'percent_max',
  value: 10 * 5 = 50,
  source: 'self_skill'
}

// サブセグメント3: "被ダメージ9%軽減"
{
  stat: 'damage_taken',
  target: 'range/ally',
  mode: 'percent_max',
  value: -9 * 5 = -45,  // 軽減なので負の値
  source: 'self_skill'
}
```

**ステップ3: セグメント2と3の処理**

「全城娘の射程が10、攻撃が50上昇。自身に対しては効果1.5倍。」

これは非常に重要なパターンです。「全城娘」へのバフですが、「自身に対しては1.5倍」という追加条件があります。

**処理方法**: 2セットのバフを生成します。

セットA: 自身を除く全城娘へのバフ
```typescript
// 射程バフ（自身を除く）
{
  stat: 'range',
  target: 'all',
  mode: 'flat_sum',
  value: 10 * 5 = 50,  // 巨大化倍率適用
  conditionTags: ['exclude_self'],
  source: 'self_skill'
}

// 攻撃バフ（自身を除く）
{
  stat: 'attack',
  target: 'all',
  mode: 'flat_sum',
  value: 50 * 5 = 250,  // 巨大化倍率適用
  conditionTags: ['exclude_self'],
  source: 'self_skill'
}
```

セットB: 自身へのバフ（1.5倍）
```typescript
// 射程バフ（自身）
{
  stat: 'range',
  target: 'self',
  mode: 'flat_sum',
  value: (10 * 5) * 1.5 = 75,  // 巨大化倍率 + 自己倍率
  source: 'self_skill'
}

// 攻撃バフ（自身）
{
  stat: 'attack',
  target: 'self',
  mode: 'flat_sum',
  value: (50 * 5) * 1.5 = 375,  // 巨大化倍率 + 自己倍率
  source: 'self_skill'
}
```

**編成パズルでの表示**:
- 射程内の城娘: 攻撃+50%、速度+50%、被ダメ-45%
- 全ての城娘: 射程+50、攻撃+250（自身を除く）
- 自身: 射程+75、攻撃+375

これにより、バフパズルで「大坂城は自分にも全体バフがかかるが、1.5倍になる」という重要な情報が可視化されます。

#### 計略のテキスト（抜粋）

```
30秒間自身の射程1.2倍、特殊攻撃ゲージが時間経過でも蓄積武器攻撃が標的とその周囲に1.5倍のダメージを与える自身の敵撃破時の獲得気が2増加。全マス移動可能
```

**重要なパターン**: 「武器攻撃が標的とその周囲に1.5倍のダメージを与える」

これは「与えるダメージ」と同じ計算式です。

```typescript
// 検出パターン
/(\d+(?:\.\d+)?)倍のダメージを与える/

// 生成されるバフ
{
  stat: 'give_damage',
  target: 'self',
  mode: 'percent_max',
  value: 50,  // 1.5倍 → 50%
  source: 'strategy'
}
```

#### 特殊能力のテキスト（抜粋）

```
ストックを1消費し、指定方向の敵に攻撃の7倍のダメージを与え射程内味方の攻撃が30秒間150上昇。
```

**重要なパターン**: 「攻撃の7倍のダメージを与え」

これも「与えるダメージ」です。

```typescript
// 検出パターン
/攻撃の(\d+(?:\.\d+)?)倍のダメージ/

// 生成されるバフ
{
  stat: 'give_damage',
  target: 'self',
  mode: 'percent_max',
  value: 600,  // 7倍 → 600%
  source: 'strategy',
  note: '特殊能力発動時のみ'
}
```

**通常バフ**: 「射程内味方の攻撃が30秒間150上昇」

```typescript
{
  stat: 'attack',
  target: 'range/ally',
  mode: 'flat_sum',
  value: 150,
  source: 'strategy'
}
```

#### 計略のテキスト（抜粋2）

```
40秒対象の耐久が高い程与えるダメージ上昇(最大2倍)対象の射程内城娘の攻撃と防御1.2倍(同種効果と重複)対象の射程内敵の被ダメージ1.5倍(自分のみ)
```

**パターン1**: 「耐久が高い程与えるダメージ上昇(最大2倍)」

これは耐久依存条件です。

```typescript
{
  stat: 'give_damage',
  target: 'self',
  mode: 'percent_max',
  value: 100,  // 最大2倍 → 100%
  conditionTags: ['durability_dependent'],
  note: '耐久が高いほど効果大（最大2倍）',
  source: 'strategy'
}
```

**パターン2**: 「攻撃と防御1.2倍(同種効果と重複)」

これは「効果重複」の別表記です。並列展開した両方のバフに`isDuplicate: true`を設定します。

```typescript
// 攻撃バフ
{
  stat: 'attack',
  target: 'range/ally',
  mode: 'percent_max',
  value: 20,  // 1.2倍 → 20%
  isDuplicate: true,  // 「同種効果と重複」= 効果重複
  source: 'strategy'
}

// 防御バフ
{
  stat: 'defense',
  target: 'range/ally',
  mode: 'percent_max',
  value: 20,
  isDuplicate: true,  // 同じく効果重複
  source: 'strategy'
}
```

**パターン3**: 「対象の射程内敵の被ダメージ1.5倍(自分のみ)」

```typescript
{
  stat: 'damage_taken',
  target: 'range',  // 射程内の敵
  mode: 'percent_max',
  value: 50,  // 1.5倍 → 50%
  source: 'strategy',
  note: '(自分のみ)は対象キャラの射程内という意味'
}
```

---

## 🎓 具体例の完全分析

引き継ぎドキュメントで提供された具体例を、完全に分析します。

### 例1: 天童城（絢爛）

#### 特技のテキスト（再掲）

```
巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇全ての敵の防御と移動速度が8%低下
```

#### 段階的なパース処理

**ステップ1: 前処理**

全角・半角の統一、表記揺れの正規化を行います。

```typescript
// 元のテキスト
"巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇全ての敵の防御と移動速度が8%低下"

// 前処理後（特に変化なし、既に半角）
"巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇全ての敵の防御と移動速度が8%低下"
```

**ステップ2: 文の分割**

接頭辞、範囲指定の変化、句読点を基準に分割します。

```typescript
// 分割結果
[
  "巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇",
  "全ての敵の防御と移動速度が8%低下"
]
```

分割の根拠：「全ての敵」という新しい範囲指定が出現したため。

**ステップ3: 各セグメントの処理**

**セグメント1の処理**: "巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇"

接頭辞の検出:
```typescript
hasGiantPrefix = true;  // "巨大化する度に" を検出
giantMultiplier = 5;
```

さらに細分化:
```typescript
[
  "射程内の敵の防御と移動速度6%低下(効果重複)",
  "、射程7%低下",
  "、被ダメージ10%上昇"
]
```

サブセグメント1-1: "射程内の敵の防御と移動速度6%低下(効果重複)"

```typescript
// 範囲検出
target = 'range';  // "射程内" から

// 並列展開
stats = ['enemy_defense', 'enemy_movement'];  // "防御と移動速度" から

// 数値・モード
value = 6;
mode = 'percent_max';

// 括弧内の処理
isDuplicate = true;  // "(効果重複)" から

// 巨大化倍率の適用
finalValue = 6 * 5 = 30;

// 生成されるバフ
[
  {
    stat: 'enemy_defense',
    target: 'range',
    mode: 'percent_max',
    value: 30,
    isDuplicate: true,
    source: 'self_skill'
  },
  {
    stat: 'enemy_movement',
    target: 'range',
    mode: 'percent_max',
    value: 30,
    isDuplicate: true,
    source: 'self_skill'
  }
]
```

サブセグメント1-2: "、射程7%低下"

```typescript
// 範囲検出（継承）
target = 'range';  // 前のセグメントから継承

// Stat検出
// ※ここで「射程」は「敵の射程」と解釈
// これは新しいStatが必要: 'enemy_range'
stat = 'enemy_range';  

// 数値・モード
value = 7;
mode = 'percent_max';

// 巨大化倍率の適用
finalValue = 7 * 5 = 35;

// 生成されるバフ
{
  stat: 'enemy_range',
  target: 'range',
  mode: 'percent_max',
  value: 35,
  isDuplicate: false,
  source: 'self_skill'
}
```

**重要な発見**: 「敵の射程」というStatが必要です。これはTYPE_CONVERSION_MAPPING.mdには定義されていないので、追加が必要です。

サブセグメント1-3: "、被ダメージ10%上昇"

```typescript
// 範囲検出（継承）
target = 'range';  // 前のセグメントから継承

// Stat検出
stat = 'damage_taken';  // "被ダメージ" から

// 数値・モード
value = 10;
mode = 'percent_max';

// 巨大化倍率の適用
finalValue = 10 * 5 = 50;

// 生成されるバフ
{
  stat: 'damage_taken',
  target: 'range',
  mode: 'percent_max',
  value: 50,
  isDuplicate: false,
  source: 'self_skill'
}
```

**セグメント2の処理**: "全ての敵の防御と移動速度が8%低下"

```typescript
// 範囲検出
target = 'all';  // "全ての敵" から

// 接頭辞の継続判定
// 設計決定1に基づき、「全ての敵」でも接頭辞は継続
hasGiantPrefix = true;
giantMultiplier = 5;

// 並列展開
stats = ['enemy_defense', 'enemy_movement'];

// 数値・モード
value = 8;
mode = 'percent_max';

// 巨大化倍率の適用
finalValue = 8 * 5 = 40;

// 生成されるバフ
[
  {
    stat: 'enemy_defense',
    target: 'all',
    mode: 'percent_max',
    value: 40,
    isDuplicate: false,
    source: 'self_skill'
  },
  {
    stat: 'enemy_movement',
    target: 'all',
    mode: 'percent_max',
    value: 40,
    isDuplicate: false,
    source: 'self_skill'
  }
]
```

#### 最終的な生成バフ（特技）

```typescript
[
  // グループ1: 射程内の敵（効果重複）
  {
    id: 'tendo-skill-001',
    stat: 'enemy_defense',
    target: 'range',
    mode: 'percent_max',
    value: 30,
    isDuplicate: true,
    source: 'self_skill',
    isActive: true
  },
  {
    id: 'tendo-skill-002',
    stat: 'enemy_movement',
    target: 'range',
    mode: 'percent_max',
    value: 30,
    isDuplicate: true,
    source: 'self_skill',
    isActive: true
  },
  
  // グループ2: 射程内の敵（通常）
  {
    id: 'tendo-skill-003',
    stat: 'enemy_range',  // ※新規Stat
    target: 'range',
    mode: 'percent_max',
    value: 35,
    isDuplicate: false,
    source: 'self_skill',
    isActive: true
  },
  {
    id: 'tendo-skill-004',
    stat: 'damage_taken',
    target: 'range',
    mode: 'percent_max',
    value: 50,
    isDuplicate: false,
    source: 'self_skill',
    isActive: true
  },
  
  // グループ3: 全ての敵
  {
    id: 'tendo-skill-005',
    stat: 'enemy_defense',
    target: 'all',
    mode: 'percent_max',
    value: 40,
    isDuplicate: false,
    source: 'self_skill',
    isActive: true
  },
  {
    id: 'tendo-skill-006',
    stat: 'enemy_movement',
    target: 'all',
    mode: 'percent_max',
    value: 40,
    isDuplicate: false,
    source: 'self_skill',
    isActive: true
  }
]
```

#### 計略のテキスト（再掲）

```
40秒間対象の射程が100上昇。射程内の城娘の攻撃と防御が400上昇、巨大化段階が5以上の城娘は効果1.5倍。射程内敵の撃破気2増加(自分のみ)
```

#### 段階的なパース処理

**ステップ1: 前処理**

効果時間を除去します。

```typescript
// 元のテキスト
"40秒間対象の射程が100上昇。射程内の城娘の攻撃と防御が400上昇、巨大化段階が5以上の城娘は効果1.5倍。射程内敵の撃破気2増加(自分のみ)"

// 前処理後
"対象の射程が100上昇。射程内の城娘の攻撃と防御が400上昇、巨大化段階が5以上の城娘は効果1.5倍。射程内敵の撃破気2増加(自分のみ)"
```

**ステップ2: 文の分割**

句点（。）で分割します。

```typescript
[
  "対象の射程が100上昇",
  "射程内の城娘の攻撃と防御が400上昇、巨大化段階が5以上の城娘は効果1.5倍",
  "射程内敵の撃破気2増加(自分のみ)"
]
```

**ステップ3: 各セグメントの処理**

セグメント1: "対象の射程が100上昇"

```typescript
// 「対象」の処理
// 文末に "(自分のみ)" があるかチェック
// → 最後のセグメント（セグメント3）に "(自分のみ)" がある
// → しかし、セグメント3は「対象」を含まないので、セグメント1には適用されない
// → 「対象」はデフォルトで 'self' として扱う

target = 'self';
stat = 'range';
mode = 'flat_sum';
value = 100;

// 生成されるバフ
{
  stat: 'range',
  target: 'self',
  mode: 'flat_sum',
  value: 100,
  source: 'strategy'
}
```

セグメント2: "射程内の城娘の攻撃と防御が400上昇、巨大化段階が5以上の城娘は効果1.5倍"

これは条件付きバフの例です。設計決定3に基づき、別々のバフとして生成します。

```typescript
// まず基本部分をパース
target = 'range/ally';
stats = ['attack', 'defense'];
mode = 'flat_sum';
value = 400;

// 条件部分の検出
condition = 'giant_5';
multiplier = 1.5;

// 生成されるバフ（並列展開 × 条件の2パターン）
[
  // 攻撃上昇（基本）
  {
    stat: 'attack',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 400,
    conditionTags: [],
    source: 'strategy'
  },
  // 攻撃上昇（巨大化5段階以上）
  {
    stat: 'attack',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 600,  // 400 * 1.5
    conditionTags: ['giant_5'],
    source: 'strategy'
  },
  
  // 防御上昇（基本）
  {
    stat: 'defense',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 400,
    conditionTags: [],
    source: 'strategy'
  },
  // 防御上昇（巨大化5段階以上）
  {
    stat: 'defense',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 600,  // 400 * 1.5
    conditionTags: ['giant_5'],
    source: 'strategy'
  }
]
```

セグメント3: "射程内敵の撃破気2増加(自分のみ)"

```typescript
// "(自分のみ)" の処理
// これはこのセグメント全体にかかる
target = 'self';

// "射程内敵の撃破" から costType を判定
stat = 'cost';
costType = 'enemy_defeat';
mode = 'flat_sum';
value = 2;

// 生成されるバフ
{
  stat: 'cost',
  costType: 'enemy_defeat',
  target: 'self',
  mode: 'flat_sum',
  value: 2,
  source: 'strategy'
}
```

#### 最終的な生成バフ（計略）

```typescript
[
  // 自身の射程上昇
  {
    id: 'tendo-strategy-001',
    stat: 'range',
    target: 'self',
    mode: 'flat_sum',
    value: 100,
    source: 'strategy',
    isActive: true
  },
  
  // 射程内の城娘の攻撃上昇（基本）
  {
    id: 'tendo-strategy-002',
    stat: 'attack',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 400,
    conditionTags: [],
    source: 'strategy',
    isActive: true
  },
  
  // 射程内の城娘の攻撃上昇（巨大化5以上）
  {
    id: 'tendo-strategy-003',
    stat: 'attack',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 600,
    conditionTags: ['giant_5'],
    source: 'strategy',
    isActive: true
  },
  
  // 射程内の城娘の防御上昇（基本）
  {
    id: 'tendo-strategy-004',
    stat: 'defense',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 400,
    conditionTags: [],
    source: 'strategy',
    isActive: true
  },
  
  // 射程内の城娘の防御上昇（巨大化5以上）
  {
    id: 'tendo-strategy-005',
    stat: 'defense',
    target: 'range/ally',
    mode: 'flat_sum',
    value: 600,
    conditionTags: ['giant_5'],
    source: 'strategy',
    isActive: true
  },
  
  // 自身の撃破気増加
  {
    id: 'tendo-strategy-006',
    stat: 'cost',
    costType: 'enemy_defeat',
    target: 'self',
    mode: 'flat_sum',
    value: 2,
    source: 'strategy',
    isActive: true
  }
]
```

### 例2: 室町第（響乱）

#### 特技のテキスト（再掲）

```
【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算巨大化毎に射程内の城娘の射程が10、攻撃が50上昇射程内の敵の攻撃と移動速度が8%低下
```

#### 段階的なパース処理

**ステップ1: 鼓舞の検出**

【鼓舞】マーカーを検出します。

```typescript
hasInspire = true;
```

**ステップ2: 文の分割**

鼓舞部分、巨大化部分、敵デバフ部分に分割します。

```typescript
[
  "【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算",
  "巨大化毎に射程内の城娘の射程が10、攻撃が50上昇",
  "射程内の敵の攻撃と移動速度が8%低下"
]
```

分割の根拠：
- 【鼓舞】は特殊処理
- 「巨大化毎に」という新しい接頭辞
- 「射程内の敵」という新しい範囲指定

**ステップ3: 各セグメントの処理**

セグメント1: "【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算"

```typescript
// 鼓舞の処理
inspireSourceStats = ['attack', 'defense'];
value = 30;
target = 'range/ally';

// 生成されるバフ（複数ステータス → 別々のBuff）
[
  {
    stat: 'inspire',
    inspireSourceStat: 'attack',
    mode: 'percent_max',
    value: 30,
    target: 'range/ally',
    source: 'self_skill'
  },
  {
    stat: 'inspire',
    inspireSourceStat: 'defense',
    mode: 'percent_max',
    value: 30,
    target: 'range/ally',
    source: 'self_skill'
  }
]
```

セグメント2: "巨大化毎に射程内の城娘の射程が10、攻撃が50上昇"

```typescript
// 接頭辞の検出
hasGiantPrefix = true;
giantMultiplier = 5;

// 範囲検出
target = 'range/ally';

// 並列展開（「、」区切り）
// "射程が10" と "攻撃が50上昇"

// サブセグメント1: "射程が10"
{
  stat: 'range',
  target: 'range/ally',
  mode: 'flat_sum',
  value: 10 * 5 = 50,
  source: 'self_skill'
}

// サブセグメント2: "攻撃が50上昇"
{
  stat: 'attack',
  target: 'range/ally',
  mode: 'flat_sum',
  value: 50 * 5 = 250,
  source: 'self_skill'
}
```

セグメント3: "射程内の敵の攻撃と移動速度が8%低下"

```typescript
// 範囲検出
target = 'range';

// 接頭辞の継続判定
// 新しい範囲指定が出現したが、設計決定1に基づき継続
// ※ただし、これは「敵」へのデバフなので、文脈的に巨大化倍率は適用されないと判断
// （巨大化は「城娘」への効果にのみ適用されるのが一般的）
hasGiantPrefix = false;

// 並列展開
stats = ['enemy_attack', 'enemy_movement'];
value = 8;
mode = 'percent_max';

// ※巨大化倍率は適用しない（文脈判断）
// または、巨大化倍率を適用する場合: value = 8 * 5 = 40

// 生成されるバフ
[
  {
    stat: 'enemy_attack',
    target: 'range',
    mode: 'percent_max',
    value: 8,  // または 40
    source: 'self_skill'
  },
  {
    stat: 'enemy_movement',
    target: 'range',
    mode: 'percent_max',
    value: 8,  // または 40
    source: 'self_skill'
  }
]
```

**重要な議論点**: 最後の敵デバフに巨大化倍率が適用されるかどうかは、ゲームの実際の動作を確認する必要があります。一般的には、「巨大化毎に」は城娘へのバフにのみ適用されると考えられますが、確証がない場合は、設定フラグで切り替えられるようにします。

#### 計略のテキスト（再掲）

```
60秒間特技効果が1.25倍、射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える射程内の城娘の撃破気が1増加(同種効果の重複無し)
```

#### 段階的なパース処理

**ステップ1: 前処理**

効果時間を除去します。

```typescript
// 前処理後
"特技効果が1.25倍、射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える射程内の城娘の撃破気が1増加(同種効果の重複無し)"
```

**ステップ2: 特殊効果の検出**

設計決定5に基づき、特技効果の倍率と継続効果は別途管理します。

```typescript
// 検出される特殊効果
specialEffects = [
  {
    type: 'skill_multiplier',
    value: 1.25,
    description: '特技効果が1.25倍'
  },
  {
    type: 'continuous_heal',
    description: '射程内の殿と城娘を継続回復'
  },
  {
    type: 'continuous_damage',
    description: '敵に継続的にダメージ'
  }
];
```

**ステップ3: 通常バフのパース**

残った部分から通常のバフを抽出します。

```typescript
// "射程内の城娘の撃破気が1増加(同種効果の重複無し)"

target = 'range/ally';
stat = 'cost';
costType = 'ally_defeat';  // 城娘撃破時（ノビ）
mode = 'flat_sum';
value = 1;

// 括弧内の処理
isExplicitlyNonDuplicate = true;  // 設計決定2に基づく

// 生成されるバフ
{
  stat: 'cost',
  costType: 'ally_defeat',
  target: 'range/ally',
  mode: 'flat_sum',
  value: 1,
  isDuplicate: false,
  isExplicitlyNonDuplicate: true,
  source: 'strategy'
}
```

---

## 🚨 エッジケースとその対処

実際のWikiテキストで遭遇する可能性がある、特殊なケースとその対処方法を説明します。

### エッジケース1: 句読点の欠落

句読点がなく、文が連続しているケース。

```typescript
// 例: "射程内の敵の防御が低下全ての敵の移動速度が低下"
// → 句読点がないが、範囲指定の変化で分割できる
```

対処方法: 範囲指定キーワードを優先して、分割を試みます。

### エッジケース2: 複数の括弧

1つの文に複数の括弧がある場合。

```typescript
// 例: "攻撃が上昇(効果重複)、防御が上昇(自身のみ)"
```

対処方法: 各括弧を直前の効果に関連付けます。

### エッジケース3: ネストした並列表記

```typescript
// 例: "攻撃と防御が上昇、射程と移動速度が上昇"
// → 4つのバフ: 攻撃、防御、射程、移動速度
```

対処方法: まず「、」で分割し、その後「と」で展開します。

### エッジケース4: 数値が複数ある

```typescript
// 例: "攻撃が30、防御が50上昇"
// → "攻撃が30上昇" と "防御が50上昇"
```

対処方法: 数値と対応するStatをペアで抽出します。

### エッジケース5: 単位の省略

```typescript
// 例: "攻撃が30、防御が50%上昇"
// → "攻撃が30上昇"（単位なし） と "防御が50%上昇"
```

対処方法: 単位がない場合は、文脈から判断します。通常は`flat_sum`と解釈しますが、周囲のバフが`percent_max`の場合は、それに合わせることも検討します。

### エッジケース6: 表記揺れの極端な例

```typescript
// 例: "攻撃力ＵＰ３０パーセント"
// → 正規化: "攻撃上昇30%"
```

対処方法: 正規化ルールを徹底的に適用します。

---

### テストカテゴリ9: 実際のキャラクター

```typescript
describe('実際のキャラクターデータ', () => {
  test('天童城の特技', () => {
    const input = '巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇全ての敵の防御と移動速度が8%低下';
    const results = parseSkillLine(input);
    
    // 6つのバフが生成されることを確認
    expect(results).toHaveLength(6);
    
    // 効果重複の防御と移動速度
    expect(results[0].stat).toBe('enemy_defense');
    expect(results[0].value).toBe(30);
    expect(results[0].isDuplicate).toBe(true);
    
    expect(results[1].stat).toBe('enemy_movement');
    expect(results[1].value).toBe(30);
    expect(results[1].isDuplicate).toBe(true);
    
    // 全ての敵の部分
    expect(results[4].target).toBe('all');
    expect(results[4].value).toBe(40);
  });
  
  test('室町第の特技', () => {
    const input = '【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算巨大化毎に射程内の城娘の射程が10、攻撃が50上昇射程内の敵の攻撃と移動速度が8%低下';
    const results = parseSkillLine(input);
    
    // 鼓舞2つ + 巨大化バフ2つ + 敵デバフ2つ = 6つ
    expect(results).toHaveLength(6);
    
    // 鼓舞
    expect(results[0].stat).toBe('inspire');
    expect(results[0].inspireSourceStat).toBe('attack');
    
    expect(results[1].stat).toBe('inspire');
    expect(results[1].inspireSourceStat).toBe('defense');
    
    // 巨大化バフ
    expect(results[2].stat).toBe('range');
    expect(results[2].value).toBe(50);  // 10 * 5
    
    expect(results[3].stat).toBe('attack');
    expect(results[3].value).toBe(250);  // 50 * 5
  });
  
  test('ゴールデン・ハインドの特技（スタック可能バフ）', () => {
    const input = '【配置】敵撃破毎に自身の攻撃5%と70(効果重複)、射程7上昇(20回まで)';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(3);
    
    // 攻撃パーセント（最大スタック時）
    expect(results[0].stat).toBe('attack');
    expect(results[0].mode).toBe('percent_max');
    expect(results[0].value).toBe(100);  // 5 × 20
    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].stackable).toBe(true);
    expect(results[0].maxStacks).toBe(20);
    
    // 攻撃固定値（最大スタック時）
    expect(results[1].stat).toBe('attack');
    expect(results[1].mode).toBe('flat_sum');
    expect(results[1].value).toBe(1400);  // 70 × 20
    expect(results[1].isDuplicate).toBe(true);
    expect(results[1].stackable).toBe(true);
    expect(results[1].maxStacks).toBe(20);
    
    // 射程（最大スタック時）
    expect(results[2].stat).toBe('range');
    expect(results[2].value).toBe(140);  // 7 × 20
    expect(results[2].stackable).toBe(true);
    expect(results[2].maxStacks).toBe(20);
  });
  
  test('ゴールデン・ハインド（明示されない鼓舞）', () => {
    const input = '最大化時、自身を除く射程内城娘に自身の攻撃の30%の値を加算';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(1);
    expect(results[0].stat).toBe('inspire');
    expect(results[0].inspireSourceStat).toBe('attack');
    expect(results[0].value).toBe(30);
    expect(results[0].conditionTags).toContain('giant_5');
    expect(results[0].conditionTags).toContain('exclude_self');
  });
  
  test('大坂城の特技（自己適用倍率）', () => {
    const input = '全城娘の攻撃が50上昇。自身に対しては効果1.5倍。';
    const results = parseSkillLine(input);
    
    // 2つのバフが生成される
    expect(results).toHaveLength(2);
    
    // 他の城娘へのバフ
    expect(results[0].target).toBe('all');
    expect(results[0].value).toBe(50);
    expect(results[0].conditionTags).toContain('exclude_self');
    
    // 自身へのバフ
    expect(results[1].target).toBe('self');
    expect(results[1].value).toBe(75);  // 50 × 1.5
  });
});
```

### テストカテゴリ10: 新しいパターン

```typescript
describe('新しいパターンのテスト', () => {
  test('直撃ボーナス（絶対値）', () => {
    const input = '直撃ボーナスが300%に上昇';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('critical_bonus');
    expect(result.mode).toBe('absolute_set');
    expect(result.value).toBe(300);
  });
  
  test('直撃ボーナス（加算）', () => {
    const input = '直撃ボーナスが50%上昇';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('critical_bonus');
    expect(result.mode).toBe('percent_max');
    expect(result.value).toBe(50);
  });
  
  test('○倍のダメージを与える', () => {
    const input = '武器攻撃が標的とその周囲に1.5倍のダメージを与える';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('give_damage');
    expect(result.value).toBe(50);  // 1.5倍 → 50%
  });
  
  test('攻撃の○倍のダメージ', () => {
    const input = '攻撃の7倍のダメージを与え';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('give_damage');
    expect(result.value).toBe(600);  // 7倍 → 600%
  });
  
  test('同種効果と重複（効果重複の別表記）', () => {
    const input = '攻撃が20%上昇(同種効果と重複)';
    const result = parseSkillLine(input)[0];
    
    expect(result.isDuplicate).toBe(true);  // 効果重複と同じ
  });
  
  test('水上条件', () => {
    const input = '【水上】自身の巨大化気を半減';
    const result = parseSkillLine(input)[0];
    
    expect(result.conditionTags).toContain('on_water');
    expect(result.stat).toBe('cost');
    expect(result.costType).toBe('giant_cost');
    expect(result.value).toBe(50);  // 半減 = 50%
  });
  
  test('耐久依存条件', () => {
    const input = '対象の耐久が高い程与えるダメージ上昇(最大2倍)';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('give_damage');
    expect(result.value).toBe(100);  // 2倍 → 100%
    expect(result.conditionTags).toContain('durability_dependent');
  });
});
```

---

## ✅ テストケース

実装の正しさを検証するためのテストケースです。

### テストカテゴリ1: 基本パターン

```typescript
describe('基本的なバフのパース', () => {
  test('攻撃割合バフ', () => {
    const input = '攻撃が30%上昇';
    const expected = {
      stat: 'attack',
      mode: 'percent_max',
      value: 30,
      target: 'self'  // 範囲指定なしはself
    };
    expect(parseSkillLine(input)[0]).toMatchObject(expected);
  });
  
  test('防御固定バフ', () => {
    const input = '防御が50上昇';
    const expected = {
      stat: 'defense',
      mode: 'flat_sum',
      value: 50,
      target: 'self'
    };
    expect(parseSkillLine(input)[0]).toMatchObject(expected);
  });
  
  test('射程内バフ', () => {
    const input = '射程内の城娘の攻撃が20%上昇';
    const expected = {
      stat: 'attack',
      mode: 'percent_max',
      value: 20,
      target: 'range/ally'
    };
    expect(parseSkillLine(input)[0]).toMatchObject(expected);
  });
});
```

### テストカテゴリ2: 並列表記

```typescript
describe('並列表記の展開', () => {
  test('「と」による並列', () => {
    const input = '攻撃と防御が30%上昇';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(2);
    expect(results[0].stat).toBe('attack');
    expect(results[1].stat).toBe('defense');
    expect(results[0].value).toBe(30);
    expect(results[1].value).toBe(30);
  });
  
  test('「・」による並列', () => {
    const input = '射程・移動速度が30%低下';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(2);
    expect(results[0].stat).toBe('enemy_range');
    expect(results[1].stat).toBe('enemy_movement');
  });
});
```

### テストカテゴリ3: 効果重複

```typescript
describe('効果重複の検出', () => {
  test('効果重複フラグの設定', () => {
    const input = '敵の防御が5%低下(効果重複)';
    const result = parseSkillLine(input)[0];
    
    expect(result.isDuplicate).toBe(true);
  });
  
  test('並列表記での効果重複', () => {
    const input = '防御と移動速度が6%低下(効果重複)';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(2);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[1].isDuplicate).toBe(true);
  });
  
  test('効果重複のスコープ', () => {
    const input = '防御が6%低下(効果重複)、射程が7%低下';
    const results = parseSkillLine(input);
    
    expect(results[0].isDuplicate).toBe(true);
    expect(results[1].isDuplicate).toBe(false);
  });
});
```

### テストカテゴリ4: 範囲の継続

```typescript
describe('範囲の継続ルール', () => {
  test('範囲指定なしで前のセグメントを継承', () => {
    const input = '射程内の敵の防御が低下、移動速度が低下';
    const results = parseSkillLine(input);
    
    expect(results[0].target).toBe('range');
    expect(results[1].target).toBe('range');  // 継承
  });
  
  test('新しい範囲指定で範囲が変わる', () => {
    const input = '射程内の敵の防御が低下。全ての敵の移動速度が低下';
    const results = parseSkillLine(input);
    
    expect(results[0].target).toBe('range');
    expect(results[1].target).toBe('all');  // 変更
  });
});
```

### テストカテゴリ5: 巨大化倍率

```typescript
describe('巨大化倍率の適用', () => {
  test('巨大化する度に', () => {
    const input = '巨大化する度に攻撃が6%上昇';
    const result = parseSkillLine(input)[0];
    
    expect(result.value).toBe(30);  // 6 * 5
  });
  
  test('巨大化倍率のスコープ', () => {
    const input = '巨大化する度に攻撃が6%上昇。防御が10%上昇';
    const results = parseSkillLine(input);
    
    expect(results[0].value).toBe(30);  // 巨大化適用
    expect(results[1].value).toBe(10);  // 適用されない（新しい文）
  });
});
```

### テストカテゴリ6: 鼓舞

```typescript
describe('鼓舞の処理', () => {
  test('単一ステータスの鼓舞', () => {
    const input = '【鼓舞】自身の攻撃の30%を射程内に加算';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('inspire');
    expect(result.inspireSourceStat).toBe('attack');
    expect(result.value).toBe(30);
  });
  
  test('複数ステータスの鼓舞', () => {
    const input = '【鼓舞】自身の攻撃と防御の30%を射程内に加算';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(2);
    expect(results[0].inspireSourceStat).toBe('attack');
    expect(results[1].inspireSourceStat).toBe('defense');
  });
});
```

### テストカテゴリ7: 条件付きバフ

```typescript
describe('条件付きバフ', () => {
  test('巨大化段階条件', () => {
    const input = '攻撃が400上昇、巨大化段階が5以上の城娘は効果1.5倍';
    const results = parseSkillLine(input);
    
    expect(results).toHaveLength(2);
    expect(results[0].value).toBe(400);
    expect(results[0].conditionTags).toEqual([]);
    expect(results[1].value).toBe(600);
    expect(results[1].conditionTags).toContain('giant_5');
  });
});
```

### テストカテゴリ8: 表記揺れ

```typescript
describe('表記揺れの正規化', () => {
  test('アップ → 上昇', () => {
    const input = '攻撃アップ30%';
    const result = parseSkillLine(input)[0];
    
    expect(result.stat).toBe('attack');
    expect(result.value).toBe(30);
  });
  
  test('全角 → 半角', () => {
    const input = '攻撃が３０％上昇';
    const result = parseSkillLine(input)[0];
    
    expect(result.value).toBe(30);
  });
});
```

### テストカテゴリ9: 実際のキャラクター

```typescript
describe('実際のキャラクターデータ', () => {
  test('天童城の特技', () => {
    const input = '巨大化する度に射程内の敵の防御と移動速度6%低下(効果重複)、射程7%低下、被ダメージ10%上昇全ての敵の防御と移動速度が8%低下';
    const results = parseSkillLine(input);
    
    // 6つのバフが生成されることを確認
    expect(results).toHaveLength(6);
    
    // 効果重複の防御と移動速度
    expect(results[0].stat).toBe('enemy_defense');
    expect(results[0].value).toBe(30);
    expect(results[0].isDuplicate).toBe(true);
    
    expect(results[1].stat).toBe('enemy_movement');
    expect(results[1].value).toBe(30);
    expect(results[1].isDuplicate).toBe(true);
    
    // 全ての敵の部分
    expect(results[4].target).toBe('all');
    expect(results[4].value).toBe(40);
  });
  
  test('室町第の特技', () => {
    const input = '【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算巨大化毎に射程内の城娘の射程が10、攻撃が50上昇射程内の敵の攻撃と移動速度が8%低下';
    const results = parseSkillLine(input);
    
    // 鼓舞2つ + 巨大化バフ2つ + 敵デバフ2つ = 6つ
    expect(results).toHaveLength(6);
    
    // 鼓舞
    expect(results[0].stat).toBe('inspire');
    expect(results[0].inspireSourceStat).toBe('attack');
    
    expect(results[1].stat).toBe('inspire');
    expect(results[1].inspireSourceStat).toBe('defense');
    
    // 巨大化バフ
    expect(results[2].stat).toBe('range');
    expect(results[2].value).toBe(50);  // 10 * 5
    
    expect(results[3].stat).toBe('attack');
    expect(results[3].value).toBe(250);  // 50 * 5
  });
});
```

---

## 📋 実装チェックリスト

PARSING_RULES.mdに基づいた実装が完了したら、以下を確認してください。

### パーサー実装（基本）
- [ ] 前処理（全角・半角統一、表記揺れ正規化、不要情報除去）が実装されている
- [ ] 文の分割ロジック（句読点、範囲指定、接頭辞）が実装されている
- [ ] 範囲の検出と継続ルールが実装されている
- [ ] 効果の抽出（Stat、数値、BuffMode）が実装されている
- [ ] 条件の抽出（括弧内、文脈）が実装されている
- [ ] 並列表記の展開（「と」「・」）が実装されている

### パーサー実装（新パターン）
- [ ] 特技発動条件マーカー（【配置】【水上】）の検出と処理
- [ ] スタック可能バフ（「敵撃破毎に」「○回まで」）の処理
- [ ] 明示されない鼓舞の検出パターンが実装されている
- [ ] 除外条件（「自身を除く」）の検出と処理
- [ ] 直撃ボーナスの特殊表記（「○%に上昇」vs「○%上昇」）の区別
- [ ] 自己適用倍率（「自身に対しては効果1.5倍」）の処理
- [ ] 「○倍のダメージを与える」パターンの検出
- [ ] 「同種効果と重複」フラグの検出と設定
- [ ] HP/耐久依存条件の検出と処理

### 特殊処理（基本）
- [ ] 鼓舞の処理フローが実装されている
- [ ] 巨大化倍率の適用ロジックが実装されている
- [ ] 倍率からパーセントへの変換が実装されている
- [ ] 条件付きバフの生成（別Buffとして）が実装されている
- [ ] 継続効果の扱い（note フィールド）が実装されている
- [ ] 特技効果倍率の扱い（specialEffects）が実装されている

### 型定義の拡張
- [ ] 新しいStat（`enemy_range`, `critical_bonus`）が追加されている
- [ ] 新しいBuffMode（`absolute_set`）が追加されている
- [ ] Buffインターフェースに新しいフィールドが追加されている
  - [ ] `stackable?: boolean`
  - [ ] `maxStacks?: number`
  - [ ] `currentStacks?: number`
- [ ] 新しいConditionTag（`on_water`, `exclude_self`, `hp_dependent`, `on_placement`）が追加されている
- [ ] 「耐久依存」の表記も`hp_dependent`にマッピングされている

### フラグ・フィールド（基本）
- [ ] isDuplicate フラグが正しく設定される
- [ ] isExplicitlyNonDuplicate フラグが実装されている
- [ ] conditionTags が正しく抽出される
- [ ] costType が正しく設定される
- [ ] inspireSourceStat が鼓舞で正しく設定される

### フラグ・フィールド（新規）
- [ ] stackable フラグが正しく設定される
- [ ] maxStacks が正しく抽出される
- [ ] 「同種効果と重複」が`isDuplicate: true`として正しく処理される
- [ ] note フィールドに適切な備考が記録される

### エッジケース対応
- [ ] 句読点の欠落に対応している
- [ ] 複数の括弧に対応している
- [ ] ネストした並列表記に対応している
- [ ] 数値が複数ある場合に対応している
- [ ] 単位の省略に対応している
- [ ] 特殊マーカーが複数ある場合（【配置】と【水上】の併用）に対応している

### テスト（基本パターン）
- [ ] 基本パターンのテストが全てパスする
- [ ] 並列表記のテストが全てパスする
- [ ] 効果重複のテストが全てパスする
- [ ] 範囲継続のテストが全てパスする
- [ ] 巨大化倍率のテストが全てパスする
- [ ] 鼓舞のテストが全てパスする
- [ ] 条件付きバフのテストが全てパスする
- [ ] 表記揺れのテストが全てパスする

### テスト（新パターン）
- [ ] スタック可能バフのテストがパスする
- [ ] 明示されない鼓舞のテストがパスする
- [ ] 自己適用倍率のテストがパスする
- [ ] 直撃ボーナスのテストがパスする
- [ ] 「○倍のダメージ」パターンのテストがパスする
- [ ] 「同種効果と重複」のテストがパスする
- [ ] 水上条件のテストがパスする
- [ ] 耐久依存条件のテストがパスする

### 実際のキャラクターデータでの検証
- [ ] 天童城の特技が正しくパースされる
- [ ] 室町第の特技が正しくパースされる
- [ ] ゴールデン・ハインドの特技が正しくパースされる
- [ ] 大坂城の特技が正しくパースされる
- [ ] 各キャラクターの計略が正しくパースされる


---

## 📚 関連ドキュメント

このドキュメントは、基本的なパース仕様（パターン1〜10）を扱います。さらに詳しい情報については、以下のドキュメントを参照してください。

### パース仕様の続き

- **[PARSING_RULES_ADVANCED.md](./PARSING_RULES_ADVANCED.md)** - 高度なパターン（パターン11以降）
  - 爆風範囲・爆風ダメージ
  - 射程内と射程外で効果が異なるバフ
  - 編成特技の除外
  - ノックバックの4段階
  - 徐々に気が増加する系の複雑なルール
  - 自然増加量の「増加」と「大きく増加」
  - (重複時効果減少) - スタックペナルティ
  - (重複なし) - 最大値のみ適用
  - 対象が暗黙的な複雑な文章構造
  - 動的バフ - 可変パラメータに依存する効果
  - 条件による値の分岐（直接指定）
  - 計略範囲バフ - 範囲サイズによる分類
  - 手動編集機能の必要性

- **[WIKI_PARSER_GUIDE.md](./WIKI_PARSER_GUIDE.md)** - Wikiパーサー実装知見とバージョン履歴
  - 特殊能力 vs 特殊攻撃の区別
  - スキル名と説明文の分離
  - 効果重複の位置ベース検出
  - バージョン履歴（v1.0〜v2.0）
  - 重要な設計決定のまとめ

### その他の関連ドキュメント

- `TYPE_CONVERSION_MAPPING.md` - 型変換の完全仕様
- `TARGET_NORMALIZATION.md` - Target正規化ルール
- `CONDITION_TAG_SPEC.md` - ConditionTag仕様
- `ARCHITECTURE.md` - プロジェクト全体の設計書
- `src/core/parser/buffParser.ts` - パーサーの実装（これから作成）
- `src/core/parser/patterns.ts` - 正規表現パターン定義（これから作成）

---

**Document Version**: 2.0  
**Created**: 2025-12-06  
**Last Updated**: 2025-12-14  
**Status**: 仕様確定 ✅
