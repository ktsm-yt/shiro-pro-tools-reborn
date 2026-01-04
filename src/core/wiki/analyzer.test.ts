import { describe, it, expect } from 'vitest';
import { analyzeBuffText, analyzeCharacter } from './analyzer';
import type { RawCharacterData } from './types';

describe('analyzeBuffText', () => {
    describe('基本的なパーセントバフ', () => {
        it('should parse "攻撃力+30%" correctly', () => {
            const result = analyzeBuffText('攻撃力+30%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 30,
                target: 'self',
            });
        });

        it('should parse "防御力+20%" correctly', () => {
            const result = analyzeBuffText('防御力+20%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: 20,
                target: 'self',
            });
        });
    });

    describe('固定値バフ', () => {
        it('should parse "攻撃力+50" as flat buff', () => {
            const result = analyzeBuffText('攻撃力+50');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'flat_sum',
                value: 50,
            });
        });
    });

    describe('範囲バフ', () => {
        it('should parse "範囲内の味方の攻撃力+20%"', () => {
            const result = analyzeBuffText('範囲内の味方の攻撃力+20%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 20,
                target: 'range',
            });
        });

        it('should parse "範囲内の味方の防御力+15%"', () => {
            const result = analyzeBuffText('範囲内の味方の防御力+15%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: 15,
                target: 'range',
            });
        });
    });

    describe('全体バフ', () => {
        it('should parse "味方全体の攻撃力+10%"', () => {
            const result = analyzeBuffText('味方全体の攻撃力+10%');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 10,
                target: 'all',
            });
        });
    });

    describe('複数バフ', () => {
        it('should parse multiple buffs in one text', () => {
            const result = analyzeBuffText('攻撃力+30%、防御力+20%');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                stat: 'attack',
                value: 30,
            });
            expect(result[1]).toMatchObject({
                stat: 'defense',
                value: 20,
            });
        });
    });

    describe('バフが無い場合', () => {
        it('should return empty array for non-buff text', () => {
            const result = analyzeBuffText('通常攻撃');
            expect(result).toHaveLength(0);
        });

        it('should return empty array for empty string', () => {
            const result = analyzeBuffText('');
            expect(result).toHaveLength(0);
        });
    });
    describe('新しいバフパターン', () => {
        it('should parse "与ダメージが30%上昇" correctly', () => {
            const result = analyzeBuffText('与ダメージが30%上昇');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'damage_dealt',
                mode: 'percent_max',
                value: 30,
            });
        });

        it('should parse "被ダメージを25%軽減" correctly', () => {
            const result = analyzeBuffText('被ダメージを25%軽減');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'damage_taken',
                mode: 'percent_max',
                value: 25,  // 軽減量は正の値で格納
            });
        });

        it('should parse "射程+20" correctly', () => {
            const result = analyzeBuffText('射程+20');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'range',
                mode: 'flat_sum',
                value: 20,
            });
        });

        it('should parse "与える ダメージ1.3倍" with line breaks correctly', () => {
            const result = analyzeBuffText('自身の与える\nダメージ1.3倍');
            const giveDamage = result.find(b => b.stat === 'give_damage');
            expect(giveDamage).toBeDefined();
            expect(giveDamage?.value).toBe(30);
        });

        it('should not attach season tags to give_damage in mixed tag-conditional text', () => {
            const text = [
                '自身の攻撃が敵の防御を無視し、耐久50%以下の敵に与える',
                'ダメージ1.5倍。射程内城娘の攻撃40%、［絢爛］城娘は50%上昇',
                '計略中、自身の与えるダメージ1.3倍、攻撃後の隙60%短縮',
            ].join('\n');
            const result = analyzeBuffText(text);
            const giveDamageBuffs = result.filter(b => b.stat === 'give_damage');
            expect(giveDamageBuffs.length).toBeGreaterThan(0);
            // 「絢爛」タグがgive_damageに伝播しない
            expect(giveDamageBuffs.some(b => b.conditionTags?.includes('kenran'))).toBe(false);
        });

        it('should parse "撃破気が1増加" correctly (enemy defeat cost)', () => {
            const result = analyzeBuffText('撃破気が1増加');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                stat: 'cost_defeat_bonus',
                mode: 'flat_sum',
                value: 1,
            });
        });
    });

    describe('並列表記の展開', () => {
        it('should expand "攻撃と防御が30%上昇" into 2 separate buffs', () => {
            const result = analyzeBuffText('攻撃と防御が30%上昇');
            expect(result).toHaveLength(2);
            expect(result.find(b => b.stat === 'attack')).toMatchObject({
                stat: 'attack',
                mode: 'percent_max',
                value: 30,
            });
            expect(result.find(b => b.stat === 'defense')).toMatchObject({
                stat: 'defense',
                mode: 'percent_max',
                value: 30,
            });
        });

        it('should expand "防御・移動速度が20%低下" into 2 separate buffs', () => {
            const result = analyzeBuffText('敵の防御・移動速度が20%低下');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result.find(b => b.stat === 'enemy_defense')).toBeTruthy();
            expect(result.find(b => b.stat === 'enemy_movement')).toBeTruthy();
        });

        it('should expand "射程内の城娘の攻撃と防御が1.2倍" with target range', () => {
            const result = analyzeBuffText('射程内の城娘の攻撃と防御が1.2倍');
            expect(result).toHaveLength(2);
            expect(result.every(b => b.target === 'range')).toBe(true);
            expect(result.find(b => b.stat === 'attack')?.value).toBeCloseTo(20, 1); // (1.2-1)*100
            expect(result.find(b => b.stat === 'defense')?.value).toBeCloseTo(20, 1);
        });

        it('should expand "攻撃と攻撃速度10%上昇" into attack and attack_speed (暁星大坂)', () => {
            const result = analyzeBuffText('攻撃と攻撃速度10%上昇');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result.find(b => b.stat === 'attack')).toMatchObject({
                stat: 'attack',
                value: 10,
            });
            expect(result.find(b => b.stat === 'attack_speed')).toMatchObject({
                stat: 'attack_speed',
                value: 10,
            });
        });

        it('should parse "巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇" with ×5 multiplier', () => {
            const result = analyzeBuffText('巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result.find(b => b.stat === 'attack')?.value).toBe(50); // 10 × 5
            expect(result.find(b => b.stat === 'attack_speed')?.value).toBe(50); // 10 × 5
        });

        it('should apply ×5 to subsequent sentences until new condition marker', () => {
            // 暁星大坂城の特技テキスト: 「巨大化毎に」のスコープは「最大化時」まで継続
            const text = '巨大化毎に射程内城娘の攻撃と攻撃速度10%上昇、被ダメージ9%軽減。全城娘の射程が10、攻撃が50上昇。最大化時、自身の範囲攻撃の範囲が35%上昇';
            const result = analyzeBuffText(text);

            // 第1文: 巨大化毎に → ×5適用
            expect(result.find(b => b.stat === 'attack' && b.mode === 'percent_max' && b.target === 'range')?.value).toBe(50); // 10 × 5
            expect(result.find(b => b.stat === 'attack_speed' && b.target === 'range')?.value).toBe(50); // 10 × 5
            expect(result.find(b => b.stat === 'damage_taken' && b.target === 'range')?.value).toBe(45); // 9 × 5

            // 第2文: スコープ継続 → ×5適用
            const allAttackFlat = result.filter(b => b.stat === 'attack' && b.mode === 'flat_sum' && b.target === 'all');
            expect(allAttackFlat.length).toBeGreaterThanOrEqual(1);
            expect(allAttackFlat[0]?.value).toBe(250); // 50 × 5

            const allRangeFlat = result.filter(b => b.stat === 'range' && b.mode === 'flat_sum' && b.target === 'all');
            expect(allRangeFlat.length).toBeGreaterThanOrEqual(1);
            expect(allRangeFlat[0]?.value).toBe(50); // 10 × 5

            // 第3文: 最大化時 → 新条件、×5適用なし
            // (範囲攻撃の範囲はパースされないかもしれないがスコープリセットは確認)
        });

        it('should NOT apply ×5 to 鼓舞 before 巨大化毎に (室町第)', () => {
            // 室町第の特技: 鼓舞は最初の文で巨大化毎にの前
            const text = '【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算。巨大化毎に射程内の城娘の射程が10、攻撃が50上昇。射程内の敵の攻撃と移動速度が8%低下';
            const result = analyzeBuffText(text);

            // 鼓舞(inspire)は巨大化毎にの前なので×5されない
            const inspireAttack = result.find(b => b.stat === 'inspire' && b.inspireSourceStat === 'attack');
            const inspireDefense = result.find(b => b.stat === 'inspire' && b.inspireSourceStat === 'defense');
            expect(inspireAttack?.value).toBe(30); // NOT 150
            expect(inspireDefense?.value).toBe(30); // NOT 150

            // 巨大化毎にの後は×5
            expect(result.find(b => b.stat === 'range' && b.mode === 'flat_sum')?.value).toBe(50); // 10 × 5
            expect(result.find(b => b.stat === 'attack' && b.mode === 'flat_sum')?.value).toBe(250); // 50 × 5
        });

        it('should parse 撃破気が1増加 in special ability (室町第)', () => {
            const text = '60秒間特技効果が1.25倍、射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える。射程内の城娘の撃破気が1増加';
            const result = analyzeBuffText(text);

            // skill_multiplier
            const multiplier = result.find(b => b.stat === 'skill_multiplier');
            expect(multiplier?.value).toBe(1.25);

            // 撃破気が1増加 → cost_defeat_bonus
            const defeatBonus = result.find(b => b.stat === 'cost_defeat_bonus');
            expect(defeatBonus?.value).toBe(1);
            expect(defeatBonus?.target).toBe('range');
        });

        it('should NOT apply ×5 to 鼓舞 even without period before 巨大化毎に (wiki format)', () => {
            // Wiki HTMLでは句点が省略されることがある
            const text = '【鼓舞】自身の攻撃と防御の30%の値を射程内の城娘に加算巨大化毎に射程内の城娘の射程が10、攻撃が50上昇射程内の敵の攻撃と移動速度が8%低下';
            const result = analyzeBuffText(text);

            // 鼓舞は×5されない
            const inspireAttack = result.find(b => b.stat === 'inspire' && b.inspireSourceStat === 'attack');
            const inspireDefense = result.find(b => b.stat === 'inspire' && b.inspireSourceStat === 'defense');
            expect(inspireAttack?.value).toBe(30); // NOT 150
            expect(inspireDefense?.value).toBe(30); // NOT 150

            // 巨大化毎には×5
            expect(result.find(b => b.stat === 'range' && b.mode === 'flat_sum')?.value).toBe(50); // 10 × 5
            expect(result.find(b => b.stat === 'attack' && b.mode === 'flat_sum')?.value).toBe(250); // 50 × 5
            expect(result.find(b => b.stat === 'enemy_attack')?.value).toBe(40); // 8 × 5
            expect(result.find(b => b.stat === 'enemy_movement')?.value).toBe(40); // 8 × 5
        });

        it('should NOT parse enemy debuff "射程が50%低下" as positive range buff', () => {
            // 敵デバフの並列展開で「射程」が正のバフにならないことを確認
            const text = '射程内の敵の与ダメージと射程が50%低下';
            const result = analyzeBuffText(text);

            // enemy_range (敵の射程デバフ) があること
            expect(result.find(b => b.stat === 'enemy_range')).toBeDefined();
            // enemy_damage_dealt (敵の与ダメ低下) があること
            expect(result.find(b => b.stat === 'enemy_damage_dealt')).toBeDefined();

            // range (正のバフ) がないこと
            const rangeBuffs = result.filter(b => b.stat === 'range');
            expect(rangeBuffs).toHaveLength(0);

            // damage_dealt (正の与ダメバフ) がないこと
            const damageBuffs = result.filter(b => b.stat === 'damage_dealt');
            expect(damageBuffs).toHaveLength(0);
        });

        it('should parse "対象の射程が1.3倍" as 30% range buff with target ally', () => {
            // 計略のパターン: 対象の射程が1.3倍
            const text = '対象の射程が1.3倍';
            const result = analyzeBuffText(text);

            expect(result).toHaveLength(1);
            expect(result[0].stat).toBe('range');
            expect(result[0].mode).toBe('percent_max');
            expect(result[0].value).toBeCloseTo(30, 5); // 1.3 - 1 = 0.3 = 30%
            expect(result[0].target).toBe('ally'); // 「対象」= ally
        });

        it('should split repeated condition headers (近接/架空) into separate buffs', () => {
            const text = '全近接城娘の攻撃が120上昇、与ダメージが50%上昇、全架空城の攻撃が120上昇、与ダメージが1.7倍';
            const result = analyzeBuffText(text);

            const attackFlats = result.filter(b => b.stat === 'attack' && b.mode === 'flat_sum' && b.value === 120);
            expect(attackFlats).toHaveLength(2);
            expect(attackFlats.some(b => b.conditionTags?.includes('melee'))).toBe(true);
            expect(attackFlats.some(b => b.conditionTags?.includes('fictional'))).toBe(true);
        });
    });
});

