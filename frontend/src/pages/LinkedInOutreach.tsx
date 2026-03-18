import { useEffect, useRef, useState } from "react";
import {
  getContacts,
  launchLinkedInPhantom,
  getPhantomAgents,
  launchPhantomAgent,
  abortPhantomAgent,
  getPhantomContainer,
} from "../api/client";

// ── Types ────────────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  linkedin_url: string;
  tags: string[];
};

type PhantomAgent = {
  id: string;
  name: string;
  status?: string; // "running" | "idle" | etc.
  lastEndMessage?: string;
  lastEndStatus?: string;
  updatedAt?: string;
  // fallback fields depending on API shape
  [key: string]: unknown;
};

type ContainerOutput = {
  id?: string;
  status?: string;
  output?: string;
  exitCode?: number;
  [key: string]: unknown;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
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
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? "").toLowerCase();
  const isRunning = s === "running";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isRunning
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-slate-200/60 dark:bg-surface-500 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-surface-400/40"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
      />
      {isRunning ? "Running" : status || "Idle"}
    </span>
  );
}

function formatTime(ts?: string | number) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

// ── Contact list (shared by Connect & Message tabs) ──────────────────────────

function ContactList({
  contacts,
  loading,
  selected,
  onToggle,
  onToggleAll,
}: {
  contacts: Contact[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-surface-400/30">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === contacts.length && contacts.length > 0}
            onChange={onToggleAll}
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
                onChange={() => onToggle(c.id)}
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
  );
}

// ── Tab 1: Connect ────────────────────────────────────────────────────────────

function ConnectTab({
  contacts,
  loading,
}: {
  contacts: Contact[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectNote, setConnectNote] = useState(
    "Hi {{first_name}}, I work with Indo Aerial Systems \u2014 we build precision motors and ESCs for drone manufacturers. Would love to connect and learn about your work at {{company}}."
  );
  const [batchSize, setBatchSize] = useState(20);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

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
        campaign_id: "manual",
        step_type: "linkedin_connect",
        batch_size: Math.min(batchSize, selected.size),
      });
      setResult(
        res?.message ??
          `Phantom launched. ${selected.size} contacts queued for LinkedIn connect.`
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ContactList
        contacts={contacts}
        loading={loading}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <div className="space-y-4">
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Connection Request
          </h3>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
              Note (optional, 300 chars max)
            </label>
            <textarea
              rows={5}
              maxLength={300}
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
              value={connectNote}
              onChange={(e) => setConnectNote(e.target.value)}
            />
            <p className="text-xs text-slate-400 text-right mt-1">
              {connectNote.length}/300
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Use {`{{first_name}}`}, {`{{company}}`} for personalization.
            </p>
          </div>

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
            <p className="text-xs text-slate-500 mt-1">
              LinkedIn recommends &lt;25/day for safety.
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-400 mb-1">
            &#9888; LinkedIn Safety
          </p>
          <p className="text-xs text-amber-300/80">
            Stay under 25 connection requests per day. Use warm-up delays.
            Phantombuster handles this automatically.
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
              <Spinner />
              Launching Phantom...
            </>
          ) : (
            `Launch Connect \u2192 ${selected.size} contacts`
          )}
        </button>
      </div>
    </div>
  );
}

// ── Tab 2: Message ────────────────────────────────────────────────────────────

function MessageTab({
  contacts,
  loading,
}: {
  contacts: Contact[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [messageBody, setMessageBody] = useState(
    "Hi {{first_name}}, following up on my connection request. We supply motors, ESCs, and flight controllers to drone OEMs across India. Happy to share our spec sheets if it\u2019s relevant to what you\u2019re building at {{company}}. Best, IAS Team"
  );
  const [batchSize, setBatchSize] = useState(20);
  const [campaignId, setCampaignId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

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
        step_type: "linkedin_message",
        batch_size: Math.min(batchSize, selected.size),
      });
      setResult(
        res?.message ??
          `Phantom launched. ${selected.size} contacts queued for LinkedIn message.`
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ContactList
        contacts={contacts}
        loading={loading}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <div className="space-y-4">
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Message
          </h3>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">
              Message Body
            </label>
            <textarea
              rows={6}
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none"
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
              className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition"
              placeholder="Link to email campaign..."
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            />
          </div>

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
            <p className="text-xs text-slate-500 mt-1">
              LinkedIn recommends &lt;50 messages/day for safety.
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-400 mb-1">
            &#9888; LinkedIn Safety
          </p>
          <p className="text-xs text-amber-300/80">
            Stay under 50 messages per day. Use warm-up delays. Phantombuster
            handles this automatically.
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
              <Spinner />
              Launching Phantom...
            </>
          ) : (
            `Launch Message \u2192 ${selected.size} contacts`
          )}
        </button>
      </div>
    </div>
  );
}

// ── Tab 3: Phantom Agents ─────────────────────────────────────────────────────

