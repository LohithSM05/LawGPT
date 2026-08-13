import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, FilePlus2, Download, Trash2, RefreshCw, Loader2, Image as ImageIcon } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import UploadDocuments from '../../../components/upload/UploadDocuments';
import documentService from '../../../services/documentService';

const STATUS_BADGE_VARIANT = {
  pending: 'secondary',
  processing: 'accent',
  completed: 'default',
  failed: 'outline',
};

const POLL_INTERVAL_MS = 4000;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType) {
  return (mimeType || '').startsWith('image/');
}

function FileIcon({ mimeType }) {
  if (isImage(mimeType)) return <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export default function CaseDocumentsTab() {
  const { caseId, refetch } = useOutletContext();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = () => documentService.listDocuments(caseId).then((docs) => setDocuments(docs));

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // While any document is still being processed by the pipeline, keep the
  // list fresh; stop polling once everything settles.
  useEffect(() => {
    const hasActive = documents.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!hasActive) return undefined;
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const handleUploaded = () => {
    setShowUpload(false);
    setActionError('');
    load();
    refetch(); // documentCount on the Overview may have changed
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.originalName}"? It will be hidden from this case but nothing is permanently destroyed.`)) return;
    setActionError('');
    try {
      await documentService.deleteDocument(caseId, doc._id);
      await load();
      await refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Delete failed');
    }
  };

  const handleRetry = async (doc) => {
    setBusyId(doc._id);
    setActionError('');
    try {
      await documentService.triggerProcess(caseId, doc._id);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Could not queue document');
    } finally {
      setBusyId(null);
    }
  };

  const hasActive = documents.some((d) => d.status === 'pending' || d.status === 'processing');

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Documents</h2>
          {hasActive && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing — OCR, chunking and indexing are running in the background.
            </p>
          )}
        </div>
        {!showUpload && (
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <FilePlus2 className="mr-2 h-3.5 w-3.5" />
            Add documents
          </Button>
        )}
      </div>

      {actionError && <Badge variant="outline" className="mb-3">{actionError}</Badge>}

      {showUpload && (
        <Card className="mb-6 p-5">
          <UploadDocuments caseId={caseId} onUploaded={handleUploaded} />
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No documents uploaded for this case yet.</p>
          {!showUpload && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowUpload(true)}>
              Upload the first document
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc._id} className="p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileIcon mimeType={doc.mimeType} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.originalName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.docType || 'No type'}
                    {doc.size ? ` · ${formatSize(doc.size)}` : ''}
                    {doc.status === 'completed' && doc.pageCount
                      ? ` · ${doc.pageCount} page${doc.pageCount > 1 ? 's' : ''}${doc.chunkCount ? ` · ${doc.chunkCount} chunks` : ''}`
                      : ''}
                  </p>
                  {doc.status === 'failed' && doc.error && (
                    <p className="mt-1 text-xs text-destructive" title={doc.error}>
                      {doc.error.length > 140 ? `${doc.error.slice(0, 140)}…` : doc.error}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE_VARIANT[doc.status] || 'secondary'}>{doc.status}</Badge>
                <div className="flex shrink-0 items-center gap-1">
                  {doc.status === 'failed' && (
                    <Button size="icon" variant="ghost" title="Retry processing" onClick={() => handleRetry(doc)} disabled={busyId === doc._id}>
                      {busyId === doc._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" asChild title="Download">
                    <a href={documentService.getDownloadUrl(caseId, doc._id)}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
