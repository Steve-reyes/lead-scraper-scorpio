/**
 * Deep enrichment route — uses FlareSolverr to scrape directory sites.
 *
 * POST /api/enrich/deep — Enrich leads using directory site scraping
 *   via FlareSolverr (bypasses Cloudflare).
 *
 * Supports hard-stop via /api/enrich/stop (shared with batch enrich).
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Lead } from '../types';
import { findInDirectoriesDeep } from '../services/directoryFlare';
import { detectCountry } from '../utils/validators';
import { sendToClient } from '../index';
import { saveLead } from '../store';
import { enrichState } from './enrichState';

const router = Router();

router.post('/deep', async (req: Request, res: Response) => {
  try {
    const { leads, clientId } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Leads array is required' });
    }

    // Cancel any existing deep enrichment
    if (enrichState.deepAbort) {
      enrichState.deepAbort.abort();
      enrichState.deepAbort = null;
    }

    // Create fresh abort controller
    const ac = new AbortController();
    enrichState.deepAbort = ac;

    console.log(`[Deep Enrich] Starting deep enrichment for ${leads.length} leads${clientId ? ` (client ${clientId})` : ''}`);

    // Acknowledge immediately
    res.json({
      success: true,
      total: leads.length,
      status: 'started',
      message: `Deep enriching ${leads.length} leads through directory sites...`,
    });

    const sendMessage = clientId && sendToClient
      ? (msg: object) => sendToClient(clientId, msg)
      : () => {};

    sendMessage({
      type: 'progress',
      payload: { message: `Starting deep enrichment for ${leads.length} leads...` },
    });

    // Process leads sequentially (FlareSolverr handles 1 req at a time efficiently)
    const enrichedLeads: Lead[] = [];

    for (let i = 0; i < leads.length; i++) {
      // Check for stop signal
      if (ac.signal.aborted) {
        console.log('[Deep Enrich] Stopped by user request');
        sendMessage({
          type: 'enrich_cancelled',
          payload: { message: 'Deep enrichment stopped by user.' },
        });
        // Mark remaining as cancelled
        for (let j = i; j < leads.length; j++) {
          const cancelled: Lead = {
            ...leads[j],
            enrichmentStatus: 'failed',
            enrichmentError: 'stopped',
            updatedAt: new Date().toISOString(),
          };
          enrichedLeads.push(cancelled);
          saveLead(cancelled);
        }
        break;
      }

      const lead = leads[i] as Lead;
      sendMessage({
        type: 'progress',
        payload: { message: `[${i + 1}/${leads.length}] Searching directories for ${lead.businessName}...` },
      });

      const city = lead.city || lead.address?.split(',')[0]?.trim() || '';
      const country = lead.country || detectCountry(lead.address || '');

      try {
        const dirResult = await findInDirectoriesDeep(lead.businessName, city, country);

        const enriched: Lead = {
          ...lead,
          sources: [...(lead.sources || [])],
          enrichmentStatus: 'complete',
          updatedAt: new Date().toISOString(),
        };

        if (dirResult) {
          if (dirResult.phone && !enriched.phone) enriched.phone = dirResult.phone;
          if (dirResult.email && !enriched.email) enriched.email = dirResult.email;
          if (dirResult.website && !enriched.website) enriched.website = dirResult.website;

          const alreadyHasSource = enriched.sources.some((s) => s.type === dirResult.source.type);
          if (!alreadyHasSource) enriched.sources.push(dirResult.source);
        }

        enrichedLeads.push(enriched);

        saveLead(enriched);

        sendMessage({
          type: 'lead_enriched',
          payload: {
            lead: enriched,
            enrichedWithEmail: enriched.email ? 1 : 0,
            phonesFound: enriched.phone ? 1 : 0,
            fallbackSitesScraped: 1,
          },
        });
      } catch (error: any) {
        const failed: Lead = {
          ...lead,
          enrichmentStatus: 'failed',
          enrichmentError: `Deep enrichment failed: ${error?.message || 'Unknown'}`,
          updatedAt: new Date().toISOString(),
        };
        enrichedLeads.push(failed);
        saveLead(failed);
        sendMessage({ type: 'lead_enriched', payload: { lead: failed } });
      }
    }

    if (!ac.signal.aborted) {
      sendMessage({
        type: 'enrich_complete',
        payload: {
          totalEnriched: enrichedLeads.length,
          message: `Deep enriched ${enrichedLeads.length} leads.`,
        },
      });
    }

    // Cleanup
    if (enrichState.deepAbort === ac) {
      enrichState.deepAbort = null;
    }

  } catch (error: any) {
    console.error('[Deep Enrich] Error:', error);
    if (enrichState.deepAbort) {
      enrichState.deepAbort = null;
    }
    if (req.body?.clientId && sendToClient) {
      sendToClient(req.body.clientId, {
        type: 'error',
        payload: { error: `Deep enrichment failed: ${error?.message || 'Unknown error'}` },
      });
    }
  }
});

export default router;
