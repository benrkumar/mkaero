import { useState } from "react";
import { fetchApolloLeads } from "../api/client";

const INDUSTRIES = [
  "Aerospace & Defense",
  "Aviation",
  "Manufacturing",
  "Agriculture",
  "Oil & Gas",
  "Mining",
  "Construction",
  "Logistics & Supply Chain",
  "Government & Defense",
  "Emergency Services",
  "Surveying & Mapping",
  "Film & Media",
];

const SENIORITY = [
  "C-Level",
  "VP",
  "Director",
  "Manager",
  "Head of",
  "Founder",
  "Partner",
  "Engineer",
];

const COMPANY_SIZE_OPTIONS = [
  { label: "1-10", value: "1,10" },
  { label: "11-50", value: "11,50" },
  { label: "51-200", value: "51,200" },
  { label: "201-500", value: "201,500" },
  { label: "501-1000", value: "501,1000" },
  { label: "1001-5000", value: "1001,5000" },
  { label: "5000+", value: "5001,100000" },
];

type LeadResult = {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  email: string;
  linkedin_url: string;
};

function ChipInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput("");
  };

  const remove = (chip: string) => onChange(value.filter((x) => x !== chip));

  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">
        {label}
      </label>
      <div className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg p-2 flex flex-wrap gap-1.5 min-h-[42px]">
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-md px-2 py-0.5 text-xs"
          >
            {chip}
            <button
              onClick={() => remove(chip)}
              className="text-sky-400/60 hover:text-sky-300 ml-0.5"
            >
              &#10005;
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
          placeholder={value.length === 0 ? placeholder : ""}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
        />
      </div>
      <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Press Enter to add</p>
    </div>
  );
}

export default function LeadFinder() {
  const [jobTitles, setJobTitles] = useState<string[]>(["CEO", "CTO", "Founder", "Head of Engineering"]);
  const [locations, setLocations] = useState<string[]>(["India"]);
  const [keywords, setKeywords] = useState<string[]>(["drone", "UAV"]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<string[]>([]);
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [maxResults, setMaxResults] = useState(50);
  const [importTag, setImportTag] = useState("apollo-import");

  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");

  const toggleIndustry = (v: string) =>
    setIndustries((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const toggleSeniority = (v: string) =>
    setSeniority((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const toggleSize = (v: string) =>
    setCompanySizes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const handleSearch = async () => {
    if (!jobTitles.length && !keywords.length) {
      setError("Add at least one job title or keyword.");
      return;
    }
    setError("");
    setImported(false);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        job_titles: jobTitles,
        locations,
        keywords,
        max_results: maxResults,
        import_tag: importTag,
      };
      if (industries.length) payload.industries = industries;
      if (seniority.length) payload.seniority = seniority;
      if (companySizes.length) payload.company_sizes = companySizes;

      const res = await fetchApolloLeads(payload);
      setResults(res.contacts ?? res ?? []);
      setImported(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? "Lead fetch failed. Check your Apollo API key in Settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Finder</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Pull verified leads from Apollo.io and import them into contacts and campaigns.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Filters */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Search Filters</h3>

            <ChipInput label="Job Titles / Roles" value={jobTitles} onChange={setJobTitles} placeholder="CEO, CTO, Procurement..." />
            <ChipInput label="Locations" value={locations} onChange={setLocations} placeholder="India, Dubai, Singapore..." />
            <ChipInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="drone, UAV, autonomy..." />

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Industry</label>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map((ind) => (
                  <button key={ind} onClick={() => toggleIndustry(ind)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition border ${industries.includes(ind) ? "bg-sky-500/20 text-sky-300 border-sky-500/40" : "bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"}`}>
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Seniority</label>
              <div className="flex flex-wrap gap-1.5">
                {SENIORITY.map((s) => (
                  <button key={s} onClick={() => toggleSeniority(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition border ${seniority.includes(s) ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Company Size</label>
              <div className="flex flex-wrap gap-1.5">
                {COMPANY_SIZE_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => toggleSize(o.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition border ${companySizes.includes(o.value) ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Import Settings</h3>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Max Results</label>
              <div className="flex items-center gap-3">
                <input type="range" min={10} max={200} step={10} value={maxResults} onChange={(e) => setMaxResults(parseInt(e.target.value))} className="flex-1 accent-sky-500" />
                <span className="text-sm font-mono text-sky-400 w-8 text-right">{maxResults}</span>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Import Tag</label>
              <input
                className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
                placeholder="e.g. drone-oem-india"
                value={importTag}
                onChange={(e) => setImportTag(e.target.value)}
              />
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Applied to all imported contacts</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">{error}</div>
          )}

          <button onClick={handleSearch} disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching from Apollo...
              </>
            ) : "Fetch Leads \u2192"}
          </button>
        </div>

        {/* Results */}
        <div className="col-span-2">
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-surface-400/30">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {results.length > 0 ? `${results.length} leads fetched` : "Results"}
              </h3>
              {imported && results.length > 0 && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  &#10003; Saved to Contacts with tag &ldquo;{importTag}&rdquo;
                </span>
              )}
            </div>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-surface-600 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <p className="text-slate-900 dark:text-white font-medium mb-1">No leads yet</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
                  Set your filters and click &ldquo;Fetch Leads&rdquo; to pull verified contacts from Apollo.io.
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-surface-700">
                    <tr className="border-b border-surface-400/20">
                      {["Name", "Title", "Company", "Location", "Channels"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-surface-400/15">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-surface-600/40 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center text-xs font-bold text-sky-400 shrink-0">
                              {r.first_name?.[0] ?? "?"}
                            </div>
                            <span className="text-slate-900 dark:text-white font-medium">{r.first_name} {r.last_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{r.title}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{r.company}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{r.location}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {r.email && <span className="text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 rounded px-1.5 py-0.5">Email</span>}
                            {r.linkedin_url && <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded px-1.5 py-0.5">LI</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
