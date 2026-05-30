/**
 * Saved Lists API
 * Persists saved lead lists (from Search & Scrape page) in SQLite.
 *
 * GET    /api/saved-lists       → list all saved lists
 * POST   /api/saved-lists       → save one list (overwrites by listName)
 * DELETE /api/saved-lists/:name → remove one list
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || '/app/data';

let db: any | null = null;

function getDb(): any {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, 'leads.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_lists (
      list_name TEXT PRIMARY KEY,
      leads TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

const router = Router();

// GET /api/saved-lists
router.get('/saved-lists', (_req: Request, res: Response) => {
  try {
    const rows = getDb().prepare('SELECT * FROM saved_lists ORDER BY updated_at DESC').all();
    const lists = rows.map((r: any) => ({
      name: r.list_name,
      leads: JSON.parse(r.leads),
      createdAt: r.created_at,
      leadCount: JSON.parse(r.leads).length,
    }));
    res.json({ lists });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/saved-lists — save one list
router.post('/saved-lists', (req: Request, res: Response) => {
  try {
    const { name, leads, createdAt } = req.body;
    if (!name || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'name and leads[] required' });
    }
    getDb().prepare(`
      INSERT INTO saved_lists (list_name, leads, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(list_name) DO UPDATE SET
        leads = ?,
        updated_at = datetime('now')
    `).run(name, JSON.stringify(leads), createdAt || new Date().toISOString(), JSON.stringify(leads));
    res.json({ saved: name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/saved-lists/:name
router.delete('/saved-lists/:name', (req: Request, res: Response) => {
  try {
    getDb().prepare('DELETE FROM saved_lists WHERE list_name = ?').run(req.params.name);
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
