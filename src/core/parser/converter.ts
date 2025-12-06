import type { Buff } from '../types';
import type { ParsedBuff } from './buffParser';
import { typeToStatMap, targetMap } from './patterns';

let buffIdSeq = 0;

export function convertToRebornBuff(parsed: ParsedBuff): Omit<Buff, 'id' | 'source' | 'isActive'> {
  const stat = typeToStatMap[parsed.type];
  const mode: Buff['mode'] = parsed.unit === '+%' ? 'percent_max' : 'flat_sum';
  const target = targetMap[parsed.target] ?? 'self';
  let value = parsed.value;

  // 被ダメ軽減や再攻撃短縮はマイナス方向として扱う
  if (parsed.type === '被ダメ割合') value = -value;
  if (parsed.type === '攻撃速度割合') value = -value;

  return {
    stat,
    mode,
    value,
    target,
  };
}

export function createBuffId(): string {
  return `buff_${buffIdSeq++}`;
}
