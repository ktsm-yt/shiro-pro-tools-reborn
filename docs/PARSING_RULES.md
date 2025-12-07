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
  
  // cost専用フィールド
  costType?: CostBuffType;
  
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

### パターン11: 爆風範囲・爆風ダメージ

ダメージ計算では無視してよいが、存在は認識すべきパターンです。

```typescript
// 例: 爆風範囲と爆風ダメージ2倍
```

**処理方法**: 備考（note）として記録し、パースはスキップ

### パターン12: 射程内と射程外で効果が異なるバフ

同じステータスに対して、範囲によって異なる値のバフが提供される場合があります。これは甲府城の特技に見られるパターンです。

```typescript
// 例: 射程内の味方の射程10、攻撃速度7%与ダメ7%上昇、攻撃後の隙7%短縮。
//     射程外の味方は射程8、攻撃速度6%、与ダメ6%上昇、攻撃後の隙6%短縮
```

**重要な設計決定**: バフパズルでは射程内の大きな効果を参照し、射程外の効果は備考として扱います。

**理由**: 同種バフは最大値が適用される（パーセント系）、または加算される（固定値）ため、バフパズルでは最大ポテンシャルを表示することが目的です。射程外の小さい値は、詳細情報として別途表示します。

**処理方法**: 両方のバフを生成しますが、UIでは射程内のバフを優先的に表示します。

```typescript
// 射程内のバフ（優先表示）
{
  stat: 'attack_speed',
  target: 'range/ally',
  value: 35,  // 7% × 5（巨大化倍率）
  source: 'self_skill',
  priority: 'high'  // ★新しいフィールド
}

// 射程外のバフ（備考）
{
  stat: 'attack_speed',
  target: 'out_of_range/ally',  // ★新しいターゲット
  value: 30,  // 6% × 5
  source: 'self_skill',
  priority: 'low',
  note: '射程外の城娘に適用'
}
```

### パターン13: 編成特技の除外

編成特技は初期値に関わるため、バフパズルでは表示しません。

```typescript
// 例: 部隊の[絢爛]と関東・甲信越城娘の初回計略使用までの時間が30%
//     計略再使用までの時間が5%短縮
```

**処理方法**: `source: 'formation_skill'` のバフは生成しますが、バフパズルのUIでは表示しません。ダメージ計算時の初期値計算では使用される可能性があります。

### パターン14: ノックバックの4段階

ノックバックには強度によって4種類の表記があります。

```typescript
// 少し後退 → 1マス
// 後退 → 2マス
// 大きく後退 → 3マス
// 劇的に後退 → 4マス
```

**検出パターンの優先順位**:

```typescript
const KNOCKBACK_PATTERNS = [
  { pattern: /劇的に後退/, value: 4, priority: 1 },
  { pattern: /大きく後退/, value: 3, priority: 2 },
  { pattern: /(\d+)マス?後退/, value: 'numeric', priority: 3 },
  { pattern: /少し後退/, value: 1, priority: 4 },
  { pattern: /後退(?!させる)/, value: 2, priority: 5 }  // 単独の「後退」は最後
];
```

**注意**: より具体的なパターンを先にチェックする必要があります。「後退」だけの検出を先にすると、「大きく後退」も誤って「後退」とマッチしてしまいます。

### パターン15: 徐々に気が増加する系の複雑なルール

同じ「時間経過で気が徐々に増加」という文言が、文脈によって異なる意味を持ちます。これは正規表現だけでは対応できない、最も複雑なパターンの一つです。

**ルール**:

1. **基本パターン**: 「時間経過で気が徐々に増加」→ 5秒ごとに2増加
2. **明示的な指定**: 「10秒毎に気が1増加」→ 指定された通り
3. **巨大化依存**: 「巨大化する度に...時間経過で気が徐々に増加」→ 10秒ごとに5増加（最大値）

**処理フロー**:

```typescript
function parseGradualCostIncrease(text: string, context: ParseContext) {
  // ステップ1: 明示的な指定を優先
  const explicitMatch = text.match(/(\d+)秒(?:毎|ごと)に気が(\d+)増加/);
  if (explicitMatch) {
    return {
      interval: parseInt(explicitMatch[1]),
      amount: parseInt(explicitMatch[2]),
      note: '明示的な指定'
    };
  }
  
  // ステップ2: 「時間経過で気が徐々に増加」の基本パターン
  if (/時間経過で気が徐々に増加/.test(text)) {
    // 巨大化依存かどうかをチェック
    if (context.hasGiantPrefix) {
      return {
        interval: 10,
        amount: 5,  // 巨大化5段階時の最大値
        note: '巨大化依存（最大値）'
      };
    } else {
      return {
        interval: 5,
        amount: 2,
        note: '基本パターン'
      };
    }
  }
  
  return null;
}
```

**重要な注意**: このルールは現時点で発見されたパターンに基づいています。今後、例外が見つかる可能性があります。

### パターン16: 自然増加量の「増加」と「大きく増加」

気の自然増加量には、副詞による値の修飾があります。

```typescript
// 気の自然増加量を増加 → +40%
// 気の自然増加量を大きく増加 → +70%
```

**検出パターン**:

```typescript
const NATURAL_COST_PATTERN = /気の自然増加量を(大きく)?増加/;

const MAGNITUDE_VALUES = {
  '': 40,        // 修飾なし
  '大きく': 70   // 「大きく」修飾
};

// 使用例
const match = text.match(NATURAL_COST_PATTERN);
if (match) {
  const magnitude = match[1] || '';
  const value = MAGNITUDE_VALUES[magnitude];
  
  return {
    stat: 'cost',
    costType: 'natural',
    mode: 'percent_max',
    value: value
  };
}
```

### パターン17: (重複時効果減少) - スタックペナルティ

これは「効果重複」とは異なる新しい概念です。同じバフが複数スタックした場合、2つ目以降の効果が減少します。

```typescript
// 例: 気の自然増加量を大きく増加(重複時効果減少)
```

**意味**: 同じキャラを2体編成した場合、2体目の効果が半減します。

- 1体目: +70%
- 2体目: +35%（半減）
- 合計: +105%

**新しいフィールド**:

```typescript
interface Buff {
  // ... 既存のフィールド
  stackPenalty?: number;  // スタック時のペナルティ（0.5 = 半減）
}
```

**検出パターン**:

```typescript
if (/重複時効果減少/.test(text)) {
  buff.stackPenalty = 0.5;
}
```

### パターン18: (重複なし) - 最大値のみ適用

これは「複数のキャラが同じstatのバフを持っている場合、最大値のものだけが適用される」という意味です。

```typescript
// 例1: 射程内敵の撃破気1増加(重複なし)
// 例2: 射程内敵の撃破獲得気2増加
```

両方が編成にいる場合、値が大きい方（+2）だけが適用され、小さい方（+1）は無効になります。

**新しいフィールド**:

```typescript
interface Buff {
  // ... 既存のフィールド
  nonStacking?: boolean;  // 重複しない（最大値のみ適用）
}
```

**検出パターン**:

```typescript
if (/重複なし/.test(text)) {
  buff.nonStacking = true;
}
```