type AgentCardState = {
  launching: boolean;
  aborting: boolean;
  showArgInput: boolean;
  argJson: string;
  containerId: string | null;
  containerOutput: ContainerOutput | null;
  containerPolling: boolean;
  launchError: string;
  abortMsg: string;
};

function PhantomAgentsTab() {
  const [agents, setAgents] = useState<PhantomAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [cardStates, setCardStates] = useState<Record<string, AgentCardState>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const defaultCardState = (): AgentCardState => ({
    launching: false,
    aborting: false,
    showArgInput: false,
    argJson: "",
    containerId: null,
    containerOutput: null,
    containerPolling: false,
    launchError: "",
    abortMsg: "",
  });

  const patchCard = (id: string, patch: Partial<AgentCardState>) =>
    setCardStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? defaultCardState()), ...patch },
    }));

  const fetchAgents = () => {
    getPhantomAgents()
      .then((data) => {
        const list: PhantomAgent[] = Array.isArray(data)
          ? data
          : data?.agents ?? data?.items ?? [];
        setAgents(list);
        setFetchError("");
      })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number; data?: { detail?: string } } };
        if (err.response?.status === 503 || err.response?.status === 404) {
          setFetchError("not_configured");
        } else {
          setFetchError(
            err.response?.data?.detail ?? "Failed to load Phantombuster agents."
          );
        }
      })
      .finally(() => setLoadingAgents(false));
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup container poll timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  const startContainerPoll = (agentId: string, containerId: string) => {
    if (pollTimers.current[agentId]) clearInterval(pollTimers.current[agentId]);
    patchCard(agentId, { containerPolling: true });

    const poll = async () => {
      try {
        const data = await getPhantomContainer(containerId);
        patchCard(agentId, { containerOutput: data });
        // Stop polling if finished
        const status = (data?.status ?? "").toLowerCase();
        if (status === "finished" || status === "error" || status === "stopped") {
          clearInterval(pollTimers.current[agentId]);
          delete pollTimers.current[agentId];
          patchCard(agentId, { containerPolling: false });
        }
      } catch {
        clearInterval(pollTimers.current[agentId]);
        delete pollTimers.current[agentId];
        patchCard(agentId, { containerPolling: false });
      }
    };

    poll();
    pollTimers.current[agentId] = setInterval(poll, 5_000);
  };

  const handleLaunch = async (agent: PhantomAgent) => {
    const cs = cardStates[agent.id] ?? defaultCardState();
    let parsedArgs: object | undefined = undefined;
    if (cs.argJson.trim()) {
      try {
        parsedArgs = JSON.parse(cs.argJson);
      } catch {
        patchCard(agent.id, { launchError: "Invalid JSON argument." });
        return;
      }
    }

    patchCard(agent.id, { launching: true, launchError: "", abortMsg: "" });
    try {
      const res = await launchPhantomAgent(agent.id, parsedArgs);
      const containerId: string =
        res?.containerId ?? res?.container_id ?? res?.id ?? "";
      patchCard(agent.id, {
        launching: false,
        containerId,
        showArgInput: false,
        containerOutput: null,
      });
      if (containerId) startContainerPoll(agent.id, containerId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      patchCard(agent.id, {
        launching: false,
        launchError:
          err.response?.data?.detail ?? "Failed to launch agent.",
      });
    }
  };

  const handleAbort = async (agentId: string) => {
    patchCard(agentId, { aborting: true, abortMsg: "" });
    try {
      await abortPhantomAgent(agentId);
      patchCard(agentId, { aborting: false, abortMsg: "Agent aborted." });
      if (pollTimers.current[agentId]) {
        clearInterval(pollTimers.current[agentId]);
        delete pollTimers.current[agentId];
        patchCard(agentId, { containerPolling: false });
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      patchCard(agentId, {
        aborting: false,
        abortMsg: err.response?.data?.detail ?? "Failed to abort agent.",
      });
    }
  };

  if (loadingAgents) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
        <Spinner />
        <span className="text-sm">Loading Phantombuster agents...</span>
      </div>
    );
  }

  if (fetchError === "not_configured") {
    return (
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-8 text-center space-y-3">
        <p className="text-2xl">&#128272;</p>
        <p className="text-slate-900 dark:text-white font-semibold">
          Phantombuster not configured
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
          Connect your Phantombuster API key to manage and launch automation
          agents directly from this dashboard.
        </p>
        <a
          href="/settings"
          className="inline-block mt-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          Go to Settings &#8599;
        </a>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-sm text-red-400">
        {fetchError}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
        No Phantombuster agents found for this account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Auto-refreshes every 10s. Container output polls every 5s after launch.
      </p>
      {agents.map((agent) => {
        const cs = cardStates[agent.id] ?? defaultCardState();
        const agentStatus = (agent.status as string) ?? undefined;
        return (
          <div
            key={agent.id}
            className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-5 space-y-3"
          >
            {/* Agent header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {agent.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  ID: {agent.id} &bull; Last run:{" "}
                  {formatTime((agent.updatedAt ?? agent.lastEndTime) as string | undefined)}
                </p>
              </div>
              <StatusBadge status={agentStatus} />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  patchCard(agent.id, { showArgInput: !cs.showArgInput })
                }
                className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition"
              >
                Launch
              </button>
              <button
                onClick={() => handleAbort(agent.id)}
                disabled={cs.aborting}
                className="bg-slate-100 dark:bg-surface-600 hover:bg-slate-200 dark:hover:bg-surface-500 text-slate-700 dark:text-slate-300 text-xs font-semibold px-4 py-1.5 rounded-lg border border-slate-200 dark:border-surface-400/40 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {cs.aborting && <Spinner />}
                Abort
              </button>
            </div>

            {/* Inline arg input */}
            {cs.showArgInput && (
              <div className="space-y-2 border-t border-slate-100 dark:border-surface-400/30 pt-3">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest">
                  Custom JSON argument (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder='{"spreadsheetUrl": "...", "numberOfAddsPerLaunch": 10}'
                  value={cs.argJson}
                  onChange={(e) =>
                    patchCard(agent.id, { argJson: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition resize-none font-mono"
                />
                <button
                  onClick={() => handleLaunch(agent)}
                  disabled={cs.launching}
                  className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2 rounded-lg transition flex items-center gap-2"
                >
                  {cs.launching && <Spinner />}
                  {cs.launching ? "Launching..." : "Confirm Launch"}
                </button>
              </div>
            )}

            {/* Launch result / containerId */}
            {cs.containerId && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                Launched. Container ID:{" "}
                <span className="font-mono">{cs.containerId}</span>
                {cs.containerPolling && (
                  <span className="ml-2 text-sky-400">polling output...</span>
                )}
              </div>
            )}

            {/* Live container output */}
            {cs.containerOutput && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest">
                  Container Output
                </p>
                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-surface-400/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {cs.containerOutput.output ??
                    JSON.stringify(cs.containerOutput, null, 2)}
                </pre>
              </div>
            )}

            {/* Error / abort messages */}
            {cs.launchError && (
              <p className="text-xs text-red-400">{cs.launchError}</p>
            )}
            {cs.abortMsg && (
              <p className="text-xs text-amber-400">{cs.abortMsg}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 4: History ────────────────────────────────────────────────────────────

function HistoryTab() {
  const [agents, setAgents] = useState<PhantomAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    getPhantomAgents()
      .then((data) => {
        const list: PhantomAgent[] = Array.isArray(data)
          ? data
          : data?.agents ?? data?.items ?? [];
        setAgents(list);
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { detail?: string } } };
        setFetchError(
          err.response?.data?.detail ?? "Failed to load agent history."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Coming soon notice */}
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex items-start gap-3">
        <span className="text-sky-400 text-lg mt-0.5">&#128202;</span>
        <div>
          <p className="text-sm font-semibold text-sky-400">
            History tracking coming soon
          </p>
          <p className="text-xs text-sky-300/80 mt-0.5">
            Full per-run execution history with logs and result exports is not
            yet implemented. Showing current agent statuses as a best-effort
            view.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-8 justify-center">
          <Spinner />
          <span className="text-sm">Loading agents...</span>
        </div>
      ) : fetchError ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {fetchError}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
          No agents found.
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const lastStatus =
              (agent.lastEndStatus as string) ??
              (agent.status as string) ??
              "unknown";
            const lastEndMsg =
              (agent.lastEndMessage as string) ?? "No message available.";
            return (
              <div
                key={agent.id}
                className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-xl px-5 py-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {agent.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Last run:{" "}
                    {formatTime(
                      (agent.updatedAt ?? agent.lastEndTime) as string | undefined
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-lg">
                    {lastEndMsg}
                  </p>
                </div>
                <StatusBadge status={lastStatus} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

const TABS = ["Connect", "Message", "Phantom Agents", "History"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, string> = {
  Connect: "\uD83D\uDD17",
  Message: "\u2709\uFE0F",
  "Phantom Agents": "\uD83E\uDD16",
  History: "\uD83D\uDCC5",
};

export default function LinkedInOutreach() {
  const [tab, setTab] = useState<Tab>("Connect");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    getContacts({ has_linkedin: true, page_size: 200 })
      .then((r) => setContacts(r.items ?? r))
      .catch(console.error)
      .finally(() => setLoadingContacts(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
          LinkedIn Outreach
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Send connection requests and messages via Phantombuster automation.
          Separate from email campaigns.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-surface-800 border border-slate-100 dark:border-surface-400/30 rounded-xl p-1 w-fit">
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
            {TAB_ICONS[t]} {t}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === "Connect" && (
        <ConnectTab contacts={contacts} loading={loadingContacts} />
      )}
      {tab === "Message" && (
        <MessageTab contacts={contacts} loading={loadingContacts} />
      )}
      {tab === "Phantom Agents" && <PhantomAgentsTab />}
      {tab === "History" && <HistoryTab />}
    </div>
  );
}
