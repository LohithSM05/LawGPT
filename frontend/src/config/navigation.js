import {
  Clock,
  Trophy,
  XCircle,
  CheckCircle2,
  Archive,
  History,
  Pin,
  ArrowRightLeft,
} from 'lucide-react';

/** Sidebar "Case Workspace" section. Add a new status here — no component changes needed. */

export const caseStatusNav = [
  { status: 'ongoing', labelKey: 'cases.ongoing', icon: Clock, group: 'top' },

  { status: 'won', labelKey: 'cases.won', icon: Trophy, group: 'closed' },
  { status: 'lost', labelKey: 'cases.lost', icon: XCircle, group: 'closed' },
  { status: 'transferred', labelKey: 'cases.transferred', icon: ArrowRightLeft, group: 'closed' },
  { status: 'closed', labelKey: 'cases.closed', icon: CheckCircle2, group: 'top' },
  { status: 'archived', labelKey: 'cases.archived', icon: Archive, group: 'bottom' },
  { status: 'recent', labelKey: 'cases.recent', icon: History, group: 'bottom' },
  { status: 'pinned', labelKey: 'cases.pinned', icon: Pin, group: 'bottom' },
];
