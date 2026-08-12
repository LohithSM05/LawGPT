import { Clock, Trophy, XCircle, CheckCircle2, Archive, History, Pin } from 'lucide-react';

/** Sidebar "Case Workspace" section. Add a new status here — no component changes needed. */
export const caseStatusNav = [
  { status: 'ongoing', labelKey: 'cases.ongoing', icon: Clock },
  { status: 'won', labelKey: 'cases.won', icon: Trophy },
  { status: 'lost', labelKey: 'cases.lost', icon: XCircle },
  { status: 'closed', labelKey: 'cases.closed', icon: CheckCircle2 },
  { status: 'archived', labelKey: 'cases.archived', icon: Archive },
  { status: 'recent', labelKey: 'cases.recent', icon: History },
  { status: 'pinned', labelKey: 'cases.pinned', icon: Pin },
];
