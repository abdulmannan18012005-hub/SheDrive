import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Polyfill WebSocket for Node.js < 22 using the 'ws' package.
// This must be done before createClient() is called.
// Official Supabase recommendation: https://supabase.com/docs/reference/javascript/initializing
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = ws;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    '[Supabase] Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in server/.env. ' +
    'Supabase Auth features (password reset) will not work.'
  );
}

/**
 * Server-side Supabase client using the Service Role key.
 * This has admin privileges and bypasses Row Level Security.
 * Used only for password reset email delivery via Supabase Auth.
 *
 * The globalThis.WebSocket polyfill above resolves the Node.js 20
 * "WebSocket is not defined" error thrown by @supabase/realtime-js.
 */
export const supabase: SupabaseClient = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : (null as any);