**UI表示**: このフラグがあるバフは、「重複なし」というバッジを表示し、ユーザーに警告します。

### パターン19: 対象が暗黙的な複雑な文章構造

一部のキャラクター（特に伏兵を召喚するキャラ）の特技は、対象が明示的に書かれていない複雑な構造を持ちます。

```typescript
// 例: 飛行敵以外に狙われず攻撃しない伏兵(1体)。
//     時間経過で射程が徐々に上昇(上限200)。
//     気の自然増加量を大きく増加(重複時効果減少)。
//     射程内敵の撃破気1増加(重複なし)
```

**対象の推測ルール**:

1. 文の最初に「伏兵」というキーワードがある場合、その段落の効果は伏兵に関するものと推測
2. ただし、「気の増加」系は常にフィールド全体への効果なので、`target: 'field'`
3. 「射程内敵」というキーワードがある場合、それは伏兵の射程内を指している可能性が高い

**処理の難しさ**: これは正規表現だけでは完全には対応できません。実装時には、キーワードとヒューリスティックなルールの組み合わせが必要になります。

**暫定的な処理方針**: 

- 明確に判定できない場合は、`note`フィールドに元のテキストを保存
- ユーザーに「この効果の対象は推測です」と警告を表示
- 将来的に、より多くの例を集めてパターンを改善

### パターン21: 動的バフ - 可変パラメータに依存する効果

**極めて重要な概念**: 気は個別のキャラクターが持つリソースではなく、編成全体で共有されるフィールドリソースです。この理解は、気に関するバフの処理において根本的に重要です。

#### 気のゲームシステム

城プロREにおいて、気は以下のように機能します。

まず、気は時間経過で自然に増加していきます。これが基本的な気の獲得方法です。プレイヤーはこの共有された気を使って、城娘を配置したり、巨大化させたり、計略を発動したり、特殊能力を使用したりします。つまり、気は編成全体で管理される行動ポイントのようなリソースです。

気に関するバフには、以下のような種類があります。

- **気の自然増加量を上昇**: フィールド全体での気の増加速度が上がる
- **敵撃破時の気獲得を増加**: 敵を倒したときにフィールド全体の気が増える（気(牛)）
- **巨大化気を軽減**: 巨大化に必要な気の消費量が減る
- **計略消費気を軽減**: 計略発動に必要な気の消費量が減る

これら全ての効果は、特定のキャラクターに影響するのではなく、フィールド全体に影響します。

#### 処理ルール

気に関するバフは、常に `target: 'field'` として表現します。

```typescript
// 例1: 気の自然増加量を大きく増加
{
  stat: 'cost',
  costType: 'natural',
  target: 'field',  // ★必ずfieldを指定
  mode: 'percent_max',
  value: 70,  // 大きく増加 = 70%
  note: 'フィールド全体の気の増加速度に影響'
}

// 例2: 敵撃破時の獲得気2増加
{
  stat: 'cost',
  costType: 'enemy_defeat',
  target: 'field',  // ★必ずfieldを指定
  mode: 'flat_sum',
  value: 2,
  note: '敵撃破時、フィールド全体の気が増加'
}

// 例3: 巨大化気を半減
{
  stat: 'cost',
  costType: 'giant_cost',
  target: 'field',  // ★必ずfieldを指定
  mode: 'percent_reduction',
  value: 50,
  note: '巨大化の消費気が軽減される'
}
```

#### 伏兵と気の関係

伏兵を召喚するキャラクター（鹿野城など）の特技は、気の処理において特に重要な例です。

鹿野城が伏兵を召喚すると、その伏兵は攻撃をしませんが、フィールドに存在し続けます。そして、その伏兵の射程内の敵が倒されると、フィールド全体の気が増加します。

これは「伏兵が気を得る」のではなく、「伏兵の存在がフィールド全体の気の増加に貢献する」という意味です。伏兵は気の増加装置として機能しており、伏兵自身が気を使うことも、気を保持することもありません。

```typescript
// 鹿野城の例: 「射程内敵の撃破気1増加(重複なし)」
{
  stat: 'cost',
  costType: 'enemy_defeat',
  target: 'field',  // フィールド全体への効果
  mode: 'flat_sum',
  value: 1,
  nonStacking: true,
  note: '伏兵の射程内の敵撃破時、フィールド全体の気が+1される',
  source: 'self_skill'  // 鹿野城の特技による効果
}
```

この効果は伏兵自身に紐づくものではなく、鹿野城が配置されることによってフィールド全体に与えられる効果です。伏兵が召喚されたときに、このバフが有効になり、フィールドレベルで気の増加に貢献します。

#### バフパズルでの気の表示

バフパズルにおいて、気のバフは他のバフとは異なる扱いが必要です。気はフィールド全体で共有されるため、「誰が誰に気のバフを与える」という表現は適切ではありません。

より正確には、「この編成では、気の増加速度がどれだけ上がるか」「敵撃破時の気の獲得量がどれだけ増えるか」という情報を表示すべきです。これは、個別のキャラクターへのバフではなく、編成全体のリソース管理に関する情報になります。

**UI設計の推奨**:

バフマトリクスとは別に、「フィールド効果」のようなセクションを設けて、気に関するバフをまとめて表示するのが良いでしょう。例えば：

**フィールド効果**
- 気の自然増加速度: +70%（鹿野城による）
- 敵撃破時の気獲得: +1（鹿野城の伏兵による、重複なし）
- 巨大化気軽減: -50%（ゴールデン・ハインド、水上配置時のみ）

このように、編成全体での気の管理状況が一目で分かる表示が理想的です。

### パターン21: 動的バフ - 可変パラメータに依存する効果

**極めて重要な概念**: 一部のバフは、戦闘中に変動するパラメータ（敵の数、伏兵の数、味方の数など）に依存して効果が変化します。これらを「動的バフ」と呼びます。動的バフは、バフパズルとダメージ計算で異なる扱いが必要になります。

#### 動的バフの分類

動的バフは、依存するパラメータの性質によって2つのカテゴリに分類されます。この分類は、ツールでの扱い方を決定する上で重要です。

**カテゴリA: 編成依存の動的バフ**

編成構築時にある程度コントロール可能なパラメータに依存するバフです。具体的には、伏兵の数や味方の数などがこれに該当します。これらは編成を確定した時点で、想定される値の範囲を絞り込むことができます。

例として、ドレッドノートの計略を見てみましょう。「40秒間対象の射程が1.5倍、射程内の対象を除く味方1体につき攻撃が150、与えるダメージが15%ずつ上昇」というバフがあります。このバフの効果は、射程内にいる味方の数によって変化します。しかし、編成は8人と決まっているため、「最大で味方7人分、つまり攻撃+1050、与ダメ+105%」という上限が明確に存在します。

編成依存の動的バフは、編成構築のシミュレーションである程度具体的な値を計算できるため、バフパズルでも部分的に扱うことができます。ただし、実際の配置や射程の関係で、理論上の最大値と実際の値は異なる可能性があります。

**カテゴリB: 戦闘状況依存の動的バフ**

戦闘中に刻一刻と変化し、プレイヤーがコントロールできないパラメータに依存するバフです。具体的には、敵の数がこれに該当します。敵は出現し、倒され、また新たに出現するため、バフの効果は常に変動します。

