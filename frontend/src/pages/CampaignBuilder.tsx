import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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

type Contact = {
  id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  company?: string;
  email?: string;
};

type Toast = { message: string; type: "success" | "error" } | null;

const GOALS = [
  "Book a 15-min Demo Call",
  "Request Product Sample",
  "Download Brochure",
  "Get a Quote",
  "Brand Awareness",
];

const VARIABLES = ["first_name", "last_name", "company", "title", "city", "industry"];

const SAMPLE_CONTACT = {
  first_name: "Alex",
  last_name: "Chen",
  company: "Acme Corp",
  title: "Head of Operations",
  city: "Mumbai",
  industry: "Manufacturing",
  email: "alex@acmecorp.com",
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "w-3 h-3"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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

// ── Test Email Modal ──────────────────────────────────────────────────────────
function TestEmailModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (toEmail: string, toName: string) => Promise<void>;
}) {
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("Test User");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim()) return;
    setSending(true);
    await onSend(toEmail.trim(), toName.trim() || "Test User");
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          Send Test Email
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Email will be sent with sample contact data (Alex Chen, Acme Corp)
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1.5 block">
              To email address *
            </label>
            <input
              type="email"
              required
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-sky-500 transition"
              placeholder="you@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1.5 block">
              Your name{" "}
              <span className="normal-case tracking-normal font-normal text-slate-300 dark:text-slate-600">
                (optional)
              </span>
            </label>
            <input
              type="text"
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-sky-500 transition"
              placeholder="Test User"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !toEmail.trim()}
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending && <SpinnerIcon className="w-4 h-4" />}
              Send Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [wizStep, setWizStep] = useState(1);

  // Toast
  const [toast, setToast] = useState<Toast>(null);
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);

  // Step 2 — tag filter
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Step 2 — contact picker
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Step 3
  const [emailSteps, setEmailSteps] = useState<Step[]>([
    { id: "s1", delay_days: 0, subject: "", body: "", generating: false },
    { id: "s2", delay_days: 3, subject: "", body: "", generating: false },
    { id: "s3", delay_days: 7, subject: "", body: "", generating: false },
    { id: "s4", delay_days: 14, subject: "", body: "", generating: false },
  ]);
  const [previewStepIdx, setPreviewStepIdx] = useState<number | null>(null);

  // Step 3 — per-step tab state (edit | preview)
  const [stepTab, setStepTab] = useState<"edit" | "preview">("edit");
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);

  // Step 3 — AI compose (uses new endpoint with sample contact)
  const [aiComposing, setAiComposing] = useState<number | null>(null);

  // Step 3 — render-preview state
  const [renderPreviewLoading, setRenderPreviewLoading] = useState(false);
  const [renderPreviewData, setRenderPreviewData] = useState<{
    subject: string;
    body_html: string;
  } | null>(null);

  // Step 3 — test email modal
  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);

  // Ref for body textarea to support cursor-position variable insertion
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Step 4
  const [autoStart, setAutoStart] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  // Load tags and contacts on mount
  useEffect(() => {
    getAllTags().then(setAllTags).catch(() => {});
    setContactsLoading(true);
    getContacts({ page_size: 200, has_email: true })
      .then((r) => setAllContacts(r.items ?? r ?? []))
      .catch(() => setAllContacts([]))
      .finally(() => setContactsLoading(false));
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

  // Reset preview data when switching active step or tab
  useEffect(() => {
    setRenderPreviewData(null);
    setStepTab("edit");
  }, [activeStepIdx]);

  const fetchRenderPreview = async (idx: number) => {
    const s = emailSteps[idx];
    setRenderPreviewLoading(true);
    setRenderPreviewData(null);
    try {
      const res = await fetch("/api/v1/content/render-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: s.subject, body: s.body }),
      });
      if (!res.ok) throw new Error("Failed to render preview");
      const data = await res.json();
      setRenderPreviewData({ subject: data.subject ?? s.subject, body_html: data.body_html ?? data.body ?? "" });
    } catch {
      setRenderPreviewData({ subject: s.subject, body_html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${s.body}</pre>` });
    } finally {
      setRenderPreviewLoading(false);
    }
  };

  const handleTabChange = (tab: "edit" | "preview", idx: number) => {
    setStepTab(tab);
    if (tab === "preview") {
      fetchRenderPreview(idx);
    }
  };

  const toggleTag = (t: string) =>
    setSelectedTags((ts) =>
      ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]
    );

  const toggleContact = (id: string) =>
    setSelectedContactIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase().trim();
    if (!q) return allContacts;
    return allContacts.filter(
      (c) =>
        `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [allContacts, contactSearch]);

  // Audience summary: tag count + individual picks
  const tagCount = audienceCount ?? 0;
  const individualCount = selectedContactIds.length;
  const totalEstimate = tagCount + individualCount;

  // AI Compose with sample contact (new endpoint)
  const aiComposeStep = async (idx: number) => {
    setAiComposing(idx);
    try {
      const res = await fetch("/api/v1/content/preview/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: SAMPLE_CONTACT,
          step_number: idx + 1,
          campaign_goal: goal,
        }),
      });
      if (!res.ok) throw new Error("AI compose failed");
      const data = await res.json();
      setEmailSteps((prev) =>
        prev.map((x, i) =>
          i === idx
            ? { ...x, subject: data.subject ?? x.subject, body: data.body ?? x.body }
            : x
        )
      );
    } catch {
      showToast("AI composition failed. Check your API key in Settings.", "error");
    } finally {
      setAiComposing(null);
    }
  };

  // Insert variable at cursor position in body textarea
  const insertVariable = (varName: string, idx: number) => {
    const token = `{{${varName}}}`;
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const current = emailSteps[idx].body;
      const newBody = current.slice(0, start) + token + current.slice(end);
      updateStepField(idx, "body", newBody);
      // Restore focus and cursor after React re-render
      setTimeout(() => {
        textarea.focus();
        const newPos = start + token.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      // Fallback: append to end
      updateStepField(idx, "body", emailSteps[idx].body + token);
    }
  };

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

  const handleSendTestEmail = async (toEmail: string, toName: string) => {
    if (!savedCampaignId) {
      showToast("Save campaign first to send test email.", "error");
      setTestEmailModalOpen(false);
      return;
    }
    if (activeStepIdx === null) return;
    const step = emailSteps[activeStepIdx];
    try {
      const res = await fetch(`/api/v1/campaigns/${savedCampaignId}/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_id: step.id,
          to_email: toEmail,
          to_name: toName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to send test email");
      }
      showToast(`Test email sent to ${toEmail}!`, "success");
      setTestEmailModalOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send test email";
      showToast(msg, "error");
    }
  };

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
      setSavedCampaignId(campaign.id);
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

      // Enroll contacts from tag filter
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

      // Enroll individually selected contacts (deduplicated server-side)
      if (selectedContactIds.length > 0) {
        await enrollContacts(campaign.id, selectedContactIds);
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Test Email Modal */}
      {testEmailModalOpen && (
        <TestEmailModal
          onClose={() => setTestEmailModalOpen(false)}
          onSend={handleSendTestEmail}
        />
      )}

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
                  <p className="text-xs text-slate-400 dark:text-slate-500">from tags</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">&#8212;</p>
              )}
            </div>
          </div>

          {/* Tag filter */}
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 block">
              Filter by Tags
            </label>
            {allTags.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
                        : "bg-slate-50 dark:bg-surface-600 text-slate-400 border-slate-200 dark:border-surface-400/50 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white px-2"
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

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-surface-400/40" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest">
              or pick individually
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-surface-400/40" />
          </div>

          {/* Contact picker */}
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 block">
              Individual Contacts
            </label>

            {/* Search input */}
            <div className="relative mb-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
                />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
                placeholder="Search by name, company, or email…"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>

            {/* Scrollable contact list */}
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-surface-400/40 rounded-lg bg-slate-50 dark:bg-surface-600">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500 text-sm">
                  <svg
                    className="animate-spin w-4 h-4 text-sky-500"
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
                  Loading contacts…
                </div>
              ) : filteredContacts.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
                  {contactSearch ? "No contacts match your search." : "No contacts found."}
                </p>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedContactIds.includes(contact.id);
                  const fullName =
                    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                    contact.email ||
                    contact.id;
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-200 dark:border-surface-400/30 last:border-b-0 transition ${
                        isSelected
                          ? "bg-sky-50 dark:bg-sky-500/10"
                          : "hover:bg-white dark:hover:bg-surface-500/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-sky-500 shrink-0"
                        checked={isSelected}
                        onChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-sky-600 dark:text-sky-300"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {fullName}
                        </p>
                        {(contact.title || contact.company) && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {[contact.title, contact.company].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-sky-500 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Select/clear all helpers */}
            {!contactsLoading && filteredContacts.length > 0 && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() =>
                    setSelectedContactIds((prev) => {
                      const ids = new Set(prev);
                      filteredContacts.forEach((c) => ids.add(c.id));
                      return Array.from(ids);
                    })
                  }
                  className="text-xs text-sky-500 hover:text-sky-400 transition"
                >
                  Select all visible
                </button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button
                  onClick={() =>
                    setSelectedContactIds((prev) => {
                      const visibleIds = new Set(filteredContacts.map((c) => c.id));
                      return prev.filter((id) => !visibleIds.has(id));
                    })
                  }
                  className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Deselect all visible
                </button>
                {selectedContactIds.length > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <button
                      onClick={() => setSelectedContactIds([])}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Audience summary */}
          <div className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/40 rounded-lg px-4 py-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-mono font-semibold text-sky-400">{tagCount.toLocaleString()}</span>
              <span className="text-slate-500 dark:text-slate-400"> from tags</span>
              {" + "}
              <span className="font-mono font-semibold text-violet-400">
                {individualCount.toLocaleString()}
              </span>
              <span className="text-slate-500 dark:text-slate-400"> individually selected</span>
              {" = "}
              <span className="font-mono font-semibold text-emerald-400">
                {totalEstimate.toLocaleString()}
              </span>
              <span className="text-slate-500 dark:text-slate-400"> total</span>
              {tagCount > 0 && individualCount > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                  (duplicates will be deduplicated)
                </span>
              )}
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizStep(1)}
              className="bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email Sequence</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Build your drip sequence. Use AI to generate content per step.
              </p>
            </div>
            <button
              onClick={addEmailStep}
              className="text-sm bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-3 py-2 transition"
            >
              + Add Step
            </button>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-3">
              {emailSteps.map((s, idx) => {
                const isActive = activeStepIdx === idx;
                const isComposing = aiComposing === idx;
                return (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-surface-700 border rounded-xl transition ${
                      previewStepIdx === idx || isActive
                        ? "border-sky-500/50"
                        : "border-slate-200 dark:border-surface-400/40"
                    }`}
                  >
                    {/* Step header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-surface-400/30">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                          previewStepIdx === idx || isActive
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 dark:bg-surface-500 text-slate-400"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-slate-500">Day</span>
                        <input
                          type="number"
                          min={0}
                          className="w-14 bg-slate-50 dark:bg-surface-500 border border-slate-200 dark:border-surface-400/50 rounded px-2 py-1 text-xs text-slate-900 dark:text-white text-center outline-none focus:border-sky-500"
                          value={s.delay_days}
                          onChange={(e) =>
                            updateStepField(idx, "delay_days", parseInt(e.target.value) || 0)
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
                            <SpinnerIcon />
                            Generating...
                          </>
                        ) : (
                          "\u2726 AI Generate"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const next = isActive ? null : idx;
                          setActiveStepIdx(next);
                          setPreviewStepIdx(next);
                        }}
                        className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        {isActive ? "\u25bc" : "\u25b6"} Edit
                      </button>
                      <button
                        onClick={() =>
                          setPreviewStepIdx(previewStepIdx === idx ? null : idx)
                        }
                        className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
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

                    {/* Step editor — expanded when active */}
                    {isActive && (
                      <div className="p-4 space-y-3">
                        {/* Edit | Preview tab toggle */}
                        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-surface-400/30 pb-3">
                          <button
                            onClick={() => handleTabChange("edit", idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              stepTab === "edit"
                                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            &#9998; Edit
                          </button>
                          <button
                            onClick={() => handleTabChange("preview", idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              stepTab === "preview"
                                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            &#128065; Preview
                          </button>
                        </div>

                        {stepTab === "edit" && (
                          <>
                            {/* AI Compose button — right-aligned above Subject */}
                            <div className="flex justify-end">
                              <button
                                onClick={() => aiComposeStep(idx)}
                                disabled={isComposing}
                                className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                              >
                                {isComposing ? (
                                  <>
                                    <SpinnerIcon />
                                    Composing...
                                  </>
                                ) : (
                                  "\u2726 Compose with AI"
                                )}
                              </button>
                            </div>

                            {/* Subject */}
                            <input
                              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-sky-500 transition"
                              placeholder={`Step ${idx + 1} subject line...`}
                              value={s.subject}
                              onChange={(e) => updateStepField(idx, "subject", e.target.value)}
                            />

                            {/* Body */}
                            <textarea
                              ref={activeStepIdx === idx ? bodyTextareaRef : undefined}
                              rows={6}
                              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
                              placeholder={`Email body for step ${idx + 1}... Use {{first_name}}, {{company}}, {{title}}.`}
                              value={s.body}
                              onChange={(e) => updateStepField(idx, "body", e.target.value)}
                            />

                            {/* Variable insertion toolbar */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">
                                Insert variable:
                              </span>
                              {VARIABLES.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVariable(v, idx)}
                                  className="bg-slate-100 dark:bg-surface-600 text-sky-500 dark:text-sky-400 text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-sky-50 dark:hover:bg-surface-500 border border-slate-200 dark:border-surface-400/30 transition"
                                >
                                  {`{{${v}}}`}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {stepTab === "preview" && (
                          <div className="space-y-3">
                            {/* Sample data note */}
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Previewing with sample data:{" "}
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                Alex Chen · Acme Corp · Head of Operations
                              </span>
                            </p>

                            {renderPreviewLoading ? (
                              <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
                                <SpinnerIcon className="w-4 h-4" />
                                Rendering preview…
                              </div>
                            ) : renderPreviewData ? (
                              <>
                                {/* Subject banner */}
                                <div className="bg-slate-100 dark:bg-surface-600 rounded-lg px-4 py-2.5">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Subject:{" "}
                                  </span>
                                  <span className="text-sm text-slate-900 dark:text-white">
                                    {renderPreviewData.subject || "(no subject)"}
                                  </span>
                                </div>

                                {/* Body iframe */}
                                <iframe
                                  srcDoc={renderPreviewData.body_html}
                                  style={{ width: "100%", minHeight: "400px", border: "none", borderRadius: "8px" }}
                                  title={`Preview step ${idx + 1}`}
                                  sandbox="allow-same-origin"
                                />

                                {/* Action buttons */}
                                <div className="flex items-center gap-3 pt-1">
                                  <button
                                    onClick={() => fetchRenderPreview(idx)}
                                    className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition"
                                  >
                                    &#8635; Refresh
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveStepIdx(idx);
                                      setTestEmailModalOpen(true);
                                    }}
                                    className="text-xs bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition"
                                  >
                                    &#128231; Send Test Email
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-slate-500 text-center py-8">
                                No preview available.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsed quick-view (when not active) */}
                    {!isActive && (
                      <div className="p-4 space-y-3">
                        <input
                          className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-sky-500 transition"
                          placeholder={`Step ${idx + 1} subject line...`}
                          value={s.subject}
                          onChange={(e) => updateStepField(idx, "subject", e.target.value)}
                          onClick={() => {
                            setActiveStepIdx(idx);
                            setPreviewStepIdx(idx);
                          }}
                        />
                        <textarea
                          rows={4}
                          className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
                          placeholder={`Email body for step ${idx + 1}... Use {{first_name}}, {{company}}, {{title}}.`}
                          value={s.body}
                          onChange={(e) => updateStepField(idx, "body", e.target.value)}
                          onClick={() => {
                            setActiveStepIdx(idx);
                            setPreviewStepIdx(idx);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Preview panel */}
            <div className="col-span-1">
              <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-4 sticky top-6">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                  Preview
                </p>
                {previewStepIdx !== null && emailSteps[previewStepIdx] ? (
                  <div className="space-y-3">
                    <div className="bg-slate-50 dark:bg-surface-600 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Subject</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {emailSteps[previewStepIdx].subject
                          .replace(/\{\{first_name\}\}/g, "Arjun")
                          .replace(/\{\{company\}\}/g, "Aeronext") || "\u2014"}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-surface-600 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Body</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {emailSteps[previewStepIdx].body
                          .replace(/\{\{first_name\}\}/g, "Arjun")
                          .replace(/\{\{last_name\}\}/g, "Sharma")
                          .replace(/\{\{company\}\}/g, "Aeronext")
                          .replace(/\{\{title\}\}/g, "CTO")
                          .replace(/\{\{industry\}\}/g, "Aerospace") ||
                          "No content yet."}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
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
              className="bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Review &amp; Launch</h2>

          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white text-sm">Campaign Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-slate-900 dark:text-white font-medium">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Goal</span>
                  <span className="text-slate-900 dark:text-white text-right max-w-[180px]">{goal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Steps</span>
                  <span className="text-sky-400 font-mono">
                    {emailSteps.filter((s) => s.subject || s.body).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audience (tags)</span>
                  <span className="text-slate-900 dark:text-white">
                    {selectedTags.length ? selectedTags.join(", ") : "All contacts"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">From tags</span>
                  <span className="text-emerald-400 font-mono">{tagCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Individually selected</span>
                  <span className="text-violet-400 font-mono">{individualCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-surface-400/30 pt-2">
                  <span className="text-slate-500 font-medium">Total estimate</span>
                  <span className="text-sky-400 font-mono font-semibold">
                    {totalEstimate.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-slate-900 dark:text-white">
                    {emailSteps.length > 0
                      ? `${emailSteps[emailSteps.length - 1].delay_days} days`
                      : "\u2014"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white text-sm">Launch Settings</h3>
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-surface-600 rounded-lg border border-slate-200 dark:border-surface-400/40">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Auto-start campaign</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Start sending immediately. Otherwise saved as draft.
                  </p>
                </div>
              </label>
              <div className="p-3 bg-slate-50 dark:bg-surface-600 rounded-lg border border-slate-200 dark:border-surface-400/40 space-y-1">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Sequence</p>
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
              className="bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-4 py-2.5 text-sm transition"
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
                className="bg-slate-100 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg px-5 py-2.5 text-sm transition disabled:opacity-50"
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
                {launching && <SpinnerIcon className="w-4 h-4" />}
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
