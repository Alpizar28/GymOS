"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      const first = await supabase.auth.getSession();
      if (first.data.session) return first.data.session;
      const refreshed = await supabase.auth.refreshSession();
      return refreshed.data.session ?? null;
    }

    async function recoverSession() {
      const session = await resolveSession();
      if (session && mounted) {
        router.replace("/today");
      }
    }

    void recoverSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.replace("/today");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Cuenta creada. Revisa tu correo para confirmar si aplica.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/today");
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "No se pudo iniciar sesion";
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage("");
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "No se pudo iniciar con Google";
      setMessage(text);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="mb-4 flex items-center justify-center">
        <Image src="/logo-wordmark.svg" alt="GymOS" width={180} height={32} className="h-8 w-auto" priority />
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-4">
        <h1 className="text-xl font-bold">GymOS Login</h1>
        <p className="text-sm text-zinc-400">Autenticacion con Supabase</p>

        <form className="space-y-3" onSubmit={submit}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40"
          >
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googleLoading || loading}
          className="w-full py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 font-semibold disabled:opacity-40"
        >
          {googleLoading ? "Redirigiendo a Google..." : "Continuar con Google"}
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="text-xs text-zinc-400 underline"
        >
          {mode === "login" ? "No tienes cuenta? Crear cuenta" : "Ya tienes cuenta? Iniciar sesion"}
        </button>

        {message ? <p className="text-xs text-zinc-300">{message}</p> : null}
      </div>
    </div>
  );
}
