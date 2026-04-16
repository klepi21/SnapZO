const ONBOARDING_KEY = "snapzo-onboarding-v1";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
}
