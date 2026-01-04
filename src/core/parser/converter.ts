import type { Buff } from '../types';
import type { ParsedBuff } from './buffParser';

let buffIdSeq = 0;

export function convertToRebornBuff(parsed: ParsedBuff): Omit<Buff, 'id' | 'source' | 'isActive'> {
    const buff: Omit<Buff, 'id' | 'source' | 'isActive'> = {
        stat: parsed.stat as Buff['stat'],
        mode: parsed.mode as Buff['mode'],
        value: parsed.value,
        target: parsed.target,
        costType: parsed.costType,
        inspireSourceStat: parsed.inspireSourceStat as Buff['inspireSourceStat'],
        isDuplicate: parsed.isDuplicate,
        isExplicitlyNonDuplicate: parsed.isExplicitlyNonDuplicate,
        nonStacking: parsed.nonStacking,
        stackPenalty: parsed.stackPenalty,
        stackable: parsed.stackable,
        maxStacks: parsed.maxStacks,
        currentStacks: parsed.currentStacks,
        priority: parsed.priority,
        isDynamic: parsed.isDynamic,
        dynamicType: parsed.dynamicType,
        dynamicCategory: parsed.dynamicCategory,
        unitValue: parsed.unitValue,
        dynamicParameter: parsed.dynamicParameter,
        requiresAmbush: parsed.requiresAmbush,
        benefitsOnlySelf: parsed.benefitsOnlySelf,
        confidence: parsed.confidence,
        inferenceReason: parsed.inferenceReason,
        note: parsed.note,
        conditionTags: parsed.conditionTags,
    };

    // 気バフは常にfield
    if (buff.stat === 'cost') {
        buff.target = 'field';
    }

    return buff;
}

export function createBuffId(): string {
  return `buff_${buffIdSeq++}`;
}
