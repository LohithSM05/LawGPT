import { forwardRef } from 'react';
import { Input } from './input';

/**
 * A plain text input with native <datalist> suggestions. Lets the user pick
 * from a curated list (case type, party role, hearing type) or type
 * anything else — the value stays a plain string, matching the backend's
 * free-text fields (see Case.js / Hearing.js comments on why those aren't
 * enums). Simpler than a custom combobox component for the same result.
 */
export const ComboInput = forwardRef(({ options, listId, ...props }, ref) => (
  <>
    <Input list={listId} ref={ref} autoComplete="off" {...props} />
    <datalist id={listId}>
      {options.map((opt) => (
        <option key={opt} value={opt} />
      ))}
    </datalist>
  </>
));
ComboInput.displayName = 'ComboInput';
