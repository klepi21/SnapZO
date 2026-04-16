import Image from "next/image";
import { MUSD_TOKEN_ICON_URL } from "@/lib/constants/musd-token-icon";

interface MusdInlineIconProps {
  /** Pixel size (width & height). */
  size?: number;
  className?: string;
}

export function MusdInlineIcon({
  size = 16,
  className = "shrink-0 rounded-full object-cover",
}: MusdInlineIconProps) {
  return (
    <Image
      src={MUSD_TOKEN_ICON_URL}
      alt="MUSD"
      width={size}
      height={size}
      className={className}
      sizes={`${size}px`}
    />
  );
}
