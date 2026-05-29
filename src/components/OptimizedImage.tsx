import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  /** Mark true only for the LCP image above the fold */
  priority?: boolean;
  /** Aspect-ratio container (e.g. "16/9") to reserve space and avoid CLS */
  aspect?: string;
  containerClassName?: string;
};

/**
 * Drop-in <img> replacement with:
 * - loading="lazy" + decoding="async" by default
 * - fetchpriority hint for LCP candidate
 * - skeleton placeholder while loading
 * - automatic CLS prevention via aspect container
 */
export function OptimizedImage({
  src,
  alt,
  priority = false,
  aspect,
  className,
  containerClassName,
  onLoad,
  onError,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/30",
        aspect && "w-full",
        containerClassName,
      )}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/40 to-muted/10" />
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          // @ts-expect-error fetchpriority not yet in React DOM types
          fetchpriority={priority ? "high" : "auto"}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          onError={(e) => {
            setErrored(true);
            onError?.(e);
          }}
          {...rest}
        />
      )}
      {errored && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Image indisponible
        </div>
      )}
    </div>
  );
}
