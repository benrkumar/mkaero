import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateCampaign } from "../api/client";

type StepPreview = {
  step: number;
  delay_days: number;
  subject: string;
  body: string;
  summary: string;
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

const EXAMPLES = [
  "Reach out to drone OEM founders and CTOs in India to pitch our motor and ESC components",
  "Target precision agriculture tech leads at agritech companies for our GPS modules",
  "Connect with defense R&D program managers about our carbon fiber drone frames",
  "Pitch our propellers and batteries to drone repair shops and service centers in India",
];

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [maxLeads, setMaxLeads] = useState(50);
  const [emailChannel, setEmailChannel] = useState(true);
  const [linkedinChannel, setLinkedinChannel] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [error, setError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError("Please describe your target audience.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const data = await generateCampaign({
        description,
        max_leads: maxLeads,
        email_channel: emailChannel,
        linkedin_channel: linkedinChannel,
        auto_fetch_leads: true,
        auto_enroll: true,
        auto_start: autoStart,
      });
      setResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? "Something went wrong. Check your Anthropic API key in Settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-drone rounded-xl flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Campaign Wizard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Describe your audience &#8212; AI builds the entire campaign for you
            </p>
          </div>
        </div>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* Main input */}
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Try an example:</p>
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

          {/* Options */}
          <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Campaign Options</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">
                  Max Leads to Fetch
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={maxLeads}
                    onChange={(e) => setMaxLeads(Number(e.target.value))}
                    className="flex-1 accent-sky-500"
                  />
                  <span className="text-sm font-mono text-sky-400 w-8 text-right">{maxLeads}</span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Requires Apollo API key</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold block mb-2">
                  Outreach Channels
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={emailChannel} onChange={(e) => setEmailChannel(e.target.checked)} className="accent-sky-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">&#9993; Email (Mailgun)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={linkedinChannel} onChange={(e) => setLinkedinChannel(e.target.checked)} className="accent-violet-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">&#128100; LinkedIn (Phantombuster)</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 cursor-pointer p-3 bg-surface-600 rounded-lg border border-surface-400/40">
                  <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} className="mt-0.5 accent-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-white">Auto-start campaign after creation</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      If unchecked, campaign saved as draft so you can review first.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-gradient-drone text-white rounded-xl font-semibold text-base transition disabled:opacity-60 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI is building your campaign...
              </>
            ) : (
              <>\u2726 Generate Campaign</>
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-slate-500 -mt-2">
              15&#8211;30 seconds. Claude is writing your email sequence, LinkedIn messages, and fetching leads.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Success banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400">&#10003;</span>
                  <h2 className="font-bold text-white text-lg">{result.campaign_name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${result.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-500 text-slate-400"}`}>
                    {result.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{result.summary}</p>
                <p className="text-sm text-slate-400 mt-1">{result.message}</p>
              </div>
              <button
                onClick={() => navigate(`/campaigns/${result.campaign_id}`)}
                className="shrink-0 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                View Campaign
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Leads Fetched", value: result.leads_fetched, color: "text-sky-400" },
              { label: "Leads Enrolled", value: result.leads_enrolled, color: "text-emerald-400" },
              { label: "Email Steps", value: result.steps_preview.length, color: "text-violet-400" },
              { label: "Status", value: result.status, color: "text-slate-300" },
            ].map((s) => (
              <div key={s.label} className="bg-surface-700 border border-surface-400/40 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Apollo filters */}
          <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3 text-sm">AI-Generated Apollo Filters</h3>
            <div className="space-y-2">
              {Object.entries(result.apollo_filters).map(([key, val]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-medium text-slate-500 capitalize w-36 shrink-0">{key.replace(/_/g, " ")}:</span>
                  <span className="text-slate-300">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Email sequence */}
          <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4 text-sm">
              Email Sequence <span className="text-slate-500 font-normal">({result.steps_preview.length} steps)</span>
            </h3>
            <div className="space-y-3">
              {result.steps_preview.map((step) => (
                <div key={step.step} className="border border-surface-400/40 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-600/50 transition"
                    onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {step.step}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{step.summary}</p>
                        <p className="text-xs text-slate-500">Day {step.delay_days} &#8212; {step.subject}</p>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs">{expandedStep === step.step ? "\u25b2 Hide" : "\u25bc Show"}</span>
                  </button>
                  {expandedStep === step.step && (
                    <div className="border-t border-surface-400/30 bg-surface-600/30 px-4 py-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject</p>
                        <p className="text-sm text-white font-medium">{step.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Body</p>
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{step.body}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* LinkedIn messages */}
          {(result.linkedin_connection_note || result.linkedin_followup) && (
            <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-4 text-sm">LinkedIn Messages</h3>
              {result.linkedin_connection_note && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Connection Request Note</p>
                  <div className="bg-violet-500/10 border border-violet-500/25 rounded-lg p-3 text-sm text-slate-300">
                    {result.linkedin_connection_note}
                  </div>
                </div>
              )}
              {result.linkedin_followup && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Follow-up Message</p>
                  <div className="bg-violet-500/10 border border-violet-500/25 rounded-lg p-3 text-sm text-slate-300">
                    {result.linkedin_followup}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/campaigns/${result.campaign_id}`)}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-medium transition"
            >
              Open Campaign &#8594;
            </button>
            <button
              onClick={() => { setResult(null); setDescription(""); }}
              className="px-6 py-3 bg-surface-700 border border-surface-400/40 text-slate-300 hover:text-white rounded-xl font-medium transition"
            >
              Create Another Campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
