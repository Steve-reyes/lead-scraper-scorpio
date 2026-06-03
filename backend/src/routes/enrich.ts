/**
 * Enrichment route.
 *
 * POST /api/enrich        — Enrich a single lead (synchronous)
 * POST /api/enrich/batch  — Enrich multiple leads (REST polling pattern)
 * POST /api/enrich/stop   — Hard-stop any running enrichment
 *
 * Enrichment is independent of WebSocket — survives browser close/refresh.
 * It must be explicitly invoked from the /enrich page.
 */

import { Router, Request, Response } from 'express';
import { enrichLead, enrichLeadBatch } from '../workers/enrichmentWorker';
import { saveLead } from '../store';
import { Lead } from '../types';
import { enrichState } from './enrichState';

const router = Router();

// ── POST /api/enrich — Enrich a single lead (synchronous) ──
router.post('/', async (req: Request, res: Response) => {
  try {
    const { lead } = req.body;
    if (!lead) {
      return res.status(400).json({ error: 'Lead is required' });
    }

    const enrichedLead = await enrichLead(lead, () => {});

    // Finalize status
    enrichedLead.enrichmentStatus = enrichedLead.enrichmentError ? 'failed' : 'complete';
    enrichedLead.updatedAt = new Date().toISOString();

    saveLead(enrichedLead);

    res.json({
      success: true,
      lead: enrichedLead,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Enrichment failed: ${error?.message || 'Unknown error'}` });
  }
});

// ── POST /api/enrich/batch — Enrich multiple leads ──
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { leads } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Leads array is required' });
    }

    // Cancel any existing enrichment first
    if (enrichState.batchAbort) {
      enrichState.batchAbort.abort();
      enrichState.batchAbort = null;
    }

    // Create a fresh abort controller for this run
    const ac = new AbortController();
    enrichState.batchAbort = ac;

    console.log(`[Enrich] Starting batch enrichment for ${leads.length} leads`);

    // Acknowledge immediately
    res.json({
      success: true,
      total: leads.length,
      status: 'started',
      message: `Starting enrichment for ${leads.length} leads...`,
    });

    const onUpdate = (lead: Lead) => {
      if (ac.signal.aborted) return;
      saveLead(lead);
    };

    try {
      const enrichedLeads = await enrichLeadBatch(leads, onUpdate, 5, ac.signal);
      if (!ac.signal.aborted) {
        console.log(`[Enrich] Batch complete — ${enrichedLeads.length} leads`);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[Enrich] Batch enrichment stopped by user');
      } else {
        console.error('[Enrich] Batch enrichment error:', error);
      }
    } finally {
      if (enrichState.batchAbort === ac) {
        enrichState.batchAbort = null;
      }
    }
  } catch (error: any) {
    console.error('[Enrich] Error:', error);
    // Response already sent — no need to send again
  }
});

// ── POST /api/enrich/stop — Hard-stop any running enrichment ──
router.post('/stop', (_req: Request, res: Response) => {
  let stoppedSomething = false;

  if (enrichState.batchAbort) {
    enrichState.batchAbort.abort();
    enrichState.batchAbort = null;
    stoppedSomething = true;
  }

  if (enrichState.deepAbort) {
    enrichState.deepAbort.abort();
    enrichState.deepAbort = null;
    stoppedSomething = true;
  }

  if (stoppedSomething) {
    console.log('[Enrich] Enrichment stopped by user request');
    res.json({ success: true, message: 'Enrichment stopped.' });
  } else {
    res.json({ success: true, message: 'No active enrichment to stop.' });
  }
});

export default router;
