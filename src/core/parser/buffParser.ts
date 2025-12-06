import { patterns, type ParsedPattern, type LegacyBuffType } from './patterns';

export interface ParsedBuff {
  type: LegacyBuffType;
  target: string;
  value: number;
  unit: '+%' | '+';
  isSpecial: boolean;
  hasCondition: boolean;
  conditionText?: string;
  note: string;
  rawText: string;
}

function detectTarget(text: string): string {
  if (/射程内|範囲内/.test(text)) return '射程内';
  if (/全(て)?の?城娘|味方全(体|員)|殿/.test(text)) return '全';
  return '自身';
}

export function parseSkillLine(line: string): ParsedBuff[] {
  const results: ParsedBuff[] = [];
  const seen = new Set<string>();
  const target = detectTarget(line);

  patterns.forEach((p: ParsedPattern) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(p.regex, 'g');
    while ((match = regex.exec(line)) !== null) {
      const value = Number(match[1]);
      const key = `${p.type}-${match.index}-${match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        type: p.type,
        target,
        value,
        unit: p.unit,
        isSpecial: false,
        hasCondition: false,
        note: '',
        rawText: match[0],
      });
    }
  });
  // 重複除去（内容が同じものは1つにまとめる）
  const unique = new Map<string, ParsedBuff>();
  results.forEach(r => {
    const k = `${r.type}-${r.target}-${r.value}-${r.unit}-${r.rawText}`;
    if (!unique.has(k)) unique.set(k, r);
  });

  return Array.from(unique.values());
}
