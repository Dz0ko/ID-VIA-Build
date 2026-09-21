import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { whopConfigured } from "@/lib/whop";

export default async function Signup() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 grid-bg">
      <Logo />
      <Suspense>
        <AuthForm mode="signup" whopEnabled={whopConfigured()} />
      </Suspense>
    </div>
  );
}
