import { VerifyEmailView } from './verify-email-view';

const VerifyEmailPage = async ({
  searchParams,
}: PageProps<'/verify-email'>) => {
  const { token } = await searchParams;

  return <VerifyEmailView token={typeof token === 'string' ? token : null} />;
};

export default VerifyEmailPage;
