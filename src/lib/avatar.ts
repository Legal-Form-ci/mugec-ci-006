import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AVATARS_BUCKET = "avatars";
const SIGN_TTL_SECONDS = 60 * 60; // 1h
const cache = new Map<string, { url: string; expires: number }>();

/**
 * Extract the storage object path from a stored avatar reference.
 * Supports:
 *  - direct paths ("<userId>/photo-...png")
 *  - legacy public URLs from when the bucket was public
 *  - signed URLs (re-signed)
 * Returns null for data URLs or external URLs (not in our bucket).
 */
function extractAvatarPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("data:")) return null;
  const marker = `/storage/v1/object/`;
  const idx = stored.indexOf(marker);
  if (idx >= 0) {
    // matches /storage/v1/object/{public|sign}/avatars/<path>?...
    const after = stored.slice(idx + marker.length);
    const parts = after.split("/");
    if (parts.length >= 3 && parts[1] === AVATARS_BUCKET) {
      const path = parts.slice(2).join("/").split("?")[0];
      return decodeURIComponent(path);
    }
  }
  // Not a URL — assume already a storage path inside the avatars bucket
  if (!/^https?:\/\//.test(stored)) return stored.replace(/^\/+/, "");
  return null;
}

export async function getDisplayableAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("data:")) return stored;
  const path = extractAvatarPath(stored);
  if (!path) return stored; // external URL — passthrough
  const cached = cache.get(path);
  const now = Date.now();
  if (cached && cached.expires > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: now + SIGN_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export function useResolvedAvatar(stored: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!stored) { setUrl(null); return; }
    getDisplayableAvatarUrl(stored).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [stored]);
  return url;
}
