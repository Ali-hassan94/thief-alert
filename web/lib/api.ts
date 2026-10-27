// web/lib/api.ts
import { supabase } from "@/lib/supabase";

export type AlertItem = {
  photoUrl: string | null;
  
confirms: number;
fakes: number;
myVote: "confirm" | "fake" | null;
  id: string;
  description: string | null;
  status: "active" | "resolved";
  createdAt: string;
  lat: number;
  lng: number;
  distanceM: number | null;
  mine: boolean;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function formatDistance(m: number | null) {
  if (m == null) return "";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}