import { useEffect, useState } from "react";
import { deleteContact, getContacts, addContactTags, getAllTags, bulkTagContacts } from "../api/client";
import { Link } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  new:          "bg-sky-500/15 text-sky-400 border border-sky-500/25",
  in_campaign:  "bg-violet-500/15 text-violet-400 border border-violet-500/25",
  replied:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  unsubscribed: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  bounced:      "bg-red-500/15 text-red-400 border border-red-500/25",
};

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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{total.toLocaleString()} total</p>
        </div>
        <Link to="/leads" className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          + Import from Apollo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[200px] bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition"
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Bulk tag bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3">
          <span className="text-sm text-sky-400 font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-surface-400/30">
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleAll} className="accent-sky-500" />
              </th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Tags</th>
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
                <td className="px-4 py-3">
                  <p className="text-slate-600 dark:text-slate-300 text-sm">{c.company}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.title}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
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
        {contacts.length === 0 && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
            No contacts found.{" "}
            <Link to="/leads" className="text-sky-400 hover:underline">Import from Apollo</Link>
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
    </div>
  );
}
