/**
 * Desktop gutter behind the phone column — bridges app dark UI (#060814)
 * without going pure black or pale gray: slate + subtle blue lift.
 */
export const SHELL_GUTTER_CLASS =
  "bg-[radial-gradient(ellipse_80%_58%_at_50%_-8%,rgba(255,45,144,0.18),transparent_54%),radial-gradient(ellipse_72%_52%_at_100%_0%,rgba(124,58,237,0.15),transparent_52%),linear-gradient(168deg,#1a1630_0%,#100f1f_38%,#13192b_100%)]";

/** Feed / shell column — layered depth behind cards (not flat black). */
export const SNAPZO_SCROLL_SURFACE_CLASS =
  "bg-[radial-gradient(ellipse_110%_85%_at_50%_-10%,rgba(255,45,144,0.18),transparent_52%),radial-gradient(ellipse_74%_58%_at_100%_0%,rgba(124,58,237,0.14),transparent_46%),radial-gradient(ellipse_62%_52%_at_0%_100%,rgba(126,216,255,0.1),transparent_44%),linear-gradient(178deg,#100f22_0%,#0a0e1b_36%,#0f1730_72%,#16163a_100%)]";
