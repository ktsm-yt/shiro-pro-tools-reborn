-- キャラクター定義
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_url TEXT UNIQUE,
  name TEXT NOT NULL,
  period TEXT,
  rarity TEXT,
  weapon TEXT NOT NULL,
  weapon_range TEXT,
  weapon_type TEXT,
  placement TEXT,
  attributes JSONB NOT NULL DEFAULT '[]',
  season_attributes JSONB DEFAULT '[]',
  base_stats JSONB NOT NULL,
  special_attack JSONB,
  strategy_damage JSONB,
  ability_mode JSONB,
  range_to_attack JSONB,
  conditional_give_damage JSONB,
  ambush_info JSONB,
  image_url TEXT,
  raw_skill_texts JSONB DEFAULT '[]',
  raw_strategy_texts JSONB DEFAULT '[]',
  raw_special_texts JSONB DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  parser_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- バフ定義
CREATE TABLE buffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  stat TEXT NOT NULL,
  mode TEXT NOT NULL,
  value NUMERIC NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  condition_tags JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_efficiency NUMERIC,
  non_stacking BOOLEAN DEFAULT FALSE,
  stackable BOOLEAN DEFAULT FALSE,
  max_stacks INTEGER,
  is_dynamic BOOLEAN DEFAULT FALSE,
  dynamic_type TEXT,
  unit_value NUMERIC,
  confidence TEXT DEFAULT 'certain',
  raw_text TEXT,
  buff_group TEXT NOT NULL DEFAULT 'skills',
  is_manual_override BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buffs_character_id ON buffs(character_id);
CREATE INDEX idx_characters_name ON characters(name);
CREATE INDEX idx_characters_weapon ON characters(weapon);

-- 匿名認証用: user_characters (お気に入り)
CREATE TABLE user_characters (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, character_id)
);

-- 編成
CREATE TABLE formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slot_ids JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 環境設定
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  environment JSONB NOT NULL
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER formations_updated_at
  BEFORE UPDATE ON formations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS ポリシー
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE buffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- characters/buffs は全員読み取り可、認証ユーザーのみ書き込み可
CREATE POLICY "characters_read" ON characters FOR SELECT USING (true);
CREATE POLICY "characters_insert" ON characters FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "characters_update" ON characters FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "buffs_read" ON buffs FOR SELECT USING (true);
CREATE POLICY "buffs_insert" ON buffs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "buffs_update" ON buffs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "buffs_delete" ON buffs FOR DELETE USING (auth.uid() IS NOT NULL);

-- 個人データは本人のみ
CREATE POLICY "user_characters_own" ON user_characters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "formations_own" ON formations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_settings_own" ON user_settings FOR ALL USING (auth.uid() = user_id);
