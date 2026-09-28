import { CloudCheckIcon } from 'lucide-react';

export const DocumentInput = () => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg px-1.5 cursor-pointer truncate">
        Untitled Document
      </span>
      <CloudCheckIcon className="size-4" />
    </div>
  );
};