例として、ある城娘の特技「最大化時、射程内敵1体毎に防御が12%ずつ上昇(効果重複)」を考えてみましょう。このバフの効果は、射程内にいる敵の数によって変化します。しかし、敵の数は戦闘のフェーズによって大きく変動するため、具体的な値を予測することが困難です。

戦闘状況依存の動的バフは、シナリオを想定しない限り具体的な値を出せません。そのため、バフパズルでは原則として除外し、ダメージ計算でシナリオごとに分析する必要があります。

#### 動的バフの検出パターン

動的バフは、以下のようなキーワードで検出できます。

```typescript
const DYNAMIC_BUFF_PATTERNS = [
  {
    pattern: /射程内(?:の)?敵(\d+)体(?:毎|ごと)に/,
    type: 'per_enemy_in_range',
    category: 'combat_situation'
  },
  {
    pattern: /射程内(?:の)?(?:対象を除く)?味方(\d+)体(?:毎|ごと|につき)に?/,
    type: 'per_ally_in_range',
    category: 'formation'
  },
  {
    pattern: /伏兵(\d+)体(?:毎|ごと)に/,
    type: 'per_ambush_deployed',
    category: 'formation'
  },
  {
    pattern: /撃破(?:した)?敵(\d+)体(?:毎|ごと)に/,
    type: 'per_enemy_defeated',
    category: 'combat_situation'
  },
  {
    pattern: /(?:自身を除く)?編成内(?:の)?(.+?)(\d+)体(?:毎|ごと)に/,
    type: 'per_specific_in_formation',
    category: 'formation'
  }
];
```

#### 動的バフの型定義

動的バフを表現するため、Buffインターフェースに新しいフィールドを追加します。

```typescript
interface Buff {
  // ... 既存のフィールド
  
  // 動的バフ関連
  isDynamic?: boolean;                    // 動的バフかどうか
  dynamicType?: DynamicBuffType;          // 動的バフの種類
  dynamicCategory?: 'formation' | 'combat_situation';  // カテゴリ
  unitValue?: number;                     // 単位あたりの効果値
  dynamicParameter?: string;              // 動的パラメータの説明
}

type DynamicBuffType = 
  | 'per_enemy_in_range'        // 射程内敵1体毎
  | 'per_ally_in_range'         // 射程内味方1体毎
  | 'per_ally_other'            // 自身を除く味方1体毎
  | 'per_ambush_deployed'       // 配置された伏兵1体毎
  | 'per_enemy_defeated'        // 撃破した敵1体毎
  | 'per_specific_attribute'    // 特定属性の城娘1体毎
  | 'per_specific_weapon';      // 特定武器種の城娘1体毎
```

#### 動的バフの生成例

「射程内敵1体毎に防御が12%ずつ上昇(効果重複)」というテキストから、以下のようなバフを生成します。

```typescript
{
  id: 'buff-dynamic-001',
  stat: 'defense',
  target: 'self',
  mode: 'percent_max',
  value: 12,  // 単位値（敵1体あたり）
  isDuplicate: true,
  
  // 動的バフ専用フィールド
  isDynamic: true,
  dynamicType: 'per_enemy_in_range',
  dynamicCategory: 'combat_situation',
  unitValue: 12,
  dynamicParameter: '射程内の敵の数',
  
  note: '射程内敵1体毎に+12%（効果は敵数に依存して変動）',
  source: 'self_skill',
  conditionTags: ['giant_5'],  // 最大化時
  isActive: true
}
```

#### バフパズルにおける動的バフの扱い

**設計方針**: 動的バフは、バフパズルの主要な計算からは除外します。バフパズルの目的は、編成内の静的なバフの関係性を可視化することです。動的バフを混ぜてしまうと、この目的がぼやけてしまいます。

**UI設計**: バフマトリクスの下に「動的バフ（参考情報）」というセクションを設けます。このセクションでは、動的バフの単位効果を表示し、想定される効果の範囲を示します。

UI表示の例を見てみましょう。通常のバフマトリクスの下に、動的バフのセクションが配置されます。

```
【通常のバフマトリクス】
┌──────────────────────────────┐
│ キャラA → キャラB             │
│ 攻撃+30% (射程内)             │
└──────────────────────────────┘

【動的バフ（参考情報）】
⚠️ これらのバフの実際の効果は、戦闘中の状況によって変動します

キャラC（自身）:
  🔄 防御+12%/敵（射程内敵1体毎）
     - 敵5体想定: +60%
     - 敵10体想定: +120%
     - 最大化時のみ、効果重複

ドレッドノート（伏兵経由）:
  🔄 攻撃+120（伏兵の射程内の城娘、伏兵1体あたり）
     - 伏兵3体配置時: 最大+360
     - 実際の効果は各城娘の位置に依存
```

このように、動的バフの存在を認識しつつ、それをバフパズルの主要な計算からは除外することで、ツールの使いやすさが保たれます。ユーザーは静的なバフの最適化に集中でき、動的バフについては別途考慮できるわけです。

#### ダメージ計算における動的バフの扱い

ダメージ計算においては、動的バフは非常に重要な要素になります。ここでは、シナリオ管理機能が必要になります。

**設計方針**: 同じキャラクターでも、異なる想定（伏兵10体、15体、20体など）で複数のインスタンスを作成し、それぞれでダメージ計算を行います。

**実装の具体例**: ドレッドノートを例に考えてみましょう。ドレッドノートは伏兵を際限なく配置でき、伏兵の数によってバフの効果が大きく変動します。ダメージ計算では、以下のような操作ができるべきです。

まず、ユーザーはドレッドノートを選択し、「シナリオを追加」ボタンをクリックします。すると、動的パラメータを入力するダイアログが表示されます。ここで、「配置された伏兵の数」や「射程内の味方の数」などを設定します。

例えば、「伏兵10体シナリオ」を作成した場合、ドレッドノートの伏兵からのバフ（攻撃+120/伏兵）が、10倍の+1200として計算されます。同様に、「伏兵15体シナリオ」「伏兵20体シナリオ」を作成し、それぞれの最終攻撃力やダメージを比較できます。

これにより、ユーザーは「伏兵を何体配置するのが最も効率的か」といった実践的な疑問に答えることができます。

#### 具体例: ドレッドノート

ドレッドノートは、動的バフの最も複雑な例です。この城娘の特技と計略を詳しく見てみましょう。

**特技**:
```
自身と自身の伏兵の直撃ボーナスが120%、爆風範囲が50%上昇、被ダメ50%軽減。
射程内敵の被ダメ50%上昇
【水上】全軍船と自身の伏兵の与えるダメージが1.25倍
```

この特技には動的バフは含まれていません。全て静的なバフとして処理できます。

**計略（伏兵召喚）**:
```
自身の1.2倍の耐久/攻撃/防御で敵2体とその周囲に4連続攻撃を行う伏兵を配置(水上移動可)
伏兵の射程内の城娘の攻撃が120、射程が30上昇
```

この計略には、伏兵経由の静的バフが含まれています。ただし、伏兵は複数配置できるため、伏兵の数によって合計のバフ量が変動します。これは編成依存の動的バフと見なすことができます。

