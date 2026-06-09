-- ============================================================
-- Inventory Service Seed Data
-- Demo recipes for Steak (M001) and Nasi Goreng (M002)
-- ============================================================

-- Ingredients
INSERT IGNORE INTO ingredients (id, name, unit, stock_qty) VALUES
  (1, 'Daging Sapi', 'kg', 10),
  (2, 'Kentang', 'kg', 5),
  (3, 'Beras', 'kg', 20),
  (4, 'Telur', 'butir', 50),
  (5, 'Minyak Goreng', 'liter', 10),
  (6, 'Bawang Merah', 'gram', 500),
  (7, 'Kecap Manis', 'ml', 1000);

-- Recipes
INSERT IGNORE INTO recipes (id, menu_id, menu_name) VALUES
  (1, 'M001', 'Steak'),
  (2, 'M002', 'Nasi Goreng');

-- Recipe Items (BOM - Bill of Materials)
-- Steak (M001): Daging Sapi 0.5kg + Kentang 0.3kg
INSERT IGNORE INTO recipe_items (recipe_id, ingredient_id, qty_per_menu) VALUES
  (1, 1, 0.5),   -- Steak needs 0.5kg Daging Sapi
  (1, 2, 0.3);   -- Steak needs 0.3kg Kentang

-- Nasi Goreng (M002): Beras 0.2kg + Telur 2 butir + Minyak Goreng 0.05 liter + Bawang Merah 20 gram + Kecap Manis 30 ml
INSERT IGNORE INTO recipe_items (recipe_id, ingredient_id, qty_per_menu) VALUES
  (2, 3, 0.2),   -- Nasi Goreng needs 0.2kg Beras
  (2, 4, 2),     -- Nasi Goreng needs 2 butir Telur
  (2, 5, 0.05),  -- Nasi Goreng needs 0.05 liter Minyak Goreng
  (2, 6, 20),    -- Nasi Goreng needs 20 gram Bawang Merah
  (2, 7, 30);    -- Nasi Goreng needs 30 ml Kecap Manis
