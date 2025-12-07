# ShiroPro Tools (Reborn) - ConditionTag仕様書

**Version**: 1.1  
**Status**: 仕様更新  
**Last Updated**: 2025-12-06

**変更履歴 (v1.1)**:
- 武器種条件（melee, ranged, physical, magical）の優先度を HIGH (10) から MEDIUM (6) に変更
- 理由: 属性条件と同じレベルの絞り込み条件として扱うため
- 季節属性タグに 'bride'（花嫁）を追加
- PARSING_RULES.md v1.2 のパターン22と連携した設計決定

---

## 📋 目的

バフの適用条件を表すConditionTagの完全な定義です。targetが「誰に効くか」を表すのに対し、ConditionTagは「どんな状況で効くか」「どんなキャラに効くか」という細かい条件を管理します。

この仕様書は、以下の目的で使用されます。

まず、編成パズルでの条件の可視化です。8人編成の中で、どのバフがどの条件下で発動するのかを明確に表示する必要があります。しかし、全ての条件を同じ重みで表示すると、UIが煩雑になってしまいます。そのため、条件に優先順位を付け、重要な条件は目立たせ、細かい条件は備考として控えめに表示するという戦略を取ります。

次に、バフ適用判定ロジックの設計です。実際のダメージ計算時に、各ConditionTagをチェックして、そのバフが適用されるかを判定する必要があります。そのため、各タグの意味と判定方法を明確に定義します。

そして、パーサーの実装ガイドです。城プロWikiのテキストからConditionTagを正確に抽出するためのルールを定義します。特に、除外すべき条件（計略中、特技発動中など）を明確にします。

最後に、テストケースの作成基準です。各ConditionTagが正しく検出され、適切に判定されることを保証するためのテストパターンを提供します。

---

## 🎯 設計思想

### 1. 編成パズル主軸の条件設計

城プロREの編成パズルにおいて、最も重要なのは「このバフは何人に効くのか」という可視化です。そのため、ConditionTagは以下の原則に基づいて設計されています。

#### 原則A: 条件の影響範囲による優先順位付け

条件は、編成全体への影響度によって3つのレベルに分類されます。この分類は、UI表示の重要度と直結します。

**高優先度条件（編成パズルに直接影響）**は、編成メンバーの多くが満たす可能性がある条件です。例えば、武器種条件（近接のみ、遠隔のみ）やHP条件（HP50%以下）などがこれに該当します。これらの条件は、編成パズルのUI上で目立つ形で表示する必要があります。なぜなら、これらの条件を満たすキャラが多ければ多いほど、そのバフの価値が高まるからです。

**中優先度条件（特定編成で重要）**は、特定の編成戦略で意味を持つ条件です。例えば、属性条件（水属性のみ、平山属性のみ）がこれに該当します。これらは、8人全員に効くわけではありませんが、属性を統一した編成を組む場合には非常に重要になります。UI上では、通常の表示よりは控えめですが、無視できない情報として扱います。

**低優先度条件（備考として扱う）**は、ゲームシステム上は条件だが、実際の編成パズルでは常に満たされているか、あるいは無視できる条件です。例えば、「巨大化時」「計略発動中」「特技発動中」などがこれに該当します。これらは、UI上では「備考」として小さく表示するか、あるいは完全に省略します。

#### 原則B: 除外すべき条件の明確化

城プロREの編成パズルでは、最大化（巨大化5段階目）を基本状態として考えます。また、バフの効果を考える際は、そのバフが発動している前提で考えます。そのため、以下の条件は実質的に意味を持たないため、パース時に除外します。

「計略発動中」「計略中」という条件は、計略バフを考える際には当然満たされているので、わざわざ条件として記録する必要がありません。同様に、「特技発動中」「特技中」も、特技バフを考える際には常に満たされています。

「巨大化時」という条件も、最大化を基本とするため、実質的には常に満たされていると考えられます。ただし、「巨大化3段階以上」のような段階的な条件は、最大化でも意味を持つ可能性があるため、除外しません。

「効果時間○秒」のような時間情報も、編成パズルでは関係ないため除外します。編成パズルが扱うのは、バフが発動している状態での最終的な数値だからです。

#### 原則C: 属性と対象種別の条件化

TARGET_NORMALIZATION.mdで定義した通り、属性（水、平、山、平山、地獄）と対象種別（伏兵、殿）は、targetのModifiersではなく、ConditionTagとして管理します。

これには明確な理由があります。編成パズルのUIにおいて、targetは「範囲」を視覚的に表現する重要な要素です。一方、属性や対象種別は「その範囲の中で、さらに誰に効くか」を絞り込む条件です。この責務の違いを明確にすることで、UIの設計がシンプルになり、将来的な拡張も容易になります。

例えば、「射程内の水属性の城娘の攻撃が30%上昇」というバフは、以下のように表現されます。

```typescript
{
  target: 'range',           // 射程内という「範囲」
  conditionTags: ['water'],  // 水属性という「条件」
  stat: 'attack',
  mode: 'percent_max',
  value: 30
}
```

