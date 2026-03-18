import { useState } from "react";
import { fetchApolloLeads, hunterDiscover, fetchHunterLeads } from "../api/client";

// ── Apollo constants ───────────────────────────────────────────────────────

const INDUSTRIES = [
  "Aerospace & Defense", "Aviation", "Manufacturing", "Agriculture",
  "Oil & Gas", "Mining", "Construction", "Logistics & Supply Chain",
  "Government & Defense", "Emergency Services", "Surveying & Mapping", "Film & Media",
];
const SENIORITY = ["C-Level", "VP", "Director", "Manager", "Head of", "Founder", "Partner", "Engineer"];
const COMPANY_SIZE_OPTIONS = [
  { label: "1-10", value: "1,10" }, { label: "11-50", value: "11,50" },
  { label: "51-200", value: "51,200" }, { label: "201-500", value: "201,500" },
  { label: "501-1000", value: "501,1000" }, { label: "1001-5000", value: "1001,5000" },
  { label: "5000+", value: "5001,100000" },
];

// ── Hunter constants ───────────────────────────────────────────────────────

const HUNTER_INDUSTRIES = [
  "Information Technology", "Software", "SaaS", "Manufacturing",
  "Aerospace & Defense", "Aviation & Aerospace", "Agriculture",
  "Automotive", "Construction", "Education", "Energy", "Finance",
  "Government", "Healthcare", "Logistics", "Media", "Telecommunications",
];
const HUNTER_SIZES = [
  { label: "1–10", value: "1,10" }, { label: "11–50", value: "11,50" },
  { label: "51–200", value: "51,200" }, { label: "201–500", value: "201,500" },
  { label: "501–1000", value: "501,1000" }, { label: "1001–5000", value: "1001,5000" },
  { label: "5000+", value: "5001,100000" },
];
const HUNTER_TYPES = [
  { label: "Private", value: "private" }, { label: "Public", value: "public" },
  { label: "Non-Profit", value: "non_profit" }, { label: "Government", value: "government" },
  { label: "Educational", value: "educational" },
];
const HUNTER_COUNTRIES = [
  { label: "India", value: "IN" }, { label: "United States", value: "US" },
  { label: "United Kingdom", value: "GB" }, { label: "Germany", value: "DE" },
  { label: "France", value: "FR" }, { label: "Singapore", value: "SG" },
  { label: "UAE", value: "AE" }, { label: "Australia", value: "AU" },
  { label: "Canada", value: "CA" }, { label: "Israel", value: "IL" },
];

// ── Types ──────────────────────────────────────────────────────────────────

type LeadResult = {
  id: string; first_name: string; last_name: string;
  title: string; company: string; industry: string;
  location: string; email: string; linkedin_url: string;
};

type HunterCompany = {
  name: string; domain: string; country: string;
  size: string; industry: string; type: string; description: string;
};

// ── Shared sub-components ─────────────────────────────────────────────────

