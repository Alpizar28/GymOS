"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

const PUBLIC_PATHS = new Set(["/login", "/offline"]);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (PUBLIC_PATHS.has(pathname)) {
        if (mounted) setReady(true);
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/login");
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
