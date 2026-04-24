import { Suspense } from "react";
import { ProfileView } from "@/components/momento/profile-view";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileView />
    </Suspense>
  );
}
