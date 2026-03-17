import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCampaigns, getOverview } from "../api/client";
import StatsCard from "../components/StatsCard";

const STATUS_MAP: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  draft:     "bg-surface-500 text-slate-400 border border-surface-400",
  paused:    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  completed: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOverview().then(setStats),
      getCampaigns().then(setCampaigns),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <svg className="animate-spin w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading command center...
        </div>
      </div>
    );
  }

  const recentCampaigns = campaigns.slice(0, 6);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Command Center</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Indo Aerial Systems &#8212; Outreach Intelligence Platform
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Contacts" value={stats?.total_contacts ?? 0} color="blue" />
        <StatsCard
          label="Active Campaigns"
          value={stats?.active_campaigns ?? 0}
          sub={`of ${stats?.total_campaigns ?? 0} total`}
          color="green"
        />
        <StatsCard label="Emails Sent" value={stats?.email?.total_sent ?? 0} color="purple" />
        <StatsCard
          label="Reply Rate"
          value={`${stats?.email?.reply_rate ?? 0}%`}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {/* AI Wizard promo */}
          <div className="bg-gradient-drone rounded-xl p-6 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60 mb-1">AI-Powered</p>
                <h2 className="text-xl font-bold text-white mb-1">Campaign Wizard</h2>
                <p className="text-white/70 text-sm max-w-sm">
                  Describe your audience. AI generates the full campaign &#8212; email sequence, LinkedIn messages, and leads from Apollo.
                </p>
              </div>
              <Link to="/wizard" className="shrink-0 ml-6 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
                Launch Wizard
              </Link>
            </div>
          </div>

          {/* Campaigns list */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-surface-400/30">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Campaigns</h3>
              <Link to="/email" className="text-xs text-sky-400 hover:text-sky-300">View All</Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-surface-400/20">
              {recentCampaigns.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No campaigns yet.{" "}
                  <Link to="/wizard" className="text-sky-400 hover:underline">Create with AI</Link>
                  {" "}or{" "}
                  <Link to="/email/builder" className="text-sky-400 hover:underline">build manually</Link>.
                </div>
              ) : (
                recentCampaigns.map((c) => (
                  <div key={c.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-surface-600/50 transition">
                    <div className="flex-1 min-w-0">
                      <Link to={`/campaigns/${c.id}`} className="text-sm font-medium text-slate-900 dark:text-white hover:text-sky-400 truncate block">
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {c.steps?.length ?? 0} steps &middot;{" "}
                        {[c.email_channel && "Email", c.linkedin_channel && "LinkedIn"].filter(Boolean).join(" + ")}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_MAP[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                    <Link to={`/campaigns/${c.id}`} className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white">
                      View &#8594;
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-4">Email Performance</h3>
            <div className="space-y-3">
              {[
                { label: "Open Rate", value: `${stats?.email?.open_rate ?? 0}%`, color: "text-sky-400" },
                { label: "Click Rate", value: `${stats?.email?.click_rate ?? 0}%`, color: "text-violet-400" },
                { label: "Reply Rate", value: `${stats?.email?.reply_rate ?? 0}%`, color: "text-emerald-400" },
                { label: "Bounced", value: stats?.email?.bounced ?? 0, color: "text-red-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
                  <span className={`text-sm font-mono font-semibold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-4">LinkedIn</h3>
            <div className="space-y-3">
              {[
                { label: "Connections Sent", value: stats?.linkedin?.connections_sent ?? 0, color: "text-sky-400" },
                { label: "Acceptance Rate", value: `${stats?.linkedin?.acceptance_rate ?? 0}%`, color: "text-emerald-400" },
                { label: "Messages Sent", value: stats?.linkedin?.messages_sent ?? 0, color: "text-violet-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
                  <span className={`text-sm font-mono font-semibold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { to: "/leads", icon: "+", label: "Import Leads", iconColor: "text-sky-400" },
                { to: "/email/builder", icon: "+", label: "New Campaign", iconColor: "text-sky-400" },
                { to: "/linkedin", icon: "\u2192", label: "LinkedIn Outreach", iconColor: "text-slate-400" },
                { to: "/analytics", icon: "\u2192", label: "View Analytics", iconColor: "text-slate-400" },
              ].map((a) => (
                <Link key={a.to} to={a.to}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-slate-50 dark:bg-surface-600 hover:bg-slate-100 dark:hover:bg-surface-500 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">
                  <span className={a.iconColor}>{a.icon}</span> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
