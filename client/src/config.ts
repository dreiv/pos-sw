/**
 * Single source of truth for where the API server lives. Every module
 * that talks to the backend (products cache refresh, sync engine,
 * connectivity probe) imports from here instead of keeping its own
 * copy of the URL.
 */
export const API_BASE = "http://localhost:3000";
export const HEALTH_URL = `${API_BASE}/health`;