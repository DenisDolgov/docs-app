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
    </Room>
  );
};

export default DocumentIdPage;
