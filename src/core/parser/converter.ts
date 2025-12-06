import type { Buff } from '../types';
import type { ParsedBuff } from './buffParser';

let buffIdSeq = 0;

export function convertToRebornBuff(parsed: ParsedBuff): Omit<Buff, 'id' | 'source' | 'isActive'> {
  return {
    stat: parsed.stat as Buff['stat'],
    mode: parsed.mode as Buff['mode'],
    value: parsed.value,
    target: parsed.target as Buff['target'],
    costType: parsed.costType as Buff['costType'],
    inspireSourceStat: parsed.inspireSourceStat,
    isDuplicate: parsed.isDuplicate,
  };
}

export function createBuffId(): string {
  return `buff_${buffIdSeq++}`;
}
