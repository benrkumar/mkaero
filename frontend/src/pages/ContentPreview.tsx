import { useState } from "react";
import { getContacts, previewEmail, previewLinkedIn } from "../api/client";

export default function ContentPreview() {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const res = await getContacts({ search: email, page_size: 1 });
    if (res.items.length > 0) setContact(res.items[0]);
    else alert("Contact not found");
  };

  const handleGenerate = async () => {
    if (!contact) return;
    setLoading(true);
    try {
      const body = { contact_id: contact.id, step_number: step, channel };
      const r = channel === "email"
        ? await previewEmail(body)
        : await previewLinkedIn(body);
      setResult(r);
    } catch (e: any) {
      alert(e.response?.data?.detail ?? "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Content Preview</h1>
      <p className="text-gray-500 text-sm mb-8">Preview AI-generated outreach copy for any contact before sending.</p>

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3 text-gray-800">Select Contact</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Search by email or name..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">Search</button>
        </div>
        {contact && (
          <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
            <strong>{contact.first_name} {contact.last_name}</strong> — {contact.title} at {contact.company}
            <span className="ml-2 text-gray-500">{contact.email}</span>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-3 text-gray-800">Generate Content</h2>
        <div className="flex gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Channel</label>
            <select className="border rounded px-3 py-2 text-sm" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Step Number</label>
            <select className="border rounded px-3 py-2 text-sm" value={step} onChange={(e) => setStep(parseInt(e.target.value))}>
              <option value={1}>Step 1 — Introduction</option>
              <option value={2}>Step 2 — Value Proof</option>
              <option value={3}>Step 3 — Direct CTA</option>
              <option value={4}>Step 4 — Breakup</option>
            </select>
          </div>
          <div className="self-end">
            <button onClick={handleGenerate} disabled={!contact || loading} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-4 border rounded p-4 bg-gray-50">
            {result.subject && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subject</p>
                <p className="text-sm font-medium text-gray-800">{result.subject}</p>
              </div>
            )}
            {result.body && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Body</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{result.body}</pre>
              </div>
            )}
            {result.message && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">LinkedIn Message</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{result.message}</pre>
                <p className="text-xs text-gray-400 mt-2">{result.message.length} / 300 characters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
