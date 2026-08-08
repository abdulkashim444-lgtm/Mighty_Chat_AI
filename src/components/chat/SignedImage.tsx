import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { signedUrlFor } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

export function SignedImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    void signedUrlFor(path)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        <ImageIcon className="size-4" /> Image unavailable
      </div>
    );
  }

  if (!url) {
    return <div className={cn("h-64 w-full max-w-md animate-pulse rounded-xl bg-muted", className)} />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={cn(
          "max-h-[26rem] w-auto max-w-full rounded-xl border border-border shadow-soft",
          className,
        )}
      />
    </a>
  );
}
