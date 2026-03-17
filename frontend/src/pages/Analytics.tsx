import { useEffect, useState } from "react";
import { getOverview, getCampaigns, getCampaignStepAnalytics } from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

type StepAnalytic = {
  step_order: number;
  subject_template: string;
  sent: number;
  opened: number;
  clicked: number;
};

// ── Shared helpers ─────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const pct = (num: number, denom: number) =>
  denom > 0 ? ((num / denom) * 100).toFixed(1) : "0.0";

// ── Tab: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ overview, campaigns }: { overview: any; campaigns: any[] }) {
  const email = overview?.email ?? {};

  const funnelData = [
    { name: "Sent", value: email.total_sent ?? 0, fill: "#0EA5E9" },
    {
      name: "Opened",
      value:
        email.total_opened ??
        Math.round(((email.total_sent ?? 0) * (email.open_rate ?? 0)) / 100),
      fill: "#6366F1",
    },
    {
      name: "Clicked",
      value:
        email.total_clicked ??
        Math.round(((email.total_sent ?? 0) * (email.click_rate ?? 0)) / 100),
      fill: "#8B5CF6",
    },
    {
      name: "Replied",
      value:
        email.total_replied ??
        Math.round(((email.total_sent ?? 0) * (email.reply_rate ?? 0)) / 100),
      fill: "#10B981",
    },
  ];

  const campaignData = campaigns.slice(0, 8).map((c) => ({
    name: c.name.length > 16 ? c.name.slice(0, 16) + "\u2026" : c.name,
    Sent: c.total_sent ?? 0,
    Opened: c.total_opened ?? 0,
    Replied: c.total_replied ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: overview?.total_contacts ?? 0, color: "text-sky-400" },
          { label: "Active Campaigns", value: overview?.active_campaigns ?? 0, color: "text-emerald-400" },
          { label: "Emails Sent", value: email.total_sent ?? 0, color: "text-violet-400" },
          { label: "Reply Rate", value: `${email.reply_rate ?? 0}%`, color: "text-orange-400" },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5"
          >
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold mb-2">
              {k.label}
            </p>
            <p className={`text-3xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Email funnel chart */}
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Email Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2238" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#0F1220" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#0EA5E9" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement rates */}
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Engagement Rates</h3>
          <div className="space-y-4 mt-2">
            {[
              { label: "Open Rate", value: email.open_rate ?? 0, color: "#0EA5E9", max: 60 },
              { label: "Click Rate", value: email.click_rate ?? 0, color: "#6366F1", max: 20 },
              { label: "Reply Rate", value: email.reply_rate ?? 0, color: "#10B981", max: 15 },
              { label: "Bounce Rate", value: email.bounce_rate ?? 0, color: "#F97316", max: 10 },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                  <span className="font-mono font-semibold" style={{ color: r.color }}>
                    {r.value}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-surface-500 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((r.value / r.max) * 100, 100)}%`,
                      background: r.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign comparison */}
      {campaignData.length > 0 && (
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Campaign Comparison{" "}
            <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(top 8)</span>
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={campaignData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2238" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#0F1220" }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
              <Bar dataKey="Sent" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Opened" fill="#6366F1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Replied" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Tab: Email ─────────────────────────────────────────────────────────────

function EmailTab({ campaigns, overview }: { campaigns: any[]; overview: any }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [stepAnalytics, setStepAnalytics] = useState<StepAnalytic[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  const email = overview?.email ?? {};
  const sent = email.total_sent ?? 0;
  const opened =
    email.total_opened ?? Math.round((sent * (email.open_rate ?? 0)) / 100);
  const clicked =
    email.total_clicked ?? Math.round((sent * (email.click_rate ?? 0)) / 100);

  useEffect(() => {
    if (!selectedCampaignId) {
      setStepAnalytics([]);
      return;
    }
    setStepsLoading(true);
    getCampaignStepAnalytics(selectedCampaignId)
      .then((data) => setStepAnalytics(Array.isArray(data) ? data : data.steps ?? []))
      .catch(() => setStepAnalytics([]))
      .finally(() => setStepsLoading(false));
  }, [selectedCampaignId]);

  return (
    <div className="space-y-6">
      {/* Funnel cards */}
      <div className="flex items-center gap-3">
        {[
          { label: "Sent", value: sent, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
          { label: "Opened", value: opened, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
          { label: "Clicked", value: clicked, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map((card, i, arr) => (
          <div key={card.label} className="flex items-center gap-3 flex-1">
            <div
              className={`flex-1 bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 ${card.bg} dark:bg-opacity-100`}
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold mb-2">
                {card.label}
              </p>
              <p className={`text-3xl font-bold font-mono ${card.color}`}>
                {card.value.toLocaleString()}
              </p>
              {i > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {pct(card.value, sent)}% of sent
                </p>
              )}
            </div>
            {i < arr.length - 1 && (
              <svg
                className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Per-step breakdown */}
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Per-Step Breakdown
          </h3>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition"
          >
            <option value="">Select a campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!selectedCampaignId && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            Select a campaign above to see step-by-step analytics.
          </p>
        )}

        {selectedCampaignId && stepsLoading && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500 text-sm">
            <svg className="animate-spin w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading steps…
          </div>
        )}

        {selectedCampaignId && !stepsLoading && stepAnalytics.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            No step analytics available for this campaign yet.
          </p>
        )}

        {selectedCampaignId && !stepsLoading && stepAnalytics.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-400/40">
                  {["Step", "Subject", "Sent", "Opened (%)", "Clicked (%)"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold pb-3 pr-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stepAnalytics.map((row) => (
                  <tr
                    key={row.step_order}
                    className="border-b border-slate-100 dark:border-surface-400/20 hover:bg-slate-50 dark:hover:bg-surface-600/40 transition"
                  >
                    <td className="py-3 pr-4">
                      <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center">
                        {row.step_order}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                      {row.subject_template || <span className="text-slate-400 dark:text-slate-500 italic">No subject</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-900 dark:text-white">
                      {(row.sent ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-violet-500 dark:text-violet-400">
                        {(row.opened ?? 0).toLocaleString()}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1 text-xs">
                        ({pct(row.opened ?? 0, row.sent ?? 0)}%)
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-mono text-emerald-500 dark:text-emerald-400">
                        {(row.clicked ?? 0).toLocaleString()}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1 text-xs">
                        ({pct(row.clicked ?? 0, row.sent ?? 0)}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: LinkedIn ──────────────────────────────────────────────────────────

function LinkedInTab() {
  const cards = [
    { label: "Connections Sent", value: 0, color: "text-sky-400" },
    { label: "Accepted", value: 0, color: "text-emerald-400" },
    { label: "Messages Sent", value: 0, color: "text-violet-400" },
    { label: "Replied", value: 0, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Notice banner */}
      <div className="flex items-center gap-3 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/25 rounded-xl px-5 py-4">
        <svg
          className="w-5 h-5 text-sky-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"
          />
        </svg>
        <p className="text-sm text-slate-700 dark:text-sky-200">
          <span className="font-semibold">LinkedIn analytics powered by Phantombuster.</span>{" "}
          Data synced from Phantombuster runs. Trigger a LinkedIn phantom to populate metrics here.
        </p>
      </div>

      {/* Connection funnel cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 text-center"
          >
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold mb-2">
              {card.label}
            </p>
            <p className={`text-3xl font-bold font-mono ${card.color}`}>0</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
              Data synced from Phantombuster runs
            </p>
          </div>
        ))}
      </div>

      {/* Funnel visual */}
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-5">
          LinkedIn Connection Funnel
        </h3>
        <div className="flex items-center gap-2">
          {[
            { label: "Sent", pctWidth: "w-full", bg: "bg-sky-500" },
            { label: "Accepted", pctWidth: "w-3/4", bg: "bg-emerald-500" },
            { label: "Msg Sent", pctWidth: "w-1/2", bg: "bg-violet-500" },
            { label: "Replied", pctWidth: "w-1/4", bg: "bg-orange-500" },
          ].map((bar, i, arr) => (
            <div key={bar.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{bar.label}</p>
                <div className="h-2 bg-slate-100 dark:bg-surface-500 rounded-full overflow-hidden">
                  <div className={`h-full ${bar.bg} opacity-30 rounded-full w-full`} />
                </div>
                <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1">0</p>
              </div>
              {i < arr.length - 1 && (
                <svg
                  className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center italic">
          No data yet — run a LinkedIn Phantombuster phantom to populate this funnel.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type TabId = "overview" | "email" | "linkedin";

export default function Analytics() {
  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    Promise.all([
      getOverview().then(setOverview),
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
          Loading analytics...
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "email", label: "Email" },
    { id: "linkedin", label: "LinkedIn" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Email funnel, campaign performance, and LinkedIn activity.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab overview={overview} campaigns={campaigns} />
      )}
      {activeTab === "email" && (
        <EmailTab campaigns={campaigns} overview={overview} />
      )}
      {activeTab === "linkedin" && <LinkedInTab />}
    </div>
  );
}
