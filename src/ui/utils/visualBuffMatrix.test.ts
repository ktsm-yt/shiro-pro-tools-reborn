import { describe, it, expect } from 'vitest';
import { buildVisualBuffMatrix } from './visualBuffMatrix';
import type { Formation, Character, Buff } from '../../core/types';

describe('buildVisualBuffMatrix', () => {
  it('should apply skill_multiplier to skill buffs', () => {
    const char1: Character = {
      id: 'char1',
      name: '室町第',
      type: 'castle_girl',
      weapon: '槍',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [
        {
          id: 'skill1',
          stat: 'attack',
          mode: 'percent_max',
          value: 20,
          target: 'range',
          source: 'self_skill',
          isActive: true,
        } as Buff,
      ],
      strategies: [],
      specialAbilities: [
        {
          id: 'special1',
          stat: 'skill_multiplier',
          mode: 'absolute_set',
          value: 1.25,
          target: 'self',
          source: 'special_ability',
          isActive: true,
        } as Buff,
      ],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const formation: Formation = {
      id: 'formation1',
      name: 'Test Formation',
      slots: [char1],
    };

    const matrix = buildVisualBuffMatrix(formation);

    // 特技のバフ値に1.25倍が適用されているか確認
    const attackCell = matrix[char1.id]?.attack;
    expect(attackCell).toBeDefined();
    expect(attackCell?.maxValue).toBe(25); // 20 * 1.25 = 25
  });

  it('should not apply skill_multiplier to strategy buffs', () => {
    const char1: Character = {
      id: 'char1',
      name: 'テストキャラ',
      type: 'castle_girl',
      weapon: '槍',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [],
      strategies: [
        {
          id: 'strategy1',
          stat: 'attack',
          mode: 'percent_max',
          value: 30,
          target: 'ally',
          source: 'strategy',
          isActive: true,
        } as Buff,
      ],
      specialAbilities: [
        {
          id: 'special1',
          stat: 'skill_multiplier',
          mode: 'absolute_set',
          value: 1.5,
          target: 'self',
          source: 'special_ability',
          isActive: true,
        } as Buff,
      ],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const char2: Character = {
      id: 'char2',
      name: '対象キャラ',
      type: 'castle_girl',
      weapon: '刀',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [],
      strategies: [],
      specialAbilities: [],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const formation: Formation = {
      id: 'formation1',
      name: 'Test Formation',
      slots: [char1, char2],
    };

    const matrix = buildVisualBuffMatrix(formation);

    // 計略のバフ値には倍率が適用されないことを確認
    const attackCell = matrix[char2.id]?.attack;
    expect(attackCell).toBeDefined();
    expect(attackCell?.maxValue).toBe(30); // multiplier not applied
  });

  it('should not display skill_multiplier in matrix', () => {
    const char1: Character = {
      id: 'char1',
      name: 'テストキャラ',
      type: 'castle_girl',
      weapon: '槍',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [],
      strategies: [],
      specialAbilities: [
        {
          id: 'special1',
          stat: 'skill_multiplier',
          mode: 'absolute_set',
          value: 1.25,
          target: 'self',
          source: 'special_ability',
          isActive: true,
        } as Buff,
      ],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const formation: Formation = {
      id: 'formation1',
      name: 'Test Formation',
      slots: [char1],
    };

    const matrix = buildVisualBuffMatrix(formation);

    // skill_multiplier が matrix に含まれないことを確認
    expect(matrix[char1.id]?.skill_multiplier).toBeUndefined();
  });

  it('should handle multiple skills with multiplier', () => {
    const char1: Character = {
      id: 'char1',
      name: 'マルチスキル',
      type: 'castle_girl',
      weapon: '槍',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [
        {
          id: 'skill1',
          stat: 'attack',
          mode: 'percent_max',
          value: 20,
          target: 'self',
          source: 'self_skill',
          isActive: true,
        } as Buff,
        {
          id: 'skill2',
          stat: 'defense',
          mode: 'percent_max',
          value: 15,
          target: 'self',
          source: 'self_skill',
          isActive: true,
        } as Buff,
      ],
      strategies: [],
      specialAbilities: [
        {
          id: 'special1',
          stat: 'skill_multiplier',
          mode: 'absolute_set',
          value: 2,
          target: 'self',
          source: 'special_ability',
          isActive: true,
        } as Buff,
      ],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const formation: Formation = {
      id: 'formation1',
      name: 'Test Formation',
      slots: [char1],
    };

    const matrix = buildVisualBuffMatrix(formation);

    // 両方のスキルに倍率が適用される
    expect(matrix[char1.id]?.attack?.maxValue).toBe(40); // 20 * 2
    expect(matrix[char1.id]?.defense?.maxValue).toBe(30); // 15 * 2
  });

  it('should use default multiplier of 1 when skill_multiplier is inactive', () => {
    const char1: Character = {
      id: 'char1',
      name: 'テストキャラ',
      type: 'castle_girl',
      weapon: '槍',
      weaponRange: '近',
      weaponType: '物',
      placement: '近',
      attributes: ['平'],
      seasonAttributes: [],
      baseStats: { attack: 100, defense: 50, hp: 1000 },
      skills: [
        {
          id: 'skill1',
          stat: 'attack',
          mode: 'percent_max',
          value: 20,
          target: 'self',
          source: 'self_skill',
          isActive: true,
        } as Buff,
      ],
      strategies: [],
      specialAbilities: [
        {
          id: 'special1',
          stat: 'skill_multiplier',
          mode: 'absolute_set',
          value: 1.5,
          target: 'self',
          source: 'special_ability',
          isActive: false, // inactive
        } as Buff,
      ],
      rawSkillTexts: [],
      rawStrategyTexts: [],
    };

    const formation: Formation = {
      id: 'formation1',
      name: 'Test Formation',
      slots: [char1],
    };

    const matrix = buildVisualBuffMatrix(formation);

    // 非アクティブな場合は倍率が適用されない
    expect(matrix[char1.id]?.attack?.maxValue).toBe(20);
  });
});
