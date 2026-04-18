import Image from "next/image";

import { TOKEN_INLINE_ICON_SIZE_PX } from "@/lib/constants/token-inline-icon";

/** Served from `web/public/snap-token-logo.png` (transparent PNG). */
const SNAP_TOKEN_ICON_URL = "/snap-token-logo.png";

/** Source file intrinsic dimensions (transparent PNG `public/snap-token-logo.png`). */
const SNAP_LOGO_SRC_WIDTH = 638;
const SNAP_LOGO_SRC_HEIGHT = 622;

/** @deprecated Use {@link TOKEN_INLINE_ICON_SIZE_PX} from `@/lib/constants/token-inline-icon`. */
export const SNAP_INLINE_ICON_SIZE_PX = TOKEN_INLINE_ICON_SIZE_PX;

/**
 * SNAP-only scale on the `size` baseline: rendered edge = `round(size × this)`. MEZO/MUSD stay at
 * {@link TOKEN_INLINE_ICON_SIZE_PX} px; SNAP is **1.3×** that so the mark reads slightly larger.
 */
export const SNAP_INLINE_ICON_DISPLAY_SCALE = 1.3;

interface SnapInlineIconProps {
  /** Layout baseline in px (same default as MEZO/MUSD); rendered SNAP box is this × {@link SNAP_INLINE_ICON_DISPLAY_SCALE}. */
  size?: number;
  className?: string;
  /** When true, image is decorative (e.g. next to a visible “SNAP” label). */
  decorative?: boolean;
}

export function SnapInlineIcon({
  size = TOKEN_INLINE_ICON_SIZE_PX,
  className = "",
  decorative = false,
}: SnapInlineIconProps) {
  const boxPx = Math.round(size * SNAP_INLINE_ICON_DISPLAY_SCALE);
  /** Same treatment as MUSD/MEZO inline icons: circular clip + `object-cover` so the mark fills the circle. */
  const mergedClass = [
    "shrink-0 rounded-full bg-transparent object-cover align-middle leading-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Image
      src={SNAP_TOKEN_ICON_URL}
      alt={decorative ? "" : "SNAP"}
      width={SNAP_LOGO_SRC_WIDTH}
      height={SNAP_LOGO_SRC_HEIGHT}
      className={mergedClass}
      style={{ width: boxPx, height: boxPx }}
      sizes={`${boxPx}px`}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
