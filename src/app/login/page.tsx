import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { whopConfigured } from "@/lib/whop";

export default async function Login() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 grid-bg">
      <Logo />
      <Suspense>
        <AuthForm mode="login" whopEnabled={whopConfigured()} />
      </Suspense>
    </div>
  );
}
