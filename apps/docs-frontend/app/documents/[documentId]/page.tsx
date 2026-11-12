import { AttachmentsPanel } from './attachments-panel';
import { Editor } from './editor';
import { Navbar } from './navbar';
import { Room } from './room';
import { Toolbar } from './toolbar';

const DocumentIdPage = () => {
  return (
    <Room>
      <Navbar />
      <Toolbar />
      <Editor />
      <AttachmentsPanel />
    </Room>
  );
};

export default DocumentIdPage;
