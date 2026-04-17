import Image from "next/image";

const MEZO_TOKEN_ICON_URL = "/mezo-token-logo.png";

interface MezoInlineIconProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}

export function MezoInlineIcon({
  size = 16,
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
