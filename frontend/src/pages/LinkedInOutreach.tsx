import { useEffect, useState } from "react";
import { getContacts, launchLinkedInPhantom } from "../api/client";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  linkedin_url: string;
  tags: string[];
};

const TABS = ["Connect", "Message"] as const;
type Tab = (typeof TABS)[number];

export default function LinkedInOutreach() {
  const [tab, setTab] = useState<Tab>("Connect");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Connect settings
  const [connectNote, setConnectNote] = useState(
    "Hi {{first_name}}, I work with Indo Aerial Systems \u2014 we build precision motors and ESCs for drone manufacturers. Would love to connect and learn about your work at {{company}}."
  );

  // Message settings
  const [messageBody, setMessageBody] = useState(
    "Hi {{first_name}}, following up on my connection request. We supply motors, ESCs, and flight controllers to drone OEMs across India. Happy to share our spec sheets if it\u2019s relevant to what you\u2019re building at {{company}}. Best, IAS Team"
  );
  const [batchSize, setBatchSize] = useState(20);
  const [campaignId, setCampaignId] = useState("");

  useEffect(() => {
    getContacts({ has_linkedin: true, page_size: 200 })
      .then((r) => setContacts(r.items ?? r))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleLaunch = async () => {
    if (selected.size === 0) {
      setError("Select at least one contact.");
      return;
    }
    setError("");
    setResult("");
    setLaunching(true);
    try {
      const res = await launchLinkedInPhantom({
        campaign_id: campaignId || "manual",
        step_type: tab === "Connect" ? "linkedin_connect" : "linkedin_message",
        batch_size: Math.min(batchSize, selected.size),
      });
      setResult(
        res?.message ??
          `Phantom launched. ${selected.size} contacts queued for LinkedIn ${tab.toLowerCase()}.`
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(
        err.response?.data?.detail ??
          "Phantombuster launch failed. Check your API key in Settings."
      );
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">LinkedIn Outreach</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Send connection requests and messages via Phantombuster automation. Separate
          from email campaigns.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-surface-800 border border-slate-100 dark:border-surface-400/30 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              tab === t
                ? "bg-sky-500 text-white shadow"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t === "Connect" ? "\uD83D\uDD17 " : "\u2709\uFE0F "}{t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: contacts */}
        <div className="col-span-2 bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-surface-400/30">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === contacts.length && contacts.length > 0}
                onChange={toggleAll}
                className="accent-sky-500"
              />
              <span className="text-sm text-slate-900 dark:text-white font-medium">
                {loading ? "Loading..." : `${contacts.length} contacts with LinkedIn`}
              </span>
            </div>
            {selected.size > 0 && (
              <span className="text-xs text-sky-400 font-medium">
                {selected.size} selected
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              No contacts with LinkedIn URLs found. Import leads from Lead Finder.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-surface-400/20 max-h-[480px] overflow-y-auto">
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-surface-600/50 transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-sky-500 shrink-0"
                  />
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-xs font-bold text-sky-400 shrink-0">
                    {c.first_name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {c.title} &bull; {c.company}
                    </p>
                  </div>
                  {c.linkedin_url && (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-sky-400 hover:text-sky-300 shrink-0"
                    >
                      Profile &#8599;
                    </a>
                  )}
                  {c.tags?.length > 0 && (
                    <span className="text-xs bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full shrink-0">
                      {c.tags[0]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Right: settings + launch */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              {tab === "Connect" ? "Connection Request" : "Message"}
            </h3>

            {tab === "Connect" && (
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
                  Note (optional, 300 chars max)
                </label>
                <textarea
                  rows={5}
                  maxLength={300}
                  className="w-full bg-surface-600 border border-surface-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
                  value={connectNote}
                  onChange={(e) => setConnectNote(e.target.value)}
                />
                <p className="text-xs text-slate-600 text-right mt-1">
                  {connectNote.length}/300
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Use {`{{first_name}}`}, {`{{company}}`} for personalization.
                </p>
              </div>
            )}

            {tab === "Message" && (
              <>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
                    Message Body
                  </label>
                  <textarea
                    rows={6}
                    className="w-full bg-surface-600 border border-surface-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use {`{{first_name}}`}, {`{{company}}`} for personalization.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
                    Campaign ID (optional)
                  </label>
                  <input
                    className="w-full bg-surface-600 border border-surface-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition"
                    placeholder="Link to email campaign..."
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
                Batch Size (per run)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="flex-1 accent-sky-500"
                />
                <span className="text-sm font-mono text-sky-400 w-6 text-right">
                  {batchSize}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                LinkedIn recommends &lt;25/day for safety.
              </p>
            </div>
          </div>

          {/* Safety notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-400 mb-1">
              &#9888; LinkedIn Safety
            </p>
            <p className="text-xs text-amber-300/80">
              Stay under 25 connection requests and 50 messages per day. Use
              warm-up delays. Phantombuster handles this automatically.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">
              {error}
            </div>
          )}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400">
              {result}
            </div>
          )}

          <button
            onClick={handleLaunch}
            disabled={launching || selected.size === 0}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-2"
          >
            {launching ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Launching Phantom...
              </>
            ) : (
              `Launch ${tab} \u2192 ${selected.size} contacts`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