**計略（バフ）**:
```
40秒間対象の射程が1.5倍、射程内の対象を除く味方1体につき攻撃が150、与えるダメージが15%ずつ上昇
対象と自身の伏兵の攻撃が2倍(自分のみ)
```

この計略には、明確な動的バフが含まれています。「射程内の対象を除く味方1体につき」という部分が、動的パラメータです。

生成されるバフの例を見てみましょう。

```typescript
// 静的バフ: 射程1.5倍
{
  stat: 'range',
  target: 'ally',  // 対象
  mode: 'percent_max',
  value: 50,
  source: 'strategy',
  isActive: true
}

// 動的バフ: 味方1体につき攻撃+150
{
  stat: 'attack',
  target: 'ally',  // 対象
  mode: 'flat_sum',
  value: 150,  // 単位値
  isDynamic: true,
  dynamicType: 'per_ally_in_range',
  dynamicCategory: 'formation',
  unitValue: 150,
  dynamicParameter: '射程内の対象を除く味方の数',
  note: '味方1体につき+150（最大7体で+1050）',
  source: 'strategy',
  isActive: true
}

// 動的バフ: 味方1体につき与ダメ+15%
{
  stat: 'give_damage',
  target: 'ally',  // 対象
  mode: 'percent_max',
  value: 15,  // 単位値
  isDynamic: true,
  dynamicType: 'per_ally_in_range',
  dynamicCategory: 'formation',
  unitValue: 15,
  dynamicParameter: '射程内の対象を除く味方の数',
  note: '味方1体につき+15%（最大7体で+105%）',
  source: 'strategy',
  isActive: true
}
```

バフパズルでは、これらの動的バフを「参考情報」として表示します。一方、ダメージ計算では、「射程内に味方が5人いる」「7人いる」といったシナリオを作成し、それぞれのダメージを比較できます。

このように、動的バフを適切に扱うことで、ドレッドノートのような複雑なキャラクターでも、実践的な分析が可能になります。

### パターン22: 条件による値の分岐（直接指定）

以前のパターン（大坂城の「効果1.5倍」など）では、基本値に倍率を掛けるという形で条件付き効果を表現していました。しかし、一部のキャラクターでは、条件によって直接的に異なる値が指定されるパターンがあります。

```typescript
// 例: 射程内の味方の攻撃と防御と与ダメージが40%、近接城娘は50%上昇
```

**構造の分析**:

この文章には、2つのレベルの効果が含まれています。まず、基本効果として「射程内の味方」全体に対して40%の上昇があります。そして、条件付き効果として「近接城娘」に限定した場合は50%の上昇になります。

重要なのは、これは「40%の1.25倍で50%」という計算ではなく、直接的に「近接城娘には50%」と指定されているということです。つまり、近接城娘に対しては40%のバフと50%のバフの両方が生成されますが、実際の適用時には条件を満たす方（50%）が選択されます。

**パース時の処理**:

このパターンを検出するには、読点（、）で文を分割し、前後で範囲指定が変化しているかをチェックします。

```typescript
// ステップ1: 読点で分割
const segments = text.split(/、|,/);
// ["射程内の味方の攻撃と防御と与ダメージが40%", "近接城娘は50%上昇"]

// ステップ2: 各セグメントを解析
segment1: {
  target: 'range/ally',
  stats: ['attack', 'defense', 'damage_dealt'],
  value: 40,
  mode: 'percent_max'
}

segment2: {
  target: 'range/ally',  // 範囲は引き継がれる
  conditionTags: ['melee'],  // ★条件が追加
  stats: ['attack', 'defense', 'damage_dealt'],  // statsも引き継がれる
  value: 50,
  mode: 'percent_max'
}
```

**生成されるBuffの例**:

この特技からは、合計6つのBuffが生成されます。基本効果として射程内の味方全体への3つのBuff（攻撃40%、防御40%、与ダメ40%）、そして条件付き効果として射程内の近接城娘への3つのBuff（攻撃50%、防御50%、与ダメ50%）が生成されます。

```typescript
// 基本効果（射程内の味方全体）
[
  {
    stat: 'attack',
    target: 'range/ally',
    mode: 'percent_max',
    value: 40,
    conditionTags: [],
    priority: 'normal',
    source: 'self_skill'
  },
  // defense, damage_dealt も同様...
  
  // 条件付き効果（射程内の近接城娘）
  {
    stat: 'attack',
    target: 'range/ally',
    mode: 'percent_max',
    value: 50,
    conditionTags: ['melee'],  // ★近接のみ
    priority: 'high',  // ★条件付きバフの方が優先度が高い
    source: 'self_skill'
  },
  // defense, damage_dealt も同様...
]
```

**バフ適用時の処理**:

バフ適用判定時には、同じstatに対して複数のバフがある場合、条件を満たすバフの中から最大値を選びます。近接城娘の場合は`melee`条件を満たすバフ（50%）が適用され、遠隔城娘の場合は条件なしのバフ（40%）が適用されます。

**重要な設計決定**: 近接・遠隔はConditionTagで処理する

武器種別条件（近接・遠隔）はConditionTagとして扱うことに決定しました。この理由は、属性条件（水、平、山など）と武器種別条件は、ゲームシステム上は同じレベルの「絞り込み条件」だからです。どちらも編成メンバーの中から特定の条件を満たすキャラクターを絞り込むという処理になります。

したがって、実装上も同じ仕組みで扱うのが自然です。targetは「範囲」を表現することに専念し、その範囲の中で「誰に効くか」という絞り込みはConditionTagが担当する、という責務の分離が明確になります。

```typescript
// 水属性の城娘への効果
{ target: 'range/ally', conditionTags: ['water'] }

// 近接城娘への効果
{ target: 'range/ally', conditionTags: ['melee'] }

// 近接かつ水属性の城娘への効果
{ target: 'range/ally', conditionTags: ['melee', 'water'] }
```

この一貫性は、バフ適用判定のロジックをシンプルに保つ上でも重要です。全てのConditionTagを同じループでチェックすればよく、武器種別だけ特別扱いする必要がありません。

**優先度の調整**:

武器種別条件（melee, ranged）の優先度は、属性条件と同じレベルの「中程度（優先度6）」に設定します。これにより、UI上での表示順序が自然になります。

**完全な実例**:

提示された特技全体を解析してみましょう。

```
自身の攻撃対象が3増加。
射程内の味方の攻撃と防御と与ダメージが40%、近接城娘は50%上昇。
全近接城娘の巨大化気を35%軽減。
10秒毎に気が追加で2増加
```

セグメント1は自身の攻撃対象+3、セグメント2は射程内の味方への基本バフ40%と近接城娘への条件付きバフ50%、セグメント3は全近接城娘の巨大化気軽減35%、セグメント4は10秒毎に気が追加で2増加、となります。特に注目すべきは、セグメント3の「全近接城娘の巨大化気を35%軽減」です。気はフィールド全体で共有されるリソースなので、`target: 'field'`として表現しますが、`conditionTags: ['melee']`を付けることで「近接城娘が巨大化する際に適用される軽減」という意味を表現できます。

