import { Editor } from './editor';
import { Navbar } from './navbar';
import { Room } from './room';
import { Toolbar } from './toolbar';

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
      <Room>
        <Editor />
      </Room>
    </>
  );
};

export default DocumentIdPage;
