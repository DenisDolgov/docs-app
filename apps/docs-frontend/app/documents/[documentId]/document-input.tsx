'use client';

import { CloudCheckIcon, CloudOffIcon, LoaderIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useRoom } from '@/app/documents/[documentId]/room';
import { getDocument } from '@/lib/documents';

export const DocumentInput = () => {
  const params = useParams<{ documentId: string }>();
  const { status } = useRoom();
  const [title, setTitle] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    getDocument(params.documentId)
      .then((document) => {
        setTitle(document.title);
        setTitleError(false);
      })
      .catch(() => setTitleError(true));
  }, [params.documentId]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg px-1.5 cursor-pointer truncate">
        {title ?? (titleError ? 'Документ недоступен' : 'Загрузка…')}
      </span>
      {status === 'connected' && (
        <CloudCheckIcon className="size-4 text-muted-foreground" />
      )}
      {status === 'connecting' && (
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      )}
      {status === 'closed' && (
        <CloudOffIcon className="size-4 text-destructive" />
      )}
    </div>
  );
};
