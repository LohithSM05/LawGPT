import {
  Gavel,
  BookOpen,
  FileText,
  Shield,
  FileSearch,
  Landmark,
  Building2,
  Search,
  GitCompare,
  Microscope,
  BookMarked,
  Bookmark,
  Bot,
  Users,
  CalendarClock,
  CheckSquare,
  Calendar,
  BarChart3,
  PieChart,
  Settings,
} from 'lucide-react';

/**
 * Every entry here becomes a clickable sidebar item AND a routed page
 * (/app/research/:slug or /app/practice/:slug) rendered by the generic
 * ComingSoonView until its owning module is built. `plannedModule` maps to
 * the roadmap in PROJECT_MEMORY.md — keep them in sync. Renumbered after
 * Module 3 became Case Management (was previously the document pipeline
 * slot) — everything downstream shifted +1.
 */
export const researchTools = [
  { slug: 'judge-research', labelKey: 'research.judgeResearch', icon: Gavel, plannedModule: 6 },
  { slug: 'constitution', labelKey: 'research.constitution', icon: BookOpen, plannedModule: 6 },
  { slug: 'bns', labelKey: 'research.bns', icon: FileText, plannedModule: 5, built: true },
  { slug: 'bnss', labelKey: 'research.bnss', icon: Shield, plannedModule: 5, built: true },
  { slug: 'bsa', labelKey: 'research.bsa', icon: FileSearch, plannedModule: 5, built: true },
  { slug: 'supreme-court', labelKey: 'research.supremeCourt', icon: Landmark, plannedModule: 6 },
  { slug: 'high-court', labelKey: 'research.highCourt', icon: Building2, plannedModule: 6 },
  { slug: 'judgment-search', labelKey: 'research.judgmentSearch', icon: Search, plannedModule: 6 },
  { slug: 'case-comparison', labelKey: 'research.caseComparison', icon: GitCompare, plannedModule: 6 },
  { slug: 'evidence-analyzer', labelKey: 'research.evidenceAnalyzer', icon: Microscope, plannedModule: 7 },
  { slug: 'legal-dictionary', labelKey: 'research.legalDictionary', icon: BookMarked, plannedModule: 6 },
  { slug: 'bookmarks', labelKey: 'research.bookmarks', icon: Bookmark, plannedModule: 10 },
  { slug: 'ai-assistant', labelKey: 'research.aiAssistant', icon: Bot, plannedModule: 8 },
];

export const practiceTools = [
  { slug: 'clients', labelKey: 'practice.clients', icon: Users, plannedModule: 10 },
  {
    slug: 'hearings',
    labelKey: 'practice.hearings',
    icon: CalendarClock,
    plannedModule: 10,
    // Per-case hearing management is real as of Module 3 (open any case →
    // Hearings tab). This sidebar page is specifically the cross-case
    // calendar/aggregation view, which is a different, not-yet-built
    // feature — the note keeps that distinction clear in the UI.
    note: 'Per-case hearings are already live — open any case and use its Hearings tab. This page will add a hearing calendar across all your cases.',
  },
  { slug: 'tasks', labelKey: 'practice.tasks', icon: CheckSquare, plannedModule: 10 },
  { slug: 'calendar', labelKey: 'practice.calendar', icon: Calendar, plannedModule: 10 },
  { slug: 'reports', labelKey: 'practice.reports', icon: BarChart3, plannedModule: 9 },
  { slug: 'analytics', labelKey: 'practice.analytics', icon: PieChart, plannedModule: 10 },
  { slug: 'settings', labelKey: 'practice.settings', icon: Settings, plannedModule: 10 },
];
