import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale, FolderOpen, Brain, ShieldCheck, Gavel, Bot } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const capabilities = [
  {
    icon: FolderOpen,
    title: 'Case workspaces',
    desc: 'Every case gets its own workspace — documents, evidence, judgments, and notes in one place.',
  },
  {
    icon: Brain,
    title: 'AI case analysis',
    desc: 'Summaries, timelines, and IPC/BNS section tagging generated from your uploaded documents.',
  },
  {
    icon: Gavel,
    title: 'Legal research center',
    desc: 'Search the Constitution, BNS/BNSS/BSA, and Supreme & High Court judgments in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidence scoring',
    desc: 'Weak, medium, or strong ratings for each piece of evidence, with the reasoning shown.',
  },
  {
    icon: Bot,
    title: 'Grounded case chat',
    desc: 'Ask questions about a case and get answers sourced only from its documents — no hallucination.',
  },
  {
    icon: Scale,
    title: 'Prosecution & defence arguments',
    desc: 'Draft both sides of an argument, plus a risk read, before you walk into court.',
  },
];

export default function Landing() {
  const { t } = useTranslation('common');

  return (
    <div>
      <section className="bg-ledger">
        <div className="container flex flex-col items-center gap-6 py-20 text-center">
          <span className="exhibit-tag">Case File · AI-Assisted Review</span>
          <h1 className="font-display max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            AI-powered legal case management &amp; research
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Upload case documents, get instant analysis, retrieve similar judgments, and manage every case from one
            workspace — built for lawyers, researchers, and students.
          </p>
          <div className="flex gap-3">
            <Button size="lg" asChild>
              <Link to="/register">{t('actions.getStarted')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">{t('actions.signIn')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <Card key={c.title}>
              <CardHeader>
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <CardTitle className="pt-3 text-base">{c.title}</CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