describe('analyzeCharacter - strategy target from parentheses', () => {
    it('should set target to self when strategy has (自分のみが対象)', () => {
        const rawData: RawCharacterData = {
            name: 'テスト',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [],
            strategyTexts: ['30秒間対象の射程が1.3倍（自分のみが対象）'],
        };

        const character = analyzeCharacter(rawData);

        expect(character.strategies).toHaveLength(1);
        expect(character.strategies[0].stat).toBe('range');
        expect(character.strategies[0].target).toBe('self'); // ()内で自分指定 → self
    });

    it('should NOT override enemy debuff targets even with (自分のみが対象)', () => {
        // 室町第の計略パターン: 自分バフ + 敵デバフ
        const rawData: RawCharacterData = {
            name: 'テスト',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [],
            strategyTexts: ['30秒間対象の射程が1.3倍。射程内の敵の被ダメージが50%上昇（自分のみが対象）'],
        };

        const character = analyzeCharacter(rawData);

        // 射程バフは self
        const rangeBuff = character.strategies.find(b => b.stat === 'range');
        expect(rangeBuff?.target).toBe('self');

        // 敵デバフは range（射程内の敵）のまま
        const enemyDebuff = character.strategies.find(b => b.stat === 'enemy_damage_taken');
        expect(enemyDebuff?.target).toBe('range'); // 敵バフは上書きしない
    });

    it('should keep original target when no parentheses override', () => {
        const rawData: RawCharacterData = {
            name: 'テスト',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [],
            strategyTexts: ['射程内の城娘の攻撃が20%上昇'],
        };

        const character = analyzeCharacter(rawData);

        expect(character.strategies).toHaveLength(1);
        expect(character.strategies[0].stat).toBe('attack');
        expect(character.strategies[0].target).toBe('range'); // 元のtargetを維持
    });

    it('should extract cost_defeat_bonus from strategy (室町第)', () => {
        // 室町第の計略「最秘曲・啄木」の実際のテキスト
        // 注: Wikiの実際のテキストは (同種効果の重複無し) であり、(自分のみが対象) ではない
        const rawData: RawCharacterData = {
            name: '室町第',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [],
            strategyTexts: ['60秒間特技効果が1.25倍、射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える射程内の城娘の撃破気が1増加(同種効果の重複無し)'],
        };

        const character = analyzeCharacter(rawData);

        // 撃破気 (cost_defeat_bonus) が抽出されること
        const defeatBonus = character.strategies.find(b => b.stat === 'cost_defeat_bonus');
        expect(defeatBonus).toBeDefined();
        expect(defeatBonus?.value).toBe(1);
        expect(defeatBonus?.mode).toBe('flat_sum');
        expect(defeatBonus?.source).toBe('strategy');
        // (同種効果の重複無し) は target 上書きしないので range のまま
        expect(defeatBonus?.target).toBe('range');
    });
});

