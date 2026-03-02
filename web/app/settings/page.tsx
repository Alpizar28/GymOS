"use client";

import { useEffect, useState } from "react";
import { api, type ProtectionRule } from "@/lib/api";

const MUSCLE_GROUPS = [
    "chest", "back", "shoulders", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "core",
];

function ProtectionBadge({ rule, onRemove }: { rule: ProtectionRule; onRemove: () => void }) {
    const severityColor =
        rule.severity >= 8
            ? "border-red-600/50 bg-red-950/30 text-red-300"
            : rule.severity >= 5
                ? "border-amber-600/50 bg-amber-950/30 text-amber-300"
                : "border-yellow-600/50 bg-yellow-950/30 text-yellow-300";

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl border ${severityColor}`}>
            <div>
                <p className="font-semibold capitalize">{rule.muscle_group}</p>
                <p className="text-xs opacity-70 mt-0.5">
                    Severity {rule.severity}/10 · Volume ×{rule.factor} ({Math.round(rule.factor * 100)}%)
                </p>
            </div>
            <button
                onClick={onRemove}
                className="px-3 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 text-xs hover:bg-red-900/40 hover:text-red-300 transition"
            >
                Remove
            </button>
        </div>
    );
}

export default function SettingsPage() {
    const [protections, setProtections] = useState<ProtectionRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [muscle, setMuscle] = useState("chest");
    const [severity, setSeverity] = useState(5);
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState("");

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    const load = () => {
        api.getProtections()
            .then(setProtections)
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    async function handleAdd() {
        setAdding(true);
        try {
            await api.addProtection(muscle, severity);
            load();
            showToast(`🛡️ Protection activated for ${muscle}`);
        } catch {
            showToast("❌ Failed to add protection");
        } finally {
            setAdding(false);
        }
    }

    async function handleRemove(muscleGroup: string) {
        try {
            await api.removeProtection(muscleGroup);
            setProtections((prev) => prev.filter((p) => p.muscle_group !== muscleGroup));
            showToast(`✅ Protection removed for ${muscleGroup}`);
        } catch {
            showToast("❌ Failed to remove protection");
        }
    }

    const severityLabel =
        severity >= 9 ? "Extreme — almost no volume"
            : severity >= 7 ? "High — significant volume cut"
                : severity >= 5 ? "Medium — moderate volume cut"
                    : severity >= 3 ? "Low — slight volume cut"
                        : "Minimal";

    return (
        <div className="max-w-xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-zinc-500 text-sm mt-1">Manage injury protection and training adjustments</p>
            </div>

            {/* ── Protection Manager ── */}
            <section className="mb-10">
                <h2 className="text-lg font-semibold text-zinc-300 mb-4">🛡️ Muscle Protection</h2>
                <p className="text-sm text-zinc-500 mb-5">
                    Activate protection for an injured or sore muscle group. Future plan generation
                    will automatically reduce volume for affected muscles.
                </p>

                {/* Active protections */}
                {loading ? (
                    <div className="text-zinc-600 text-sm">Loading...</div>
                ) : protections.length > 0 ? (
                    <div className="space-y-3 mb-6">
                        <p className="text-xs uppercase tracking-wider text-zinc-600 font-semibold">Active</p>
                        {protections.map((p) => (
                            <ProtectionBadge
                                key={p.muscle_group}
                                rule={p}
                                onRemove={() => handleRemove(p.muscle_group)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-zinc-800 text-zinc-600 text-sm text-center mb-6">
                        🟢 No active protections — all muscles at full volume
                    </div>
                )}

                {/* Add protection */}
                <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold text-zinc-300">Add Protection</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
                                Muscle Group
                            </label>
                            <select
                                value={muscle}
                                onChange={(e) => setMuscle(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500 capitalize"
                            >
                                {MUSCLE_GROUPS.map((m) => (
                                    <option key={m} value={m} className="capitalize">
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
                                Severity: {severity}/10
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={severity}
                                onChange={(e) => setSeverity(parseInt(e.target.value))}
                                className="w-full accent-violet-500 mt-1"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-zinc-500 italic">
                        {severityLabel} (volume ×{Math.round(Math.max(0.2, 1 - (severity / 10) * 0.8) * 100)}%)
                    </p>

                    <button
                        onClick={handleAdd}
                        disabled={adding}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                        {adding ? "Adding..." : `🛡️ Protect ${muscle}`}
                    </button>
                </div>
            </section>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl text-sm font-medium text-white">
                    {toast}
                </div>
            )}
        </div>
    );
}
