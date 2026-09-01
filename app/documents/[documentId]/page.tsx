import { Editor } from '@/app/documents/[documentId]/editor';
import { Toolbar } from '@/app/documents/[documentId]/toolbar';

interface DocumentIdPageProps {
  params: Promise<{ documentId: string }>;
}

const DocumentIdPage = async ({ params }: DocumentIdPageProps) => {
  const awaitedParams = await params;
  const { documentId } = awaitedParams;

  return (
    <>
      <div>Document ID: {documentId}</div>
      <Toolbar />
      <Editor />
    </>
  );
};

export default DocumentIdPage;
