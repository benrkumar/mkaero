import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateCampaign, updateSequenceStep, getSettings, fetchLeadsForCampaign } from "../api/client";

// ── Types ────────────────────────────────────────────────────────────────────

type StepPreview = {
  step: number;
  delay_days: number;
  subject: string;
  body: string;
  summary: string;
  id?: string; // backend may return an id for PATCH
};

type WizardResult = {
  campaign_id: string;
  campaign_name: string;
  summary: string;
  apollo_filters: Record<string, unknown>;
  steps_preview: StepPreview[];
  linkedin_connection_note: string;
  linkedin_followup: string;
  leads_fetched: number;
  leads_enrolled: number;
  status: string;
  message: string;
};

type EditedStep = { subject: string; body: string };

// ── Example prompts ──────────────────────────────────────────────────────────

const EXAMPLES = [
  "Reach out to drone OEM founders and CTOs in India to pitch our motor and ESC components",
  "Target precision agriculture tech leads at agritech companies for our GPS modules",
  "Connect with defense R&D program managers about our carbon fiber drone frames",
  "Pitch our propellers and batteries to drone repair shops and service centers in India",
];

// ── Icons (inline SVG helpers) ───────────────────────────────────────────────

function IconTarget({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function IconEnvelope({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,14 22,4" />
    </svg>
  );
}

function IconLinkedIn({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPencil({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignWizard() {
  const navigate = useNavigate();

  // --- API capability detection ---
  const [hasApollo, setHasApollo] = useState(false);
  const [hasMailgun, setHasMailgun] = useState(false);
  const [hasPhantombuster, setHasPhantombuster] = useState(false);
  const [hasAI, setHasAI] = useState(false);

  useEffect(() => {
    getSettings().then((data: { has_value: Record<string, boolean> }) => {
      const hv = data.has_value ?? {};
      setHasApollo(!!hv.apollo_api_key);
      setHasMailgun(!!(hv.mailgun_api_key && hv.mailgun_domain));
      setHasPhantombuster(!!hv.phantombuster_api_key);
      setHasAI(!!(hv.anthropic_api_key || hv.gemini_api_key));
      // Auto-enable LinkedIn only if Phantombuster is configured; email always on
      if (hv.phantombuster_api_key) setLinkedinChannel(true);
    }).catch(() => {});
  }, []);

  // --- Wizard form state ---
  const [description, setDescription] = useState("");
  const [maxLeads, setMaxLeads] = useState(50);
  const [emailChannel, setEmailChannel] = useState(true);
  const [linkedinChannel, setLinkedinChannel] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [error, setError] = useState("");

  // --- Result UI state ---
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // --- Editable content state ---
  const [editedSteps, setEditedSteps] = useState<Record<number, EditedStep>>({});
  const [editedLinkedInNote, setEditedLinkedInNote] = useState("");
  const [editedLinkedInFollowup, setEditedLinkedInFollowup] = useState("");

  // --- Fetch leads state ---
  const [fetchDomain, setFetchDomain] = useState("");
  const [fetchMax, setFetchMax] = useState(50);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ fetched: number; enrolled: number; domain: string } | null>(null);
  const [fetchError, setFetchError] = useState("");

  // --- Save state ---
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────

  const initEdits = (data: WizardResult) => {
    const steps: Record<number, EditedStep> = {};
    data.steps_preview.forEach((s) => {
      steps[s.step] = { subject: s.subject, body: s.body };
    });
    setEditedSteps(steps);
    setEditedLinkedInNote(data.linkedin_connection_note ?? "");
    setEditedLinkedInFollowup(data.linkedin_followup ?? "");
  };

  const getStep = (stepNum: number) =>
    result?.steps_preview.find((s) => s.step === stepNum);

  const isStepEdited = (stepNum: number) => {
    const orig = getStep(stepNum);
    const edit = editedSteps[stepNum];
    if (!orig || !edit) return false;
    return edit.subject !== orig.subject || edit.body !== orig.body;
  };

  const isLinkedInNoteEdited =
    result && editedLinkedInNote !== (result.linkedin_connection_note ?? "");

  const isLinkedInFollowupEdited =
    result && editedLinkedInFollowup !== (result.linkedin_followup ?? "");

  const anyEdited =
    (result?.steps_preview ?? []).some((s) => isStepEdited(s.step)) ||
    isLinkedInNoteEdited ||
    isLinkedInFollowupEdited;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError("Please describe your target audience.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setSaveSuccess(false);
    setSaveError("");
    setFetchResult(null);
    setFetchError("");
    setFetchDomain("");
    try {
      const data = await generateCampaign({
        description,
        max_leads: maxLeads,
        email_channel: emailChannel,
        linkedin_channel: linkedinChannel,
        auto_start: autoStart,
      });
      setResult(data);
      initEdits(data);
      setExpandedStep(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(
        err.response?.data?.detail ??
          "Something went wrong. Check your AI API key (Anthropic or Gemini) in Settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!result) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const editedStepNums = result.steps_preview.filter((s) =>
        isStepEdited(s.step)
      );
      await Promise.all(
        editedStepNums.map((s) => {
          // Use step id if available, fall back to step number string
          const stepId = s.id ?? String(s.step);
          return updateSequenceStep(stepId, {
            subject: editedSteps[s.step].subject,
            body: editedSteps[s.step].body,
          });
        })
      );
      setSaveSuccess(true);
      // Sync originals so "edited" badges disappear
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps_preview: prev.steps_preview.map((s) =>
            editedSteps[s.step]
              ? { ...s, ...editedSteps[s.step] }
              : s
          ),
          linkedin_connection_note: editedLinkedInNote,
          linkedin_followup: editedLinkedInFollowup,
        };
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setSaveError(err.response?.data?.detail ?? "Failed to save edits.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setDescription("");
    setEditedSteps({});
    setEditedLinkedInNote("");
    setEditedLinkedInFollowup("");
    setSaveSuccess(false);
    setSaveError("");
    setFetchResult(null);
    setFetchError("");
    setFetchDomain("");
  };

  const handleFetchLeads = async () => {
    if (!result || !fetchDomain.trim()) return;
    setFetchLoading(true);
    setFetchError("");
    setFetchResult(null);
    try {
      const res = await fetchLeadsForCampaign(result.campaign_id, fetchDomain.trim(), fetchMax);
      setFetchResult({ fetched: res.fetched, enrolled: res.enrolled, domain: res.domain });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setFetchError(err.response?.data?.detail ?? "Lead fetch failed. Check your Hunter.io API key in Settings.");
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-drone rounded-xl flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              AI Campaign Wizard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Describe your audience &#8212; AI builds the entire campaign for you
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          WIZARD FORM (shown when no result yet)
      ════════════════════════════════════════════════════════════════════ */}
      {!result ? (
        <div className="space-y-5">
          {/* Main prompt input */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-6">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Who do you want to reach?
            </label>
            <textarea
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none focus:border-sky-500 transition"
              rows={4}
              placeholder="e.g. Reach out to drone OEM founders and CTOs in India to pitch our motor and ESC components..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="mt-3">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                Try an example:
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDescription(ex)}
                    className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-full text-slate-500 dark:text-slate-400 hover:text-sky-400 hover:border-sky-500/40 transition"
                  >
                    {ex.slice(0, 55)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Auto-detected services status */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ready to launch</h2>
              <a href="/settings" className="text-xs text-sky-500 hover:underline">Configure in Settings →</a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* AI */}
              <div className={`rounded-xl p-3 border text-center ${hasAI ? "bg-violet-500/5 border-violet-500/25" : "bg-slate-50 dark:bg-surface-600 border-slate-200 dark:border-surface-400/40 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${hasAI ? "bg-violet-500/20 text-violet-500" : "bg-slate-200 dark:bg-surface-500 text-slate-400"}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">AI Content</p>
                <p className={`text-[10px] mt-0.5 ${hasAI ? "text-violet-500" : "text-slate-400"}`}>{hasAI ? "✓ Ready" : "Not configured"}</p>
              </div>
              {/* Apollo leads */}
              <div className={`rounded-xl p-3 border text-center ${hasApollo ? "bg-sky-500/5 border-sky-500/25" : "bg-slate-50 dark:bg-surface-600 border-slate-200 dark:border-surface-400/40 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${hasApollo ? "bg-sky-500/20 text-sky-500" : "bg-slate-200 dark:bg-surface-500 text-slate-400"}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Apollo Leads</p>
                <p className={`text-[10px] mt-0.5 ${hasApollo ? "text-sky-500" : "text-slate-400"}`}>{hasApollo ? "✓ Ready" : "Not configured"}</p>
              </div>
              {/* Email */}
              <div className={`rounded-xl p-3 border text-center ${hasMailgun ? "bg-emerald-500/5 border-emerald-500/25" : "bg-slate-50 dark:bg-surface-600 border-slate-200 dark:border-surface-400/40 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${hasMailgun ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-200 dark:bg-surface-500 text-slate-400"}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,14 22,4"/></svg>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Email Drip</p>
                <p className={`text-[10px] mt-0.5 ${hasMailgun ? "text-emerald-500" : "text-slate-400"}`}>{hasMailgun ? "✓ Ready" : "Not configured"}</p>
              </div>
              {/* LinkedIn */}
              <div className={`rounded-xl p-3 border text-center ${hasPhantombuster ? "bg-violet-500/5 border-violet-500/25" : "bg-slate-50 dark:bg-surface-600 border-slate-200 dark:border-surface-400/40 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${hasPhantombuster ? "bg-violet-500/20 text-violet-500" : "bg-slate-200 dark:bg-surface-500 text-slate-400"}`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">LinkedIn</p>
                <p className={`text-[10px] mt-0.5 ${hasPhantombuster ? "text-violet-500" : "text-slate-400"}`}>{hasPhantombuster ? "✓ Ready" : "Not configured"}</p>
              </div>
            </div>

            {/* Compact options row */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-surface-600/60 flex flex-wrap items-center gap-4">
              {/* Max leads */}
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Max leads:</label>
                <input type="range" min={10} max={200} step={10} value={maxLeads}
                  onChange={(e) => setMaxLeads(Number(e.target.value))} className="flex-1 accent-sky-500" />
                <span className="text-xs font-mono text-sky-400 w-6 text-right">{maxLeads}</span>
              </div>
              {/* Channels */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={emailChannel} onChange={(e) => setEmailChannel(e.target.checked)} className="accent-sky-500" />
                  Email
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={linkedinChannel} onChange={(e) => setLinkedinChannel(e.target.checked)} className="accent-violet-500" />
                  LinkedIn
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} className="accent-emerald-500" />
                  Auto-start
                </label>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-gradient-drone text-white rounded-xl font-semibold text-base transition disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                AI is building your campaign...
              </>
            ) : (
              <>✦ Generate Campaign</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-slate-500 -mt-2">
              15&#8211;30 seconds. Claude is writing your email sequence,
              LinkedIn messages, and fetching leads.
            </p>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
            RESULT VIEW
        ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-5">
          {/* ── Success banner ── */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400">
                    <IconCheck className="w-5 h-5 inline" />
                  </span>
                  <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                    {result.campaign_name}
                  </h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {result.summary}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {result.message}
                </p>
              </div>
              <button
                onClick={() => navigate(`/campaigns/${result.campaign_id}`)}
                className="shrink-0 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto"
              >
                View Campaign
              </button>
            </div>
          </div>

          {/* ── Campaign stat strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center text-violet-500 dark:text-violet-400">
                <IconEnvelope className="w-5 h-5" />
              </div>
              <p className="text-lg font-bold font-mono text-violet-600 dark:text-violet-400">{result.steps_preview.length}-step</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Email Sequence</p>
            </div>
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-500 dark:text-sky-400">
                <IconTarget className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">{fetchResult ? fetchResult.enrolled : 0}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Leads Enrolled</p>
            </div>
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 flex flex-col items-center text-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${result.status === "active" ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-100 dark:bg-slate-600 text-slate-500"}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${result.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-100 dark:bg-slate-600/60 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-500/40"}`}>
                {result.status}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-500">Status</p>
            </div>
          </div>

          {/* ── Fetch Leads from Hunter.io ── */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Fetch Leads via Hunter.io</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter a company domain to find verified email contacts and enroll them in this campaign.
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="flex-1 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-orange-500 transition"
                placeholder="e.g. dronecompany.com"
                value={fetchDomain}
                onChange={(e) => setFetchDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleFetchLeads(); }}
              />
              <button
                onClick={handleFetchLeads}
                disabled={fetchLoading || !fetchDomain.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shrink-0"
              >
                {fetchLoading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                )}
                {fetchLoading ? "Fetching..." : "Fetch & Enroll"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Max contacts:</label>
              <input type="range" min={5} max={100} step={5} value={fetchMax}
                onChange={(e) => setFetchMax(Number(e.target.value))} className="flex-1 accent-orange-500" />
              <span className="text-xs font-mono text-orange-400 w-6 text-right">{fetchMax}</span>
            </div>

            {fetchError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">{fetchError}</div>
            )}
            {fetchResult && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                <IconCheck className="w-4 h-4 shrink-0" />
                Found {fetchResult.fetched} contacts at {fetchResult.domain} — {fetchResult.enrolled} enrolled in campaign.
              </div>
            )}
          </div>

          {/* ── Apollo filters ── */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">
              AI-Generated Apollo Filters
            </h3>
            <div className="space-y-2">
              {Object.entries(result.apollo_filters).map(([key, val]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-medium text-slate-400 dark:text-slate-500 capitalize w-36 shrink-0">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {Array.isArray(val) ? val.join(", ") : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Phase 6B + 6C: EMAIL SEQUENCE SECTION
          ═══════════════════════════════════════════════════════════════ */}
          <div className="border border-sky-500/30 rounded-xl overflow-hidden">
            {/* Section header — sky accent */}
            <div className="bg-sky-500/10 dark:bg-sky-500/10 border-b border-sky-500/20 px-5 py-3 flex items-center gap-2">
              <IconEnvelope className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <h3 className="font-semibold text-sky-700 dark:text-sky-300 text-sm">
                Email Sequence
              </h3>
              <span className="ml-1 text-xs text-sky-600/70 dark:text-sky-400/70 font-normal">
                ({result.steps_preview.length}-step sequence)
              </span>
            </div>

            <div className="bg-white dark:bg-surface-700 p-4 space-y-3">
              {result.steps_preview.map((step) => {
                const edited = editedSteps[step.step] ?? {
                  subject: step.subject,
                  body: step.body,
                };
                const stepEdited = isStepEdited(step.step);
                const isOpen = expandedStep === step.step;

                return (
                  <div
                    key={step.step}
                    className="border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden"
                  >
                    {/* Accordion header */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-600/50 transition"
                      onClick={() =>
                        setExpandedStep(isOpen ? null : step.step)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-500 dark:text-sky-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {step.step}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {step.summary}
                            </p>
                            {stepEdited && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium">
                                <IconPencil className="w-3 h-3" />
                                edited
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Day {step.delay_days} &#8212;{" "}
                            {edited.subject}
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">
                        {isOpen ? "\u25b2 Hide" : "\u25bc Edit"}
                      </span>
                    </button>

                    {/* Accordion body — editable */}
                    {isOpen && (
                      <div className="border-t border-slate-200 dark:border-surface-400/30 bg-slate-50 dark:bg-surface-600/30 px-4 py-4 space-y-4">
                        {/* Subject */}
                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide block mb-1.5">
                            Subject
                          </label>
                          <textarea
                            rows={2}
                            className="w-full bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white resize-none outline-none focus:border-sky-500 dark:focus:border-sky-400 transition font-medium"
                            value={edited.subject}
                            onChange={(e) =>
                              setEditedSteps((prev) => ({
                                ...prev,
                                [step.step]: {
                                  ...edited,
                                  subject: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>

                        {/* Body */}
                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide block mb-1.5">
                            Body
                          </label>
                          <textarea
                            rows={10}
                            className="w-full bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 resize-y outline-none focus:border-sky-500 dark:focus:border-sky-400 transition leading-relaxed font-sans"
                            value={edited.body}
                            onChange={(e) =>
                              setEditedSteps((prev) => ({
                                ...prev,
                                [step.step]: {
                                  ...edited,
                                  body: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Phase 6B + 6C: LINKEDIN SECTION
          ═══════════════════════════════════════════════════════════════ */}
          {(result.linkedin_connection_note || result.linkedin_followup) && (
            <div className="border border-violet-500/30 rounded-xl overflow-hidden">
              {/* Section header — violet accent */}
              <div className="bg-violet-500/10 dark:bg-violet-500/10 border-b border-violet-500/20 px-5 py-3 flex items-center gap-2">
                <IconLinkedIn className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                <h3 className="font-semibold text-violet-700 dark:text-violet-300 text-sm">
                  LinkedIn Messages
                </h3>
              </div>

              <div className="bg-white dark:bg-surface-700 p-5 space-y-5">
                {/* Connection note */}
                {result.linkedin_connection_note && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Connection Request Note
                      </p>
                      {isLinkedInNoteEdited && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium">
                          <IconPencil className="w-3 h-3" />
                          edited
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      className="w-full bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/25 rounded-lg px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 resize-y outline-none focus:border-violet-500 transition leading-relaxed"
                      value={editedLinkedInNote}
                      onChange={(e) => setEditedLinkedInNote(e.target.value)}
                    />
                  </div>
                )}

                {/* Follow-up message */}
                {result.linkedin_followup && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Follow-up Message
                      </p>
                      {isLinkedInFollowupEdited && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-medium">
                          <IconPencil className="w-3 h-3" />
                          edited
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      className="w-full bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/25 rounded-lg px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 resize-y outline-none focus:border-violet-500 transition leading-relaxed"
                      value={editedLinkedInFollowup}
                      onChange={(e) =>
                        setEditedLinkedInFollowup(e.target.value)
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Save edits feedback ── */}
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
              <IconCheck className="w-4 h-4" />
              Edits saved successfully.
            </div>
          )}

          {/* ── Action bar ── */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate(`/campaigns/${result.campaign_id}`)}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-medium transition"
            >
              Open Campaign &#8594;
            </button>

            {anyEdited && (
              <button
                onClick={handleSaveEdits}
                disabled={saving}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    Saving...
                  </>
                ) : (
                  <>
                    <IconPencil className="w-4 h-4" />
                    Save Edits
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleReset}
              className="px-6 py-3 bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium transition"
            >
              Create Another Campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
