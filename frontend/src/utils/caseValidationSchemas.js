import { z } from 'zod';

const optionalText = z.string().trim().optional().or(z.literal(''));

export const caseFormSchema = z.object({
  caseNumber: z.string().trim().min(1, 'Case number is required'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  caseType: z.string().trim().min(1, 'Case type is required'),
  description: optionalText,
  court: optionalText,
  state: optionalText,
  jurisdiction: optionalText,
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  filingDate: optionalText,
  tags: optionalText, // comma-separated in the UI, split into an array on submit
});

export const partyFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  role: z.string().trim().min(1, 'Role is required'),
  entityType: z.enum(['person', 'organization']),
  contact: optionalText,
  notes: optionalText,
});

// Matches backend/src/models/Hearing.js HEARING_STATUSES exactly. Only
// used by HearingForm's create-mode status field now — edit mode no longer
// exposes status (see HearingForm.jsx / hearingController.updateHearing).
export const hearingFormSchema = z.object({
  hearingDate: z.string().trim().min(1, 'Hearing date is required'),
  court: optionalText,
  judge: optionalText,
  hearingType: z.string().trim().min(1, 'Hearing type is required'),
  status: z.enum(['scheduled', 'completed', 'adjourned', 'postponed', 'cancelled', 'no_appearance', 'rescheduled']),
  summary: optionalText,
  notes: optionalText,
  outcome: optionalText,
});
