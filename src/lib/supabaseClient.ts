// Safe Supabase client wrapper with env fallbacks
// Do NOT edit the auto-generated client at src/integrations/supabase/client.ts
// This wrapper prevents runtime crashes when envs are not injected in the build.
import { createClient } from '@supabase/supabase-js';

const FALLBACK_PROJECT_ID = 'yrjwyeuqfleqhbveohrf';
const FALLBACK_URL = `https://${FALLBACK_PROJECT_ID}.supabase.co`;
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
