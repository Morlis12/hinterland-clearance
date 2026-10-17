import {
  pgTable,
  serial,
  bigserial,
  bigint,
  integer,
  smallint,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- Couche normalisation : référentiels ----------
export const agencies = pgTable(
  "agencies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull().unique(),
  },
  (t) => [uniqueIndex("agencies_name_uq").on(t.name)]
);

export const comUnits = pgTable(
  "com_units",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    agencyId: integer("agency_id").references(() => agencies.id),
  },
  (t) => [uniqueIndex("com_units_name_agency_uq").on(t.name, t.agencyId), index("com_units_agency_idx").on(t.agencyId)]
);

export const coms = pgTable(
  "coms",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 300 }).notNull(),
    comUnitId: integer("com_unit_id").references(() => comUnits.id),
    agencyId: integer("agency_id").references(() => agencies.id),
  },
  (t) => [
    uniqueIndex("coms_name_unit_agency_uq").on(t.name, t.comUnitId, t.agencyId),
    index("coms_agency_idx").on(t.agencyId),
    index("coms_unit_idx").on(t.comUnitId),
  ]
);

// ---------- Couche 2 : historique des imports / snapshots ----------
export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  fileType: varchar("file_type", { length: 2 }).notNull(), // 'A' | 'B'
  extractionDate: date("extraction_date", { mode: "string" }).notNull(),
  loadedAt: timestamp("loaded_at", { withTimezone: true }).defaultNow().notNull(),
  rowCount: integer("row_count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("success"), // success | warnings | failed
  warnings: jsonb("warnings").$type<string[]>().default([]),
  origin: varchar("origin", { length: 10 }).notNull().default("cli"), // web | cli
});

// ---------- Couche 1 : données brutes ----------
// Résumé par COM (Sheet1)
export const rawComSummary = pgTable(
  "raw_com_summary",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .references(() => imports.id)
      .notNull(),
    agencyId: integer("agency_id").references(() => agencies.id),
    comUnitId: integer("com_unit_id").references(() => comUnits.id),
    comId: integer("com_id").references(() => coms.id),
    // libellés bruts (pour traçabilité même si référentiels évoluent)
    agencyName: varchar("agency_name", { length: 200 }),
    comUnitName: varchar("com_unit_name", { length: 100 }),
    comName: varchar("com_name", { length: 300 }),
    isSubtotal: boolean("is_subtotal").notNull().default(false),
    dossiersValides: integer("dossiers_valides"),
    bae: integer("bae").notNull().default(0),
    factDouane: integer("fact_douane").notNull().default(0),
    miseEnLivraison: integer("mise_en_livraison").notNull().default(0),
    livraison: integer("livraison").notNull().default(0),
    retourConteneur: integer("retour_conteneur").notNull().default(0),
    declaresNonFactures: integer("declares_non_factures").notNull().default(0),
    factPrestation: integer("fact_prestation").notNull().default(0),
    archivage: integer("archivage").notNull().default(0),
    sansDeclaration: integer("sans_declaration").notNull().default(0),
    debours: integer("debours").notNull().default(0),
  },
  (t) => [
    index("raw_com_summary_import_idx").on(t.importId),
    index("raw_com_summary_com_idx").on(t.comId),
    index("raw_com_summary_agency_idx").on(t.agencyId),
  ]
);

// Détail par dossier (Sheet2 du Fichier A) — 10 catégories compactes (smallint 0/1) + masque de bits
export const rawDossierDetails = pgTable(
  "raw_dossier_details",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    importId: integer("import_id")
      .references(() => imports.id)
      .notNull(),
    agencyId: integer("agency_id").references(() => agencies.id),
    comUnitId: integer("com_unit_id").references(() => comUnits.id),
    comId: integer("com_id").references(() => coms.id),
    agencyName: varchar("agency_name", { length: 200 }),
    comUnitName: varchar("com_unit_name", { length: 100 }),
    comName: varchar("com_name", { length: 300 }),
    dossier: varchar("dossier", { length: 100 }).notNull(),
    bae: smallint("bae").notNull().default(0),
    factDouane: smallint("fact_douane").notNull().default(0),
    miseEnLivraison: smallint("mise_en_livraison").notNull().default(0),
    livraison: smallint("livraison").notNull().default(0),
    retourConteneur: smallint("retour_conteneur").notNull().default(0),
    declaresNonFactures: smallint("declares_non_factures").notNull().default(0),
    factPrestation: smallint("fact_prestation").notNull().default(0),
    archivage: smallint("archivage").notNull().default(0),
    sansDeclaration: smallint("sans_declaration").notNull().default(0),
    debours: smallint("debours").notNull().default(0),
    flagsMask: integer("flags_mask").notNull().default(0),
  },
  (t) => [
    index("raw_dossier_import_idx").on(t.importId),
    index("raw_dossier_com_idx").on(t.comId),
    index("raw_dossier_agency_idx").on(t.agencyId),
    index("raw_dossier_num_idx").on(t.dossier),
  ]
);

// Dossiers non archivés (Fichier B) — même structure, sans dossiers validés
export const rawUnarchived = pgTable(
  "raw_unarchived",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    importId: integer("import_id")
      .references(() => imports.id)
      .notNull(),
    agencyId: integer("agency_id").references(() => agencies.id),
    comUnitId: integer("com_unit_id").references(() => comUnits.id),
    comId: integer("com_id").references(() => coms.id),
    agencyName: varchar("agency_name", { length: 200 }),
    comUnitName: varchar("com_unit_name", { length: 100 }),
    comName: varchar("com_name", { length: 300 }),
    dossier: varchar("dossier", { length: 100 }).notNull(),
    bae: smallint("bae").notNull().default(0),
    factDouane: smallint("fact_douane").notNull().default(0),
    miseEnLivraison: smallint("mise_en_livraison").notNull().default(0),
    livraison: smallint("livraison").notNull().default(0),
    retourConteneur: smallint("retour_conteneur").notNull().default(0),
    declaresNonFactures: smallint("declares_non_factures").notNull().default(0),
    factPrestation: smallint("fact_prestation").notNull().default(0),
    archivage: smallint("archivage").notNull().default(0),
    sansDeclaration: smallint("sans_declaration").notNull().default(0),
    debours: smallint("debours").notNull().default(0),
    flagsMask: integer("flags_mask").notNull().default(0),
  },
  (t) => [
    index("raw_unarch_import_idx").on(t.importId),
    index("raw_unarch_com_idx").on(t.comId),
    index("raw_unarch_agency_idx").on(t.agencyId),
    index("raw_unarch_num_idx").on(t.dossier),
  ]
);

export type ImportRow = typeof imports.$inferSelect;