このパターンは、条件による値の分岐を扱う上で非常に重要な実例です。基本値と条件付き値を別々のBuffとして生成し、適用時に適切な方を選択するというアプローチにより、柔軟で拡張性の高い設計が実現できます。

### パターン23: 計略範囲バフ - 範囲サイズによる分類

計略の中には、範囲を指定してその範囲内の味方にバフを与えるものがあります。この範囲のサイズによって、実際に何人の味方を巻き込めるかが大きく変わるため、バフパズルでの扱い方を範囲サイズに応じて変える必要があります。

```typescript
// 例: 30秒間範囲内の殿と城娘の攻撃と攻撃速度が1.25倍
//     攻撃後の隙が40%短縮(同種効果重複)(範囲：超特大、発動中の計略を解除しない)
```

**ゲームの実態と設計方針**:

城プロREは基本的に「射程内に味方を入れる」ゲームです。つまり、キャラクターを密集して配置し、互いにバフを掛け合うことが基本戦略になります。この前提があるため、計略の範囲バフは、範囲サイズによって以下のように分類できます。

超特大から大の範囲は、実際のプレイでは基本戦略（密集配置）を実行する限り、複数の味方を巻き込むことがほぼ確実です。これは信頼できる情報として、バフパズルの計算に含めることができます。一方、中から小の範囲は、マップの形状や配置戦略によって、巻き込める味方の数が大きく変動します。これは不確定性が高いため、保守的に扱う必要があります。

**範囲サイズによるtarget変換ルール**:

範囲サイズの表記と、それに対応するtargetの変換ルールを定義します。この変換により、バフパズルで適切な扱いができるようになります。

```typescript
const RANGE_SIZE_TO_TARGET = {
  // 超特大・特大：複数を確実に巻き込める
  '超特大': 'range',
  '特大': 'range',
  
  // 大：複数巻き込める可能性が高いが、全員ではない
  '大': 'range',
  
  // 中・小：対象指定に近い（1〜2人程度）
  '中': 'ally',
  '小': 'ally',
  
  // 特殊ケース：伏兵の射程内（後述）
  '伏兵の射程内': 'dynamic'  // 動的バフとして扱う
};
```

この分類は、実際のゲームプレイの感覚に基づいた実用的な判断です。完璧な情報ではありませんが、編成構築時の意思決定には十分な精度を持っています。

**パース時の処理フロー**:

計略範囲バフを検出する際の処理手順を示します。この手順により、範囲情報を適切にBuffオブジェクトに変換できます。

まず、括弧内の範囲情報を抽出します。正規表現パターン`/（範囲[：:]\s*(.+?)(?:[、,)]|$)/`を使って、「範囲：超特大」といった部分を検出します。次に、抽出した範囲サイズを上記の変換テーブルに照らし合わせ、適切なtargetを決定します。そして、元の範囲サイズ情報はnoteフィールドに保存します。これにより、ユーザーが後から「なぜこのtargetになったのか」を確認できます。

最後に、効果時間の情報（「30秒間」など）はバフパズルでは使用しませんが、これもnoteに保存しておきます。将来的にダメージ計算機能を拡張する際に役立つ可能性があります。

**生成されるBuffの例**:

提示された計略テキストから生成されるBuffオブジェクトを具体的に示します。

```typescript
// 「30秒間範囲内の殿と城娘の攻撃と攻撃速度が1.25倍攻撃後の隙が40%短縮
//  (同種効果重複)(範囲：超特大、発動中の計略を解除しない)」

[
  // 攻撃バフ
  {
    id: 'strategy-buff-001',
    stat: 'attack',
    target: 'range',  // 超特大なのでrange
    mode: 'percent_max',
    value: 25,  // 1.25倍 → 25%上昇
    isDuplicate: true,  // 同種効果重複
    source: 'strategy',
    note: '30秒間、範囲：超特大、発動中の計略を解除しない',
    isActive: true
  },
  
  // 攻撃速度バフ
  {
    id: 'strategy-buff-002',
    stat: 'attack_speed',
    target: 'range',
    mode: 'percent_max',
    value: 25,
    isDuplicate: true,
    source: 'strategy',
    note: '30秒間、範囲：超特大、発動中の計略を解除しない',
    isActive: true
  },
  
  // 隙短縮バフ
  {
    id: 'strategy-buff-003',
    stat: 'attack_gap',
    target: 'range',
    mode: 'percent_reduction',
    value: 40,
    isDuplicate: true,
    source: 'strategy',
    note: '30秒間、範囲：超特大、発動中の計略を解除しない',
    isActive: true
  }
]
```

各Buffオブジェクトのnoteフィールドには、元の範囲サイズ（超特大）と効果時間（30秒間）が保存されています。これにより、ユーザーはバフの詳細を確認でき、なぜrangeとして扱われているのかを理解できます。

**重要な除外情報**:

括弧内の一部の情報は、バフパズルの文脈では実質的に意味を持ちません。これらは除外するか、noteにのみ保存します。

効果時間（「30秒間」など）は、バフパズルでは「バフが発動している状態」を前提とするため、計算には使用しません。ただし、noteに保存しておくことで、将来的なダメージ計算機能で活用できる可能性があります。

「発動中の計略を解除しない」といった戦闘中の挙動に関する情報も、編成パズルのスコープ外です。これもnoteに保存するだけで十分です。

**特殊ケース：伏兵の射程内バフ**:

伏兵の射程内という表記は、通常の範囲サイズとは異なる特殊な性質を持っています。これは動的バフとして扱う必要がありますが、その理由は一般に想像されるものとは異なります。

伏兵の射程内バフが持つ不確定要素を整理してみましょう。まず、編成依存の要素として、伏兵を召喚するキャラクターを編成に入れるかどうかという選択があります。次に、配置依存の要素として、伏兵をどこに配置するかによって、射程内に入る味方が変わります。さらに、伏兵の種類による要素として、どのキャラクターの伏兵を使うかによって、提供されるバフの内容や伏兵自体の性能が大きく変わります。

ここで重要な実態を理解する必要があります。城プロREにおいて、伏兵は二つの大きなカテゴリに分類されます。一つは支援型伏兵で、これは気の自然増加や気(牛)、気(ノビ)といったフィールドレベルのリソース管理を担当します。もう一つは戦闘型伏兵で、成都城のような高い耐久力と攻撃力を持ち、前線で戦闘を支える役割を果たします。

支援型伏兵の場合、プレイヤーは気管理という編成全体の生命線を守るため、伏兵を死守する陣形を取って戦います。つまり、これらの伏兵は実際には非常に高い生存率を持ち、そのバフも信頼性が高い可能性があります。一方、戦闘型伏兵の場合、伏兵自体が前線で敵と交戦するため、配置位置や戦況によってバフの提供範囲が変動します。

この複雑な実態を踏まえると、伏兵の射程内バフを一律に「信頼性が低い」と扱うのは適切ではありません。しかし、バフパズルの設計思想である「静的な編成分析」という観点からは、伏兵の配置と種類による変動要素が大きすぎるため、動的バフとして扱うのが妥当です。

