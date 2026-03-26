-- バフ全置換をトランザクションで実行するRPC
CREATE OR REPLACE FUNCTION replace_buffs(
  p_character_id UUID,
  p_buffs JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM buffs WHERE character_id = p_character_id;

  INSERT INTO buffs (
    character_id, stat, mode, value, source, target,
    condition_tags, is_active, is_duplicate, duplicate_efficiency,
    non_stacking, stackable, max_stacks, is_dynamic, dynamic_type,
    unit_value, confidence, raw_text, buff_group, is_manual_override, note
  )
  SELECT
    p_character_id,
    (b->>'stat')::text,
    (b->>'mode')::text,
    (b->>'value')::numeric,
    (b->>'source')::text,
    (b->>'target')::text,
    COALESCE(b->'condition_tags', '[]'::jsonb),
    COALESCE((b->>'is_active')::boolean, true),
    COALESCE((b->>'is_duplicate')::boolean, false),
    (b->>'duplicate_efficiency')::numeric,
    COALESCE((b->>'non_stacking')::boolean, false),
    COALESCE((b->>'stackable')::boolean, false),
    (b->>'max_stacks')::integer,
    COALESCE((b->>'is_dynamic')::boolean, false),
    (b->>'dynamic_type')::text,
    (b->>'unit_value')::numeric,
    COALESCE(b->>'confidence', 'certain'),
    (b->>'raw_text')::text,
    COALESCE(b->>'buff_group', 'skills'),
    COALESCE((b->>'is_manual_override')::boolean, false),
    (b->>'note')::text
  FROM jsonb_array_elements(p_buffs) AS b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
