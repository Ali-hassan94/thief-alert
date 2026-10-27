import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ueuohbqfpdjgyuwyyitf.supabase.co";

const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_l4fFOMXb6CL_P_iUkNs_hg_UUsu32oT";

export const supabase = createClient(url, key);