重要なのは、伏兵バフが動的である理由は生存率の低さではなく、配置の柔軟性と効果の多様性にあるということです。伏兵をどこに配置するか、どの伏兵を使うか、何体配置するかという選択によって、最終的なバフ効果が大きく変わります。この変動性こそが、伏兵バフを動的バフとして扱うべき本質的な理由なのです。

```typescript
// 「伏兵の射程内の城娘の攻撃が120上昇」の例

{
  id: 'ambush-buff-001',
  stat: 'attack',
  target: 'range',  // 範囲バフではあるが...
  mode: 'flat_sum',
  value: 120,
  
  // 動的バフとして扱う
  isDynamic: true,
  dynamicType: 'per_ambush_deployed',
  dynamicCategory: 'formation',  // 編成依存だが配置にも依存
  
  source: 'self_skill',
  note: '伏兵の射程内、配置位置と伏兵の種類に依存',
  
  // 伏兵依存フラグ
  requiresAmbush: true,  // ★新しいフラグ
  
  isActive: true
}
```

**新しいフィールド：requiresAmbush**:

伏兵依存のバフを明示的に識別するため、新しいフラグを導入します。

```typescript
interface Buff {
  // ... 既存のフィールド
  
  requiresAmbush?: boolean;  // 伏兵が配置されている必要があるバフ
}
```

このフラグが付いたバフは、UIで特別なマーキング（例：伏兵アイコン）を表示します。これにより、ユーザーは「このバフは伏兵が配置されている場合に有効」という重要な情報を視覚的に認識できます。

ただし、実際のゲームプレイにおいて、特に気管理を担当する支援型伏兵は高い信頼性を持つという実態も考慮する必要があります。そのため、将来的な拡張として、ユーザーが手動編集で伏兵バフの確信度を調整できるようにすることも検討できます。これにより、「この伏兵バフは死守するので信頼性が高い」とユーザーが判断した場合、バフパズルの主計算に含めることができます。

**バフパズルでの表示方針**:

範囲バフと伏兵バフの表示方法を整理します。通常の範囲バフ（超特大〜大、中〜小）は、バフマトリクスの通常セクションに表示します。ただし、noteに保存された範囲サイズ情報を視覚的に区別できるようにします。例えば、超特大は濃い色のバッジ、大は薄い色のバッジ、中は点線のバッジといった形で、範囲の信頼性を視覚化します。

一方、伏兵の射程内バフは、動的バフセクション（参考情報）に表示します。これは、ドレッドノートの伏兵バフと同じ扱いです。伏兵マーク（⚡や🔰などのアイコン）を付けることで、「このバフは伏兵依存です」という情報を明示します。

ただし、UIには「このバフを主計算に含める」といったオプションを用意することも検討できます。これにより、ユーザーが「この伏兵は死守するので信頼できる」と判断した場合、柔軟に対応できます。デフォルトでは動的バフとして扱いつつ、ユーザーの戦略に応じて調整可能という設計です。

この設計により、ツールは実態の複雑さを認識しつつ、デフォルトでは保守的な判断を提供し、必要に応じてユーザーがカスタマイズできるという柔軟性を持ちます。計略範囲バフは信頼できる情報として編成パズルに組み込み、伏兵バフはユーザーの戦略に応じて扱いを調整できる、という実用的な使い分けが可能になります。

**実装のポイント**:

パーサー実装時の注意点をまとめます。括弧内の情報抽出では、複数の情報が含まれる場合があります。例えば「(同種効果重複)(範囲：超特大、発動中の計略を解除しない)」のように、複数の括弧が連続したり、カンマで区切られたりします。正規表現で丁寧に分割し、それぞれの情報を適切に処理する必要があります。

範囲サイズが明示されていない計略もあります。その場合は、デフォルトでrangeとして扱うか、確信度を下げて処理します。パーサーは推測結果にconfidence: 'inferred'フラグを付け、ユーザーに確認を促します。

伏兵の射程内という表記は、「伏兵」というキーワードで検出できます。ただし、「伏兵を配置」といった召喚効果と区別する必要があります。文脈から「伏兵の射程内」というバフ範囲の指定だと判断できた場合のみ、requiresAmbushフラグを付けます。

**完全な検出パターン**:

計略範囲を検出する正規表現パターンを定義します。

```typescript
const STRATEGY_RANGE_PATTERNS = [
  {
    pattern: /範囲[：:]\s*(超特大|特大|大|中|小)/,
    extract: (match) => match[1],
    type: 'size'
  },
  {
    pattern: /伏兵の射程内/,
    extract: () => '伏兵の射程内',
    type: 'ambush_range',
    requiresAmbush: true
  },
  {
    pattern: /範囲内の(?:殿と)?城娘/,
    extract: () => 'default',
    type: 'default_range'
  }
];
```

これらのパターンを優先度順にチェックし、最初にマッチしたものを採用します。範囲サイズが検出できた場合は、変換テーブルに従ってtargetを決定します。伏兵の射程内が検出された場合は、isDynamic: trueとrequiresAmbush: trueを設定します。どちらも検出できなかった場合は、「範囲内の城娘」という一般的な表記からrangeと推測しますが、confidence: 'inferred'フラグを付けます。

このパターンは、計略バフの実態を反映しつつ、シンプルさを保った設計になっています。noteフィールドに詳細情報を保存することで、システムの複雑さを抑えながらも、必要な情報は失わない、という実用的なバランスを実現しています。

---

## 🔧 手動編集機能の必要性

パーサーがどれだけ優秀でも、城プロREのテキストの複雑さと多様性を考えると、100%完璧な解析は不可能です。むしろ、パーサーは80-90%の精度を目指し、残りは人間が修正できる仕組みを作る方が現実的です。

### 修正が必要になるケース

パーサーの解析結果を手動で修正する必要があるケースは、大きく3つのカテゴリに分類できます。

**ケース1: 主語の省略と文脈判断**

城プロREのテキストでは、主語が省略されることが頻繁にあります。例えば、「最大化時、射程内敵1体毎に防御が12%ずつ上昇(効果重複)」という文では、「防御が」の主語が明示されていません。パーサーは文脈から「自身の防御」と推測しますが、実際には「射程内の城娘の防御」だった、というケースが起こり得ます。

このような場合、パーサーは推測結果に確信度フラグを付けることができます。そして、ユーザーは実際のゲームでの動作を確認し、必要に応じて修正します。

**ケース2: 複雑な条件の解釈**

一部のキャラクター（特に伏兵を召喚するキャラ）の特技は、対象が暗黙的な複雑な構造を持ちます。例えば、「飛行敵以外に狙われず攻撃しない伏兵(1体)。時間経過で射程が徐々に上昇(上限200)。気の自然増加量を大きく増加(重複時効果減少)。射程内敵の撃破気1増加(重複なし)」というテキストでは、どの効果が伏兵に適用され、どの効果がフィールド全体に適用されるのかを判断するのが困難です。

パーサーはヒューリスティックなルールで推測しますが、誤る可能性があります。ユーザーが手動で修正できることで、正確なデータを維持できます。

**ケース3: 新しいパターンの出現**

城プロREは継続的にアップデートされ、新しいキャラクターが追加されます。新しいキャラクターは、これまで見たことのないパターンのバフを持っている可能性があります。パーサーがこのような新パターンに対応していない場合、ユーザーが手動で入力する必要があります。

