import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ── Contacts ──────────────────────────────────────────────────────────────
export const getContacts = (params?: object) =>
  api.get("/contacts", { params }).then((r) => r.data);

export const getContact = (id: string) =>
  api.get(`/contacts/${id}`).then((r) => r.data);

export const createContact = (body: object) =>
  api.post("/contacts", body).then((r) => r.data);

export const updateContact = (id: string, body: object) =>
  api.patch(`/contacts/${id}`, body).then((r) => r.data);

export const deleteContact = (id: string) =>
  api.delete(`/contacts/${id}`);

export const addContactTags = (id: string, tags: string[]) =>
  api.post(`/contacts/${id}/tags`, { tags }).then((r) => r.data);

export const bulkTagContacts = (contact_ids: string[], tag: string) =>
  api.post("/contacts/bulk/tag", { contact_ids, tag }).then((r) => r.data);

export const getAllTags = () =>
  api.get("/contacts/tags").then((r) => r.data);

export const uploadCSVPreview = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/contacts/upload/preview", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const uploadCSV = (file: File, columnMapping: Record<string, string>, importTag?: string) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("column_mapping", JSON.stringify(columnMapping));
  if (importTag) fd.append("import_tag", importTag);
  return api.post("/contacts/upload/csv", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// ── Apollo ────────────────────────────────────────────────────────────────
export const fetchApolloLeads = (body: object) =>
  api.post("/apollo/fetch", body).then((r) => r.data);

// ── Campaigns ─────────────────────────────────────────────────────────────
export const getCampaigns = () =>
  api.get("/campaigns").then((r) => r.data);

export const getCampaign = (id: string) =>
  api.get(`/campaigns/${id}`).then((r) => r.data);

export const createCampaign = (body: object) =>
  api.post("/campaigns", body).then((r) => r.data);

export const updateCampaign = (id: string, body: object) =>
  api.patch(`/campaigns/${id}`, body).then((r) => r.data);

export const runCampaign = (id: string) =>
  api.post(`/campaigns/${id}/run`).then((r) => r.data);

export const pauseCampaign = (id: string) =>
  api.post(`/campaigns/${id}/pause`).then((r) => r.data);

export const enrollContacts = (id: string, contact_ids: string[]) =>
  api.post(`/campaigns/${id}/enroll`, { contact_ids }).then((r) => r.data);

export const getCampaignLeads = (id: string) =>
  api.get(`/campaigns/${id}/leads`).then((r) => r.data);

export const unenrollLead = (campaignId: string, leadId: string) =>
  api.delete(`/campaigns/${campaignId}/leads/${leadId}`);

// ── Sequences ─────────────────────────────────────────────────────────────
export const getSteps = (campaignId: string) =>
  api.get(`/sequences/campaigns/${campaignId}/steps`).then((r) => r.data);

export const addStep = (campaignId: string, body: object) =>
  api.post(`/sequences/campaigns/${campaignId}/steps`, body).then((r) => r.data);

export const updateStep = (stepId: string, body: object) =>
  api.patch(`/sequences/${stepId}`, body).then((r) => r.data);

export const deleteStep = (stepId: string) =>
  api.delete(`/sequences/${stepId}`);

// ── Content ───────────────────────────────────────────────────────────────
export const previewEmail = (body: object) =>
  api.post("/content/preview/email", body).then((r) => r.data);

export const previewLinkedIn = (body: object) =>
  api.post("/content/preview/linkedin", body).then((r) => r.data);

// ── Analytics ─────────────────────────────────────────────────────────────
export const getOverview = () =>
  api.get("/analytics/overview").then((r) => r.data);

export const getCampaignAnalytics = (id: string) =>
  api.get(`/analytics/campaigns/${id}`).then((r) => r.data);

// ── AI Wizard ─────────────────────────────────────────────────────────────
export const generateCampaign = (body: {
  description: string;
  max_leads?: number;
  email_channel?: boolean;
  linkedin_channel?: boolean;
  auto_fetch_leads?: boolean;
  auto_enroll?: boolean;
  auto_start?: boolean;
}) => api.post("/wizard/generate", body).then((r) => r.data);

export const launchLinkedInPhantom = (body: {
  campaign_id: string;
  step_type: string;
  batch_size?: number;
}) => api.post("/wizard/linkedin/launch", body).then((r) => r.data);

export default api;
