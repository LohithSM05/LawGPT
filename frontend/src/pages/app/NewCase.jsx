import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import CaseForm from '../../components/cases/CaseForm';
import caseService from '../../services/caseService';

export default function NewCase() {
  const navigate = useNavigate();

  const handleCreate = async (payload) => {
    const created = await caseService.createCase(payload);
    navigate(`/app/case/${created._id}`, { replace: true });
  };

  return (
    <div className="container max-w-2xl py-12">
      <Card>
        <CardHeader>
          <CardTitle>New case</CardTitle>
          <CardDescription>You can add parties, hearings, and notes once the case is created.</CardDescription>
        </CardHeader>
        <CardContent>
          <CaseForm onSubmit={handleCreate} submitLabel="Create case" />
        </CardContent>
      </Card>
    </div>
  );
}