このように、targetとconditionTagsを分離することで、「射程内の誰かに効く」という情報と「水属性に限定される」という情報が、それぞれ独立して管理されます。

---

## 📊 ConditionTag型定義

### 完全な型定義

城プロREで実際に使用される全ての条件を網羅した型定義です。各タグには、その意味と優先度が明確に定義されています。

```typescript
/**
 * バフの適用条件を表すタグ
 * 
 * 優先度レベル:
 * - HIGH: 編成パズルに直接影響する重要な条件
 * - MEDIUM: 特定編成で意味を持つ条件
 * - LOW: 備考として扱う条件（または除外される条件）
 */
type ConditionTag = 
  // ========================================
  // 武器種条件（優先度: MEDIUM）
  // ========================================
  | 'melee'              // 近接武器のみ（刀、槍、盾、ランス、双剣、拳）
  | 'ranged'             // 遠隔武器のみ（弓、鉄砲、石弓、法術、歌舞等）
  | 'physical'           // 物理攻撃のみ（刀、槍、弓、鉄砲等）
  | 'magical'            // 法術攻撃のみ（法術、歌舞等）
  
  // ========================================
  // HP条件（優先度: HIGH）
  // ========================================
  | 'hp_above_50'        // HP50%以上
  | 'hp_below_50'        // HP50%以下
  | 'hp_above_70'        // HP70%以上
  | 'hp_below_30'        // HP30%以下
  | 'hp_full'            // HP100%（満タン）
  
  // ========================================
  // 巨大化段階条件（優先度: MEDIUM）
  // ========================================
  | 'giant_1_plus'       // 巨大化1段階以上
  | 'giant_2_plus'       // 巨大化2段階以上
  | 'giant_3_plus'       // 巨大化3段階以上
  | 'giant_4_plus'       // 巨大化4段階以上
  | 'giant_5'            // 巨大化5段階（最大化）
  
  // ========================================
  // 属性条件（優先度: MEDIUM）
  // ========================================
  | 'water'              // 水属性の城娘
  | 'plain'              // 平属性の城娘
  | 'mountain'           // 山属性の城娘
  | 'plain_mountain'     // 平山属性の城娘
  | 'hell'               // 地獄属性の城娘
  
  // ========================================
  // 季節属性条件（優先度: MEDIUM）
  // ========================================
  | 'summer'             // 夏属性
  | 'kenran'             // 絢爛属性
  | 'halloween'          // ハロウィン属性
  | 'school'             // 学園属性
  | 'christmas'          // 聖夜属性
  | 'new_year'           // 正月属性
  | 'moon_viewing'       // お月見属性
  | 'bride'              // 花嫁属性
  
  // ========================================
  // 対象種別条件（優先度: MEDIUM）
  // ========================================
  | 'castle_girl'        // 城娘（通常のキャラクター）
  | 'ambush'             // 伏兵（召喚ユニット）
  | 'lord'               // 殿（プレイヤー）
  
  // ========================================
  // 敵種別条件（優先度: MEDIUM）
  // ========================================
  | 'flying_enemy'       // 飛行敵
  | 'ground_enemy'       // 地上敵
  | 'boss_enemy'         // ボス敵
  
  // ========================================
  // 特殊条件（優先度: LOW〜MEDIUM）
  // ========================================
  | 'same_weapon'        // 同じ武器種のみ
  | 'different_weapon'   // 異なる武器種のみ
  | 'night_battle'       // 夜戦
  | 'continuous_deploy'  // 連続配置時
  
  // ========================================
  // 除外される条件（パース時に無視）
  // ========================================
  // 'strategy_active'   // 計略中 → 前提なので記録しない
  // 'skill_active'      // 特技中 → 前提なので記録しない
  // 'giant'             // 巨大化時 → 最大化前提なので記録しない
```

### 優先度の詳細定義

各ConditionTagには優先度が設定されています。この優先度は、UI表示とバフ適用判定の両方に影響します。

```typescript
/**
 * ConditionTagの優先度定義
 * 
 * この優先度は以下の用途で使用されます:
 * 1. UI表示: 高優先度の条件は目立つ形で表示
 * 2. バフソート: 条件が少なく、優先度が高いバフを上位に表示
 * 3. 編成推奨: 高優先度の条件を満たすキャラ編成を推奨
 */
const CONDITION_PRIORITY = {
  // 高優先度: 編成パズルに直接影響
  'hp_above_50': 9,
  'hp_below_50': 9,
  'hp_above_70': 8,
  'hp_below_30': 8,
  'hp_full': 7,
  
  // 中優先度: 特定編成で重要
  'melee': 6,           // ★ 武器種条件を中優先度に変更
  'ranged': 6,          // ★ 武器種条件を中優先度に変更
  'physical': 6,        // ★ 武器種条件を中優先度に変更
  'magical': 6,         // ★ 武器種条件を中優先度に変更
  'water': 6,
  'plain': 6,
  'mountain': 6,
  'plain_mountain': 6,
  'hell': 6,
  'summer': 6,
  'kenran': 6,
  'halloween': 6,
  'school': 6,
  'christmas': 6,
  'new_year': 6,
  'moon_viewing': 6,
  'bride': 6,           // ★ 花嫁を追加
  'giant_3_plus': 5,
  'giant_4_plus': 5,
  'giant_5': 5,
  'ambush': 5,
  'lord': 5,
  'flying_enemy': 5,
  'ground_enemy': 5,
  'boss_enemy': 5,
  
  // 低優先度: 備考的な条件
  'same_weapon': 3,
  'different_weapon': 3,
  'night_battle': 2,
  'continuous_deploy': 2,
  'giant_1_plus': 1,
  'giant_2_plus': 1,
  'castle_girl': 1  // 城娘はデフォルトなので低優先度
} as const;
```

