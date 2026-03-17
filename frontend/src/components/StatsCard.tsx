interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  color?: "blue" | "green" | "orange" | "red" | "purple";
  icon?: string;
}

const ACCENT: Record<string, string> = {
  blue:   "from-sky-500/20 to-sky-500/5 border-sky-500/30",
  green:  "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  red:    "from-red-500/20 to-red-500/5 border-red-500/30",
  purple: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
};

const DOT: Record<string, string> = {
  blue: "bg-sky-500", green: "bg-emerald-500", orange: "bg-orange-500", red: "bg-red-500", purple: "bg-violet-500",
};

export default function StatsCard({ label, value, sub, delta, deltaPositive, color = "blue", icon }: StatsCardProps) {
  return (
    <div className={`bg-gradient-to-br ${ACCENT[color]} border rounded-xl p-5 relative overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
        <span className={`w-2 h-2 rounded-full ${DOT[color]} mt-0.5`} />
      </div>
      <p className="text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {delta && (
          <span className={`text-xs font-medium ${deltaPositive ? "text-emerald-400" : "text-red-400"}`}>
            {deltaPositive ? "+" : ""}{delta}
          </span>
        )}
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}
