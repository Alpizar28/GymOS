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

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (mounted) setReady(true);
    }

    void check();
    return () => {
      mounted = false;
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
