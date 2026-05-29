import { AvatarImage } from "@/components/ui/avatar";
import { useResolvedAvatar } from "@/lib/avatar";

/**
 * <AvatarImage> wrapper that resolves an avatar storage reference
 * (stored as `members.photo_url`) into a signed URL on render.
 * Use anywhere we previously rendered <AvatarImage src={member.photo_url} />.
 */
export function MemberAvatarImage({ src, alt }: { src?: string | null; alt?: string }) {
  const url = useResolvedAvatar(src);
  if (!url) return null;
  return <AvatarImage src={url} alt={alt} />;
}

/** Plain <img> variant for non-Avatar contexts (cards, badges). */
export function MemberAvatarImg({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const url = useResolvedAvatar(src);
  if (!url) return null;
  return <img src={url} alt={alt ?? ""} className={className} />;
}