手動で修正されたデータは、パーサーの改善に役立てることができます。ユーザーの修正履歴を分析することで、パーサーが苦手とするパターンを特定し、将来のアップデートで対応できます。

### UI設計の方針

手動編集機能のUIは、直感的で使いやすいものである必要があります。旧ツールで「登録・編集専門の画面」を用意されていたというのは、まさにこの問題への実践的な解決策です。

新しいツールでも、同様のアプローチを採用すべきでしょう。具体的には、キャラクター編集画面で、パーサーが生成したBuffオブジェクトの各フィールドを、GUIで編集できるようにします。

編集画面のイメージとしては、以下のような要素が含まれます。まず、特技や計略のテキストを表示し、そこから生成されたバフのリストを表示します。各バフは、展開可能なカード形式で表示され、クリックすると詳細が表示されます。

詳細画面では、statをドロップダウンメニューで選択できます。targetも同様にドロップダウンで選択できます。valueは数値入力フィールドで編集できます。modeもドロップダウンで選択できます。conditionTagsはチェックボックスで選択できます。

さらに、「バフを追加」ボタンを用意し、パーサーが検出できなかったバフを手動で追加できるようにします。逆に、「バフを削除」ボタンで、誤って検出されたバフを削除できます。

### 確信度フラグの活用

パーサーが推測した結果には、確信度フラグを付けることができます。これにより、ユーザーは「このバフは推測なので確認が必要」ということを認識できます。

```typescript
interface Buff {
  // ... 既存のフィールド
  
  confidence?: 'certain' | 'inferred' | 'uncertain';  // 確信度
  inferenceReason?: string;  // 推測の理由
}
```

UI上では、確信度が低いバフには警告アイコンを表示します。例えば、⚠️マークが付いたバフは、ユーザーに確認を促します。ユーザーが確認して正しいと判断した場合、確信度を「certain」に変更できます。逆に、誤りを発見した場合は修正します。

このシステムにより、パーサーの限界を認めつつ、ユーザーとの協力で高品質なデータを維持できます。完璧なパーサーを目指すのではなく、人間との協働を前提とした実用的なツール設計が重要です。

---

## 🆕 発見された追加パターン（v1.1で追加）

実際のキャラクターデータを調査した結果、v1.0では未カバーだった重要なパターンが発見されました。これらは反復的な改善の一環として追加されます。

### パターン1: 特技の発動条件マーカー

【配置】や【水上】のような、特技の発動条件を示すマーカーが存在します。

```typescript
// 例: 【配置】敵撃破毎に自身の攻撃5%と70上昇(効果重複)
// 例: 【水上】自身の巨大化気を半減
```

**処理方法**: 
- 【配置】: 条件タグとして扱わず、デフォルトで適用される特技として扱う
- 【水上】: ConditionTag 'on_water' として扱い、備考として表示

### パターン2: 発動トリガー付きバフ

「敵撃破毎に」のような、発動トリガーが明記されているバフです。

```typescript
// 例: 敵撃破毎に自身の攻撃5%と70上昇(効果重複、20回まで)
```

**処理方法**:
- 編成パズルでは、最大スタック時の値を表示
- 「20回まで」→ 攻撃 5% × 20 = 100%、固定値 70 × 20 = 1400
- 新しいフィールド `stackable` と `maxStacks` を追加

### パターン3: 明示されない鼓舞

【鼓舞】マーカーがなくても、鼓舞として扱うべきパターンが存在します。

```typescript
// 例: 自身を除く射程内城娘に自身の攻撃の30%の値を加算
// → これは鼓舞
```

**検出パターン**:
```typescript
/自身の(攻撃|防御|射程)(?:の|が)(\d+)%(?:の値)?を(.+?)(?:に|へ)加算/
```

### パターン4: 除外条件（「自身を除く」）

範囲指定に「自身を除く」という除外条件が付く場合があります。

```typescript
// 例: 自身を除く射程内城娘
```

**処理方法**:
- target に新しいModifier 'exclude_self' を追加
- または、conditionTag 'exclude_self' として扱う

### パターン5: 直撃ボーナス

直撃ボーナスは特殊な表記があります。

```typescript
// パターンA: 上限固定
"直撃ボーナスが300%に上昇" → 最終的な値が300%になる

// パターンB: 加算
"直撃ボーナスが50%上昇" → 現在値に50%加算
```

**新しいStat**: `critical_bonus`

**新しいMode**: `absolute_set` （上限固定の場合）

### パターン6: 自己適用時の倍率

全体バフだが、自身に対してだけ倍率が異なる場合があります。

```typescript
// 例: 全城娘の攻撃が50上昇。自身に対しては効果1.5倍。
```

**処理方法**: 2つの別々のバフとして生成
- バフA: target='all'、value=50、conditionTags=['exclude_self']
- バフB: target='self'、value=75（50 × 1.5）

### パターン7: 「攻撃が○倍のダメージを与える」

これは「与えるダメージ」と同じ計算式ですが、表記が異なります。

```typescript
// 例: 武器攻撃が標的とその周囲に1.5倍のダメージを与える
// → stat: 'give_damage', value: 50 (1.5倍 → 50%)
```

**検出パターン**:
```typescript
/(\d+(?:\.\d+)?)倍のダメージを与える/
```

### パターン8: 「同種効果と重複」

**重要**: これは「効果重複」の別表記です。意味は同じです。

```typescript
// 例: 攻撃と防御1.2倍(同種効果と重複)
// → これは「効果重複」と同じ意味
```

**表記のバリエーション**:
- 「効果重複」
- 「重複可」
- 「重複可能」
- 「同種効果と重複」← これも同じ意味

**処理方法**: 全て`isDuplicate: true`として扱います。新しいフラグは不要です。

### パターン9: 効果の上限回数

バフが重複する最大回数が明記されている場合があります。

```typescript
// 例: 攻撃5%上昇(効果重複、20回まで)
```

**新しいフィールド**:
```typescript
interface Buff {
  // ... 既存のフィールド
  maxStacks?: number;  // 最大スタック回数
  stackable?: boolean;  // スタック可能かどうか
}
```

### パターン10: HP/耐久依存条件

**重要**: 「HP」と「耐久」は同じ意味です。城プロREでは城娘の体力を「耐久」と呼びます。

条件が「HPが高いほど」「耐久が高いほど」のように、数値に依存する場合があります。これらは表記が異なるだけで、同じ条件として扱います。

```typescript
// 例1: 対象の耐久が高い程与えるダメージ上昇(最大2倍)
// 例2: HPが高い程攻撃上昇(最大1.5倍)
// → どちらも同じConditionTag: 'hp_dependent'
```

**新しいConditionTag**:
- `hp_dependent`: HP/耐久依存（数値が高いほど効果大）

**注意**: これは既存の`hp_above_50`などとは異なります。`hp_above_50`は「50%以上か未満か」という二値判定ですが、`hp_dependent`は「高ければ高いほど効果が大きい」という連続的な条件です。

**処理方法**: 最大値を記録し、備考として詳細を保持します。

