-- ==============================================================================
-- BAZA DANYCH FILAMENTÓW 3D - CLOUDFLARE D1 (SQLITE)
-- Wklej tę zawartość w Cloudflare Dashboard: D1 -> Twoja baza -> Console -> Execute
-- ==============================================================================

-- 1. Tworzenie tabeli 'filaments'
CREATE TABLE IF NOT EXISTS filaments (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    
    -- Główne pola:
    manufacturer TEXT NOT NULL,               -- Producent (np. Devil Design, Sunlu, Fiberlogy)
    material TEXT NOT NULL,                   -- Materiał (np. PLA, PETG, TPU 95A, ASA)
    version TEXT,                             -- Wersja (np. Matte, High Speed, Meta, Silk)
    color_name TEXT NOT NULL,                 -- Nazwa koloru (np. Czarny, Krwista Czerwień)
    color_hex TEXT DEFAULT '#3b82f6',         -- Kod koloru HEX (#rrggbb)
    location TEXT NOT NULL,                   -- Lokalizacja (np. Półka A, Pudełko próżniowe 2)
    
    -- Pola dodatkowe / parametry:
    weight_total INTEGER DEFAULT 1000,        -- Waga początkowa netto w gramach (g)
    weight_current INTEGER DEFAULT 1000,      -- Aktualna pozostała waga w gramach (g)
    weight_spool INTEGER DEFAULT 220,         -- Szacowana waga samej pustej szpuli (tara w g)
    temp_nozzle TEXT,                         -- Zalecana temp. dyszy (np. 210-230)
    temp_bed TEXT,                            -- Zalecana temp. stołu (np. 60-70)
    status TEXT DEFAULT 'W użyciu',           -- Status: 'Nowa', 'W użyciu', 'Końcówka', 'Pusta'
    notes TEXT                                -- Uwagi, parametry suszenia, flow itp.
);

-- 2. Indeks przyspieszający sortowanie po dacie dodania
CREATE INDEX IF NOT EXISTS idx_filaments_created ON filaments(created_at DESC);

-- 3. Przykładowe dane startowe (opcjonalne)
INSERT OR IGNORE INTO filaments 
(id, created_at, manufacturer, material, version, color_name, color_hex, location, weight_total, weight_current, temp_nozzle, temp_bed, status, notes)
VALUES
('init-1', datetime('now', '-2 days'), 'Fiberlogy', 'PLA', 'Matte', 'Grafitowy (Graphite)', '#374151', 'Półka A', 1000, 750, '210-225', '50-60', 'W użyciu', 'Świetne matowe wykończenie, ukrywa warstwy.'),
('init-2', datetime('now', '-1 day'), 'Devil Design', 'PETG', 'Standard', 'Przezroczysty Czerwony', '#dc2626', 'Pudełko próżniowe 1', 1000, 920, '230-240', '70-80', 'W użyciu', 'Wymaga suszenia przed drukiem.'),
('init-3', datetime('now'), 'Sunlu', 'PLA', 'High Speed', 'Biały (White)', '#f8fafc', 'Półka A', 1000, 1000, '205-220', '50-60', 'Nowa', 'Dedykowany do szybkiego druku (CoreXY).');