この優先度定義には、城プロREのゲームデザインに関する深い理解が反映されています。例えば、武器種条件が最高優先度なのは、編成の半数程度が満たす可能性があり、編成パズルにおいて非常に重要な情報だからです。一方、「城娘」という条件は、ほとんどのバフが城娘に効くため、わざわざ強調する必要がありません。

---

## 🔍 パース時の検出ルール

城プロWikiのテキストからConditionTagを抽出する際のルールです。旧バフパーサーの`conditionPatterns`を基に、Reborn版の設計思想を反映させています。

### 除外すべきキーワード

以下のキーワードが検出された場合、ConditionTagとして記録しません。これらは前提条件であり、わざわざ記録する意味がないためです。

```typescript
/**
 * パース時に無視すべき条件パターン
 * 
 * これらのパターンが検出されても、ConditionTagには含めません。
 * 理由: 編成パズルでは前提条件として扱うため
 */
const EXCLUDED_CONDITION_PATTERNS = [
  // 計略・特技の発動状態（発動している前提）
  /計略(?:発動)?中/,
  /計略(?:使用)?時/,
  /特技(?:発動)?中/,
  /特技(?:使用)?時/,
  
  // 巨大化の基本状態（最大化を前提とする）
  /巨大化時/,
  /巨大化(?:する)?(?:と|すると)/,
  
  // 効果時間（編成パズルでは無関係）
  /効果時間[：:]\s*\d+秒/,
  /\d+秒間/,
  
  // 効果重複（別フラグで管理）
  /効果重複/,
  /重複可(?:能)?/,
  
  // ゲージ関連（詳細すぎる）
  /ゲージ蓄積/,
  /最大ストック/,
  
  // その他の詳細情報
  /時間経過で/,
  /徐々に/
];
```

これらのパターンを除外する理由を、もう少し詳しく説明します。

計略中や特技中という条件は、そのバフが発動している状態を考える際には当然満たされています。例えば、「計略中、攻撃が50%上昇」というバフを考える際、「計略中」という条件は自明です。計略が発動していなければ、そもそもこのバフ自体が存在しないからです。そのため、この条件を記録しても意味がありません。

巨大化時という条件も同様です。編成パズルでは、全てのキャラが最大化（巨大化5段階目）している状態を基本とします。そのため、「巨大化時」という条件は常に満たされており、わざわざ記録する必要がありません。ただし、「巨大化3段階以上」のような段階的な条件は、最大化でも意味を持ちます。なぜなら、「巨大化3段階以上」という条件は、「巨大化3、4、5段階目で効果が発動する」という意味であり、段階ごとの違いを表現しているからです。

### 検出すべきパターン

以下のパターンが検出された場合、対応するConditionTagを生成します。各パターンには、検出の優先順位と、複数マッチした場合の処理方法が定義されています。