describe('analyzeCharacter', () => {
    it('should convert RawCharacterData to Character', () => {
        const rawData: RawCharacterData = {
            name: '江戸城',
            url: 'http://example.com',
            weapon: '刀',
            attributes: ['平'],
            baseStats: {
                attack: 150,
                defense: 100,
                range: 200,
            },
            skillTexts: ['攻撃力+30%'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        expect(character.name).toBe('江戸城');
        expect(character.weapon).toBe('刀');
        expect(character.attributes).toEqual(['平']);
        expect(character.skills).toHaveLength(1);
        expect(character.skills[0]).toMatchObject({
            stat: 'attack',
            mode: 'percent_max',
            value: 30,
            source: 'self_skill',
        });
    });

    it('should handle multiple skills', () => {
        const rawData: RawCharacterData = {
            name: 'テストキャラ',
            url: 'http://example.com',
            weapon: '槍',
            attributes: ['水'],
            baseStats: {},
            skillTexts: ['攻撃力+20%', '範囲内の味方の防御力+15%'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        expect(character.skills).toHaveLength(2);
        expect(character.skills[0].stat).toBe('attack');
        expect(character.skills[1].stat).toBe('defense');
        expect(character.skills[1].target).toBe('range');
    });

    it('should extract cost_defeat_bonus from specialTexts (室町第)', () => {
        // 室町第の特殊能力「最秘曲・啄木」
        // 撃破気が1増加は特殊能力（special ability）として格納される
        const rawData: RawCharacterData = {
            name: '室町第',
            url: 'http://example.com',
            weapon: '歌舞',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [],
            strategyTexts: [],
            specialTexts: ['60秒間特技効果が1.25倍、射程内の殿と城娘を継続回復し、敵に継続的にダメージを与える射程内の城娘の撃破気が1増加(同種効果の重複無し)'],
        };

        const character = analyzeCharacter(rawData);

        // 特殊能力からの撃破気
        const defeatBonus = character.specialAbilities.find(b => b.stat === 'cost_defeat_bonus');
        expect(defeatBonus).toBeDefined();
        expect(defeatBonus?.value).toBe(1);
        expect(defeatBonus?.mode).toBe('flat_sum');
        expect(defeatBonus?.source).toBe('special_ability');
        expect(defeatBonus?.target).toBe('range');
    });

    it('should detect rangeToAttack and conditionalGiveDamage from skill text (竜焔仙台城)', () => {
        const rawData: RawCharacterData = {
            name: '[竜焔]仙台城',
            url: 'http://example.com',
            weapon: '銃',
            attributes: ['平'],
            baseStats: {
                attack: 1000,
                range: 648,
            },
            skillTexts: [
                '自身の特殊攻撃で与えるダメージが1.3倍。射程が100上昇、自身の射程の値を攻撃に加算。自身の射程が1000以上の場合与えるダメージが2倍',
            ],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        // 射程→攻撃変換（閾値なし - 「射程の値を攻撃に加算」は常時発動）
        expect(character.rangeToAttack).toEqual({ enabled: true, threshold: undefined });
        // 条件付き与えるダメージ（射程1000以上で2倍）
        expect(character.conditionalGiveDamage).toEqual([{ rangeThreshold: 1000, multiplier: 2 }]);
        // 射程+100バフも認識されているか確認
        const rangeBuff = character.skills.find(b => b.stat === 'range' && b.mode === 'flat_sum');
        expect(rangeBuff).toBeDefined();
        expect(rangeBuff?.value).toBe(100);
        // 特殊攻撃の与えるダメージ1.3倍も検出
        const specialGiveDamage = character.skills.find(
            b => b.stat === 'give_damage' && b.note === '特殊攻撃'
        );
        expect(specialGiveDamage).toBeDefined();
        expect(specialGiveDamage?.value).toBeCloseTo(30); // 1.3倍 = 30%
    });

    it('should detect rangeToAttack without threshold', () => {
        const rawData: RawCharacterData = {
            name: '仮キャラ',
            url: 'http://example.com',
            weapon: '銃',
            attributes: ['平'],
            baseStats: {},
            skillTexts: [
                '自身の射程の値を攻撃に加算',
            ],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        // 射程→攻撃変換のみ（閾値なし）
        expect(character.rangeToAttack).toEqual({ enabled: true, threshold: undefined });
    });

    it('should not set rangeToAttack if pattern not present', () => {
        const rawData: RawCharacterData = {
            name: '通常城娘',
            url: 'http://example.com',
            weapon: '刀',
            attributes: ['平'],
            baseStats: {},
            skillTexts: ['攻撃力+30%'],
            strategyTexts: [],
        };

        const character = analyzeCharacter(rawData);

        expect(character.rangeToAttack).toBeUndefined();
    });

    it('should extract "計略中" buffs from skill texts as Phase 2 buffs (絢爛ダノター城)', () => {
        const rawData: RawCharacterData = {
            name: '[絢爛]ダノター城',
            url: 'http://example.com',
            weapon: '銃',
            attributes: ['山'],
            baseStats: {
                attack: 1000,
            },
            skillTexts: [
                '計略中、自身の与えるダメージ1.3倍、攻撃後の隙60%短縮',
            ],
            strategyTexts: [
                '15秒間自身の攻撃速度2.5倍、1.5倍の射程で射程内全敵に攻撃の2倍の5連続攻撃',
            ],
        };

        const character = analyzeCharacter(rawData);

        // 「計略中」バフがskillsに追加されていること（計略常時発動前提でPhase 2バフとして扱う）
        const giveDamageBuff = character.skills.find(b => b.stat === 'give_damage' && b.note === '計略中');
        expect(giveDamageBuff).toBeDefined();
        expect(giveDamageBuff?.value).toBe(30); // 1.3倍 → 30%
        expect(giveDamageBuff?.mode).toBe('percent_max');
        expect(giveDamageBuff?.source).toBe('self_skill');
        expect(character.skills.filter(b => b.stat === 'give_damage').length).toBe(1);

        const gapReductionBuff = character.skills.find(b => b.stat === 'attack_gap' && b.note === '計略中');
        expect(gapReductionBuff).toBeDefined();
        expect(gapReductionBuff?.value).toBe(60);
        expect(gapReductionBuff?.mode).toBe('percent_reduction');

        // 計略本体の情報も正しく設定されていること
        expect(character.strategyDamage).toBeDefined();
        expect(character.strategyDamage?.multiplier).toBe(2);
        expect(character.strategyDamage?.hits).toBe(5);
        expect(character.strategyDamage?.buffAttackSpeed).toBe(2.5);
    });

    it('should extract "計略使用時" buffs from skill texts as Phase 2 buffs', () => {
        const rawData: RawCharacterData = {
            name: 'テストキャラ',
            url: 'http://example.com',
            weapon: '銃',
            attributes: ['山'],
            baseStats: {},
            skillTexts: [
                '計略使用時自身の与えるダメージ1.3倍、攻撃後の隙60%短縮',
            ],
            strategyTexts: [
                '10秒間1.5倍の射程で射程内全敵に攻撃の2倍の3連続攻撃',
            ],
        };

        const character = analyzeCharacter(rawData);

        // 「計略使用時」もパースされること
        const giveDamageBuff = character.skills.find(b => b.stat === 'give_damage' && b.note === '計略中');
        expect(giveDamageBuff).toBeDefined();
        expect(giveDamageBuff?.value).toBe(30);

        const gapReductionBuff = character.skills.find(b => b.stat === 'attack_gap' && b.note === '計略中');
        expect(gapReductionBuff).toBeDefined();
        expect(gapReductionBuff?.value).toBe(60);
    });

    // 他 stat は今後の拡張で追加
});

describe('気関連パターン', () => {
    // 自然気テスト
    it('should parse "自然に気が増加" as cost 40%', () => {
        const result = analyzeBuffText('自然に気が増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost',
            mode: 'percent_max',
            value: 40,
        });
    });

    it('should parse "自然に気が大きく増加" as cost 70%', () => {
        const result = analyzeBuffText('自然に気が大きく増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost',
            mode: 'percent_max',
            value: 70,
        });
    });

    // 気軽減%テスト（巨大化気のみ対象）
    it('should parse "巨大化に必要な気が15%軽減" as cost_giant percent', () => {
        const result = analyzeBuffText('巨大化に必要な気が15%軽減');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_giant',
            mode: 'percent_reduction',
            value: 15,
        });
    });

    it('should parse "巨大化に必要な気を半減" as cost_giant 50%', () => {
        const result = analyzeBuffText('巨大化に必要な気を半減');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_giant',
            mode: 'percent_reduction',
            value: 50,
        });
    });

    // 気軽減-テスト（固定値: 消費気・巨大化気 両方対象）
    it('should parse "消費気が2軽減" as cost_giant flat', () => {
        const result = analyzeBuffText('消費気が2軽減');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_giant',
            mode: 'flat_sum',
            value: 2,
        });
    });

    it('should parse "巨大化に必要な気が3軽減" as cost_giant flat', () => {
        const result = analyzeBuffText('巨大化に必要な気が3軽減');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_giant',
            mode: 'flat_sum',
            value: 3,
        });
    });

    // 徐々気テスト（複数の表記揺れ対応）
    it('should parse "徐々に気が3回復" as cost_gradual', () => {
        const result = analyzeBuffText('徐々に気が3回復');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 3,
        });
    });

    it('should parse "10秒ごとに気が2増加" as cost_gradual', () => {
        const result = analyzeBuffText('10秒ごとに気が2増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 2,
        });
    });

    it('should parse "時間経過で気が徐々に3増加" as cost_gradual', () => {
        const result = analyzeBuffText('時間経過で気が徐々に3増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 3,
        });
    });

    it('should parse "巨大化するごとに気が1増加" as cost_gradual (×5 for max giant)', () => {
        const result = analyzeBuffText('巨大化するごとに気が1増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 5,  // 1 × 5回巨大化 = 5
        });
    });

    it('should parse "時間経過で気が徐々に増加" as cost_gradual with default value 2', () => {
        const result = analyzeBuffText('時間経過で気が徐々に増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 2,  // 5秒毎に2増加（デフォルト）
        });
    });

    it('should parse "5秒毎に2増加" as cost_gradual', () => {
        const result = analyzeBuffText('5秒毎に気が2増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_gradual',
            mode: 'flat_sum',
            value: 2,
        });
    });

    // 気(牛)テスト
    it('should parse "敵撃破時の獲得気が2増加" as cost_enemy_defeat (気牛) - contains 敵', () => {
        const result = analyzeBuffText('敵撃破時の獲得気が2増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_enemy_defeat',
            mode: 'flat_sum',
            value: 2,
        });
    });

    it('should parse "自身の敵撃破時の獲得気が2増加" as cost_enemy_defeat (暁星大坂)', () => {
        const result = analyzeBuffText('自身の敵撃破時の獲得気が2増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_enemy_defeat',
            mode: 'flat_sum',
            value: 2,
        });
    });

    // 気(ノビ)テスト
    it('should parse "射程内の城娘の撃破気が1増加" as cost_defeat_bonus (気ノビ) - no 敵', () => {
        const result = analyzeBuffText('射程内の城娘の撃破気が1増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_defeat_bonus',
            mode: 'flat_sum',
            value: 1,
        });
    });

    it('should parse "撃破獲得気2増加" as cost_defeat_bonus (気ノビ) - no 敵', () => {
        const result = analyzeBuffText('撃破獲得気2増加');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            stat: 'cost_defeat_bonus',
            mode: 'flat_sum',
            value: 2,
        });
    });

    // 攻撃N%とM展開テスト（ゴールデン・ハインド）
    it('should expand "攻撃5%と70(効果重複)" to percent and flat buffs', () => {
        const result = analyzeBuffText('攻撃5%と70(効果重複)');
        expect(result).toHaveLength(2);
        // 効果重複は%のみ
        const percentBuff = result.find(b => b.stat === 'effect_duplicate_attack');
        expect(percentBuff).toBeDefined();
        expect(percentBuff?.value).toBe(5);
        expect(percentBuff?.mode).toBe('percent_max');
        // 固定値は通常attack
        const flatBuff = result.find(b => b.stat === 'attack' && b.mode === 'flat_sum');
        expect(flatBuff).toBeDefined();
        expect(flatBuff?.value).toBe(70);
    });

    // 効果重複効率テスト（鳥取城など）
    it('should parse "攻撃2.5倍(効果重複)この効果(効果重複の150%)" with duplicateEfficiency', () => {
        const result = analyzeBuffText('攻撃2.5倍(効果重複)この効果(効果重複の150%)');
        expect(result).toHaveLength(1);
        const buff = result[0];
        expect(buff.stat).toBe('effect_duplicate_attack');
        expect(buff.value).toBe(150); // 2.5倍 = 150%
        expect(buff.isDuplicate).toBe(true);
        expect(buff.duplicateEfficiency).toBe(150);
    });

    it('should parse "攻撃30%上昇(効果重複)" without duplicateEfficiency (default)', () => {
        const result = analyzeBuffText('攻撃30%上昇(効果重複)');
        expect(result).toHaveLength(1);
        const buff = result[0];
        expect(buff.stat).toBe('effect_duplicate_attack');
        expect(buff.value).toBe(30);
        expect(buff.isDuplicate).toBe(true);
        expect(buff.duplicateEfficiency).toBeUndefined();
    });
});

