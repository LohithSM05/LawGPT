import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import CaseForm from '../../components/cases/CaseForm';
import caseService from '../../services/caseService';

export default function EditCase() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    caseService.getCase(caseId).then(({ case: c }) => {
      if (!cancelled) {
        setCaseData(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const handleUpdate = async (payload) => {
    await caseService.updateCase(caseId, payload);
    navigate(`/app/case/${caseId}/overview`, { replace: true });
  };

  if (loading) return <div className="container py-12 text-sm text-muted-foreground">Loading…</div>;
  if (!caseData) return <div className="container py-12 text-sm text-muted-foreground">Case not found.</div>;

  return (
    <div className="container max-w-2xl py-12">
      <Link to={`/app/case/${caseId}/overview`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to case
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit case</CardTitle>
          <CardDescription>Update case details. Parties, hearings, and notes are managed from their own tabs.</CardDescription>
        </CardHeader>
        <CardContent>
          <CaseForm initialCase={caseData} onSubmit={handleUpdate} submitLabel="Save changes" />
        </CardContent>
      </Card>
      <div className="mt-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/cases/ongoing">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            All cases
          </Link>
        </Button>
      </div>
    </div>
  );
}
