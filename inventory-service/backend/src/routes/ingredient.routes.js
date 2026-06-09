const express = require('express');
const router = express.Router();
const pool = require('../config/pool');

// GET /api/inventory/ingredients — list all ingredients
router.get('/ingredients', async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT id, name, unit, stock_qty, updated_at FROM ingredients ORDER BY id');
      res.json(rows);
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ingredients', details: err.message });
  }
});

// POST /api/inventory/ingredients — create a new ingredient
router.post('/ingredients', async (req, res) => {
  const { name, unit, stock_qty } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ error: 'name and unit are required' });
  }

  const qty = stock_qty !== undefined ? stock_qty : 0;

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.query(
        'INSERT INTO ingredients (name, unit, stock_qty) VALUES (?, ?, ?)',
        [name, unit, qty],
      );
      res.status(201).json({ id: result.insertId, name, unit, stock_qty: Number(qty) });
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ingredient', details: err.message });
  }
});

// PATCH /api/inventory/ingredients/:id — update ingredient (stock_qty)
router.patch('/ingredients/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_qty } = req.body;

  if (stock_qty !== undefined && stock_qty < 0) {
    return res.status(400).json({ error: 'stock_qty cannot be negative' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.query(
        'UPDATE ingredients SET stock_qty = ? WHERE id = ?',
        [stock_qty, id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      const [rows] = await conn.query('SELECT id, name, unit, stock_qty, updated_at FROM ingredients WHERE id = ?', [id]);
      res.json(rows[0]);
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ingredient', details: err.message });
  }
});

module.exports = router;
