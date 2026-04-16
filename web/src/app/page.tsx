import { SplashScreen } from "@/components/momento/splash-screen";
import { SHELL_GUTTER_CLASS } from "@/lib/shell-background";

export default function Home() {
  return (
    <div className={`flex min-h-dvh justify-center ${SHELL_GUTTER_CLASS}`}>
      <SplashScreen />
    </div>
  );
}
