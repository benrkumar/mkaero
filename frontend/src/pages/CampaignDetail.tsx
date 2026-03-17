import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { addStep, deleteStep, getCampaign, getCampaignAnalytics, runCampaign, pauseCampaign } from "../api/client";
import StatsCard from "../components/StatsCard";

const API_BASE = "/api/v1";

// ─── types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  contact_id: string;
  status: "active" | "replied" | "completed" | "opted_out" | "paused";
  current_step: number;
  enrolled_at: string;
  contact: {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    title: string;
  };
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  replied: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  completed: "bg-slate-100 dark:bg-surface-600 text-slate-500 border border-slate-200 dark:border-surface-400/30",
  opted_out: "bg-red-500/10 text-red-400 border border-red-500/20",
  paused: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const VARIABLES = ["first_name", "last_name", "company", "title", "city", "industry"];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-800 dark:bg-surface-600 text-white text-sm px-4 py-3 rounded-xl shadow-xl border border-slate-600 dark:border-surface-400/40 flex items-center gap-3">
      <span>{message}</span>
      <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">✕</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();

  // existing state
  const [campaign, setCampaign] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStep, setNewStep] = useState({
    channel: "email",
    delay_days: 3,
    subject_template: "",
    body_template: "",
  });

  // main tab
  const [mainTab, setMainTab] = useState<"steps" | "contacts">("steps");

  // contacts / leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // add-contacts modal
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);

  // step modal enhancements
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [stepModalTab, setStepModalTab] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);

  // toast
  const [toast, setToast] = useState<string | null>(null);

  // ── loaders ────────────────────────────────────────────────────────────────
  const load = () => {
    getCampaign(id!).then(setCampaign).catch(console.error);
    getCampaignAnalytics(id!).then(setAnalytics).catch(() => {});
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/leads`);
      if (res.ok) {
        const data = await res.json();
        setLeads(Array.isArray(data) ? data : []);
      } else {
        setLeads([]);
      }
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (mainTab === "contacts") loadLeads();
  }, [mainTab]);

  // ── existing handlers ──────────────────────────────────────────────────────
  const handleAddStep = async () => {
    const order = (campaign?.steps?.length ?? 0) + 1;
    await addStep(id!, { ...newStep, step_order: order });
    setShowAddStep(false);
    setNewStep({ channel: "email", delay_days: 3, subject_template: "", body_template: "" });
    setStepModalTab("edit");
    load();
  };

  const handleDeleteStep = async (stepId: string) => {
    if (confirm("Delete this step?")) {
      await deleteStep(stepId);
      load();
    }
  };

  // ── variable insertion ─────────────────────────────────────────────────────
  const insertVariable = (varName: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const tag = `{{${varName}}}`;
    const next = el.value.slice(0, start) + tag + el.value.slice(end);
    setNewStep((s) => ({ ...s, body_template: next }));
    // restore cursor after re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  // ── AI compose ────────────────────────────────────────────────────────────
  const handleAiCompose = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content/preview/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: { first_name: "Alex", last_name: "Smith", company: "Acme Corp", title: "CEO", city: "", industry: "" },
          step_number: 1,
          campaign_goal: campaign?.goal ?? "general outreach",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewStep((s) => ({
          ...s,
          subject_template: data.subject ?? s.subject_template,
          body_template: data.body ?? s.body_template,
        }));
        setToast("AI content generated");
      } else {
        setToast("AI compose failed — try again");
      }
    } catch {
      setToast("AI compose failed — try again");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Preview tab ───────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setStepModalTab("preview");
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content/render-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newStep.subject_template,
          body: newStep.body_template,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html ?? data.rendered ?? "");
      }
    } catch {
      setPreviewHtml("<p>Preview unavailable</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Test email ────────────────────────────────────────────────────────────
  const handleSendTest = async () => {
    if (!testEmailAddress) return;
    setTestEmailSending(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailAddress, subject: newStep.subject_template, body: newStep.body_template }),
      });
      if (res.ok) {
        setToast(`Test email sent to ${testEmailAddress}`);
        setShowTestEmail(false);
        setTestEmailAddress("");
      } else {
        setToast("Failed to send test email");
      }
    } catch {
      setToast("Failed to send test email");
    } finally {
      setTestEmailSending(false);
    }
  };

  // ── contacts modal ────────────────────────────────────────────────────────
  const openAddContacts = async () => {
    setContactSearch("");
    setSelectedContactIds(new Set());
    setShowAddContacts(true);
    try {
      const res = await fetch(`${API_BASE}/contacts?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setAllContacts(Array.isArray(data) ? data : data.items ?? []);
      }
    } catch {
      setAllContacts([]);
    }
  };

  const filteredContacts = allContacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    return (
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  const toggleContact = (cid: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      next.has(cid) ? next.delete(cid) : next.add(cid);
      return next;
    });
  };

  const handleEnroll = async () => {
    if (selectedContactIds.size === 0) return;
    setEnrolling(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [...selectedContactIds] }),
      });
      if (res.ok) {
        setToast(`Enrolled ${selectedContactIds.size} contact${selectedContactIds.size !== 1 ? "s" : ""}`);
        setShowAddContacts(false);
        loadLeads();
      } else {
        setToast("Enrollment failed — try again");
      }
    } catch {
      setToast("Enrollment failed — try again");
    } finally {
      setEnrolling(false);
    }
  };

  // ── remove lead ───────────────────────────────────────────────────────────
  const handleRemoveLead = async (leadId: string) => {
    if (!confirm("Remove this contact from the campaign?")) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        setToast("Contact removed");
      } else {
        setToast("Failed to remove contact");
      }
    } catch {
      setToast("Failed to remove contact");
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (!campaign) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
          <span className="text-sm text-slate-400 dark:text-slate-500 capitalize">{campaign.status}</span>
        </div>
        <div className="flex gap-2">
          {campaign.status === "active" ? (
            <button
              onClick={() => pauseCampaign(id!).then(load)}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/30"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={() => runCampaign(id!).then(load).catch((e: any) => alert(e.response?.data?.detail))}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
            >
              Run Campaign
            </button>
          )}
        </div>
      </div>

      {/* Analytics summary */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatsCard label="Total Leads" value={analytics.total_leads} color="blue" />
          <StatsCard label="Active" value={analytics.active_leads} color="green" />
          <StatsCard label="Replied" value={analytics.replied_leads} color="green" />
          <StatsCard label="Open Rate" value={`${analytics.email?.open_rate ?? 0}%`} color="blue" />
        </div>
      )}

      {/* Main tab bar */}
      <div className="bg-slate-100 dark:bg-surface-800 rounded-lg p-1 flex gap-1 mb-4 w-fit">
        {(["steps", "contacts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              mainTab === tab
                ? "bg-white dark:bg-surface-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── STEPS TAB ─────────────────────────────────────────────────────── */}
      {mainTab === "steps" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Sequence Steps</h2>
            <button onClick={() => { setShowAddStep(true); setStepModalTab("edit"); }} className="text-sm text-sky-500 dark:text-sky-400 hover:underline">
              + Add Step
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {(campaign.steps ?? []).map((step: any, i: number) => (
              <div key={step.id} className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold capitalize">{step.channel}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Day {step.delay_days}</span>
                  </div>
                  <button onClick={() => handleDeleteStep(step.id)} className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                </div>
                {step.channel === "email" && step.subject_template && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <strong>Subject:</strong> {step.subject_template}
                  </p>
                )}
                {step.body_template && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{step.body_template}</p>
                )}
                {step.channel === "linkedin" && step.linkedin_message_template && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{step.linkedin_message_template}</p>
                )}
              </div>
            ))}
            {(campaign.steps ?? []).length === 0 && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-surface-400/40 rounded-lg">
                No steps yet. Add your first sequence step.
              </div>
            )}
          </div>

          {/* Add Step modal (inline card) */}
          {showAddStep && (
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5">
              {/* modal header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white">Add Sequence Step</h3>
                {/* Edit | Preview tabs */}
                <div className="bg-slate-100 dark:bg-surface-800 rounded-lg p-0.5 flex gap-0.5">
                  {(["edit", "preview"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => t === "preview" ? handlePreview() : setStepModalTab("edit")}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all capitalize ${
                        stepModalTab === t
                          ? "bg-white dark:bg-surface-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {stepModalTab === "edit" ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Channel</label>
                      <select
                        className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700"
                        value={newStep.channel}
                        onChange={(e) => setNewStep({ ...newStep, channel: e.target.value })}
                      >
                        <option value="email">Email</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Delay (days from previous step)</label>
                      <input
                        type="number"
                        className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700"
                        value={newStep.delay_days}
                        onChange={(e) => setNewStep({ ...newStep, delay_days: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  {newStep.channel === "email" && (
                    <>
                      {/* AI Compose button */}
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={handleAiCompose}
                          disabled={aiLoading}
                          className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {aiLoading ? (
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <span>✦</span>
                          )}
                          Compose with AI
                        </button>
                      </div>

                      {/* Subject */}
                      <div className="mb-3">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                          Subject (leave blank for AI generation)
                        </label>
                        <input
                          className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700"
                          value={newStep.subject_template}
                          onChange={(e) => setNewStep({ ...newStep, subject_template: e.target.value })}
                          placeholder="Quick question, {{first_name}}"
                        />
                      </div>

                      {/* Body */}
                      <div className="mb-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                          Body (leave blank for AI generation)
                        </label>
                        <textarea
                          ref={bodyRef}
                          rows={5}
                          className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700"
                          value={newStep.body_template}
                          onChange={(e) => setNewStep({ ...newStep, body_template: e.target.value })}
                          placeholder="Hi {{first_name}}, ..."
                        />
                      </div>

                      {/* Variable toolbar */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className="text-xs text-slate-400 dark:text-slate-500 self-center mr-1">Insert:</span>
                        {VARIABLES.map((v) => (
                          <button
                            key={v}
                            onClick={() => insertVariable(v)}
                            className="bg-slate-100 dark:bg-surface-600 text-sky-500 dark:text-sky-400 text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-sky-50 dark:hover:bg-surface-500 border border-slate-200 dark:border-surface-400/30"
                          >
                            {`{{${v}}}`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleAddStep} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                      Add Step
                    </button>
                    <button onClick={() => setShowAddStep(false)} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* Preview tab */
                <div>
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-500">Generating preview…</div>
                  ) : (
                    <iframe
                      srcDoc={previewHtml || `<html><body style="font-family:sans-serif;padding:16px;color:#555">${newStep.body_template || "No content yet"}</body></html>`}
                      className="w-full h-72 rounded-lg border border-slate-200 dark:border-surface-400/40 bg-white"
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => setStepModalTab("edit")}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      ← Back to Edit
                    </button>
                    <button
                      onClick={() => setShowTestEmail(true)}
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                    >
                      Send Test
                    </button>
                  </div>

                  {/* Test email mini-modal */}
                  {showTestEmail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="bg-white dark:bg-surface-700 rounded-xl shadow-xl border border-slate-200 dark:border-surface-400/40 p-6 w-full max-w-sm">
                        <h4 className="font-semibold text-slate-800 dark:text-white mb-3">Send Test Email</h4>
                        <input
                          type="email"
                          className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700 mb-4"
                          placeholder="you@example.com"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowTestEmail(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                            Cancel
                          </button>
                          <button
                            onClick={handleSendTest}
                            disabled={testEmailSending || !testEmailAddress}
                            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg disabled:opacity-60"
                          >
                            {testEmailSending ? "Sending…" : "Send"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── CONTACTS TAB ──────────────────────────────────────────────────── */}
      {mainTab === "contacts" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Enrolled Contacts</h2>
            <button
              onClick={openAddContacts}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium"
            >
              + Add Contacts
            </button>
          </div>

          {leadsLoading ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">Loading contacts…</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-surface-400/40 rounded-xl">
              No contacts enrolled yet. Click "Add Contacts" to enroll contacts into this campaign.
            </div>
          ) : (
            <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-surface-400/20">
                    {["Name", "Company", "Email", "Status", "Step", "Enrolled", ""].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-50 dark:border-surface-400/10 hover:bg-slate-50 dark:hover:bg-surface-600/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">
                        {lead.contact.first_name} {lead.contact.last_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{lead.contact.company || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{lead.contact.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[lead.status] ?? STATUS_BADGE.active}`}>
                          {lead.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">Step {lead.current_step + 1}</td>
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatDate(lead.enrolled_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveLead(lead.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ADD CONTACTS MODAL ────────────────────────────────────────────── */}
      {showAddContacts && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-surface-700 rounded-xl shadow-2xl border border-slate-200 dark:border-surface-400/40 w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* modal header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-surface-400/20 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-slate-800 dark:text-white">Add Contacts to Campaign</h3>
              <button onClick={() => setShowAddContacts(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">
                ✕
              </button>
            </div>

            {/* search */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-surface-400/20 flex-shrink-0">
              <input
                type="search"
                placeholder="Search by name, email, or company…"
                className="w-full border border-slate-200 dark:border-surface-400/40 rounded-lg px-3 py-2 text-sm bg-white dark:bg-surface-700 placeholder-slate-400"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                {selectedContactIds.size} selected · {filteredContacts.length} shown
              </p>
            </div>

            {/* list */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 400 }}>
              {filteredContacts.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">No contacts found</p>
              ) : (
                filteredContacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 dark:hover:bg-surface-600/30 cursor-pointer border-b border-slate-50 dark:border-surface-400/10 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      checked={selectedContactIds.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                        {c.first_name} {c.last_name}
                        {c.company ? <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal">· {c.company}</span> : null}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{c.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-surface-400/20 flex gap-2 justify-end flex-shrink-0">
              <button
                onClick={() => setShowAddContacts(false)}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrolling || selectedContactIds.size === 0}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {enrolling ? "Enrolling…" : `Enroll Selected (${selectedContactIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
