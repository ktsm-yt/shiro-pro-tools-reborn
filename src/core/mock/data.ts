import type { Character, Buff, Formation } from '../types';
import { calcBuffMatrix } from '../logic/buffs';

const createBuff = (
    id: string,
    stat: 'attack' | 'defense' | 'range' | 'cooldown' | 'cost' | 'damage_dealt' | 'damage_taken',
    mode: 'percent_max' | 'flat_sum',
    value: number,
    target: 'self' | 'range' | 'all' = 'self'
): Buff => ({
    id,
    stat,
    mode,
    value,
    source: 'self_skill',
    target,
    isActive: true,
});

export const MOCK_CHARS: Character[] = [
    {
        id: 'c1',
        name: '江戸城',
        weapon: '刀',
        attributes: ['平'],
        baseStats: {
            attack: 100,
            defense: 50,
            range: 200,
            cooldown: 30,
            cost: 10,
            damage_dealt: 0,
            damage_taken: 0,
            hp: 2000,
            recovery: 10,
            attack_speed: 0,
            attack_gap: 0,
            movement_speed: 0,
            knockback: 0,
            target_count: 0,
            ki_gain: 0,
            damage_drain: 0,
            ignore_defense: 0,
        },
        skills: [
            createBuff('b1', 'attack', 'percent_max', 25, 'all'), // 全体攻撃25%
            createBuff('b2', 'range', 'flat_sum', 20, 'all'), // 全体射程+20
        ],
        strategies: [],
    },
    {
        id: 'c2',
        name: '彦根城',
        weapon: '槍',
        attributes: ['平山'],
        baseStats: {
            attack: 80,
            defense: 40,
            range: 180,
            cooldown: 25,
            cost: 8,
            damage_dealt: 0,
            damage_taken: 0,
            hp: 1800,
            recovery: 10,
            attack_speed: 0,
            attack_gap: 0,
            movement_speed: 0,
            knockback: 0,
            target_count: 0,
            ki_gain: 0,
            damage_drain: 0,
            ignore_defense: 0,
        },
        skills: [
            createBuff('b3', 'attack', 'flat_sum', 80, 'all'), // 全体攻撃+80
        ],
        strategies: [],
    },
    {
        id: 'c3',
        name: '大阪城',
        weapon: '歌舞',
        attributes: ['平'],
        baseStats: {
            attack: 0,
            defense: 0,
            range: 300,
            cooldown: 0,
            cost: 12,
            damage_dealt: 0,
            damage_taken: 0,
            hp: 1500,
            recovery: 50,
            attack_speed: 0,
            attack_gap: 0,
            movement_speed: 0,
            knockback: 0,
            target_count: 0,
            ki_gain: 0,
            damage_drain: 0,
            ignore_defense: 0,
        },
        skills: [
            createBuff('b4', 'range', 'percent_max', 20, 'range'), // 範囲射程20%
        ],
        strategies: [],
    },
];

export const MOCK_FORMATION: Formation = {
    slots: [
        MOCK_CHARS[0],
        MOCK_CHARS[1],
        MOCK_CHARS[2],
        null, null, null, null, null
    ]
};

export const MOCK_BUFF_MATRIX = calcBuffMatrix(MOCK_FORMATION);
