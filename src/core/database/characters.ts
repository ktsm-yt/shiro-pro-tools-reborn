import { supabase } from './client';
import type { Character, Buff } from '../types';
import { characterToDbRow, dbRowToCharacter, buffToDbRow } from './types';
import type { DbCharacterRow, DbBuffRow } from './types';

export async function upsertCharacter(char: Character, wikiUrl?: string): Promise<string | null> {
    if (!supabase) return null;

    const row = characterToDbRow(char, wikiUrl);

    // wiki_url があれば upsert、なければ insert
    const { data, error } = wikiUrl
        ? await supabase
            .from('characters')
            .upsert(row, { onConflict: 'wiki_url' })
            .select('id')
            .single()
        : await supabase
            .from('characters')
            .insert(row)
            .select('id')
            .single();

    if (error) {
        console.error('Failed to upsert character:', error.message);
        return null;
    }

    const characterId = data.id;

    // バフを全置換（RPC でトランザクション化）
    const allBuffs: Buff[] = [
        ...char.skills.map(b => ({ ...b, buffGroup: 'skills' as const })),
        ...char.strategies.map(b => ({ ...b, buffGroup: 'strategies' as const })),
        ...(char.specialAbilities ?? []).map(b => ({ ...b, buffGroup: 'specialAbilities' as const })),
    ];

    const buffRows = allBuffs.map(b => buffToDbRow(b, characterId));
    const { error: rpcError } = await supabase.rpc('replace_buffs', {
        p_character_id: characterId,
        p_buffs: buffRows,
    });
    if (rpcError) {
        console.error('Failed to replace buffs:', rpcError.message);
    }

    return characterId;
}

export async function fetchCharacterByWikiUrl(wikiUrl: string): Promise<Character | null> {
    if (!supabase) return null;

    const { data: charRow, error } = await supabase
        .from('characters')
        .select('*')
        .eq('wiki_url', wikiUrl)
        .single();

    if (error || !charRow) return null;

    const { data: buffRows } = await supabase
        .from('buffs')
        .select('*')
        .eq('character_id', charRow.id);

    return dbRowToCharacter(charRow as DbCharacterRow, (buffRows ?? []) as DbBuffRow[]);
}

export async function fetchAllCharacters(): Promise<Character[]> {
    if (!supabase) return [];

    const { data: charRows, error } = await supabase
        .from('characters')
        .select('*')
        .order('name');

    if (error || !charRows) return [];

    // 全バフを一括取得
    const charIds = charRows.map(r => r.id);
    const { data: allBuffRows } = await supabase
        .from('buffs')
        .select('*')
        .in('character_id', charIds);

    const buffsByChar = new Map<string, DbBuffRow[]>();
    for (const buff of (allBuffRows ?? []) as DbBuffRow[]) {
        const existing = buffsByChar.get(buff.character_id) ?? [];
        existing.push(buff);
        buffsByChar.set(buff.character_id, existing);
    }

    return charRows.map(row =>
        dbRowToCharacter(row as DbCharacterRow, buffsByChar.get(row.id) ?? [])
    );
}
