import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { addStep, deleteStep, getCampaign, getCampaignAnalytics, runCampaign, pauseCampaign } from "../api/client";
import StatsCard from "../components/StatsCard";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStep, setNewStep] = useState({ channel: "email", delay_days: 3, subject_template: "", body_template: "" });

  const load = () => {
    getCampaign(id!).then(setCampaign).catch(console.error);
    getCampaignAnalytics(id!).then(setAnalytics).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const handleAddStep = async () => {
    const order = (campaign?.steps?.length ?? 0) + 1;
    await addStep(id!, { ...newStep, step_order: order });
    setShowAddStep(false);
    load();
  };

  const handleDeleteStep = async (stepId: string) => {
    if (confirm("Delete this step?")) {
      await deleteStep(stepId);
      load();
    }
  };

  if (!campaign) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
          <span className="text-sm text-slate-400 dark:text-slate-500 capitalize">{campaign.status}</span>
        </div>
        <div className="flex gap-2">
          {campaign.status === "active" ? (
            <button onClick={() => pauseCampaign(id!).then(load)} className="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/30">Pause</button>
          ) : (
            <button onClick={() => runCampaign(id!).then(load).catch((e) => alert(e.response?.data?.detail))} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">Run Campaign</button>
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

      {/* Sequence steps */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Sequence Steps</h2>
        <button onClick={() => setShowAddStep(true)} className="text-sm text-sky-500 dark:text-sky-400 hover:underline">+ Add Step</button>
      </div>

      <div className="space-y-3 mb-6">
        {(campaign.steps ?? []).map((step: any, i: number) => (
          <div key={step.id} className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm font-semibold capitalize">{step.channel}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Day {step.delay_days}</span>
              </div>
              <button onClick={() => handleDeleteStep(step.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>
            {step.channel === "email" && step.subject_template && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1"><strong>Subject:</strong> {step.subject_template}</p>
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

      {showAddStep && (
        <div className="bg-white dark:bg-surface-700 border border-slate-200 dark:border-surface-400/40 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Add Sequence Step</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Channel</label>
              <select className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700" value={newStep.channel} onChange={(e) => setNewStep({ ...newStep, channel: e.target.value })}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Delay (days from previous step)</label>
              <input type="number" className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700" value={newStep.delay_days} onChange={(e) => setNewStep({ ...newStep, delay_days: parseInt(e.target.value) })} />
            </div>
          </div>
          {newStep.channel === "email" && (
            <>
              <div className="mb-3">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Subject (leave blank for AI generation)</label>
                <input className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700" value={newStep.subject_template} onChange={(e) => setNewStep({ ...newStep, subject_template: e.target.value })} placeholder="Quick question, {{first_name}}" />
              </div>
              <div className="mb-3">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Body (leave blank for AI generation)</label>
                <textarea rows={4} className="w-full border border-slate-200 dark:border-surface-400/40 rounded px-3 py-2 text-sm bg-white dark:bg-surface-700" value={newStep.body_template} onChange={(e) => setNewStep({ ...newStep, body_template: e.target.value })} placeholder="Hi {{first_name}}, ..." />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={handleAddStep} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Add Step</button>
            <button onClick={() => setShowAddStep(false)} className="px-3 py-2 text-gray-500 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
