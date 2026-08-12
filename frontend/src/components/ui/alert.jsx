import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const alertVariants = cva('relative w-full rounded-md border p-4 text-sm [&>svg]:h-4 [&>svg]:w-4', {
  variants: {
    variant: {
      default: 'border-border bg-muted text-foreground',
      destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
});

const Alert = forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn('mb-1 font-medium leading-none', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
