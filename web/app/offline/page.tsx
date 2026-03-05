"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto pt-16 text-center">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <p className="text-4xl mb-3">📴</p>
        <h1 className="text-xl font-bold">Sin conexion</h1>
        <p className="text-sm text-zinc-500 mt-2">
          GymOS esta en modo offline. Puedes revisar datos guardados y volver a intentar cuando regreses a internet.
        </p>
        <Link
          href="/today"
          className="inline-block mt-5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold"
        >
          Volver a Today
        </Link>
      </div>
    </div>
  );
}
