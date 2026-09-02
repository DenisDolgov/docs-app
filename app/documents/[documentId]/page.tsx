import { Editor } from '@/app/documents/[documentId]/editor';
import { Navbar } from '@/app/documents/[documentId]/navbar';
import { Toolbar } from '@/app/documents/[documentId]/toolbar';

interface DocumentIdPageProps {
  params: Promise<{ documentId: string }>;
}

const DocumentIdPage = async ({ params }: DocumentIdPageProps) => {
  const awaitedParams = await params;
  const { documentId } = awaitedParams;

  return (
    <>
      <Navbar />
      <Toolbar />
      <Editor />
    </>
  );
};

export default DocumentIdPage;