```typescript
/**
 * ConditionTag検出パターン
 * 
 * 各パターンは以下の情報を持ちます:
 * - pattern: 検出する正規表現
 * - tags: マッチした場合に生成するConditionTag（配列）
 * - priority: 検出優先度（高いほど先に判定）
 * - exclusive: 同カテゴリ内で排他的か（trueの場合、1つだけ選択）
 */
const CONDITION_DETECTION_PATTERNS = [
  // ========================================
  // 武器種条件（優先度: 高）
  // ========================================
  {
    pattern: /近接(?:武器)?(?:のみ|限定)?/i,
    tags: ['melee'],
    priority: 100,
    exclusive: true,
    category: 'weapon_range'
  },
  {
    pattern: /遠隔(?:武器)?(?:のみ|限定)?/i,
    tags: ['ranged'],
    priority: 100,
    exclusive: true,
    category: 'weapon_range'
  },
  {
    pattern: /物理(?:攻撃)?(?:のみ|限定)?/i,
    tags: ['physical'],
    priority: 95,
    exclusive: true,
    category: 'attack_type'
  },
  {
    pattern: /(?:法術|術)(?:攻撃)?(?:のみ|限定)?/i,
    tags: ['magical'],
    priority: 95,
    exclusive: true,
    category: 'attack_type'
  },
  
  // ========================================
  // HP条件（優先度: 高）
  // ========================================
  {
    pattern: /(?:HP|耐久|体力)(?:が)?50[％%]以上/i,
    tags: ['hp_above_50'],
    priority: 90,
    exclusive: true,
    category: 'hp_condition'
  },
  {
    pattern: /(?:HP|耐久|体力)(?:が)?50[％%]以下/i,
    tags: ['hp_below_50'],
    priority: 90,
    exclusive: true,
    category: 'hp_condition'
  },
  {
    pattern: /(?:HP|耐久|体力)(?:が)?70[％%]以上/i,
    tags: ['hp_above_70'],
    priority: 90,
    exclusive: true,
    category: 'hp_condition'
  },
  {
    pattern: /(?:HP|耐久|体力)(?:が)?30[％%]以下/i,
    tags: ['hp_below_30'],
    priority: 90,
    exclusive: true,
    category: 'hp_condition'
  },
  {
    pattern: /(?:HP|耐久|体力)(?:が)?(?:満タン|100[％%]|最大)/i,
    tags: ['hp_full'],
    priority: 90,
    exclusive: true,
    category: 'hp_condition'
  },
  
  // ========================================
  // 巨大化段階条件（優先度: 中）
  // ========================================
  {
    pattern: /巨大化(?:が)?5(?:段階|回)?(?:以上)?/i,
    tags: ['giant_5'],
    priority: 70,
    exclusive: true,
    category: 'giant_level'
  },
  {
    pattern: /巨大化(?:が)?4(?:段階|回)?以上/i,
    tags: ['giant_4_plus'],
    priority: 70,
    exclusive: true,
    category: 'giant_level'
  },
  {
    pattern: /巨大化(?:が)?3(?:段階|回)?以上/i,
    tags: ['giant_3_plus'],
    priority: 70,
    exclusive: true,
    category: 'giant_level'
  },
  {
    pattern: /巨大化(?:が)?2(?:段階|回)?以上/i,
    tags: ['giant_2_plus'],
    priority: 70,
    exclusive: true,
    category: 'giant_level'
  },
  {
    pattern: /巨大化(?:が)?1(?:段階|回)?以上/i,
    tags: ['giant_1_plus'],
    priority: 70,
    exclusive: true,
    category: 'giant_level'
  },
  
  // ========================================
  // 属性条件（優先度: 中）
  // ========================================
  {
    pattern: /水(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['water'],
    priority: 80,
    exclusive: false, // 複数属性を持つキャラもいる
    category: 'attribute'
  },
  {
    pattern: /平(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['plain'],
    priority: 80,
    exclusive: false,
    category: 'attribute'
  },
  {
    pattern: /山(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['mountain'],
    priority: 80,
    exclusive: false,
    category: 'attribute'
  },
  {
    pattern: /平山(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['plain_mountain'],
    priority: 85, // 複合属性は優先度を少し上げる
    exclusive: false,
    category: 'attribute'
  },
  {
    pattern: /地獄(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['hell'],
    priority: 80,
    exclusive: false,
    category: 'attribute'
  },
  
  // ========================================
  // 季節属性条件（優先度: 中）
  // ========================================
  {
    pattern: /夏(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['summer'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /絢爛(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['kenran'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /ハロウィン(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['halloween'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /学園(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['school'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /聖夜(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['christmas'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /正月(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['new_year'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  {
    pattern: /お月見(?:属性)?(?:城娘)?(?:のみ|限定)?/i,
    tags: ['moon_viewing'],
    priority: 80,
    exclusive: false,
    category: 'season'
  },
  
  // ========================================
  // 対象種別条件（優先度: 中）
  // ========================================
  {
    pattern: /伏兵(?:のみ|限定)?/i,
    tags: ['ambush'],
    priority: 75,
    exclusive: false,
    category: 'target_type'
  },
  {
    pattern: /殿(?:のみ|限定)?/i,
    tags: ['lord'],
    priority: 75,
    exclusive: false,
    category: 'target_type'
  },
  
  // ========================================
  // 敵種別条件（優先度: 中）
  // ========================================
  {
    pattern: /飛行(?:敵|ユニット)(?:のみ|限定)?/i,
    tags: ['flying_enemy'],
    priority: 75,
    exclusive: false,
    category: 'enemy_type'
  },
  {
    pattern: /地上(?:敵|ユニット)(?:のみ|限定)?/i,
    tags: ['ground_enemy'],
    priority: 75,
    exclusive: false,
    category: 'enemy_type'
  },
  {
    pattern: /ボス(?:敵)?(?:のみ|限定)?/i,
    tags: ['boss_enemy'],
    priority: 75,
    exclusive: false,
    category: 'enemy_type'
  },
  
  // ========================================
  // 特殊条件（優先度: 低〜中）
  // ========================================
  {
    pattern: /同(?:じ)?武器(?:種)?(?:のみ|限定)?/i,
    tags: ['same_weapon'],
    priority: 50,
    exclusive: false,
    category: 'special'
  },
  {
    pattern: /異(?:なる)?武器(?:種)?(?:のみ|限定)?/i,
    tags: ['different_weapon'],
    priority: 50,
    exclusive: false,
    category: 'special'
  },
  {
    pattern: /夜戦/i,
    tags: ['night_battle'],
    priority: 50,
    exclusive: false,
    category: 'special'
  }
];
```

これらの検出パターンは、優先度順にチェックされます。優先度が高いパターンが先にマッチした場合、同じカテゴリ内で排他的（exclusive: true）な条件は、それ以降のパターンをスキップします。

