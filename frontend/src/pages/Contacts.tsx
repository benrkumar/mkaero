import { useEffect, useRef, useState } from "react";
import {
  deleteContact,
  getContacts,
  addContactTags,
  getAllTags,
  bulkTagContacts,
  createContact,
  uploadCSVPreview,
  uploadCSV,
} from "../api/client";
import { Link } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  new:          "bg-sky-500/15 text-sky-400 border border-sky-500/25",
  in_campaign:  "bg-violet-500/15 text-violet-400 border border-violet-500/25",
  replied:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  unsubscribed: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  bounced:      "bg-red-500/15 text-red-400 border border-red-500/25",
};

const CONTACT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name",  label: "Last Name" },
  { key: "email",      label: "Email", required: true },
  { key: "company",    label: "Company" },
  { key: "title",      label: "Title" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "phone",      label: "Phone" },
];

// ── Add Contact Modal ──────────────────────────────────────────────────────

function AddContactModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({
    first_name: "", last_name: "", email: "", company: "", title: "", linkedin_url: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) { setError("Email is required."); return; }
    setSaving(true);
    setError("");
    try {
      await createContact(form);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Contact</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {CONTACT_FIELDS.map(({ key, label, required }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type={key === "email" ? "email" : "text"}
                required={required}
                className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              {saving ? "Saving..." : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CSV Upload Modal ───────────────────────────────────────────────────────

type PreviewData = { headers: string[]; rows: string[][] };

function CSVUploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importTag, setImportTag] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewError("");
    setPreview(null);
    setLoadingPreview(true);
    try {
      const data = await uploadCSVPreview(selectedFile);
      // Expect: { headers: string[], rows: string[][] }
      setPreview(data);
      // Default mapping: skip all
      const defaultMapping: Record<string, string> = {};
      CONTACT_FIELDS.forEach(({ key }) => { defaultMapping[key] = ""; });
      // Auto-map by matching header names
      CONTACT_FIELDS.forEach(({ key, label }) => {
        const match = data.headers.find(
          (h: string) =>
            h.toLowerCase().replace(/[\s_-]/g, "") === key.toLowerCase().replace(/[\s_-]/g, "") ||
            h.toLowerCase().replace(/[\s_-]/g, "") === label.toLowerCase().replace(/[\s_-]/g, "")
        );
        if (match) defaultMapping[key] = match;
      });
      setMapping(defaultMapping);
      setStep(2);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.detail ?? "Failed to parse CSV. Please check your file.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const result = await uploadCSV(file, mapping, importTag.trim() || undefined);
      setImportResult({ imported: result.imported ?? 0, skipped: result.skipped ?? 0 });
      onSuccess();
    } catch (err: any) {
      setImportError(err?.response?.data?.detail ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload CSV</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Step {step} of 3 — {step === 1 ? "Select File" : step === 2 ? "Map Columns" : "Import"}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-sky-500" : "bg-slate-200 dark:bg-surface-500"}`}
            />
          ))}
        </div>

        {/* Step 1: File select */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-surface-400/50 rounded-xl p-10 text-center cursor-pointer hover:border-sky-500 dark:hover:border-sky-500 transition group"
            >
              <div className="text-3xl mb-3 text-slate-400 dark:text-slate-500 group-hover:text-sky-400 transition">&#8682;</div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {file ? file.name : "Drop your CSV here, or click to browse"}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Accepts .csv files</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
              />
            </div>
            {loadingPreview && (
              <p className="text-sm text-sky-400 text-center">Parsing CSV...</p>
            )}
            {previewError && (
              <p className="text-sm text-red-400 text-center">{previewError}</p>
            )}
          </div>
        )}

        {/* Step 2: Column mapping + preview table */}
        {step === 2 && preview && (
          <div className="space-y-4">
            {/* Preview table */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-surface-400/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-surface-600 border-b border-slate-200 dark:border-surface-400/30">
                      {preview.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-surface-400/15">
                    {preview.rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-surface-600/40">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[160px] truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mapping selects */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Map Columns</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONTACT_FIELDS.map(({ key, label, required }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300 w-28 shrink-0">
                      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                    </span>
                    <select
                      className="flex-1 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 transition"
                      value={mapping[key] ?? ""}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">— skip —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => { setStep(1); setPreview(null); }}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                &#8592; Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
              >
                Next &#8594;
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Import tag + import */}
        {step === 3 && (
          <div className="space-y-5">
            {importResult ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-4xl">&#10003;</div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">Import Complete</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Imported <span className="text-emerald-400 font-semibold">{importResult.imported}</span>,{" "}
                  Skipped <span className="text-amber-400 font-semibold">{importResult.skipped}</span>
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Import Tag <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
                    placeholder="e.g. apollo-march-2026"
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">All imported contacts will receive this tag.</p>
                </div>

                <div className="bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-400/30 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-2">Summary</p>
                  <p>File: <span className="text-slate-900 dark:text-white">{file?.name}</span></p>
                  <p>Mapped fields: <span className="text-slate-900 dark:text-white">{Object.values(mapping).filter(Boolean).length} / {CONTACT_FIELDS.length}</span></p>
                  {importTag && <p>Tag: <span className="text-sky-400">{importTag}</span></p>}
                </div>

                {importError && <p className="text-sm text-red-400">{importError}</p>}

                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                  >
                    &#8592; Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition"
                  >
                    {importing ? "Importing..." : "Import Contacts"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Contacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkTagging, setBulkTagging] = useState(false);
  const [inlineTag, setInlineTag] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const PAGE_SIZE = 50;

  const load = () => {
    const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
    if (search) params.search = search;
    if (tagFilter) params.tag = tagFilter;
    getContacts(params)
      .then((r: any) => {
        setContacts(r.items ?? r);
        setTotal(r.total ?? r.length);
      })
      .catch(console.error);
  };

  useEffect(() => { load(); }, [page, search, tagFilter]);
  useEffect(() => { getAllTags().then(setAllTags).catch(() => {}); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)));

  const handleBulkTag = async () => {
    if (!bulkTag.trim() || selected.size === 0) return;
    setBulkTagging(true);
    try {
      await bulkTagContacts([...selected], bulkTag.trim());
      setBulkTag("");
      setSelected(new Set());
      load();
      getAllTags().then(setAllTags);
    } catch (e) {
      console.error(e);
    } finally {
      setBulkTagging(false);
    }
  };

  const handleAddInlineTag = async (contactId: string) => {
    const tag = (inlineTag[contactId] ?? "").trim();
    if (!tag) return;
    try {
      await addContactTags(contactId, [tag]);
      setInlineTag((prev) => ({ ...prev, [contactId]: "" }));
      load();
      getAllTags().then(setAllTags);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{total.toLocaleString()} total</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/leads"
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-sky-400 dark:hover:text-sky-400 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 transition"
          >
            Import from Apollo
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/50 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-lg hover:border-sky-500 dark:hover:border-sky-500 transition"
          >
            + Add Contact
          </button>
          <div className="relative">
            <button
              onClick={() => setActionMenuOpen((v) => !v)}
              className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-1.5"
            >
              Upload CSV
              <span className="text-xs opacity-75">&#9660;</span>
            </button>
            {actionMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl shadow-xl overflow-hidden w-44">
                  <button
                    onClick={() => { setShowCSVModal(true); setActionMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-600 transition"
                  >
                    Upload CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[200px] w-full bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="w-full sm:w-auto bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition"
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Bulk tag bar */}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3">
          <span className="text-sm text-sky-400 font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <input
              className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 w-40"
              placeholder="Tag name..."
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBulkTag()}
            />
            <button
              onClick={handleBulkTag}
              disabled={bulkTagging || !bulkTag.trim()}
              className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition"
            >
              {bulkTagging ? "Tagging..." : "Apply Tag"}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-surface-400/30">
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleAll} className="accent-sky-500" />
              </th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Name</th>
              <th className="hidden md:table-cell text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Status</th>
              <th className="hidden sm:table-cell text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Tags</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-surface-400/15">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-surface-600/40 transition">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="accent-sky-500" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-xs font-bold text-sky-400 shrink-0">
                      {c.first_name?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-3">
                  <p className="text-slate-600 dark:text-slate-300 text-sm">{c.company}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.title}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-4 py-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    {(c.tags ?? []).map((t: string) => (
                      <span key={t} className="text-xs bg-slate-100 dark:bg-surface-500 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-400/40 rounded-md px-1.5 py-0.5">
                        {t}
                      </span>
                    ))}
                    <div className="flex items-center">
                      <input
                        className="w-16 bg-transparent text-xs text-slate-500 dark:text-slate-400 placeholder-slate-300 dark:placeholder-slate-600 outline-none border-b border-slate-100 dark:border-surface-400/30 focus:border-sky-500 py-0.5"
                        placeholder="+tag"
                        value={inlineTag[c.id] ?? ""}
                        onChange={(e) => setInlineTag((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddInlineTag(c.id)}
                        onBlur={() => handleAddInlineTag(c.id)}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteContact(c.id).then(load)}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-400 transition"
                  >
                    &#10005;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {contacts.length === 0 && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
            No contacts found.{" "}
            <button onClick={() => setShowAddModal(true)} className="text-sky-400 hover:underline">Add a contact</button>
            {" "}or{" "}
            <button onClick={() => setShowCSVModal(true)} className="text-sky-400 hover:underline">upload a CSV</button>
            {" "}or{" "}
            <Link to="/leads" className="text-sky-400 hover:underline">import from Apollo</Link>
            {" "}to get started.
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex justify-between items-center text-sm text-slate-500">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 bg-surface-700 border border-surface-400/40 rounded-lg disabled:opacity-40 hover:text-white transition"
          >
            &#8592; Previous
          </button>
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 bg-surface-700 border border-surface-400/40 rounded-lg disabled:opacity-40 hover:text-white transition"
          >
            Next &#8594;
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onSuccess={load}
        />
      )}
      {showCSVModal && (
        <CSVUploadModal
          onClose={() => setShowCSVModal(false)}
          onSuccess={() => { load(); getAllTags().then(setAllTags); }}
        />
      )}
    </div>
  );
}
