-- Migration 0002 : nouvelle catégorie « Dossiers en vie » (fichier source mis à jour le
-- 2026-11-10 -- Sheet1 et Sheet2 du Fichier A gagnent une 11e colonne « Dossiers en vie »,
-- un vrai nouvel indicateur, pas un renommage). IF NOT EXISTS partout : idempotent, même
-- convention que 0001_init.sql.
ALTER TABLE raw_com_summary ADD COLUMN IF NOT EXISTS dossiers_en_vie INTEGER NOT NULL DEFAULT 0;
ALTER TABLE raw_dossier_details ADD COLUMN IF NOT EXISTS dossiers_en_vie SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE raw_unarchived ADD COLUMN IF NOT EXISTS dossiers_en_vie SMALLINT NOT NULL DEFAULT 0;
