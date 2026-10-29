import { PublicDocumentView } from './public-document-view';

const PublicDocumentPage = async ({
  params,
}: PageProps<'/public/documents/[token]'>) => {
  const { token } = await params;

  return <PublicDocumentView token={token} />;
};

export default PublicDocumentPage;
