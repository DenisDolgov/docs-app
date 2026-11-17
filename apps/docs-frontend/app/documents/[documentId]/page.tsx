import { AttachmentsPanel } from './attachments-panel';
import { CommentsPanel } from './comments-panel';
import { Editor } from './editor';
import { Navbar } from './navbar';
import { Room } from './room';
import { Toolbar } from './toolbar';

const DocumentIdPage = () => {
  return (
    <Room>
      <Navbar />
      <Toolbar />
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <Editor />
          <AttachmentsPanel />
        </div>
        <CommentsPanel />
      </div>
    </Room>
  );
};

export default DocumentIdPage;