例えば、「近接武器のみ」というパターンがマッチした場合、同じ`weapon_range`カテゴリ内の「遠隔武器のみ」はチェックされません。これは、1つのバフが「近接かつ遠隔」という矛盾した条件を持つことを防ぐためです。

一方、属性条件は排他的ではありません（exclusive: false）。これは、「平山」のように複数の属性を持つキャラクターが存在するためです。「平山の城娘」は「平」と「山」の両方の条件を満たすと解釈できるため、複数の属性タグを同時に持つことを許可します。

### パース時の処理フロー

実際にテキストからConditionTagを抽出する際の処理フローです。この処理は、旧バフパーサーの`extractBuffCondition`関数の動作を基に、Reborn版の設計思想を反映させています。

```typescript
/**
 * テキストからConditionTagを抽出
 * 
 * @param text - 条件を含むテキスト（括弧内の条件や、文脈から検出）
 * @returns 検出されたConditionTagの配列
 * 
 * 処理フロー:
 * 1. 除外パターンのチェック
 * 2. 検出パターンを優先度順に適用
 * 3. 重複排除
 * 4. 優先度順にソート
 */
function extractConditionTags(text: string): ConditionTag[] {
  if (!text) return [];
  
  // ステップ1: 除外パターンをチェック
  // 除外すべき条件が含まれている場合、その部分を削除
  let cleanedText = text;
  for (const excludePattern of EXCLUDED_CONDITION_PATTERNS) {
    cleanedText = cleanedText.replace(excludePattern, '');
  }
  
  // ステップ2: 検出パターンを優先度順に適用
  const detectedTags: ConditionTag[] = [];
  const matchedCategories = new Set<string>();
  
  // 優先度が高い順にソート
  const sortedPatterns = [...CONDITION_DETECTION_PATTERNS]
    .sort((a, b) => b.priority - a.priority);
  
  for (const patternDef of sortedPatterns) {
    // 排他的な条件で、既に同カテゴリがマッチしている場合はスキップ
    if (patternDef.exclusive && matchedCategories.has(patternDef.category)) {
      continue;
    }
    
    if (patternDef.pattern.test(cleanedText)) {
      detectedTags.push(...patternDef.tags);
      if (patternDef.exclusive) {
        matchedCategories.add(patternDef.category);
      }
    }
  }
  
  // ステップ3: 重複排除
  const uniqueTags = Array.from(new Set(detectedTags));
  
  // ステップ4: 優先度順にソート
  uniqueTags.sort((a, b) => {
    const priorityA = CONDITION_PRIORITY[a] || 0;
    const priorityB = CONDITION_PRIORITY[b] || 0;
    return priorityB - priorityA;
  });
  
  return uniqueTags;
}
```

この処理フローには、いくつかの重要な工夫が含まれています。

まず、除外パターンを最初にチェックすることで、無駄な処理を避けています。例えば、「巨大化時、攻撃が50%上昇」というテキストがあった場合、「巨大化時」という部分を削除してから、残りの部分から条件を抽出します。

次に、優先度が高いパターンから順にチェックすることで、より重要な条件を優先的に検出します。例えば、「平山属性の近接武器」というテキストがあった場合、「平山」と「近接」の両方が検出されますが、「近接」の方が優先度が高いため、UIでもより目立つ形で表示されます。

排他的な条件の処理も重要です。例えば、「近接」と「遠隔」は同時に満たすことができないため、どちらか一方だけを検出します。優先度が高い方（または先にマッチした方）が採用されます。

最後に、検出されたタグを優先度順にソートすることで、UI表示やバフ適用判定の際に、重要な条件から順に処理できるようにしています。

---

## 🎨 UI表示での扱い

ConditionTagは、編成パズルのUI上でどのように表示されるべきかを定義します。優先度に応じて、表示方法を変えることで、ユーザーが重要な情報に集中できるようにします。

### 表示レベルの定義

```typescript
/**
 * ConditionTagの表示レベル
 * 
 * UI上での表示方法を3段階に分類します。
 */
type DisplayLevel = 'prominent' | 'normal' | 'subtle';

/**
 * 各ConditionTagの表示レベルを決定
 * 
 * @param tag - 表示レベルを決定するConditionTag
 * @returns 表示レベル
 */
function getDisplayLevel(tag: ConditionTag): DisplayLevel {
  const priority = CONDITION_PRIORITY[tag] || 0;
  
  if (priority >= 8) {
    // 高優先度: 目立つ形で表示（バッジや色付き）
    return 'prominent';
  } else if (priority >= 5) {
    // 中優先度: 通常表示（小さなアイコンや灰色テキスト）
    return 'normal';
  } else {
    // 低優先度: 控えめに表示（備考として小さく、またはツールチップのみ）
    return 'subtle';
  }
}
```

### UI表示例

編成パズルのUIでは、ConditionTagを以下のように表示します。

**Prominent（目立つ表示）** - 優先度8以上の条件

```
┌──────────────────────────┐
│ 🗡️ 近接のみ                │ ← 赤いバッジで強調
│ 射程内/攻撃+30%            │
└──────────────────────────┘
```

