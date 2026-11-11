'use client';

import { HistoryIcon, RotateCcwIcon } from 'lucide-react';
import {
  type SubmitEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  createVersion,
  type DocumentVersionDto,
  listVersions,
  restoreVersion,
} from '@/lib/versions';

interface DocumentHistoryDialogProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const versionLabel = (version: DocumentVersionDto) =>
  version.name ?? 'Авто-чекпоинт';

// История версий: список, создание именованной версии и откат. После отката
// список перечитывается — новая версия `restored from ...` уже в истории.
export const DocumentHistoryDialog = ({
  documentId,
  open,
  onOpenChange,
}: DocumentHistoryDialogProps) => {
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [versionToRestore, setVersionToRestore] =
    useState<DocumentVersionDto | null>(null);

  const reload = useCallback(() => {
    setIsLoading(true);
    listVersions(documentId)
      .then(setVersions)
      .catch(() =>
        toast.add({ type: 'error', title: 'Не удалось загрузить историю' }),
      )
      .finally(() => setIsLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!open) {
      setName('');
      setVersionToRestore(null);
      return;
    }

    reload();
  }, [open, reload]);

  const handleCreate: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!name.trim()) return;

    setIsSaving(true);
    createVersion(documentId, name.trim())
      .then((created) => {
        setName('');
        reload();
        toast.add({
          type: 'success',
          title: `Версия «${versionLabel(created)}» сохранена`,
        });
      })
      .catch(() =>
        toast.add({ type: 'error', title: 'Не удалось сохранить версию' }),
      )
      .finally(() => setIsSaving(false));
  };

  const handleRestore = () => {
    if (!versionToRestore) return;

    setRestoringId(versionToRestore.id);
    restoreVersion(documentId, versionToRestore.id)
      .then(() => {
        reload();
        toast.add({
          type: 'success',
          title: 'Документ восстановлен из версии',
        });
      })
      .catch(() =>
        toast.add({ type: 'error', title: 'Не удалось восстановить версию' }),
      )
      .finally(() => {
        setRestoringId(null);
        setVersionToRestore(null);
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="size-4" />
              История версий
            </DialogTitle>
            <DialogDescription>
              Откат не удаляет текущее состояние: в истории появится новая
              версия.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={name}
              placeholder="Название версии"
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" disabled={isSaving || !name.trim()}>
              Сохранить
            </Button>
          </form>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {isLoading && versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : null}

            {!isLoading && versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                История пуста. Сохраните первую версию.
              </p>
            ) : null}

            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {versionLabel(version)}
                    </span>
                    <Badge variant="secondary">
                      {version.kind === 'named' ? 'версия' : 'авто'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(version.createdAt)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoringId !== null}
                  onClick={() => setVersionToRestore(version)}
                >
                  <RotateCcwIcon className="size-4" />
                  Откатить
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={versionToRestore !== null}
        onOpenChange={(next) => {
          if (!next) setVersionToRestore(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Восстановить версию?</AlertDialogTitle>
            <AlertDialogDescription>
              Текущее состояние останется в истории как «restored from{' '}
              {versionToRestore ? versionLabel(versionToRestore) : ''}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoringId !== null}
              onClick={handleRestore}
            >
              Восстановить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
