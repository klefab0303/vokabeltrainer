-- ============================================================
-- Vokabeltrainer: Supabase Schema
-- Führe dieses SQL im Supabase SQL Editor aus
-- ============================================================

-- Alte Tabellen löschen (falls vorhanden)
DROP TABLE IF EXISTS appeals CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS tests CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;

-- Lehrer
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Klassen
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tests
CREATE TABLE tests (
  id TEXT PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lesson_numbers INTEGER[] NOT NULL,
  question_count INTEGER NOT NULL,
  vocab_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ergebnisse
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Einzelne Antworten
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  latin_word TEXT NOT NULL,
  student_answer TEXT NOT NULL,
  correct_answers TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false
);

-- Einsprüche
CREATE TABLE appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

-- Öffentliche Policies (kein Auth-System)
CREATE POLICY "public_all" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON appeals FOR ALL USING (true) WITH CHECK (true);
