import { InviteView } from './invite-view';

const InvitePage = async ({ searchParams }: PageProps<'/invite'>) => {
  const { token } = await searchParams;

  return <InviteView token={typeof token === 'string' ? token : null} />;
};

export default InvitePage;
