import Image from "next/image";

import { TOKEN_INLINE_ICON_SIZE_PX } from "@/lib/constants/token-inline-icon";

const MEZO_TOKEN_ICON_URL = "/mezo-token-logo.png";

interface MezoInlineIconProps {
  /** Edge length in px; defaults to {@link TOKEN_INLINE_ICON_SIZE_PX} (same as MUSD/SNAP). */
  size?: number;
  className?: string;
  decorative?: boolean;
}

export function MezoInlineIcon({
  size = TOKEN_INLINE_ICON_SIZE_PX,
  className = "shrink-0 rounded-full object-cover",
  decorative = false,
}: MezoInlineIconProps) {
  return (
    <Image
      src={MEZO_TOKEN_ICON_URL}
      alt={decorative ? "" : "MEZO"}
      width={size}
      height={size}
      className={className}
      sizes={`${size}px`}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
