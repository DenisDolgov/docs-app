'use client';

import Link from 'next/link';
import { type SubmitEventHandler, useState } from 'react';

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
import { requestPasswordReset } from '@/lib/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setIsSent(true);
    } catch {
      setError('Не удалось отправить письмо. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isSent ? 'Проверьте почту' : 'Сброс пароля'}</CardTitle>
          <CardDescription>
            {isSent
              ? `Если аккаунт с адресом ${email} существует, мы отправили на него ссылку для сброса пароля.`
              : 'Укажите почту аккаунта — пришлём ссылку для нового пароля.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSent ? (
            <FieldGroup>
              <FieldDescription>
                Ссылка действует 1 час. Если письма нет, проверьте папку «Спам».
              </FieldDescription>
              <Button variant="outline" render={<Link href="/login" />}>
                Вернуться ко входу
              </Button>
            </FieldGroup>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="email">Почта</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Отправить ссылку
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Вспомнили пароль?{' '}
                  <Link href="/login" className="underline">
                    Войти
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

export default ForgotPasswordPage;
