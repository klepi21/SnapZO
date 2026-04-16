/**
 * Desktop gutter behind the phone column — bridges app dark UI (#060814)
 * without going pure black or pale gray: slate + subtle blue lift.
 */
export const SHELL_GUTTER_CLASS =
  "bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(59,130,246,0.11),transparent_52%),linear-gradient(168deg,#161c2c_0%,#0e121c_42%,#141a28_100%)]";

/** Feed / shell column — layered depth behind cards (not flat black). */
export const SNAPZO_SCROLL_SURFACE_CLASS =
  "bg-[radial-gradient(ellipse_110%_85%_at_50%_-8%,rgba(99,102,241,0.14),transparent_52%),radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(59,130,246,0.08),transparent_45%),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(14,165,233,0.06),transparent_42%),linear-gradient(178deg,#0a0f1c_0%,#070b14_35%,#0c1222_70%,#0e1528_100%)]";
