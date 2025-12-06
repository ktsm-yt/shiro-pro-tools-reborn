import { patterns, type ParsedPattern, targetMap } from './patterns';

export interface ParsedBuff {
  stat: string;
  mode: string;
  target: string;
  value: number;
  unit?: '+%' | '+' | '×' | '-';
  isSpecial: boolean;
  hasCondition: boolean;
  conditionText?: string;
  note: string;
  rawText: string;
  costType?: string;
  inspireSourceStat?: 'attack' | 'defense';
  isDuplicate?: boolean;
}

function detectTarget(text: string): string {
  if (/射程内|範囲内/.test(text)) return 'range';
  if (/全(て)?の?城娘|味方全(体|員)|殿/.test(text)) return 'all';
  return 'self';
}

export function parseSkillLine(line: string): ParsedBuff[] {
  const results: ParsedBuff[] = [];
  const seen = new Set<string>();
  const target = detectTarget(line);
  const isDuplicate = /効果重複|重複可|重複可能/.test(line);

  patterns.forEach((p: ParsedPattern) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(p.regex, 'g');
    while ((match = regex.exec(line)) !== null) {
      const rawVal = match[1] ?? '0';
      const value = p.valueTransform ? p.valueTransform(match) : Number(rawVal);
      if (p.mode === 'flat_sum' && match[0].includes('%')) continue; // %表記はflat除外
      const key = `${p.stat}-${match.index}-${match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const parsedTarget = p.target ? targetMap[p.target] ?? 'self' : target;

      results.push({
        stat: p.stat,
        mode: p.mode,
        target: parsedTarget,
        value,
        unit: p.unit,
        isSpecial: false,
        hasCondition: false,
        note: '',
        rawText: match[0],
        costType: p.costType,
        inspireSourceStat: p.inspireSourceStat,
        isDuplicate,
      });

      // 鼓舞: 攻撃と防御の両方を加算する場合に防御分も生成
      if (p.stat === 'inspire' && p.inspireSourceStat === 'attack' && /攻撃と防御/.test(match[0])) {
        results.push({
          stat: 'inspire',
          mode: p.mode,
          target: parsedTarget,
          value,
          unit: p.unit,
          isSpecial: false,
          hasCondition: false,
          note: '',
          rawText: match[0],
          inspireSourceStat: 'defense',
          isDuplicate,
        });
      }
    }
  });

  // 重複除去（内容が同じものは1つにまとめる）
  const unique = new Map<string, ParsedBuff>();
  results.forEach(r => {
    const k = `${r.stat}-${r.target}-${r.rawText}-${r.inspireSourceStat ?? ''}`;
    const existing = unique.get(k);
    if (!existing) {
      unique.set(k, r);
      return;
    }
    // 優先度: percent_max > percent_reduction > flat_sum
    const rank = (m: string) => m === 'percent_max' ? 2 : (m === 'percent_reduction' ? 1 : 0);
    if (rank(r.mode) > rank(existing.mode)) {
      unique.set(k, r);
    }
  });

  return Array.from(unique.values());
}
