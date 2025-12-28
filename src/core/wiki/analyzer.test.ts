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
});
