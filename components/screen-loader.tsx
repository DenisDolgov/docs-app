import { LoaderIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ScreenLoaderProps {
  label?: string;
  className?: string;
}

export const ScreenLoader = ({ label, className }: ScreenLoaderProps) => {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <LoaderIcon className="size-6 text-muted-foreground animate-spin" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
};
