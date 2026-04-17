import Image from "next/image";

const SNAP_TOKEN_ICON_URL = "/snap-token-logo.png";

interface SnapInlineIconProps {
  /** Pixel size (width & height). */
  size?: number;
  className?: string;
  /** When true, image is decorative (e.g. next to a visible “SNAP” label). */
  decorative?: boolean;
}

export function SnapInlineIcon({
  size = 16,
  className = "shrink-0 rounded-full object-cover",
  decorative = false,
}: SnapInlineIconProps) {
  return (
    <Image
      src={SNAP_TOKEN_ICON_URL}
      alt={decorative ? "" : "SNAP"}
      width={size}
      height={size}
      className={className}
      sizes={`${size}px`}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