武器種条件やHP条件など、編成パズルに直接影響する重要な条件は、目立つ色（赤やオレンジ）のバッジで表示します。これにより、ユーザーは一目で「このバフは近接キャラにしか効かない」という情報を認識できます。

**Normal（通常表示）** - 優先度5〜7の条件

```
┌──────────────────────────┐
│ 射程内/攻撃+30%            │
│ 💧 水属性 ← 小さなアイコン  │
└──────────────────────────┘
```

属性条件や敵種別条件など、特定編成で意味を持つ条件は、小さなアイコンや灰色のテキストで表示します。目立ちすぎないが、必要な情報として認識できる程度の表示です。

**Subtle（控えめ表示）** - 優先度4以下の条件

```
┌──────────────────────────┐
│ 射程内/攻撃+30%            │
│ ℹ️ ← ホバーで詳細表示      │
└──────────────────────────┘

ホバー時:
「同じ武器種のみ」
```

特殊条件など、備考的な情報は、デフォルトでは表示せず、ホバーやクリックで詳細を確認できるようにします。これにより、UIが煩雑にならず、必要な人だけが詳細を確認できます。

### 条件なしバフの扱い

ConditionTagが1つもないバフは、最も汎用性が高く、編成パズルにおいて最も価値があります。そのため、UI上では特別な表示をします。

```
┌──────────────────────────┐
│ ✨ 射程内/攻撃+30%          │ ← ゴールドの枠や星マークで強調
│ （条件なし）               │
└──────────────────────────┘
```

条件なしバフは、編成メンバー全員（または射程内全員）に効くため、編成パズルにおいて最も重要です。そのため、ゴールドの枠や星マークで強調表示し、ユーザーがすぐに認識できるようにします。

---

## 🔧 バフ適用判定ロジック

ConditionTagを使って、実際にバフが適用されるかを判定するロジックです。これは、ダメージ計算時に使用されます。

### 判定関数の仕様

```typescript
/**
 * バフが特定のキャラクターに適用されるかを判定
 * 
 * @param buff - 判定対象のバフ
 * @param character - 判定対象のキャラクター
 * @param context - ゲーム状態（HP、巨大化段階等）
 * @returns 適用される場合true
 * 
 * 判定ロジック:
 * 1. conditionTagsが空の場合 → 常に適用
 * 2. 全てのConditionTagをチェック
 * 3. 1つでも満たさない条件があれば → 適用されない
 * 4. 全ての条件を満たす → 適用される
 */
function isBuffApplicable(
  buff: Buff,
  character: Character,
  context: GameContext
): boolean {
  // ConditionTagがない場合は常に適用
  if (!buff.conditionTags || buff.conditionTags.length === 0) {
    return true;
  }
  
  // 全てのConditionTagをチェック
  for (const tag of buff.conditionTags) {
    if (!checkCondition(tag, character, context)) {
      return false; // 1つでも満たさなければ不適用
    }
  }
  
  return true; // 全ての条件を満たす
}

/**
 * 個別のConditionTagをチェック
 * 
 * @param tag - チェックするConditionTag
 * @param character - チェック対象のキャラクター
 * @param context - ゲーム状態
 * @returns 条件を満たす場合true
 */
function checkCondition(
  tag: ConditionTag,
  character: Character,
  context: GameContext
): boolean {
  switch (tag) {
    // 武器種条件
    case 'melee':
      return character.weaponInfo.range === 'melee';
    case 'ranged':
      return character.weaponInfo.range === 'ranged';
    case 'physical':
      return character.weaponInfo.type === 'physical';
    case 'magical':
      return character.weaponInfo.type === 'magical';
    
    // HP条件（contextから現在HPを取得）
    case 'hp_above_50':
      return context.getHpPercent(character.id) >= 50;
    case 'hp_below_50':
      return context.getHpPercent(character.id) < 50;
    case 'hp_above_70':
      return context.getHpPercent(character.id) >= 70;
    case 'hp_below_30':
      return context.getHpPercent(character.id) < 30;
    case 'hp_full':
      return context.getHpPercent(character.id) >= 100;
    
    // 巨大化段階条件（contextから現在の巨大化段階を取得）
    case 'giant_1_plus':
      return context.getGiantLevel(character.id) >= 1;
    case 'giant_2_plus':
      return context.getGiantLevel(character.id) >= 2;
    case 'giant_3_plus':
      return context.getGiantLevel(character.id) >= 3;
    case 'giant_4_plus':
      return context.getGiantLevel(character.id) >= 4;
    case 'giant_5':
      return context.getGiantLevel(character.id) >= 5;
    
    // 属性条件
    case 'water':
      return character.attributes.includes('水');
    case 'plain':
      return character.attributes.includes('平');
    case 'mountain':
      return character.attributes.includes('山');
    case 'plain_mountain':
      return character.attributes.includes('平山');
    case 'hell':
      return character.attributes.includes('地獄');
    
    // 季節属性条件
    case 'summer':
      return character.seasonAttributes?.includes('夏') || false;
    case 'kenran':
      return character.seasonAttributes?.includes('絢爛') || false;
    case 'halloween':
      return character.seasonAttributes?.includes('ハロウィン') || false;
    case 'school':
      return character.seasonAttributes?.includes('学園') || false;
    case 'christmas':
      return character.seasonAttributes?.includes('聖夜') || false;
    case 'new_year':
      return character.seasonAttributes?.includes('正月') || false;
    case 'moon_viewing':
      return character.seasonAttributes?.includes('お月見') || false;
    
    // 対象種別条件
    case 'castle_girl':
      return character.type === 'castle_girl';
    case 'ambush':
      return character.type === 'ambush';
    case 'lord':
      return character.type === 'lord';
    
    // 敵種別条件（敵に対するデバフの場合）
    case 'flying_enemy':
      return context.isTargetFlying();
    case 'ground_enemy':
      return !context.isTargetFlying();
    case 'boss_enemy':
      return context.isTargetBoss();
    
    // 特殊条件
    case 'same_weapon':
      // 同じ武器種の味方が範囲内にいるかをチェック
      return context.hasSameWeaponInRange(character);
    case 'different_weapon':
      // 異なる武器種の味方が範囲内にいるかをチェック
      return context.hasDifferentWeaponInRange(character);
    case 'night_battle':
      return context.isNightBattle();
    case 'continuous_deploy':
      return context.isContinuousDeploy(character.id);
    
    default:
      // 未定義のタグは常にfalseを返す（安全側に倒す）
      console.warn(`Unknown ConditionTag: ${tag}`);
      return false;
  }
}
```

