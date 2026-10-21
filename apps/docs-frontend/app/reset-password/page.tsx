import { ResetPasswordForm } from './reset-password-form';

const ResetPasswordPage = async ({
  searchParams,
}: PageProps<'/reset-password'>) => {
  const { token } = await searchParams;

  return <ResetPasswordForm token={typeof token === 'string' ? token : null} />;
};

export default ResetPasswordPage;
