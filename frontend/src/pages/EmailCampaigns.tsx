import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCampaigns, pauseCampaign, runCampaign } from "../api/client";

const STATUS: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  draft:     "bg-surface-500 text-slate-400 border border-surface-400",
  paused:    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  completed: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
};

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    getCampaigns()
      .then((all: any[]) => setCampaigns(all))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === "active").length,
    draft: campaigns.filter((c) => c.status === "draft").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email Campaigns</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Multi-step email drip campaigns with AI-generated content</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/wizard")}
            className="flex items-center gap-2 bg-gradient-drone text-white font-medium rounded-lg px-4 py-2 text-sm transition opacity-90 hover:opacity-100"
          >
            <span className="text-xs bg-white/20 rounded px-1.5 py-0.5">AI</span>
            Build with AI
          </button>
          <button
            onClick={() => navigate("/email/builder")}
            className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-500 rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            + Manual Builder
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Campaigns", value: stats.total, color: "text-slate-900 dark:text-white" },
          { label: "Active", value: stats.active, color: "text-emerald-400" },
          { label: "Draft", value: stats.draft, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Empty state: show wizard CTA prominently */}
      {!loading && campaigns.length === 0 && (
        <div className="bg-gradient-drone rounded-xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px"}} />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polyline points="2,4 12,14 22,4" />
                </svg>
              </div>
            <h2 className="text-xl font-bold text-white mb-2">No campaigns yet</h2>
            <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">
              Create your first email campaign. Use the AI Wizard for instant setup or the Manual Builder for full control.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/wizard" className="bg-white text-violet-700 font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-white/90 transition">
                AI Wizard
              </Link>
              <Link to="/email/builder" className="bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition">
                Manual Builder
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 hover:border-slate-300 dark:hover:border-surface-300 transition group">
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === "active" ? "bg-emerald-500 animate-pulse" : c.status === "draft" ? "bg-slate-500" : "bg-amber-500"}`} />

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <Link to={`/campaigns/${c.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-sky-400 transition truncate">
                  {c.name}
                </Link>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS[c.status] ?? ""}`}>{c.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                <span>{c.steps?.length ?? 0} steps</span>
                {c.email_channel && <span>Email</span>}
                {c.linkedin_channel && <span>LinkedIn</span>}
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
              {c.status === "active" ? (
                <button onClick={() => pauseCampaign(c.id).then(load)} className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition">
                  Pause
                </button>
              ) : (
                <button onClick={() => runCampaign(c.id).then(load).catch((e: any) => alert(e.response?.data?.detail))} className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition">
                  Activate
                </button>
              )}
              <Link to={`/campaigns/${c.id}`} className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-surface-400/50 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-500 transition">
                View \u2192
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