describe('伏兵配置（千賀地氏城など）', () => {
    it('should parse ambush placement with multiplicative stacking', () => {
        const raw: RawCharacterData = {
            name: '千賀地氏城',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { attack: 1000, defense: 100, range: 300 },
            strategyTexts: [
                '敵に狙われない伏兵を配置（2体まで）。自身の1.4倍の攻撃で敵4体に攻撃。配置中、自身の攻撃と攻撃速度が40%上昇（同種効果と重複）',
            ],
        };
        const character = analyzeCharacter(raw);

        // ambushInfo には maxCount と isMultiplicative のみ設定
        // 効果重複バフはパーサーで effect_duplicate_* として処理されるため attackMultiplier は設定しない
        expect(character.ambushInfo).toBeDefined();
        expect(character.ambushInfo?.maxCount).toBe(2);
        expect(character.ambushInfo?.attackMultiplier).toBeUndefined();
        expect(character.ambushInfo?.attackSpeedMultiplier).toBeUndefined();
        expect(character.ambushInfo?.isMultiplicative).toBe(true);

        // 効果重複バフがパースされていることを確認
        const duplicateAttack = character.strategies.find(b => b.stat === 'effect_duplicate_attack');
        const duplicateSpeed = character.strategies.find(b => b.stat === 'effect_duplicate_attack_speed');
        expect(duplicateAttack).toBeDefined();
        expect(duplicateAttack?.value).toBe(40);
        expect(duplicateSpeed).toBeDefined();
        expect(duplicateSpeed?.value).toBe(40);
    });

    it('should detect ambush placement without stacking buffs', () => {
        const raw: RawCharacterData = {
            name: 'テスト城',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { attack: 1000, defense: 100, range: 300 },
            strategyTexts: [
                '伏兵を配置（3体まで）。伏兵は敵2体に攻撃。',
            ],
        };
        const character = analyzeCharacter(raw);

        expect(character.ambushInfo).toBeDefined();
        expect(character.ambushInfo?.maxCount).toBe(3);
        expect(character.ambushInfo?.attackMultiplier).toBeUndefined();
        expect(character.ambushInfo?.isMultiplicative).toBe(false);
    });

    it('should parse "最大N体配置可能" format (wiki alternate)', () => {
        const raw: RawCharacterData = {
            name: '千賀地氏城（絢爛）',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 100, defense: 0, range: 300 },
            strategyTexts: [
                '敵から狙われず、本体の1.5倍の攻撃で敵4体に攻撃。最大2体配置可能。配置中、本体の攻撃と攻撃速度が40%上昇',
            ],
        };
        const character = analyzeCharacter(raw);

        expect(character.ambushInfo).toBeDefined();
        expect(character.ambushInfo?.maxCount).toBe(2);
        expect(character.ambushInfo?.attackMultiplier).toBe(1.4);
        expect(character.ambushInfo?.attackSpeedMultiplier).toBe(1.4);
    });
});

