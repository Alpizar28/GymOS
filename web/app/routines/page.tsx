"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api, type RoutineCard, type RoutineFolder } from "@/lib/api";

function CreateFolderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createFolder() {
    if (!name.trim()) {
      setError("Nombre requerido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createRoutineFolder(name.trim());
      onCreated();
    } catch {
      setError("No se pudo crear la carpeta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="text-sm font-semibold mb-3">Nueva carpeta</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mamá"
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
        />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose} className="py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm">
            Cancelar
          </button>
          <button
            onClick={createFolder}
            disabled={saving}
            className="py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRoutineModal({
  folders,
  onClose,
  onCreated,
}: {
  folders: RoutineFolder[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [folderId, setFolderId] = useState<number>(folders[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createRoutine() {
    if (!name.trim()) {
      setError("Nombre requerido");
      return;
    }
    if (!folderId) {
      setError("Selecciona una carpeta");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createRoutine({
        folder_id: folderId,
        name: name.trim(),
        subtitle: subtitle.trim() || null,
        notes: null,
        exercises: [],
      });
      onCreated();
    } catch {
      setError("No se pudo crear la rutina");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Nueva rutina</h3>
        <select
          value={folderId}
          onChange={(e) => setFolderId(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
        >
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de rutina"
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitulo (opcional)"
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm">
            Cancelar
          </button>
          <button
            onClick={createRoutine}
            disabled={saving}
            className="py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoutinesPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<RoutineFolder[]>([]);
  const [routines, setRoutines] = useState<RoutineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [startingRoutine, setStartingRoutine] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [foldersData, routinesData] = await Promise.all([
        api.getRoutineFolders(),
        api.getRoutines(),
      ]);
      setFolders(foldersData);
      setRoutines(routinesData);
      setExpanded((prev) => {
        const next = { ...prev };
        for (const folder of foldersData) {
          if (next[folder.id] === undefined) next[folder.id] = true;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const routinesByFolder = useMemo(() => {
    const map: Record<number, RoutineCard[]> = {};
    for (const routine of routines) {
      if (!map[routine.folder_id]) map[routine.folder_id] = [];
      map[routine.folder_id].push(routine);
    }
    return map;
  }, [routines]);

  async function startRoutine(routineId: number) {
    setStartingRoutine(routineId);
    try {
      await api.startRoutine(routineId);
      router.push("/today");
    } finally {
      setStartingRoutine(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full border border-zinc-800">
          ←
        </button>
        <h1 className="text-xl font-bold">Routines</h1>
        <button onClick={() => void load()} className="w-10 h-10 rounded-full border border-zinc-800">
          ⟳
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 flex items-center justify-between">
        <p className="text-sm font-semibold">All Routines</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFolderModal(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-300"
          >
            📁
          </button>
          <button
            onClick={() => setShowRoutineModal(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white"
          >
            +
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Cargando rutinas...</div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder) => {
            const list = routinesByFolder[folder.id] ?? [];
            const isOpen = expanded[folder.id] ?? true;
            return (
              <div key={folder.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [folder.id]: !isOpen }))}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <p className="text-sm font-semibold">
                    {isOpen ? "▼" : "▶"} {folder.name} ({list.length})
                  </p>
                  <span className="text-zinc-500">⋮</span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {list.length === 0 ? (
                      <p className="text-xs text-zinc-600 py-2 px-1">Sin rutinas en esta carpeta.</p>
                    ) : (
                      list.map((routine) => (
                        <div key={routine.id} className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{routine.name}</p>
                              {routine.subtitle && <p className="text-xs text-zinc-500 mt-0.5 truncate">{routine.subtitle}</p>}
                            </div>
                            <button
                              onClick={() => void startRoutine(routine.id)}
                              disabled={startingRoutine === routine.id}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                            >
                              {startingRoutine === routine.id ? "..." : "START"}
                            </button>
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {(routine.preview_items ?? []).map((item) => (
                              <p key={`${routine.id}-${item.name}`} className="text-xs text-zinc-400 flex items-center justify-between">
                                <span>🏋️ {item.name}</span>
                                <span>{item.set_count} sets</span>
                              </p>
                            ))}
                            {routine.remaining_exercises ? (
                              <p className="text-xs text-zinc-600">and {routine.remaining_exercises} more</p>
                            ) : null}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Link
                              href={`/routines/${routine.id}`}
                              className="text-xs text-red-300 hover:text-red-200"
                            >
                              Open routine →
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showFolderModal && (
        <CreateFolderModal
          onClose={() => setShowFolderModal(false)}
          onCreated={() => {
            setShowFolderModal(false);
            void load();
          }}
        />
      )}
      {showRoutineModal && (
        <CreateRoutineModal
          folders={folders}
          onClose={() => setShowRoutineModal(false)}
          onCreated={() => {
            setShowRoutineModal(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