このバフ適用判定ロジックは、非常にシンプルな設計になっています。全ての条件を満たす場合のみバフが適用されるという、AND条件です。

例えば、「近接武器かつ水属性」という条件のバフは、`conditionTags: ['melee', 'water']`として表現され、キャラクターが「近接武器」かつ「水属性」の両方を満たす場合のみ適用されます。

この設計により、複雑な条件の組み合わせも、単純なループとswitch文で処理できます。将来的に新しい条件が追加されても、switch文にcaseを追加するだけで対応できるため、拡張性が高い設計になっています。

---

## 🧪 テストケース

実装時にテストすべきパターンです。各ConditionTagが正しく検出され、適切に判定されることを保証します。

### 検出テスト

```typescript
describe('extractConditionTags', () => {
  // 除外パターンのテスト
  test('計略中や特技中は除外される', () => {
    const text1 = '計略中、攻撃が50%上昇';
    const tags1 = extractConditionTags(text1);
    expect(tags1).not.toContain('strategy_active');
    
    const text2 = '特技発動中、防御が30%上昇';
    const tags2 = extractConditionTags(text2);
    expect(tags2).not.toContain('skill_active');
  });
  
  test('巨大化時は除外されるが、段階条件は検出される', () => {
    const text1 = '巨大化時、攻撃が30%上昇';
    const tags1 = extractConditionTags(text1);
    expect(tags1).toEqual([]);
    
    const text2 = '巨大化3段階以上で攻撃が30%上昇';
    const tags2 = extractConditionTags(text2);
    expect(tags2).toContain('giant_3_plus');
  });
  
  // 武器種条件のテスト
  test('武器種条件が正しく検出される', () => {
    const text1 = '近接武器のみ攻撃が30%上昇';
    const tags1 = extractConditionTags(text1);
    expect(tags1).toContain('melee');
    
    const text2 = '遠隔武器限定で防御が20%上昇';
    const tags2 = extractConditionTags(text2);
    expect(tags2).toContain('ranged');
  });
  
  // HP条件のテスト
  test('HP条件が正しく検出される', () => {
    const text1 = 'HP50%以上で攻撃が40%上昇';
    const tags1 = extractConditionTags(text1);
    expect(tags1).toContain('hp_above_50');
    
    const text2 = '耐久30%以下で防御が50%上昇';
    const tags2 = extractConditionTags(text2);
    expect(tags2).toContain('hp_below_30');
  });
  
  // 属性条件のテスト
  test('属性条件が正しく検出される', () => {
    const text1 = '水属性の城娘の攻撃が20%上昇';
    const tags1 = extractConditionTags(text1);
    expect(tags1).toContain('water');
    
    const text2 = '平山城娘限定で防御が25%上昇';
    const tags2 = extractConditionTags(text2);
    expect(tags2).toContain('plain_mountain');
  });
  
  // 複数条件のテスト
  test('複数の条件が同時に検出される', () => {
    const text = '近接武器の水属性城娘の攻撃が30%上昇';
    const tags = extractConditionTags(text);
    expect(tags).toContain('melee');
    expect(tags).toContain('water');
    expect(tags.length).toBe(2);
  });
  
  // 優先度ソートのテスト
  test('検出された条件が優先度順にソートされる', () => {
    const text = '水属性の近接武器の攻撃が30%上昇';
    const tags = extractConditionTags(text);
    // 'melee'（優先度10）が 'water'（優先度6）より先
    expect(tags[0]).toBe('melee');
    expect(tags[1]).toBe('water');
  });
});
```

### 判定テスト

