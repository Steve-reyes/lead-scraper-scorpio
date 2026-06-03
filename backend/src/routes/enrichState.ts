/**
 * Shared enrichment state — allows /api/enrich/stop to abort both
 * batch and deep enrichment from a single endpoint.
 */

export const enrichState: {
  batchAbort: AbortController | null;
  deepAbort: AbortController | null;
} = {
  batchAbort: null,
  deepAbort: null,
};
