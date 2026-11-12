'use client';

import { DownloadIcon, PaperclipIcon, Trash2Icon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  type FileDto,
  fileDownload,
  listFiles,
  removeFile,
  uploadFile,
} from '@/lib/files';

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const errorTitle = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const AttachmentsPanel = () => {
  const params = useParams<{ documentId: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileDto[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setFiles(await listFiles(params.documentId));
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось загрузить вложения'),
      });
    }
  };

  useEffect(() => {
    let active = true;

    listFiles(params.documentId)
      .then((loaded) => {
        if (active) setFiles(loaded);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setFiles([]);
        toast.add({
          type: 'error',
          title: errorTitle(error, 'Не удалось загрузить вложения'),
        });
      });

    return () => {
      active = false;
    };
  }, [params.documentId]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';
    if (!file) return;

    setBusy(true);

    try {
      await uploadFile({ file, documentId: params.documentId });
      toast.add({ type: 'success', title: 'Вложение добавлено' });
      await refresh();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось прикрепить файл'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      await fileDownload(fileId);
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось скачать файл'),
      });
    }
  };

  const handleRemove = async (file: FileDto) => {
    if (!window.confirm(`Удалить «${file.name}»?`)) return;

    try {
      await removeFile(file.id);
      toast.add({ type: 'success', title: 'Вложение удалено' });
      await refresh();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось удалить вложение'),
      });
    }
  };

  return (
    <section className="mx-auto flex w-[816px] max-w-full flex-col gap-3 px-4 pb-10 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Вложения</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon />
          Прикрепить
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {files === null ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Вложений пока нет. Приложите PDF к документу.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Скачать ${file.name}`}
                  onClick={() => void handleDownload(file.id)}
                >
                  <DownloadIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Удалить ${file.name}`}
                  onClick={() => void handleRemove(file)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
