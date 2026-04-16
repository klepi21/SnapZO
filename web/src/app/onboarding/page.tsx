import { OnboardingFlow } from "@/components/momento/onboarding-flow";
import { SHELL_GUTTER_CLASS } from "@/lib/shell-background";

export default function OnboardingPage() {
  return (
    <div className={`flex min-h-dvh justify-center ${SHELL_GUTTER_CLASS}`}>
      <OnboardingFlow />
    </div>
  );
}
