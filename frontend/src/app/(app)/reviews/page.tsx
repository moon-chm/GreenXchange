"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/utils";

type Submission = {
  id: string; plant_name: string; owner_id: string; kind: string; timestamp: string;
  reason: string; image_url: string | null; prior_image_url: string | null;
  prior_timestamp: string | null; can_approve: boolean;
  analysis?: { summary_reason?: string; health_status?: string; is_tree?: boolean };
};

export default function ReviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get<Submission[]>(`/growth/review/queue?limit=1&skip=${offset}`);
      setItems(response.data); setReason(""); setConfirmed(false);
    } catch (err) { setError(extractErrorMessage(err, "Could not load reviews.")); }
    finally { setLoading(false); }
  }, [offset]);
  useEffect(() => { if (user?.role === "ADMIN") void load(); }, [user?.role, load]);
  const item = items[0];
  async function decide(decision: "approve" | "reject") {
    if (!item || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await api.post(`/growth/review/${item.id}`, {
        decision, reason: reason.trim(), evidence_confirmed: confirmed,
      });
      setMessage(`Decision saved. ${response.data.points_awarded} GXC; ${response.data.reward_status.replaceAll("_", " ")}.`);
      await load();
    } catch (err) { setError(extractErrorMessage(err, "Could not save this decision. Retry safely.")); }
    finally { setBusy(false); }
  }
  if (authLoading) return <p>Loading account…</p>;
  if (user?.role !== "ADMIN") return <p>Administrator access is required to review plant evidence.</p>;
  return <main className="max-w-4xl mx-auto space-y-5 pb-10">
    <h1 className="text-3xl font-semibold text-canopy">Plant evidence reviews</h1>
    <p>Approve only when the photos establish a new, distinct plant or visible growth of the same plant. Reject duplicates, unverifiable location claims and insufficient evidence. AI observations do not establish authenticity.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-fern">{message}</p>}
    <div className="flex gap-4">
      <button disabled={loading || busy} onClick={() => void load()} className="border rounded-lg p-3">Refresh photos</button>
      <button disabled={loading || busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 1))} className="border rounded-lg p-3">Previous</button>
      <button disabled={loading || busy || !item} onClick={() => setOffset(offset + 1)} className="border rounded-lg p-3">Skip for now</button>
    </div>
    {loading ? <p>Loading evidence…</p> : !item ? <p>No submissions at this position. Return to Previous or refresh for new submissions.</p> : <section className="bg-white rounded-2xl p-5 space-y-4 border">
      <h2 className="text-xl font-semibold">{item.plant_name} · {item.kind === "registration" ? "Baseline" : "Growth"}</h2>
      <p className="text-sm">Account: {item.owner_id} · Submitted {new Date(item.timestamp).toLocaleString()}</p>
      <p>{item.reason}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <figure><figcaption>Previously approved photo{item.prior_timestamp && ` · ${new Date(item.prior_timestamp).toLocaleString()}`}</figcaption>
          {item.prior_image_url ? <img className="w-full h-80 object-contain" src={item.prior_image_url} alt="Previously approved plant evidence" /> : <p>No approved baseline photo.</p>}
        </figure>
        <figure><figcaption>Submitted photo</figcaption>{item.image_url ? <img className="w-full h-80 object-contain" src={item.image_url} alt="Plant evidence awaiting review" /> : <p>Photo unavailable. Refresh before reviewing.</p>}</figure>
      </div>
      <p className="text-sm">{item.analysis?.summary_reason || "AI observations unavailable."} {item.analysis?.health_status && `Health estimate: ${item.analysis.health_status}.`}</p>
      <label className="block">Decision reason<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} rows={3} className="block w-full border rounded-lg p-3" placeholder="Describe identity, location, duplicate checks and visible growth (at least 10 characters)." /></label>
      <label className="flex gap-3"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I inspected the evidence and confirmed a distinct new plant, or actual growth of the same plant against its approved photo, and resolved any location concerns.</label>
      {!item.can_approve && <p>This submission cannot be approved: a trusted photo or approved baseline is missing. Reject it with instructions to submit new evidence.</p>}
      <div className="flex gap-4">
        <button disabled={busy || reason.trim().length < 10 || !confirmed || !item.can_approve || !item.image_url || (item.kind === "growth" && !item.prior_image_url)} onClick={() => void decide("approve")} className="bg-fern text-white rounded-lg p-3 disabled:opacity-40">Approve evidence</button>
        <button disabled={busy || reason.trim().length < 10} onClick={() => void decide("reject")} className="border border-red-700 text-red-700 rounded-lg p-3 disabled:opacity-40">Reject evidence</button>
      </div>
    </section>}
  </main>;
}
