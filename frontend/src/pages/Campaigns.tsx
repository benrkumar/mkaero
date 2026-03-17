import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCampaign, getCampaigns, pauseCampaign, runCampaign } from "../api/client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const load = () => getCampaigns().then(setCampaigns).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCampaign({ name: newName, email_channel: true, linkedin_channel: true });
    setNewName("");
    setShowCreate(false);
    load();
  };

  const handleRun = async (id: string) => {
    await runCampaign(id).catch((e) => alert(e.response?.data?.detail ?? "Error running campaign"));
    load();
  };

  const handlePause = async (id: string) => {
    await pauseCampaign(id);
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">{campaigns.length} campaigns</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/wizard")}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 text-sm font-semibold flex items-center gap-2 shadow-sm"
          >
            <span className="w-5 h-5 bg-white bg-opacity-20 rounded text-xs font-bold flex items-center justify-center">AI</span>
            Create with AI
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            + Manual
          </button>
        </div>
      </div>

      {/* AI Wizard callout (shown when no campaigns exist) */}
      {campaigns.length === 0 && !showCreate && (
        <div
          className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-8 mb-6 text-center cursor-pointer hover:shadow-md transition"
          onClick={() => navigate("/wizard")}
        >
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            AI
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Start with the AI Campaign Wizard</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
            Describe your target audience in plain English. AI will generate your entire campaign —
            email sequence, LinkedIn messages, Apollo filters, and auto-fetch leads.
          </p>
          <span className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-sm">
            Launch AI Wizard →
          </span>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-lg border p-4 mb-6 flex gap-3 items-center">
          <input
            autoFocus
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Campaign name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Create</button>
          <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-gray-500 text-sm">Cancel</button>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border p-5 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div>
              <Link to={`/campaigns/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{c.name}</Link>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                <span className="text-xs text-gray-400">{c.email_channel ? "Email" : ""}{c.linkedin_channel ? " + LinkedIn" : ""}</span>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {c.status === "active" ? (
                <button onClick={() => handlePause(c.id)} className="px-3 py-1.5 text-xs border rounded text-yellow-700 border-yellow-300 hover:bg-yellow-50">Pause</button>
              ) : (
                <button onClick={() => handleRun(c.id)} className="px-3 py-1.5 text-xs border rounded text-green-700 border-green-300 hover:bg-green-50">Run</button>
              )}
              <Link to={`/campaigns/${c.id}`} className="px-3 py-1.5 text-xs border rounded text-gray-600 hover:bg-gray-50">View →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
