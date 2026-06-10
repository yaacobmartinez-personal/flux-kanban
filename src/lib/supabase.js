import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The publishable/anon key is meant to ship in the browser; RLS is what keeps
// data safe. Never put the service_role key in a VITE_ var.
export const isConfigured = Boolean(url && anonKey);

// ---------------------------------------------------------------------------
// Client-side request limiter
//
// A token bucket + concurrency cap + FIFO queue wrapped around fetch. EVERY
// Supabase call (PostgREST, Auth, Realtime) is routed through this, so bursts
// (debounced card writes, per-drag position flushes, activity inserts) are
// smoothed instead of fired all at once.
//
// IMPORTANT: this is a UX / cost control, NOT a security boundary. A malicious
// client can bypass it by calling the REST API directly. The real ceiling is
// enforced in Postgres (see supabase/migrations/0001_init.sql §5).
// ---------------------------------------------------------------------------
const LIMIT = {
  ratePerSec: 10, // sustained requests/second
  burst: 12, // bucket capacity (allowed instantaneous burst)
  maxConcurrent: 6, // simultaneous in-flight requests
  maxRetries: 2, // retries on a *platform* 429 (Retry-After honored)
};

let tokens = LIMIT.burst;
let lastRefill = Date.now();
let active = 0;
const waiters = [];
let pumpTimer = null;

function refill() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  if (elapsed > 0) {
    tokens = Math.min(LIMIT.burst, tokens + elapsed * LIMIT.ratePerSec);
    lastRefill = now;
  }
}

function pump() {
  refill();
  while (waiters.length && tokens >= 1 && active < LIMIT.maxConcurrent) {
    tokens -= 1;
    active += 1;
    waiters.shift()();
  }
  if (waiters.length && !pumpTimer) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pump();
    }, 1000 / LIMIT.ratePerSec);
  }
}

function acquire() {
  return new Promise((resolve) => {
    waiters.push(resolve);
    pump();
  });
}

function release() {
  active = Math.max(0, active - 1);
  pump();
}

function emitRateLimited(message) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("flux:ratelimit", { detail: { message } })
    );
  }
}

async function limitedFetch(input, init) {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let res;
    try {
      res = await fetch(input, init);
    } finally {
      release();
    }

    if (res.status === 429) {
      // Distinguish our server-side limit (PostgREST maps SQLSTATE PT429) from a
      // platform throttle. App-level limits surface immediately; platform 429s
      // back off and retry.
      let appLimit = false;
      try {
        const body = await res.clone().json();
        if (body?.hint === "RATE_LIMIT" || body?.code === "PT429") {
          appLimit = true;
          emitRateLimited(body?.message || "You're doing that too fast.");
        }
      } catch {
        /* non-JSON body — treat as platform throttle */
      }

      if (!appLimit && attempt < LIMIT.maxRetries) {
        const retryAfter = parseFloat(res.headers.get("Retry-After"));
        const waitMs =
          (Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : Math.min(2 ** attempt * 600, 5000)) +
          Math.random() * 200;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }
    return res;
  }
}

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: limitedFetch },
    })
  : null;
