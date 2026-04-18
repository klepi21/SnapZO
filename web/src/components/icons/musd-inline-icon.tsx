import Image from "next/image";

import { MUSD_TOKEN_ICON_URL } from "@/lib/constants/musd-token-icon";
import { TOKEN_INLINE_ICON_SIZE_PX } from "@/lib/constants/token-inline-icon";

interface MusdInlineIconProps {
  /** Edge length in px; defaults to {@link TOKEN_INLINE_ICON_SIZE_PX} (same as MEZO/SNAP). */
  size?: number;
  className?: string;
  /** When true, image is decorative (e.g. next to a visible “MUSD” label). */
  decorative?: boolean;
}

export function MusdInlineIcon({
  size = TOKEN_INLINE_ICON_SIZE_PX,
  className = "shrink-0 rounded-full object-cover",
  decorative = false,
}: MusdInlineIconProps) {
  return (
    <Image
      src={MUSD_TOKEN_ICON_URL}
      alt={decorative ? "" : "MUSD"}
      width={size}
      height={size}
      className={className}
      sizes={`${size}px`}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