```typescript
describe('isBuffApplicable', () => {
  // 条件なしバフのテスト
  test('条件なしバフは常に適用される', () => {
    const buff: Buff = {
      id: 'buff-001',
      stat: 'attack',
      mode: 'percent_max',
      value: 30,
      target: 'range',
      conditionTags: [],
      source: 'self_skill',
      isActive: true
    };
    
    const character = createTestCharacter({ weapon: '刀' });
    const context = createTestContext();
    
    expect(isBuffApplicable(buff, character, context)).toBe(true);
  });
  
  // 武器種条件のテスト
  test('近接武器条件は近接キャラにのみ適用される', () => {
    const buff: Buff = {
      id: 'buff-002',
      stat: 'attack',
      mode: 'percent_max',
      value: 30,
      target: 'range',
      conditionTags: ['melee'],
      source: 'self_skill',
      isActive: true
    };
    
    const meleeChar = createTestCharacter({ weapon: '刀' }); // 近接
    const rangedChar = createTestCharacter({ weapon: '弓' }); // 遠隔
    const context = createTestContext();
    
    expect(isBuffApplicable(buff, meleeChar, context)).toBe(true);
    expect(isBuffApplicable(buff, rangedChar, context)).toBe(false);
  });
  
  // HP条件のテスト
  test('HP条件が正しく判定される', () => {
    const buff: Buff = {
      id: 'buff-003',
      stat: 'attack',
      mode: 'percent_max',
      value: 40,
      target: 'self',
      conditionTags: ['hp_above_50'],
      source: 'self_skill',
      isActive: true
    };
    
    const character = createTestCharacter({ weapon: '刀' });
    const contextHighHp = createTestContext({ 
      characterHp: { [character.id]: 80 } 
    });
    const contextLowHp = createTestContext({ 
      characterHp: { [character.id]: 30 } 
    });
    
    expect(isBuffApplicable(buff, character, contextHighHp)).toBe(true);
    expect(isBuffApplicable(buff, character, contextLowHp)).toBe(false);
  });
  
  // 複数条件のテスト
  test('複数条件は全て満たす必要がある（AND条件）', () => {
    const buff: Buff = {
      id: 'buff-004',
      stat: 'attack',
      mode: 'percent_max',
      value: 30,
      target: 'range',
      conditionTags: ['melee', 'water'],
      source: 'self_skill',
      isActive: true
    };
    
    const meleeWaterChar = createTestCharacter({ 
      weapon: '刀', 
      attributes: ['水'] 
    });
    const meleePlainChar = createTestCharacter({ 
      weapon: '刀', 
      attributes: ['平'] 
    });
    const rangedWaterChar = createTestCharacter({ 
      weapon: '弓', 
      attributes: ['水'] 
    });
    const context = createTestContext();
    
    // 近接かつ水属性 → 適用
    expect(isBuffApplicable(buff, meleeWaterChar, context)).toBe(true);
    
    // 近接だが平属性 → 不適用
    expect(isBuffApplicable(buff, meleePlainChar, context)).toBe(false);
    
    // 水属性だが遠隔 → 不適用
    expect(isBuffApplicable(buff, rangedWaterChar, context)).toBe(false);
  });
});
```

これらのテストケースは、ConditionTagシステムが正しく動作することを保証します。特に重要なのは、複数条件のテストです。AND条件として動作することを確認することで、将来的に複雑な条件の組み合わせが追加されても、システムが正しく機能することが保証されます。

---

## ✅ 実装チェックリスト

ConditionTagの実装が完了したら、以下を確認してください。

- [ ] 全てのConditionTagが型定義に含まれている
- [ ] 除外パターンが正しく機能し、不要な条件が記録されない
- [ ] 検出パターンが優先度順に処理される
- [ ] 排他的な条件が正しく処理される（同カテゴリで1つだけ）
- [ ] 属性条件が複数同時に検出される（排他的でない）
- [ ] 検出されたタグが優先度順にソートされる
- [ ] バフ適用判定が全てのタグで正しく動作する
- [ ] 複数条件がAND条件として正しく判定される
- [ ] UI表示レベルが優先度に応じて適切に設定される
- [ ] 全てのテストケースがパスする

---

## 🔄 バージョン履歴

### v1.0 (2025-12-06)
- 初版作成
- 旧バフパーサーの条件パターンを分析
- 除外すべき条件の明確化（計略中、特技中、巨大化時）
- 優先度に基づくUI表示設計
- バフ適用判定ロジックの仕様化

---

## 📚 関連ドキュメント

- `TYPE_CONVERSION_MAPPING.md` - 型変換の完全仕様
- `ARCHITECTURE.md` - プロジェクト全体の設計書
- `DAMAGE_CALCULATOR_SPEC.md` - ダメージ計算式の詳細仕様
- `src/core/types/index.ts` - 型定義の実装
- `src/core/parser/buffParser.ts` - パーサーの実装
- `src/core/logic/buffs.ts` - バフ適用判定の実装

---

**このドキュメントは、ConditionTagシステムの完璧な指針となることを目的としています。編成パズル主軸の設計思想を反映し、実用的かつ拡張可能なシステムを実現します。**
