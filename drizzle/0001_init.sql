-- Migration 0001 : schéma initial HINTERLAND (3 couches)
CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS agencies_name_uq ON agencies(name);

CREATE TABLE IF NOT EXISTS com_units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  agency_id INTEGER REFERENCES agencies(id),
  CONSTRAINT com_units_name_agency_uq UNIQUE(name, agency_id)
);
CREATE INDEX IF NOT EXISTS com_units_agency_idx ON com_units(agency_id);

CREATE TABLE IF NOT EXISTS coms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  com_unit_id INTEGER REFERENCES com_units(id),
  agency_id INTEGER REFERENCES agencies(id),
  CONSTRAINT coms_name_unit_agency_uq UNIQUE(name, com_unit_id, agency_id)
);
CREATE INDEX IF NOT EXISTS coms_agency_idx ON coms(agency_id);
CREATE INDEX IF NOT EXISTS coms_unit_idx ON coms(com_unit_id);

CREATE TABLE IF NOT EXISTS imports (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(500) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  file_type VARCHAR(2) NOT NULL,
  extraction_date DATE NOT NULL,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  warnings JSONB NOT NULL DEFAULT '[]',
  origin VARCHAR(10) NOT NULL DEFAULT 'cli'
);
CREATE INDEX IF NOT EXISTS imports_extraction_idx ON imports(extraction_date DESC);
CREATE INDEX IF NOT EXISTS imports_sha_idx ON imports(sha256);

CREATE TABLE IF NOT EXISTS raw_com_summary (
  id SERIAL PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES imports(id),
  agency_id INTEGER REFERENCES agencies(id),
  com_unit_id INTEGER REFERENCES com_units(id),
  com_id INTEGER REFERENCES coms(id),
  agency_name VARCHAR(200),
  com_unit_name VARCHAR(100),
  com_name VARCHAR(300),
  is_subtotal BOOLEAN NOT NULL DEFAULT FALSE,
  dossiers_valides INTEGER,
  bae INTEGER NOT NULL DEFAULT 0,
  fact_douane INTEGER NOT NULL DEFAULT 0,
  mise_en_livraison INTEGER NOT NULL DEFAULT 0,
  livraison INTEGER NOT NULL DEFAULT 0,
  retour_conteneur INTEGER NOT NULL DEFAULT 0,
  declares_non_factures INTEGER NOT NULL DEFAULT 0,
  fact_prestation INTEGER NOT NULL DEFAULT 0,
  archivage INTEGER NOT NULL DEFAULT 0,
  sans_declaration INTEGER NOT NULL DEFAULT 0,
  debours INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS raw_com_summary_import_idx ON raw_com_summary(import_id);
CREATE INDEX IF NOT EXISTS raw_com_summary_com_idx ON raw_com_summary(com_id);
CREATE INDEX IF NOT EXISTS raw_com_summary_agency_idx ON raw_com_summary(agency_id);

CREATE TABLE IF NOT EXISTS raw_dossier_details (
  id BIGSERIAL PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES imports(id),
  agency_id INTEGER REFERENCES agencies(id),
  com_unit_id INTEGER REFERENCES com_units(id),
  com_id INTEGER REFERENCES coms(id),
  agency_name VARCHAR(200),
  com_unit_name VARCHAR(100),
  com_name VARCHAR(300),
  dossier VARCHAR(100) NOT NULL,
  bae SMALLINT NOT NULL DEFAULT 0,
  fact_douane SMALLINT NOT NULL DEFAULT 0,
  mise_en_livraison SMALLINT NOT NULL DEFAULT 0,
  livraison SMALLINT NOT NULL DEFAULT 0,
  retour_conteneur SMALLINT NOT NULL DEFAULT 0,
  declares_non_factures SMALLINT NOT NULL DEFAULT 0,
  fact_prestation SMALLINT NOT NULL DEFAULT 0,
  archivage SMALLINT NOT NULL DEFAULT 0,
  sans_declaration SMALLINT NOT NULL DEFAULT 0,
  debours SMALLINT NOT NULL DEFAULT 0,
  flags_mask INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS raw_dossier_import_idx ON raw_dossier_details(import_id);
CREATE INDEX IF NOT EXISTS raw_dossier_com_idx ON raw_dossier_details(com_id);
CREATE INDEX IF NOT EXISTS raw_dossier_agency_idx ON raw_dossier_details(agency_id);
CREATE INDEX IF NOT EXISTS raw_dossier_num_idx ON raw_dossier_details(dossier);

CREATE TABLE IF NOT EXISTS raw_unarchived (
  id BIGSERIAL PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES imports(id),
  agency_id INTEGER REFERENCES agencies(id),
  com_unit_id INTEGER REFERENCES com_units(id),
  com_id INTEGER REFERENCES coms(id),
  agency_name VARCHAR(200),
  com_unit_name VARCHAR(100),
  com_name VARCHAR(300),
  dossier VARCHAR(100) NOT NULL,
  bae SMALLINT NOT NULL DEFAULT 0,
  fact_douane SMALLINT NOT NULL DEFAULT 0,
  mise_en_livraison SMALLINT NOT NULL DEFAULT 0,
  livraison SMALLINT NOT NULL DEFAULT 0,
  retour_conteneur SMALLINT NOT NULL DEFAULT 0,
  declares_non_factures SMALLINT NOT NULL DEFAULT 0,
  fact_prestation SMALLINT NOT NULL DEFAULT 0,
  archivage SMALLINT NOT NULL DEFAULT 0,
  sans_declaration SMALLINT NOT NULL DEFAULT 0,
  debours SMALLINT NOT NULL DEFAULT 0,
  flags_mask INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS raw_unarch_import_idx ON raw_unarchived(import_id);
CREATE INDEX IF NOT EXISTS raw_unarch_com_idx ON raw_unarchived(com_id);
CREATE INDEX IF NOT EXISTS raw_unarch_agency_idx ON raw_unarchived(agency_id);
CREATE INDEX IF NOT EXISTS raw_unarch_num_idx ON raw_unarchived(dossier);
