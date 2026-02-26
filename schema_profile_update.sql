-- Agregar columnas nuevas al perfil del usuario
-- Ejecuta esto en el SQL Editor de tu Supabase Dashboard

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '🐱',
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('mujer', 'hombre', 'prefiero_no_decirlo', 'otro')),
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS job_start_date DATE,
  ADD COLUMN IF NOT EXISTS job_end_date DATE; -- NULL significa "Actualidad"