```typescript
{
  stat: 'give_damage',
  target: 'self',
  mode: 'percent_max',
  value: 100,  // 最大2倍 → 100%
  conditionTags: ['hp_dependent'],
  note: 'HP/耐久が高いほど効果大（最大2倍）',
  source: 'strategy'
}
```

### パターン11: 爆風範囲・爆風ダメージ

ダメージ計算では無視してよいが、存在は認識すべきパターンです。

```typescript
// 例: 爆風範囲と爆風ダメージ2倍
```

**処理方法**: 備考（note）として記録し、パースはスキップ

---

## 🔄 バージョン履歴

### v1.2 (2025-12-06) - 高度なパターンと複雑なルール
- 13個の新しいパターンを発見・文書化
- **気（フィールドコスト）の概念を正しく理解** - 最も重要な修正
  - 気は個別のキャラクターではなく、編成全体で共有されるフィールドリソース
  - 全ての気バフは `target: 'field'` として表現
  - 伏兵と気の関係を明確化
  - バフパズルでの気の表示方法を設計
- **動的バフの概念を導入** - パターン21
  - 編成依存 vs 戦闘状況依存の分類
  - バフパズルでは別枠表記し、パズルから除外
  - ダメージ計算ではシナリオ管理機能で対応
  - ドレッドノートを具体例として詳細に文書化
- **手動編集機能の必要性を明確化**
  - パーサーは80-90%の精度を目指し、残りは人間が修正
  - 確信度フラグの導入
  - UI設計の方針を策定
- **条件による値の分岐（直接指定）** - パターン22
  - 「40%、近接城娘は50%」のような直接値指定パターン
  - 基本値と条件付き値を別Buffとして生成
  - 適用時に条件を満たす最大値を選択
- **武器種別条件の設計決定**
  - 近接・遠隔はConditionTagで処理（targetのModifierではない）
  - 属性条件と同じレベルの扱い（優先度6：中程度）
  - 責務の分離: targetは範囲、ConditionTagは絞り込み
- **計略範囲バフ** - パターン23
  - 範囲サイズ（超特大〜小）によるtarget分類ルール
  - 超特大〜大は`range`、中〜小は`ally`
  - noteフィールドに詳細情報を保存してシンプルさを維持
  - 伏兵の射程内バフの特殊扱い
  - 伏兵バフが動的である理由の正確な理解（配置の柔軟性と効果の多様性）
  - 気管理のための死守戦略という実態を反映
  - 新フィールド: `requiresAmbush`
- **季節属性タグの拡張**
  - 花嫁（bride）を追加
- 新しいターゲット `'field'` を追加
- 射程内と射程外で効果が異なるバフ（甲府城）
- 編成特技の除外方針を明確化
- ノックバックの4段階（少し、通常、大きく、劇的に）
- 徐々に気が増加する系の複雑なルール（文脈依存）
- 自然増加量の「増加」vs「大きく増加」
- (重複時効果減少) - スタックペナルティの概念
- (重複なし) - 最大値のみ適用のルール
- 対象が暗黙的な複雑な文章構造
- 型定義の拡張: `stackPenalty`, `nonStacking`, `priority`, `out_of_range`, `field`, `isDynamic`, `dynamicType`, `confidence`, `requiresAmbush`

### v1.1 (2025-12-06) - 追加パターン対応
- 11個の新しいパターンを発見・文書化
- 特技発動条件マーカー（【配置】【水上】）
- 発動トリガー付きバフ（「敵撃破毎に」）
- 明示されない鼓舞の検出
- 除外条件（「自身を除く」）
- 直撃ボーナスの特殊な表記
- 自己適用時の倍率
- 「攻撃が○倍のダメージを与える」パターン
- 「同種効果と重複」が「効果重複」の別表記であることを確認
- 効果の上限回数
- HP/耐久が同じ意味であることを確認
- 爆風範囲・爆風ダメージ

### v1.0 (2025-12-06)
- 初版作成
- 基本ルール、特殊処理、具体例の分析を完全に文書化
- 5つの重要な設計決定を実施
- テストケースを豊富に記載

---

## 📚 関連ドキュメント

- `TYPE_CONVERSION_MAPPING.md` - 型変換の完全仕様
- `TARGET_NORMALIZATION.md` - Target正規化ルール
- `CONDITION_TAG_SPEC.md` - ConditionTag仕様
- `ARCHITECTURE.md` - プロジェクト全体の設計書
- `src/core/parser/buffParser.ts` - パーサーの実装（これから作成）
- `src/core/parser/patterns.ts` - 正規表現パターン定義（これから作成）

---

## 🎯 重要な設計決定のまとめ

### 設計決定1: 「全ての敵」と「巨大化する度に」の関係

**決定内容**: 新しい範囲指定が出現しても、明示的な分節（「。」）または新しい接頭辞が出現するまで、接頭辞の影響は継続する。

**理由**: 城プロの文法では、範囲の変更は接頭辞のスコープをリセットしない。同じ文の中であれば、同じ接頭辞の影響下にあると解釈するのが自然。

**実装への影響**: giantMultiplierScopeのような設定フラグを用意し、将来的に解釈を切り替えられるようにする。

### 設計決定2: 「同種効果の重複無し」のフラグ表現

**決定内容**: 新しいフラグ`isExplicitlyNonDuplicate`を追加する。

**理由**: 「明示的に重複無し」という情報は、将来的に役立つ可能性がある。UIで注意書きを表示できる。デフォルトと区別できる。

**実装への影響**: Buff型に`isExplicitlyNonDuplicate?: boolean`を追加。

### 設計決定3: 条件付きバフの表現方法

**決定内容**: 別々のバフとして生成する（方法A）。

**理由**: 型定義がシンプル。バフの適用判定ロジックが明確。将来的にON/OFF制御が容易。

**実装への影響**: 「基本バフ」と「条件付きバフ」の2つのBuffを生成。実際の適用時は、キャラクターの状態に応じてどちらか一方が適用される。

### 設計決定4: 継続回復・継続ダメージの扱い

**決定内容**: 備考フィールドに記録し、パースはスキップ。

**理由**: 編成パズルやダメージ計算では扱えない時間経過効果。無視すると情報が失われる。将来的に拡張する可能性を残す。

**実装への影響**: Buff型に`note?: string`フィールドを追加。継続効果は特別なオブジェクト（type: 'note'）として記録。

### 設計決定5: 特技効果の倍率の扱い

**決定内容**: 計略の特殊効果として別途管理。Strategy型にspecialEffectsフィールドを追加（将来の拡張）。

**理由**: これはバフではなく、既存のバフへの倍率効果。Buff型では表現できない。計略専用の拡張が必要。

**実装への影響**: 現時点では実装しない。将来的にStrategy型とSpecialEffect型を定義し、特技効果の倍率や継続回復を管理できるようにする。

---

## 🙏 最後に

このPARSING_RULES.mdは、城プロREのテキストパースという難問を解決するための、完全なガイドラインです。実装時には、このドキュメントを参照しながら、一つ一つのルールを確実に実装してください。

また、新しいエッジケースが見つかった場合は、このドキュメントを更新し、知見を蓄積していってください。

頑張ってください！

---

**Document Version**: 1.0  
**Created**: 2025-12-06  
**Status**: 仕様確定 ✅
