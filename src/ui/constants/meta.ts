import type { Character } from '../../core/types';

type AttributeKey = 'plain' | 'plain_mountain' | 'mountain' | 'water' | 'hell' | 'none';

const ATTRIBUTE_KEYWORDS: Record<AttributeKey, string[]> = {
  plain: ['平', 'plain'],
  plain_mountain: ['平山', 'plain_mountain'],
  mountain: ['山', 'mountain'],
  water: ['水', 'water'],
  hell: ['地獄', 'hell'],
  none: ['無', 'none'],
};

export const ATTRIBUTE_META: Record<AttributeKey, { label: string; main: string; light: string; border: string; text: string; dot: string }> = {
  plain: { label: '平', main: 'bg-green-600', light: 'bg-green-500/15', border: 'border-green-500', text: 'text-green-300', dot: 'bg-green-400' },
  plain_mountain: { label: '平山', main: 'bg-lime-500', light: 'bg-lime-500/15', border: 'border-lime-500', text: 'text-lime-300', dot: 'bg-lime-400' },
  mountain: { label: '山', main: 'bg-amber-700', light: 'bg-amber-500/15', border: 'border-amber-500', text: 'text-amber-300', dot: 'bg-amber-400' },
  water: { label: '水', main: 'bg-blue-600', light: 'bg-blue-500/15', border: 'border-blue-500', text: 'text-blue-300', dot: 'bg-blue-400' },
  hell: { label: '地獄', main: 'bg-purple-600', light: 'bg-purple-500/15', border: 'border-purple-500', text: 'text-purple-300', dot: 'bg-purple-400' },
  none: { label: '無', main: 'bg-gray-600', light: 'bg-gray-500/15', border: 'border-gray-500', text: 'text-gray-300', dot: 'bg-gray-400' },
};

const WEAPON_META: Record<string, { icon: string; name: string; range: 'melee' | 'ranged' }> = {
  '刀': { icon: '⚔️', name: '刀', range: 'melee' },
  '槍': { icon: '🔱', name: '槍', range: 'melee' },
  '槌': { icon: '🔨', name: '槌', range: 'melee' },
  '拳': { icon: '👊', name: '拳', range: 'melee' },
  '剣': { icon: '⚔️', name: '剣', range: 'melee' },
  '盾': { icon: '🛡️', name: '盾', range: 'melee' },
  '鎌': { icon: '⚔️', name: '鎌', range: 'melee' },
  '戦棍': { icon: '🏏', name: '戦棍', range: 'melee' },
  '双剣': { icon: '⚔️', name: '双剣', range: 'melee' },
  'ランス': { icon: '🗡️', name: 'ランス', range: 'melee' },
  '弓': { icon: '🏹', name: '弓', range: 'ranged' },
  '鉄砲': { icon: '🔫', name: '鉄砲', range: 'ranged' },
  '銃': { icon: '🔫', name: '銃', range: 'ranged' },
  '石弓': { icon: '🎯', name: '石弓', range: 'ranged' },
  '杖': { icon: '🪄', name: '杖', range: 'ranged' },
  '歌舞': { icon: '💃', name: '歌舞', range: 'ranged' },
  '鈴': { icon: '🔔', name: '鈴', range: 'ranged' },
  '本': { icon: '📖', name: '本', range: 'ranged' },
  '鈴杖': { icon: '🔔', name: '鈴杖', range: 'ranged' },
  '法術': { icon: '✨', name: '法術', range: 'ranged' },
  '祓串': { icon: '📿', name: '祓串', range: 'ranged' },
  '投剣': { icon: '🗡️', name: '投剣', range: 'ranged' },
  '鞭': { icon: '〰️', name: '鞭', range: 'melee' },
  '大砲': { icon: '💣', name: '大砲', range: 'ranged' },
  '陣貝': { icon: '🐚', name: '陣貝', range: 'ranged' },
  '茶器': { icon: '🍵', name: '茶器', range: 'melee' },
  '軍船': { icon: '⛵', name: '軍船', range: 'ranged' },
};

export function resolveAttributeKey(attributeText?: string): AttributeKey {
  if (!attributeText) return 'none';
  const lowered = attributeText.toLowerCase();
  for (const [key, candidates] of Object.entries(ATTRIBUTE_KEYWORDS) as [AttributeKey, string[]][]) {
    if (candidates.some((c) => lowered.includes(c.toLowerCase()))) {
      return key;
    }
  }
  return 'none';
}

export function getAttributeMeta(character: Character) {
  const firstAttr = character.attributes?.[0];
  const key = resolveAttributeKey(firstAttr);
  return { key, meta: ATTRIBUTE_META[key] };
}

export function getWeaponMeta(weapon: string) {
  return WEAPON_META[weapon] ?? { icon: '🏯', name: weapon, range: 'ranged' };
}

export function isRangedWeapon(weapon: string) {
  return getWeaponMeta(weapon).range === 'ranged';
}
