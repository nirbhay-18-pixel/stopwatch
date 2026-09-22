-- ============================================================================
-- Tempo Database Schema Migration
-- Creates tables for cloud sync with Row Level Security
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('study', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, mode, name)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('study', 'other')),
  category TEXT NOT NULL,
  topic TEXT DEFAULT '',
  task TEXT DEFAULT '',
  timer_type TEXT NOT NULL CHECK (timer_type IN ('stopwatch', 'countdown')),
  started_at BIGINT NOT NULL,
  ended_at BIGINT NOT NULL,
  duration BIGINT NOT NULL,
  paused_ms BIGINT DEFAULT 0,
  continues_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON public.sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_category ON public.sessions(user_id, category);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SEGMENTS TABLE (for continued sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  duration BIGINT NOT NULL,
  paused_ms BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_segments_session ON public.segments(session_id);

-- Enable RLS
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for segments
CREATE POLICY "Users can view own segments"
  ON public.segments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own segments"
  ON public.segments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own segments"
  ON public.segments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own segments"
  ON public.segments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- LAPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.laps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  lap_number INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  lap_duration BIGINT NOT NULL,
  total_elapsed BIGINT NOT NULL,
  remaining BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(session_id, lap_number)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_laps_session ON public.laps(session_id);

-- Enable RLS
ALTER TABLE public.laps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for laps
CREATE POLICY "Users can view own laps"
  ON public.laps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own laps"
  ON public.laps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own laps"
  ON public.laps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own laps"
  ON public.laps FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for categories
DROP TRIGGER IF EXISTS on_categories_updated ON public.categories;
CREATE TRIGGER on_categories_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for sessions
DROP TRIGGER IF EXISTS on_sessions_updated ON public.sessions;
CREATE TRIGGER on_sessions_updated
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for segments
DROP TRIGGER IF EXISTS on_segments_updated ON public.segments;
CREATE TRIGGER on_segments_updated
  BEFORE UPDATE ON public.segments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for laps
DROP TRIGGER IF EXISTS on_laps_updated ON public.laps;
CREATE TRIGGER on_laps_updated
  BEFORE UPDATE ON public.laps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SYNC HELPER FUNCTIONS
-- ============================================================================

-- Upsert session (conflict resolution based on updated_at)
CREATE OR REPLACE FUNCTION public.upsert_session(
  p_id UUID,
  p_user_id UUID,
  p_mode TEXT,
  p_category TEXT,
  p_topic TEXT,
  p_task TEXT,
  p_timer_type TEXT,
  p_started_at BIGINT,
  p_ended_at BIGINT,
  p_duration BIGINT,
  p_paused_ms BIGINT,
  p_continues_session_id UUID,
  p_updated_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.sessions (
    id, user_id, mode, category, topic, task, timer_type,
    started_at, ended_at, duration, paused_ms, continues_session_id, updated_at
  ) VALUES (
    p_id, p_user_id, p_mode, p_category, p_topic, p_task, p_timer_type,
    p_started_at, p_ended_at, p_duration, p_paused_ms, p_continues_session_id, p_updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    mode = EXCLUDED.mode,
    category = EXCLUDED.category,
    topic = EXCLUDED.topic,
    task = EXCLUDED.task,
    timer_type = EXCLUDED.timer_type,
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at,
    duration = EXCLUDED.duration,
    paused_ms = EXCLUDED.paused_ms,
    continues_session_id = EXCLUDED.continues_session_id,
    updated_at = EXCLUDED.updated_at
  WHERE public.sessions.updated_at < EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