describe('abilityMode detection', () => {
    it('should detect abilityMode for ［竜焔］仙台城 pattern', () => {
        const raw: RawCharacterData = {
            name: '［竜焔］仙台城',
            weapon: '刀',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 1000, defense: 100, range: 150 },
            strategyTexts: [
                '60秒間自身の攻撃後の隙80%短縮、与えるダメージ1.2倍。自身の攻撃の2.5倍のダメージを与える攻撃を2連続で行う',
            ],
            specialAttackTexts: [
                '敵1体とその周囲に攻撃の6倍のダメージを与え、大きく後退させ、5秒間防御を0にする攻撃を2連続で5回に1回行う',
            ],
        };
        const character = analyzeCharacter(raw);

        // abilityMode が検出されること
        expect(character.abilityMode).toBeDefined();
        expect(character.abilityMode?.duration).toBe(60);
        expect(character.abilityMode?.cooldown).toBe(60);
        expect(character.abilityMode?.gapReduction).toBe(80);
        expect(character.abilityMode?.giveDamage).toBe(20); // 1.2倍 = 20%
        expect(character.abilityMode?.replacedAttack.multiplier).toBe(2.5);
        expect(character.abilityMode?.replacedAttack.hits).toBe(2);

        // 特殊攻撃も別途検出されること
        expect(character.specialAttack).toBeDefined();
        expect(character.specialAttack?.multiplier).toBe(6);
        expect(character.specialAttack?.hits).toBe(2);
        expect(character.specialAttack?.cycleN).toBe(5);
    });

    it('should not detect abilityMode without replaced attack pattern', () => {
        const raw: RawCharacterData = {
            name: 'テスト城',
            weapon: '刀',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 1000, defense: 100, range: 150 },
            strategyTexts: [
                '60秒間自身の攻撃後の隙80%短縮、与えるダメージ1.2倍',
            ],
        };
        const character = analyzeCharacter(raw);

        // replacedAttack がないので abilityMode は検出されない
        expect(character.abilityMode).toBeUndefined();
    });

    it('should not detect abilityMode for normal cycle special attack', () => {
        const raw: RawCharacterData = {
            name: 'テスト城2',
            weapon: '刀',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 1000, defense: 100, range: 150 },
            specialAttackTexts: [
                '攻撃の6倍のダメージを与える攻撃を2連続で3回に1回行う',
            ],
        };
        const character = analyzeCharacter(raw);

        // 通常の特殊攻撃のみ
        expect(character.abilityMode).toBeUndefined();
        expect(character.specialAttack).toBeDefined();
        expect(character.specialAttack?.multiplier).toBe(6);
        expect(character.specialAttack?.hits).toBe(2);
        expect(character.specialAttack?.cycleN).toBe(3);
    });
});

