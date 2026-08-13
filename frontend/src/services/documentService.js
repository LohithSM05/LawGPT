import api from './api';

// Module 4 — document service. All routes are nested under a case, so every
// call takes caseId and access control is inherited from the case (owner /
// assignedUsers / admin only).

async function uploadDocuments(caseId, files, docTypes = []) {
  const formData = new FormData();
  files.forEach((file) => formData.append('documents', file));
  if (docTypes.length) {
    // Per-file docType, aligned by index with the files array.
    formData.append('docTypes', JSON.stringify(docTypes));
  }
  const { data } = await api.post(`/cases/${caseId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data; // { documents, count }
}

async function listDocuments(caseId) {
  const { data } = await api.get(`/cases/${caseId}/documents`);
  return data.data.documents;
}

async function getDocument(caseId, documentId) {
  const { data } = await api.get(`/cases/${caseId}/documents/${documentId}`);
  return data.data.document;
}

async function deleteDocument(caseId, documentId) {
  await api.delete(`/cases/${caseId}/documents/${documentId}`);
}

function getDownloadUrl(caseId, documentId) {
  return `${api.defaults.baseURL}/cases/${caseId}/documents/${documentId}/download`;
}

async function triggerProcess(caseId, documentId) {
  const { data } = await api.post(`/cases/${caseId}/documents/${documentId}/process`);
  return data.data.document;
}

async function getDocumentPages(caseId, documentId) {
  const { data } = await api.get(`/cases/${caseId}/documents/${documentId}/pages`);
  return data.data.pages;
}

export default { uploadDocuments, listDocuments, getDocument, deleteDocument, getDownloadUrl, triggerProcess, getDocumentPages };
