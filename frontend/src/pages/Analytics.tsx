import { useEffect, useState } from "react";
import { getOverview, getCampaigns } from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

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

export default function Analytics() {
  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const email = overview?.email ?? {};

  const funnelData = [
    { name: "Sent", value: email.total_sent ?? 0, fill: "#0EA5E9" },
    { name: "Opened", value: email.total_opened ?? Math.round((email.total_sent ?? 0) * (email.open_rate ?? 0) / 100), fill: "#6366F1" },
    { name: "Clicked", value: email.total_clicked ?? Math.round((email.total_sent ?? 0) * (email.click_rate ?? 0) / 100), fill: "#8B5CF6" },
    { name: "Replied", value: email.total_replied ?? Math.round((email.total_sent ?? 0) * (email.reply_rate ?? 0) / 100), fill: "#10B981" },
  ];

  const campaignData = campaigns.slice(0, 8).map((c) => ({
    name: c.name.length > 16 ? c.name.slice(0, 16) + "\u2026" : c.name,
    Sent: c.total_sent ?? 0,
    Opened: c.total_opened ?? 0,
    Replied: c.total_replied ?? 0,
  }));

  const linkedin = overview?.linkedin ?? {};

  const linkedInData = [
    { name: "Connections Sent", value: linkedin.connections_sent ?? 0 },
    { name: "Accepted", value: linkedin.connections_accepted ?? 0 },
    { name: "Messages Sent", value: linkedin.messages_sent ?? 0 },
    { name: "Replies", value: linkedin.message_replies ?? 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Email funnel, campaign performance, and LinkedIn activity.
        </p>
      </div>

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
        {/* Email funnel */}
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Email Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2238" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#0F1220" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Email rates */}
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
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
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

      {/* LinkedIn stats */}
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">LinkedIn Activity</h3>
        <div className="grid grid-cols-4 gap-4">
          {linkedInData.map((d) => (
            <div key={d.name} className="bg-slate-50 dark:bg-surface-600 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-mono text-sky-400">{d.value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{d.name}</p>
            </div>
          ))}
        </div>
        {linkedin.connections_sent > 0 && (
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="text-slate-400 dark:text-slate-500">Acceptance Rate: </span>
              <span className="text-emerald-400 font-mono font-semibold">
                {linkedin.acceptance_rate ?? 0}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Message Reply Rate: </span>
              <span className="text-sky-400 font-mono font-semibold">
                {linkedin.message_reply_rate ?? 0}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
