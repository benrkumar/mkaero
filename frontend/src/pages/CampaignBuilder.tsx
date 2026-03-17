import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCampaign,
  enrollContacts,
  addStep,
  getAllTags,
  getContacts,
  previewEmail,
} from "../api/client";

type Step = {
  id: string;
  delay_days: number;
  subject: string;
  body: string;
  generating: boolean;
};

const GOALS = [
  "Book a 15-min Demo Call",
  "Request Product Sample",
  "Download Brochure",
  "Get a Quote",
  "Brand Awareness",
];

function ProgressBar({ step }: { step: number }) {
  const steps = ["Details", "Audience", "Sequence", "Launch"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              i + 1 === step
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : i + 1 < step
                ? "text-emerald-400"
                : "text-slate-500"
            }`}
          >
            {i + 1 < step && <span>&#10003;</span>}
            {i + 1 === step && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
            )}
            {s}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-px mx-1 ${
                i + 1 < step ? "bg-emerald-500/50" : "bg-surface-400/30"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [wizStep, setWizStep] = useState(1);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);

  // Step 2
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Step 3
  const [emailSteps, setEmailSteps] = useState<Step[]>([
    { id: "s1", delay_days: 0, subject: "", body: "", generating: false },
    { id: "s2", delay_days: 3, subject: "", body: "", generating: false },
    { id: "s3", delay_days: 7, subject: "", body: "", generating: false },
    { id: "s4", delay_days: 14, subject: "", body: "", generating: false },
  ]);
  const [previewStepIdx, setPreviewStepIdx] = useState<number | null>(null);

  // Step 4
  const [autoStart, setAutoStart] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAllTags().then(setAllTags).catch(() => {});
  }, []);

  const fetchAudienceCount = async () => {
    setAudienceLoading(true);
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 1, has_email: true };
      if (selectedTags.length) params.tag = selectedTags[0];
      const r = await getContacts(params);
      setAudienceCount(r.total ?? r.items?.length ?? 0);
    } catch {
      setAudienceCount(null);
    }
    setAudienceLoading(false);
  };

  useEffect(() => {
    if (wizStep === 2) fetchAudienceCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizStep, selectedTags.join(",")]);

  const toggleTag = (t: string) =>
    setSelectedTags((ts) =>
      ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]
    );

  const generateStepContent = async (idx: number) => {
    setEmailSteps((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, generating: true } : x))
    );
    try {
      const res = await previewEmail({
        step_number: idx + 1,
        campaign_goal: `${goal}. ${description}`,
        contact: {
          first_name: "{{first_name}}",
          last_name: "{{last_name}}",
          title: "{{title}}",
          company: "{{company}}",
          industry: "{{industry}}",
        },
      });
      setEmailSteps((prev) =>
        prev.map((x, i) =>
          i === idx
            ? {
                ...x,
                subject: res.subject ?? x.subject,
                body: res.body ?? x.body,
                generating: false,
              }
            : x
        )
      );
    } catch {
      alert("AI generation failed. Check your Anthropic API key in Settings.");
      setEmailSteps((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, generating: false } : x))
      );
    }
  };

  const addEmailStep = () => {
    const lastDelay = emailSteps.length
      ? emailSteps[emailSteps.length - 1].delay_days + 7
      : 0;
    setEmailSteps((prev) => [
      ...prev,
      {
        id: `s${Date.now()}`,
        delay_days: lastDelay,
        subject: "",
        body: "",
        generating: false,
      },
    ]);
  };

  const removeStep = (idx: number) =>
    setEmailSteps((prev) => prev.filter((_, i) => i !== idx));

  const updateStepField = (idx: number, field: keyof Step, value: unknown) =>
    setEmailSteps((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );

  const handleLaunch = async () => {
    if (!name.trim()) {
      setError("Campaign name is required.");
      setWizStep(1);
      return;
    }
    if (emailSteps.every((s) => !s.subject && !s.body)) {
      setError("Add content to at least one step.");
      return;
    }
    setError("");
    setLaunching(true);
    try {
      const campaign = await createCampaign({
        name,
        email_channel: true,
        linkedin_channel: false,
        status: autoStart ? "active" : "draft",
      });
      for (let i = 0; i < emailSteps.length; i++) {
        const s = emailSteps[i];
        if (!s.subject && !s.body) continue;
        await addStep(campaign.id, {
          step_order: i + 1,
          channel: "email",
          delay_days: s.delay_days,
          subject_template: s.subject,
          body_template: s.body,
        });
      }
      if (selectedTags.length > 0) {
        const contacts = await getContacts({
          tag: selectedTags[0],
          page_size: 200,
          has_email: true,
        });
        if (contacts.items?.length) {
          await enrollContacts(
            campaign.id,
            contacts.items.map((c: { id: string }) => c.id)
          );
        }
      }
      navigate(`/campaigns/${campaign.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? "Failed to create campaign.");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate("/email")}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-2 block"
        >
          &#8592; Email Campaigns
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manual Campaign Builder</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Full control over content and targeting &#8212; every step, every word.
        </p>
      </div>

      <ProgressBar step={wizStep} />

      {error && (
        <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Step 1: Details ── */}
      {wizStep === 1 && (
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Campaign Details</h2>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-2 block">
              Campaign Name *
            </label>
            <input
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
              placeholder="e.g. Drone OEM Founders &#8212; India Q1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-2 block">
              Description{" "}
              <span className="text-slate-300 dark:text-slate-600 normal-case tracking-normal font-normal">
                (helps AI generate better content)
              </span>
            </label>
            <textarea
              rows={3}
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
              placeholder="Target drone OEM founders and CTOs in India to pitch our motor and ESC components..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-2 block">
              Campaign Goal
            </label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`px-3 py-2 rounded-lg text-sm transition border ${
                    goal === g
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-slate-50 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (!name.trim()) {
                  setError("Name is required.");
                  return;
                }
                setError("");
                setWizStep(2);
              }}
              className="bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition"
            >
              Next: Audience &#8594;
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Audience ── */}
      {wizStep === 2 && (
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Target Audience</h2>
            <div className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/40 rounded-lg px-4 py-2 text-center min-w-[100px]">
              {audienceLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Counting...</p>
              ) : audienceCount !== null ? (
                <>
                  <p className="text-2xl font-bold font-mono text-sky-400">
                    {audienceCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">contacts match</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">&#8212;</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 block">
              Filter by Tags
            </label>
            {allTags.length === 0 ? (
              <p className="text-sm text-slate-500">
                No tags yet. Import contacts with tags from Lead Finder first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition border ${
                      selectedTags.includes(t)
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : "bg-surface-600 text-slate-400 border-surface-400/50 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-xs text-slate-400 hover:text-white px-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {selectedTags.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                No tag filter &#8212; all contacts with email will be enrolled
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizStep(1)}
              className="bg-surface-600 border border-surface-400/50 text-slate-300 hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
            >
              &#8592; Back
            </button>
            <button
              onClick={() => setWizStep(3)}
              className="bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition"
            >
              Next: Sequence &#8594;
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Sequence ── */}
      {wizStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Email Sequence</h2>
              <p className="text-slate-400 text-sm">
                Build your drip sequence. Use AI to generate content per step.
              </p>
            </div>
            <button
              onClick={addEmailStep}
              className="text-sm bg-surface-600 border border-surface-400/50 text-slate-300 hover:text-white rounded-lg px-3 py-2 transition"
            >
              + Add Step
            </button>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-3">
              {emailSteps.map((s, idx) => (
                <div
                  key={s.id}
                  className={`bg-surface-700 border rounded-xl transition ${
                    previewStepIdx === idx
                      ? "border-sky-500/50"
                      : "border-surface-400/40"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-400/30">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                        previewStepIdx === idx
                          ? "bg-sky-500 text-white"
                          : "bg-surface-500 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-slate-500">Day</span>
                      <input
                        type="number"
                        min={0}
                        className="w-14 bg-surface-500 border border-surface-400/50 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-sky-500"
                        value={s.delay_days}
                        onChange={(e) =>
                          updateStepField(
                            idx,
                            "delay_days",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <button
                      onClick={() => generateStepContent(idx)}
                      disabled={s.generating}
                      className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-lg px-3 py-1.5 hover:bg-violet-500/30 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {s.generating ? (
                        <>
                          <svg
                            className="animate-spin w-3 h-3"
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
                          Generating...
                        </>
                      ) : (
                        "\u2726 AI Generate"
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setPreviewStepIdx(
                          previewStepIdx === idx ? null : idx
                        )
                      }
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      {previewStepIdx === idx ? "\u25bc" : "\u25b6"} Preview
                    </button>
                    {emailSteps.length > 1 && (
                      <button
                        onClick={() => removeStep(idx)}
                        className="text-xs text-slate-500 hover:text-red-400"
                      >
                        &#10005;
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <input
                      className="w-full bg-surface-600 border border-surface-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition"
                      placeholder={`Step ${idx + 1} subject line...`}
                      value={s.subject}
                      onChange={(e) =>
                        updateStepField(idx, "subject", e.target.value)
                      }
                    />
                    <textarea
                      rows={4}
                      className="w-full bg-surface-600 border border-surface-400/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
                      placeholder={`Email body for step ${idx + 1}... Use {{first_name}}, {{company}}, {{title}}.`}
                      value={s.body}
                      onChange={(e) =>
                        updateStepField(idx, "body", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Preview panel */}
            <div className="col-span-1">
              <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-4 sticky top-6">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                  Preview
                </p>
                {previewStepIdx !== null && emailSteps[previewStepIdx] ? (
                  <div className="space-y-3">
                    <div className="bg-surface-600 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Subject</p>
                      <p className="text-sm text-white">
                        {emailSteps[previewStepIdx].subject
                          .replace(/\{\{first_name\}\}/g, "Arjun")
                          .replace(/\{\{company\}\}/g, "Aeronext") || "\u2014"}
                      </p>
                    </div>
                    <div className="bg-surface-600 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Body</p>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                        {emailSteps[previewStepIdx].body
                          .replace(/\{\{first_name\}\}/g, "Arjun")
                          .replace(/\{\{last_name\}\}/g, "Sharma")
                          .replace(/\{\{company\}\}/g, "Aeronext")
                          .replace(/\{\{title\}\}/g, "CTO")
                          .replace(/\{\{industry\}\}/g, "Aerospace") ||
                          "No content yet."}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 text-center">
                      Sample contact preview
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Click &#9658; Preview on any step to see it rendered here.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizStep(2)}
              className="bg-surface-600 border border-surface-400/50 text-slate-300 hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
            >
              &#8592; Back
            </button>
            <button
              onClick={() => setWizStep(4)}
              className="bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition"
            >
              Next: Review &#8594;
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Launch ── */}
      {wizStep === 4 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-white">Review &amp; Launch</h2>

          <div className="grid grid-cols-2 gap-5">
            <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-5 space-y-4">
              <h3 className="font-medium text-white text-sm">Campaign Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-white font-medium">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Goal</span>
                  <span className="text-white text-right max-w-[180px]">{goal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Steps</span>
                  <span className="text-sky-400 font-mono">
                    {emailSteps.filter((s) => s.subject || s.body).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audience</span>
                  <span className="text-white">
                    {selectedTags.length ? selectedTags.join(", ") : "All contacts"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Matching Contacts</span>
                  <span className="text-emerald-400 font-mono">
                    {audienceCount ?? "?"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-white">
                    {emailSteps.length > 0
                      ? `${emailSteps[emailSteps.length - 1].delay_days} days`
                      : "\u2014"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface-700 border border-surface-400/40 rounded-xl p-5 space-y-4">
              <h3 className="font-medium text-white text-sm">Launch Settings</h3>
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-surface-600 rounded-lg border border-surface-400/40">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <div>
                  <p className="text-sm font-medium text-white">Auto-start campaign</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Start sending immediately. Otherwise saved as draft.
                  </p>
                </div>
              </label>
              <div className="p-3 bg-surface-600 rounded-lg border border-surface-400/40 space-y-1">
                <p className="text-xs font-medium text-slate-300">Sequence</p>
                {emailSteps
                  .filter((s) => s.subject || s.body)
                  .map((s, i) => (
                    <p key={i} className="text-xs text-slate-500">
                      Day {s.delay_days}: {s.subject || "(no subject)"}
                    </p>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizStep(3)}
              className="bg-surface-600 border border-surface-400/50 text-slate-300 hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
            >
              &#8592; Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAutoStart(false);
                  handleLaunch();
                }}
                disabled={launching}
                className="bg-surface-600 border border-surface-400/50 text-slate-300 hover:text-white rounded-lg px-5 py-2.5 text-sm transition disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => {
                  setAutoStart(true);
                  handleLaunch();
                }}
                disabled={launching}
                className="bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition disabled:opacity-50 flex items-center gap-2"
              >
                {launching && (
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
                )}
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
