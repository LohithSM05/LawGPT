import api from './api';

async function createHearing(caseId, payload) {
  const { data } = await api.post(`/cases/${caseId}/hearings`, payload);
  return data.data.hearing;
}

async function listHearings(caseId) {
  const { data } = await api.get(`/cases/${caseId}/hearings`);
  return data.data.hearings;
}

async function getHearing(caseId, hearingId) {
  const { data } = await api.get(`/cases/${caseId}/hearings/${hearingId}`);
  return data.data.hearing;
}

async function updateHearing(caseId, hearingId, payload) {
  const { data } = await api.put(`/cases/${caseId}/hearings/${hearingId}`, payload);
  return data.data.hearing;
}

async function transitionHearing(caseId, hearingId, payload) {
  const { data } = await api.post(`/cases/${caseId}/hearings/${hearingId}/transition`, payload);
  return data.data; // { hearing, newHearing }
}

async function deleteHearing(caseId, hearingId) {
  await api.delete(`/cases/${caseId}/hearings/${hearingId}`);
}

export default { createHearing, listHearings, getHearing, updateHearing, transitionHearing, deleteHearing };
