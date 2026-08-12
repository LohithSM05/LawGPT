import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium font-mono uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/10 text-primary',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        accent: 'border-accent/40 bg-accent/10 text-accent-foreground dark:text-accent',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Badge = forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
