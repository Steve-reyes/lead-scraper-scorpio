/**
 * Leads API
 * Persists leads from search results in SQLite via store.ts.
 *
 * GET  /api/leads  → load all leads
 * POST /api/leads  → bulk save leads
 * DELETE /api/leads → clear all leads
 */

import { Router, Request, Response } from 'express';
import { loadLeads, saveLead, clearLeads } from '../store';

const router = Router();

// GET /api/leads
router.get('/leads', (_req: Request, res: Response) => {
  res.json({ success: true, leads: loadLeads() });
});

// POST /api/leads — bulk save leads
router.post('/leads', (req: Request, res: Response) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads array required' });
    }
    let saved = 0;
    for (const lead of leads) {
      if (saveLead(lead)) saved++;
    }
    res.json({ success: true, saved });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/leads
router.delete('/leads', (_req: Request, res: Response) => {
  clearLeads();
  res.json({ success: true });
});

export default router;
