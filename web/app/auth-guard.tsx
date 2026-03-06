"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const PUBLIC_PATHS = new Set(["/login", "/offline"]);
const ONBOARDING_PATH = "/onboarding";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      const first = await supabase.auth.getSession();
      if (first.data.session) return first.data.session;
      const refreshed = await supabase.auth.refreshSession();
      return refreshed.data.session ?? null;
    }

    async function check() {
      if (PUBLIC_PATHS.has(pathname)) {
        if (mounted) setReady(true);
        return;
      }

      const session = await resolveSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const status = await api.getOnboardingStatus().catch(() => ({ completed: true }));
      const isOnboarding = pathname === ONBOARDING_PATH;

      if (!status.completed && !isOnboarding) {
        router.replace(ONBOARDING_PATH);
        return;
      }

      if (status.completed && isOnboarding) {
        router.replace("/today");
        return;
      }

      if (mounted) setReady(true);
    }

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (PUBLIC_PATHS.has(pathname)) return;
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-500">
        Validando sesion...
      </div>
    );
  }

  return <>{children}</>;
}