describe('specialAttack stackMultiplier', () => {
    it('should detect stackMultiplier from "ダメージと攻撃上昇量が増加（最大3倍）" (暁星大坂城)', () => {
        const raw: RawCharacterData = {
            name: '［暁星］大坂城',
            weapon: '杖',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 2500, defense: 100, range: 400 },
            specialAttackTexts: [
                'ストック1消費で攻撃の7倍ダメージを指定方向の敵に与え、射程内味方の攻撃が30秒間150上昇。特殊能力中はストックを全消費し、ダメージと攻撃上昇量が増加（最大3倍）。',
            ],
        };
        const character = analyzeCharacter(raw);

        expect(character.specialAttack).toBeDefined();
        expect(character.specialAttack?.multiplier).toBe(7);
        expect(character.specialAttack?.stackMultiplier).toBe(3);
        // 最大ダメージ = 7 × 3 = 21倍
    });

    it('should not set stackMultiplier when not present', () => {
        const raw: RawCharacterData = {
            name: 'テスト城',
            weapon: '刀',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 1000, defense: 100, range: 150 },
            specialAttackTexts: [
                '攻撃の6倍のダメージを与える',
            ],
        };
        const character = analyzeCharacter(raw);

        expect(character.specialAttack).toBeDefined();
        expect(character.specialAttack?.multiplier).toBe(6);
        expect(character.specialAttack?.stackMultiplier).toBeUndefined();
    });
});

