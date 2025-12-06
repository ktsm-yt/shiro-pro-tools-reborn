export type LegacyBuffType =
  | '攻撃割合'
  | '攻撃固定'
  | '防御割合'
  | '防御固定'
  | '射程割合'
  | '射程固定'
  | '与ダメ割合'
  | '被ダメ割合'
  | '攻撃速度割合';

export const typeToStatMap: Record<LegacyBuffType, 'attack' | 'defense' | 'range' | 'damage_dealt' | 'damage_taken' | 'cooldown'> = {
  '攻撃割合': 'attack',
  '攻撃固定': 'attack',
  '防御割合': 'defense',
  '防御固定': 'defense',
  '射程割合': 'range',
  '射程固定': 'range',
  '与ダメ割合': 'damage_dealt',
  '被ダメ割合': 'damage_taken',
  '攻撃速度割合': 'cooldown', // 便宜的に再攻撃短縮として扱う
};

export const targetMap: Record<string, 'self' | 'range' | 'all'> = {
  '自身': 'self',
  '射程内': 'range',
  '全': 'all',
  '城娘': 'all',
};

export interface ParsedPattern {
  type: LegacyBuffType;
  regex: RegExp;
  unit: '+%' | '+';
}

// 簡易パターン（旧buffParser.jsの抜粋代替）
export const patterns: ParsedPattern[] = [
  { type: '攻撃割合', regex: /攻撃(?:力)?(?:が|を|\+)?\s*([0-9]+)%(?:上昇|増加|アップ)?/, unit: '+%' },
  { type: '攻撃固定', regex: /攻撃(?:力)?(?:が|を|\+)?\s*([0-9]+)(?![0-9]*%)(?:上昇|増加|アップ)?/, unit: '+' },
  { type: '防御割合', regex: /防御(?:力)?(?:が|を|\+)?\s*([0-9]+)%(?:上昇|増加|アップ)?/, unit: '+%' },
  { type: '防御固定', regex: /防御(?:力)?(?:が|を|\+)?\s*([0-9]+)(?![0-9]*%)(?:上昇|増加|アップ)?/, unit: '+' },
  { type: '射程割合', regex: /射程(?:が|を|\+)?\s*([0-9]+)%(?:上昇|アップ|増加)?/, unit: '+%' },
  { type: '射程固定', regex: /射程(?:が|を|\+)?\s*([0-9]+)(?![0-9]*%)(?:上昇|アップ|増加)?/, unit: '+' },
  { type: '与ダメ割合', regex: /与(?:える)?ダメ(?:ージ)?(?:が|を|\+)?\s*([0-9]+)%(?:上昇|増加|アップ)?/, unit: '+%' },
  { type: '被ダメ割合', regex: /(?:受ける|被)ダメ(?:ージ)?(?:が|を|\+)?\s*([0-9]+)%(?:低下|減少|軽減)/, unit: '+%' },
  { type: '攻撃速度割合', regex: /攻撃速度(?:が|を|\+)?\s*([0-9]+)%(?:上昇|短縮|加速)/, unit: '+%' },
];