function ChipInput({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  const add = () => { const v = input.trim(); if (v && !value.includes(v)) onChange([...value, v]); setInput(""); };
  const remove = (chip: string) => onChange(value.filter((x) => x !== chip));
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">{label}</label>
      <div className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg p-2 flex flex-wrap gap-1.5 min-h-[42px]">
        {value.map((chip) => (
          <span key={chip} className="inline-flex items-center gap-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-md px-2 py-0.5 text-xs">
            {chip}
            <button onClick={() => remove(chip)} className="text-sky-400/60 hover:text-sky-300 ml-0.5">&#10005;</button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
          placeholder={value.length === 0 ? placeholder : ""}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            else if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
        />
      </div>
      <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Press Enter to add</p>
    </div>
  );
}

function ToggleChips({ options, selected, onToggle, color = "sky" }: {
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  color?: "sky" | "orange" | "violet" | "emerald";
}) {
  const colors: Record<string, string> = {
    sky: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    orange: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onToggle(o.value)}
          className={`px-2.5 py-1 rounded-lg text-xs transition border ${selected.includes(o.value) ? colors[color] : "bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function LeadFinder() {
  const [source, setSource] = useState<"apollo" | "hunter">("apollo");

  // Apollo state
  const [jobTitles, setJobTitles] = useState<string[]>(["CEO", "CTO", "Founder", "Head of Engineering"]);
  const [locations, setLocations] = useState<string[]>(["India"]);
  const [keywords, setKeywords] = useState<string[]>(["drone", "UAV"]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<string[]>([]);
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [apolloResults, setApolloResults] = useState<LeadResult[]>([]);

  // Hunter state
  const [hunterIndustry, setHunterIndustry] = useState("");
  const [hunterCountry, setHunterCountry] = useState("IN");
  const [hunterSize, setHunterSize] = useState("");
  const [hunterType, setHunterType] = useState("");
  const [hunterKeyword, setHunterKeyword] = useState("");
  const [hunterMaxCompanies, setHunterMaxCompanies] = useState(10);
  const [hunterCompanies, setHunterCompanies] = useState<HunterCompany[]>([]);
  const [importingDomain, setImportingDomain] = useState<string | null>(null);
  const [importedDomains, setImportedDomains] = useState<Record<string, number>>({});
  const [importingAll, setImportingAll] = useState(false);

  // Shared
  const [maxResults, setMaxResults] = useState(50);
  const [importTag, setImportTag] = useState("apollo-import");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);
  const [error, setError] = useState("");

  const toggleArr = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const switchSource = (s: "apollo" | "hunter") => {
    setSource(s);
    setApolloResults([]);
    setHunterCompanies([]);
    setImported(false);
    setError("");
    setImportTag(s === "hunter" ? "hunter-import" : "apollo-import");
    setImportedDomains({});
  };

  // ── Apollo search ────────────────────────────────────────────────────────

  const handleApolloSearch = async () => {
    if (!jobTitles.length && !keywords.length) { setError("Add at least one job title or keyword."); return; }
    setError(""); setImported(false); setLoading(true);
    try {
      const payload: Record<string, unknown> = { job_titles: jobTitles, locations, keywords, max_results: maxResults, import_tag: importTag };
      if (industries.length) payload.industries = industries;
      if (seniority.length) payload.seniority = seniority;
      if (companySizes.length) payload.company_sizes = companySizes;
      const res = await fetchApolloLeads(payload);
      setApolloResults(res.contacts ?? res ?? []);
      setFetchCount(res.fetched ?? (res.contacts ?? res ?? []).length);
      setImported(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? "Lead fetch failed. Check your Apollo API key in Settings.");
    } finally { setLoading(false); }
  };

  // ── Hunter discover ──────────────────────────────────────────────────────

  const handleHunterDiscover = async () => {
    setError(""); setImported(false); setLoading(true); setHunterCompanies([]);
    try {
      const body: Record<string, unknown> = { max_companies: hunterMaxCompanies };
      if (hunterIndustry) body.industry = hunterIndustry;
      if (hunterCountry) body.country = hunterCountry;
      if (hunterSize) body.size_range = hunterSize;
      if (hunterType) body.company_type = hunterType;
      if (hunterKeyword.trim()) body.keyword = hunterKeyword.trim();
      const res = await hunterDiscover(body);
      setHunterCompanies(res.companies ?? []);
      if ((res.companies ?? []).length === 0) setError("No companies found for these filters. Try broader criteria.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? "Hunter search failed. Check your Hunter.io API key in Settings.");
    } finally { setLoading(false); }
  };

  const handleImportDomain = async (domain: string) => {
    setImportingDomain(domain);
    try {
      const res = await fetchHunterLeads({ domain, max_results: 50, import_tag: importTag });
      setImportedDomains((prev) => ({ ...prev, [domain]: res.fetched ?? 0 }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? `Failed to import contacts from ${domain}.`);
    } finally { setImportingDomain(null); }
  };

  const handleImportAll = async () => {
    setImportingAll(true);
    const notImported = hunterCompanies.filter((c) => !(c.domain in importedDomains));
    let total = 0;
    for (const company of notImported) {
      try {
        const res = await fetchHunterLeads({ domain: company.domain, max_results: 20, import_tag: importTag });
        setImportedDomains((prev) => ({ ...prev, [company.domain]: res.fetched ?? 0 }));
        total += res.fetched ?? 0;
      } catch { /* skip failed domains */ }
    }
    setFetchCount(total);
    setImported(true);
    setImportingAll(false);
  };

  const totalImported = Object.values(importedDomains).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Finder</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Pull verified leads from Apollo.io or discover companies via Hunter.io.
        </p>
      </div>

      {/* Source toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-1">Data source</span>
        <div className="flex bg-slate-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
          <button onClick={() => switchSource("apollo")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${source === "apollo" ? "bg-sky-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            Apollo.io
          </button>
          <button onClick={() => switchSource("hunter")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${source === "hunter" ? "bg-orange-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            Hunter.io
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className="col-span-1 space-y-4">

          {/* APOLLO filters */}
          {source === "apollo" && (
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Search Filters</h3>
              <ChipInput label="Job Titles / Roles" value={jobTitles} onChange={setJobTitles} placeholder="CEO, CTO, Procurement..." />
              <ChipInput label="Locations" value={locations} onChange={setLocations} placeholder="India, Dubai, Singapore..." />
              <ChipInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="drone, UAV, autonomy..." />
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Industry</label>
                <ToggleChips options={INDUSTRIES.map((i) => ({ label: i, value: i }))} selected={industries} onToggle={(v) => toggleArr(industries, v, setIndustries)} color="sky" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Seniority</label>
                <ToggleChips options={SENIORITY.map((s) => ({ label: s, value: s }))} selected={seniority} onToggle={(v) => toggleArr(seniority, v, setSeniority)} color="violet" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Company Size</label>
                <ToggleChips options={COMPANY_SIZE_OPTIONS} selected={companySizes} onToggle={(v) => toggleArr(companySizes, v, setCompanySizes)} color="emerald" />
              </div>
            </div>
          )}

          {/* HUNTER filters */}
          {source === "hunter" && (
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Discover Companies</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
                Find companies by industry, location and size, then import their contacts.
              </p>

              {/* Headquarters location */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Headquarters Location</label>
                <select className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
                  value={hunterCountry} onChange={(e) => setHunterCountry(e.target.value)}>
                  <option value="">Any country</option>
                  {HUNTER_COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Industry</label>
                <select className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
                  value={hunterIndustry} onChange={(e) => setHunterIndustry(e.target.value)}>
                  <option value="">Any industry</option>
                  {HUNTER_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Size</label>
                <ToggleChips
                  options={HUNTER_SIZES}
                  selected={hunterSize ? [hunterSize] : []}
                  onToggle={(v) => setHunterSize(hunterSize === v ? "" : v)}
                  color="orange"
                />
              </div>

              {/* Company type */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Company Type</label>
                <ToggleChips
                  options={HUNTER_TYPES}
                  selected={hunterType ? [hunterType] : []}
                  onToggle={(v) => setHunterType(hunterType === v ? "" : v)}
                  color="orange"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Keywords</label>
                <input
                  className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-orange-500 transition"
                  placeholder="e.g. drone, UAV, aerospace..."
                  value={hunterKeyword}
                  onChange={(e) => setHunterKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleHunterDiscover(); }}
                />
              </div>

              {/* Max companies */}
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">
                  Max Companies to Find
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min={5} max={100} step={5} value={hunterMaxCompanies}
                    onChange={(e) => setHunterMaxCompanies(parseInt(e.target.value))}
                    className="flex-1 accent-orange-500" />
                  <span className="text-sm font-mono text-orange-400 w-8 text-right">{hunterMaxCompanies}</span>
                </div>
              </div>
            </div>
          )}

          {/* Import settings (shared) */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Import Settings</h3>
            {source === "apollo" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">Max Results</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={10} max={200} step={10} value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value))} className="flex-1 accent-sky-500" />
                  <span className="text-sm font-mono text-sky-400 w-8 text-right">{maxResults}</span>
                </div>
              </div>
            )}
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

          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">{error}</div>}

          <button
            onClick={source === "apollo" ? handleApolloSearch : handleHunterDiscover}
            disabled={loading}
            className={`w-full disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-2 ${source === "hunter" ? "bg-orange-500 hover:bg-orange-400" : "bg-sky-500 hover:bg-sky-400"}`}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {source === "hunter" ? "Searching companies..." : "Fetching from Apollo..."}
              </>
            ) : source === "hunter" ? "Find Companies →" : "Fetch Leads →"}
          </button>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden h-full flex flex-col">

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between px-5 py-3.5 border-b border-slate-100 dark:border-surface-400/30">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {source === "hunter" && hunterCompanies.length > 0
                  ? `${hunterCompanies.length} companies found`
                  : source === "apollo" && apolloResults.length > 0
                  ? `${apolloResults.length} leads fetched`
                  : "Results"}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {source === "hunter" && hunterCompanies.length > 0 && (
                  <>
                    {totalImported > 0 && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        ✓ {totalImported} contacts imported
                      </span>
                    )}
                    <button
                      onClick={handleImportAll}
                      disabled={importingAll || hunterCompanies.every((c) => c.domain in importedDomains)}
                      className="text-xs bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5"
                    >
                      {importingAll ? (
                        <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Importing...</>
                      ) : "Import All Contacts"}
                    </button>
                  </>
                )}
                {source === "apollo" && imported && apolloResults.length > 0 && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    ✓ Saved with tag "{importTag}"
                  </span>
                )}
              </div>
            </div>

            {/* Hunter company list */}
            {source === "hunter" && hunterCompanies.length > 0 && (
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-surface-400/15">
                {hunterCompanies.map((company) => {
                  const isImported = company.domain in importedDomains;
                  const isImporting = importingDomain === company.domain;
                  return (
                    <div key={company.domain} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-surface-600/40 transition">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold shrink-0">
                        {company.name[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{company.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{company.domain}</span>
                          {company.industry && <span className="text-xs text-slate-400 dark:text-slate-500">· {company.industry}</span>}
                          {company.country && <span className="text-xs text-slate-400 dark:text-slate-500">· {company.country}</span>}
                          {company.size && <span className="text-xs text-slate-400 dark:text-slate-500">· {company.size} emp</span>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isImported ? (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                            {importedDomains[company.domain]} contacts
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportDomain(company.domain)}
                            disabled={isImporting || importingAll}
                            className="text-xs bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/30 hover:border-orange-500 px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium"
                          >
                            {isImporting ? (
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            ) : "Import"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hunter empty state */}
            {source === "hunter" && hunterCompanies.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <p className="text-slate-900 dark:text-white font-medium mb-1">Find companies</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
                  Set your filters on the left — industry, location, size — and click "Find Companies" to discover relevant organisations.
                </p>
              </div>
            )}

            {/* Apollo table */}
            {source === "apollo" && apolloResults.length > 0 && (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-surface-700">
                    <tr className="border-b border-surface-400/20">
                      <th className="text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Name</th>
                      <th className="hidden sm:table-cell text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Title</th>
                      <th className="hidden sm:table-cell text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Company</th>
                      <th className="hidden md:table-cell text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Location</th>
                      <th className="text-left px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Channels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-surface-400/15">
                    {apolloResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-surface-600/40 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center text-xs font-bold text-sky-400 shrink-0">
                              {r.first_name?.[0] ?? "?"}
                            </div>
                            <span className="text-slate-900 dark:text-white font-medium">{r.first_name} {r.last_name}</span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{r.title}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{r.company}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{r.location}</td>
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

            {/* Apollo empty state */}
            {source === "apollo" && apolloResults.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-surface-600 rounded-full flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <p className="text-slate-900 dark:text-white font-medium mb-1">No leads yet</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
                  Set your filters and click "Fetch Leads" to pull verified contacts from Apollo.io.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
