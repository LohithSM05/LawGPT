import api from './api';

// Module 5 Phase 3 — case analysis. Nested under a case, so access control is
// inherited from the case (owner / assignedUsers / admin only).

// Runs (or re-runs) the synchronous analysis of the case's processed
// documents. language ('en' | 'kn') selects the narrative output language.
async function runAnalysis(caseId, language = 'en') {
  const { data } = await api.post(`/cases/${caseId}/analysis`, { language });
  return data.data.analysis;
}

// Latest analysis for the case (404 if none has been generated yet).
async function getAnalysis(caseId) {
  const { data } = await api.get(`/cases/${caseId}/analysis`);
  return data.data.analysis;
}

export default { runAnalysis, getAnalysis };
