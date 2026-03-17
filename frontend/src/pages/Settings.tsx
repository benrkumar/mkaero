import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsMap = Record<string, string>;
type HasValueMap = Record<string, boolean>;

interface SettingsResponse {
  settings: SettingsMap;
  has_value: HasValueMap;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECRET_KEYS = new Set([
  "apollo_api_key",
  "mailgun_api_key",
  "anthropic_api_key",
  "phantombuster_api_key",
  "phantombuster_network_booster_id",
  "phantombuster_message_sender_id",
  "linkedin_session_cookie",
]);

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-surface-600 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-surface-400/40 rounded-full px-2.5 py-0.5">
      Not configured
    </span>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  fieldKey: string;
  value: string;
  isSecret: boolean;
  isTextarea?: boolean;
  placeholder?: string;
  onChange: (key: string, val: string) => void;
}

function Field({
  label,
  fieldKey,
  value,
  isSecret,
  isTextarea = false,
  placeholder,
  onChange,
}: FieldProps) {
  const [show, setShow] = useState(false);

  const inputClass =
    "w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40";

  const eyeButton = isSecret ? (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
      title={show ? "Hide" : "Show"}
    >
      {show ? (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            d="M3 3l14 14M8.46 8.46A3 3 0 0011.54 11.54M6.11 6.11A7.001 7.001 0 001.527 10c1.174 2.922 4.046 5 7.473 5 1.344 0 2.608-.35 3.695-.962M9.879 4.121A7 7 0 0118.473 10a7.002 7.002 0 01-2.583 3.396"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            d="M1.527 10C2.701 7.078 5.573 5 9 5s6.299 2.078 7.473 5C15.299 12.922 12.427 15 9 15S2.701 12.922 1.527 10z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  ) : null;

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        {isTextarea ? (
          <textarea
            rows={3}
            className={`${inputClass} resize-none ${isSecret ? "pr-10" : ""}`}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            style={
              isSecret && !show && value
                ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
                : undefined
            }
          />
        ) : (
          <input
            type={isSecret && !show ? "password" : "text"}
            className={`${inputClass} ${isSecret ? "pr-10" : ""}`}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(fieldKey, e.target.value)}
          />
        )}
        {eyeButton}
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  keys: string[];
  fieldLabels: Record<string, string>;
  fieldPlaceholders?: Record<string, string>;
  values: SettingsMap;
  hasValue: HasValueMap;
  onChange: (key: string, val: string) => void;
  onSave: (keys: string[]) => Promise<void>;
  saving: boolean;
  toast: string | null;
  highlight?: boolean;
  children?: React.ReactNode;
}

function SectionCard({
  title,
  description,
  keys,
  fieldLabels,
  fieldPlaceholders = {},
  values,
  hasValue,
  onChange,
  onSave,
  saving,
  toast,
  highlight = false,
  children,
}: SectionCardProps) {
  const sectionConnected = keys.every((k) => hasValue[k]);
  const sectionPartial = !sectionConnected && keys.some((k) => hasValue[k]);

  return (
    <div
      className={`bg-white dark:bg-surface-700 border rounded-xl p-5 ${
        highlight
          ? "border-sky-400/60 dark:border-sky-500/40 shadow-sm shadow-sky-500/10"
          : "border-slate-200 dark:border-surface-400/40"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {sectionConnected ? (
              <Badge connected />
            ) : sectionPartial ? (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2.5 py-0.5">
                Partial
              </span>
            ) : (
              <Badge connected={false} />
            )}
          </div>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {keys.map((key) => (
          <Field
            key={key}
            label={fieldLabels[key] ?? key}
            fieldKey={key}
            value={values[key] ?? ""}
            isSecret={SECRET_KEYS.has(key)}
            placeholder={fieldPlaceholders[key]}
            onChange={onChange}
          />
        ))}
      </div>

      {children}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-surface-600/60">
        <div className="h-5">
          {toast && (
            <span className="text-sm text-emerald-500 font-medium animate-pulse">{toast}</span>
          )}
        </div>
        <button
          onClick={() => onSave(keys)}
          disabled={saving}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── LinkedIn section ─────────────────────────────────────────────────────────

interface LinkedInSectionProps {
  values: SettingsMap;
  hasValue: HasValueMap;
  onChange: (key: string, val: string) => void;
  onSave: (keys: string[]) => Promise<void>;
  saving: boolean;
  toast: string | null;
}

function LinkedInSection({
  values,
  hasValue,
  onChange,
  onSave,
  saving,
  toast,
}: LinkedInSectionProps) {
  const [show, setShow] = useState(false);
  const val = values["linkedin_session_cookie"] ?? "";

  return (
    <div className="bg-white dark:bg-surface-700 border border-sky-400/60 dark:border-sky-500/40 shadow-sm shadow-sky-500/10 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">LinkedIn Session</h2>
            {hasValue["linkedin_session_cookie"] ? (
              <Badge connected />
            ) : (
              <Badge connected={false} />
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Paste your LinkedIn{" "}
            <code className="text-sky-500 bg-sky-500/10 rounded px-1 py-px text-xs">li_at</code>{" "}
            session cookie below. To get it: open LinkedIn in Chrome → F12 → Application → Cookies
            → copy the value of{" "}
            <code className="text-sky-500 bg-sky-500/10 rounded px-1 py-px text-xs">li_at</code>
          </p>
        </div>
        <a
          href="https://www.linkedin.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 ml-4 bg-slate-100 dark:bg-surface-600 hover:bg-slate-200 dark:hover:bg-surface-500 text-slate-700 dark:text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Open LinkedIn
        </a>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          li_at Cookie Value
        </label>
        <div className="relative">
          <textarea
            rows={3}
            className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none pr-10"
            value={val}
            placeholder="Paste your li_at cookie value here…"
            onChange={(e) => onChange("linkedin_session_cookie", e.target.value)}
            style={
              !show && val
                ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
                : undefined
            }
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title={show ? "Hide" : "Show"}
          >
            {show ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M3 3l14 14M8.46 8.46A3 3 0 0011.54 11.54M6.11 6.11A7.001 7.001 0 001.527 10c1.174 2.922 4.046 5 7.473 5 1.344 0 2.608-.35 3.695-.962M9.879 4.121A7 7 0 0118.473 10a7.002 7.002 0 01-2.583 3.396"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M1.527 10C2.701 7.078 5.573 5 9 5s6.299 2.078 7.473 5C15.299 12.922 12.427 15 9 15S2.701 12.922 1.527 10z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-surface-600/60">
        <div className="h-5">
          {toast && (
            <span className="text-sm text-emerald-500 font-medium animate-pulse">{toast}</span>
          )}
        </div>
        <button
          onClick={() => onSave(["linkedin_session_cookie"])}
          disabled={saving}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Section definitions ──────────────────────────────────────────────────────

interface SectionDef {
  id: string;
  title: string;
  description: string;
  keys: string[];
  labels: Record<string, string>;
  placeholders: Record<string, string>;
}

const SECTIONS: SectionDef[] = [
  {
    id: "anthropic",
    title: "Claude AI (Anthropic)",
    description:
      "Used for AI-powered message generation and content creation.",
    keys: ["anthropic_api_key"],
    labels: { anthropic_api_key: "API Key" },
    placeholders: { anthropic_api_key: "sk-ant-api03-…" },
  },
  {
    id: "apollo",
    title: "Apollo.io",
    description: "Used for contact enrichment and lead data.",
    keys: ["apollo_api_key"],
    labels: { apollo_api_key: "API Key" },
    placeholders: { apollo_api_key: "Your Apollo.io API key" },
  },
  {
    id: "mailgun",
    title: "Mailgun",
    description: "Used for sending outreach emails.",
    keys: ["mailgun_api_key", "mailgun_domain", "mailgun_from", "mailgun_from_name"],
    labels: {
      mailgun_api_key: "API Key",
      mailgun_domain: "Sending Domain",
      mailgun_from: "From Email Address",
      mailgun_from_name: "From Name",
    },
    placeholders: {
      mailgun_api_key: "key-…",
      mailgun_domain: "mg.yourdomain.com",
      mailgun_from: "outreach@yourdomain.com",
      mailgun_from_name: "Your Name",
    },
  },
  {
    id: "phantombuster",
    title: "Phantombuster",
    description:
      "Used for LinkedIn automation — network booster and message sender.",
    keys: [
      "phantombuster_api_key",
      "phantombuster_network_booster_id",
      "phantombuster_message_sender_id",
    ],
    labels: {
      phantombuster_api_key: "API Key",
      phantombuster_network_booster_id: "Network Booster Agent ID",
      phantombuster_message_sender_id: "Message Sender Agent ID",
    },
    placeholders: {
      phantombuster_api_key: "Your Phantombuster API key",
      phantombuster_network_booster_id: "Agent ID",
      phantombuster_message_sender_id: "Agent ID",
    },
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const [values, setValues] = useState<SettingsMap>({});
  const [hasValue, setHasValue] = useState<HasValueMap>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [sectionToast, setSectionToast] = useState<Record<string, string | null>>({});
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data: SettingsResponse = await res.json();
      setValues(data.settings);
      setHasValue(data.has_value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const showToast = useCallback((sectionId: string, message: string) => {
    setSectionToast((prev) => ({ ...prev, [sectionId]: message }));
    setTimeout(() => {
      setSectionToast((prev) => ({ ...prev, [sectionId]: null }));
    }, 2500);
  }, []);

  const saveKeys = useCallback(
    async (keys: string[], sectionId: string): Promise<void> => {
      const payload: SettingsMap = {};
      for (const k of keys) {
        payload[k] = values[k] ?? "";
      }
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      await fetchSettings();
      showToast(sectionId, "Saved!");
    },
    [values, fetchSettings, showToast]
  );

  const handleSaveSection = useCallback(
    async (keys: string[], sectionId: string) => {
      setSavingSection(sectionId);
      try {
        await saveKeys(keys, sectionId);
      } catch (err) {
        console.error(err);
      } finally {
        setSavingSection(null);
      }
    },
    [saveKeys]
  );

  const handleSaveAll = useCallback(async () => {
    setSavingAll(true);
    try {
      const allKeys = [
        ...SECTIONS.flatMap((s) => s.keys),
        "linkedin_session_cookie",
      ];
      const payload: SettingsMap = {};
      for (const k of allKeys) {
        payload[k] = values[k] ?? "";
      }
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      await fetchSettings();
      setGlobalToast("All settings saved!");
      setTimeout(() => setGlobalToast(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAll(false);
    }
  }, [values, fetchSettings]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage API keys and integration credentials. Values are stored securely in the database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {globalToast && (
            <span className="text-sm text-emerald-500 font-medium animate-pulse">
              {globalToast}
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={savingAll}
            className="bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {savingAll ? "Saving…" : "Save All"}
          </button>
        </div>
      </div>

      {/* Credential sections */}
      {SECTIONS.map((section) => (
        <SectionCard
          key={section.id}
          title={section.title}
          description={section.description}
          keys={section.keys}
          fieldLabels={section.labels}
          fieldPlaceholders={section.placeholders}
          values={values}
          hasValue={hasValue}
          onChange={handleChange}
          onSave={(keys) => handleSaveSection(keys, section.id)}
          saving={savingSection === section.id}
          toast={sectionToast[section.id] ?? null}
        />
      ))}

      {/* LinkedIn section */}
      <LinkedInSection
        values={values}
        hasValue={hasValue}
        onChange={handleChange}
        onSave={(keys) => handleSaveSection(keys, "linkedin")}
        saving={savingSection === "linkedin"}
        toast={sectionToast["linkedin"] ?? null}
      />

      {/* Safety notices */}
      <div className="space-y-3 pt-2">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <span className="font-semibold">LinkedIn notice:</span> Use LinkedIn automation
            responsibly and in accordance with LinkedIn&apos;s Terms of Service. Excessive
            automation may result in account restrictions. Always respect connection request limits.
          </p>
        </div>
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
          <p className="text-sm text-sky-600 dark:text-sky-400">
            <span className="font-semibold">Apollo.io notice:</span> Ensure your use of Apollo data
            complies with applicable data protection regulations (GDPR, CAN-SPAM, etc.) and
            Apollo&apos;s Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
