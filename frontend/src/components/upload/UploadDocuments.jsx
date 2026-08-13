import { useRef, useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { DOC_TYPES } from '../../config/caseOptions';
import documentService from '../../services/documentService';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // mirrors backend limit (25 MB)
const MAX_FILES = 10; // mirrors backend limit

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Multi-file upload with a per-file docType picker (docType is free text on
 * the backend; this datalist is just suggestions). Client-side mirrors the
 * backend's 25 MB / 10 file limits so the user sees a clear error before the
 * request, but the server remains the authority.
 */
export default function UploadDocuments({ caseId, onUploaded }) {
  const inputRef = useRef(null);
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (fileList) => {
    setError('');
    const files = Array.from(fileList || []).filter((f) => f.name);
    if (selected.length + files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files per upload.`);
      return;
    }
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`"${oversized.name}" exceeds the 25 MB per-file limit.`);
      return;
    }
    setSelected((prev) => [...prev, ...files.map((file) => ({ file, docType: '' }))]);
  };

  const removeFile = (index) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const setDocType = (index, value) => {
    setSelected((prev) => prev.map((entry, i) => (i === index ? { ...entry, docType: value } : entry)));
  };

  const handleUpload = async () => {
    if (selected.length === 0) return;
    setUploading(true);
    setError('');
    try {
      await documentService.uploadDocuments(
        caseId,
        selected.map((entry) => entry.file),
        selected.map((entry) => entry.docType)
      );
      setSelected([]);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {selected.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Upload className="h-6 w-6" />
          Click to choose documents (PDF, DOCX, TXT, PNG, JPG — up to 25 MB each, 10 files)
        </button>
      )}

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border border-border p-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(entry.file.size)}</p>
              </div>
              <div className="w-44 shrink-0">
                <Input
                  list="doc-type-options"
                  placeholder="Doc type (e.g. FIR)"
                  value={entry.docType}
                  onChange={(e) => setDocType(index, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${entry.file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <datalist id="doc-type-options">
            {DOC_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

          {error && <Badge variant="outline">{error}</Badge>}

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {uploading ? 'Uploading…' : `Upload ${selected.length} file${selected.length > 1 ? 's' : ''}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Add more
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])} disabled={uploading}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