describe('千賀地氏城 特技パターン', () => {
    it('should parse "攻撃速度が高いほど与えるダメージが上昇(上限1.7倍)" as give_damage', () => {
        const raw: RawCharacterData = {
            name: '千賀地氏城',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 363, defense: 204, range: 230 },
            skillTexts: [
                '攻撃速度が高いほど与えるダメージが上昇(上限1.7倍)',
            ],
        };
        const character = analyzeCharacter(raw);

        // give_damage バフが検出されること
        const giveDamageBuff = character.skills.find(b => b.stat === 'give_damage');
        expect(giveDamageBuff).toBeDefined();
        expect(giveDamageBuff?.value).toBe(70);  // 1.7倍 = 70%
        expect(giveDamageBuff?.mode).toBe('percent_max');
        expect(giveDamageBuff?.note).toContain('攻撃速度依存');
    });

    it('should parse "自身が攻撃する度に攻撃後の隙が10秒間7%短縮(上限70%)" as attack_gap', () => {
        const raw: RawCharacterData = {
            name: '千賀地氏城',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 363, defense: 204, range: 230 },
            skillTexts: [
                '自身が攻撃する度に攻撃後の隙が10秒間7%短縮(上限70%)',
            ],
        };
        const character = analyzeCharacter(raw);

        // attack_gap バフが検出されること
        const gapBuff = character.skills.find(b => b.stat === 'attack_gap');
        expect(gapBuff).toBeDefined();
        expect(gapBuff?.value).toBe(70);  // 上限70%
        expect(gapBuff?.mode).toBe('percent_reduction');
    });

    it('should parse both patterns together from skill texts', () => {
        const raw: RawCharacterData = {
            name: '千賀地氏城',
            weapon: '投剣',
            attributes: ['平'],
            baseStats: { hp: 0, attack: 363, defense: 204, range: 230 },
            skillTexts: [
                '自身が攻撃する度に攻撃後の隙が10秒間7%短縮(上限70%)',
                '攻撃速度が高いほど与えるダメージが上昇(上限1.7倍)',
                '射程内の味方の射程が40上昇',
            ],
            strategyTexts: [
                '敵に狙われない伏兵を配置（2体まで）。自身の1.4倍の攻撃で敵4体に攻撃。配置中、自身の攻撃と攻撃速度が40%上昇（同種効果と重複）',
            ],
        };
        const character = analyzeCharacter(raw);

        // 隙短縮
        const gapBuff = character.skills.find(b => b.stat === 'attack_gap');
        expect(gapBuff).toBeDefined();
        expect(gapBuff?.value).toBe(70);

        // 攻撃速度依存ダメージ
        const giveDamageBuff = character.skills.find(b => b.stat === 'give_damage');
        expect(giveDamageBuff).toBeDefined();
        expect(giveDamageBuff?.value).toBe(70);

        // 射程バフ
        const rangeBuff = character.skills.find(b => b.stat === 'range');
        expect(rangeBuff).toBeDefined();
        expect(rangeBuff?.value).toBe(40);

        // 伏兵配置
        expect(character.ambushInfo).toBeDefined();
        expect(character.ambushInfo?.maxCount).toBe(2);
    });
});
