'use client';

import Link from 'next/link';
import { type SubmitEventHandler, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, resetPassword } from '@/lib/api';

const InvalidLink = () => (
  <div className="flex min-h-screen items-center justify-center p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Ссылка недействительна</CardTitle>
        <CardDescription>
          Ссылка для сброса пароля повреждена, истекла или уже использована.
          Запросите новую.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          render={<Link href="/forgot-password" />}
          className="w-full"
        >
          Запросить новую ссылку
        </Button>
      </CardContent>
    </Card>
  </div>
);

export const ResetPasswordForm = ({ token }: { token: string | null }) => {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token ?? '', password);
      // Бэкенд отзывает все сессии; чистим и локальные куки, чтобы браузер не
      // держал просроченную access-куку и не пытался уйти на главную.
      await logout();
      setIsDone(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setError('Ссылка недействительна или истекла. Запросите новую.');
      } else {
        setError('Не удалось изменить пароль. Попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return <InvalidLink />;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isDone ? 'Пароль обновлён' : 'Новый пароль'}</CardTitle>
          <CardDescription>
            {isDone
              ? 'Все прежние сессии завершены. Войдите с новым паролем.'
              : 'Придумайте пароль для входа в аккаунт.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDone ? (
            <Button render={<Link href="/login" />} className="w-full">
              Войти
            </Button>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="password">Пароль</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={32}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <FieldDescription>От 8 до 32 символов</FieldDescription>
                </Field>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="password-confirmation">
                    Повторите пароль
                  </FieldLabel>
                  <Input
                    id="password-confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={32}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Сохранить пароль
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/forgot-password" className="underline">
                    Запросить новую ссылку
                  </Link>
                </p>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
