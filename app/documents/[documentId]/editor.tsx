'use client';

import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { useEditorStore } from '@/store/use-editor-store';

export const Editor = () => {
  const { setEditor } = useEditorStore();

  const editor = useEditor({
    onCreate({ editor }) {
      setEditor(editor);
    },
    onDestroy() {
      setEditor(null);
    },
    onUpdate({ editor }) {
      setEditor(editor);
    },
    onSelectionUpdate({ editor }) {
      setEditor(editor);
    },
    onTransaction({ editor }) {
      setEditor(editor);
    },
    onFocus({ editor }) {
      setEditor(editor);
    },
    onBlur({ editor }) {
      setEditor(editor);
    },
    onContentError({ editor }) {
      setEditor(editor);
    },
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class:
          'focus:outline-none print:border-0 bg-white border border-gray-100 flex flex-col min-h-[1054px] w-[816px] pt-10 px-14 pb-10 cursor-text',
      },
    },
    extensions: [
      StarterKit,
      TableKit.configure({
        table: { resizable: true },
      }),
      TaskItem.configure({
        nested: true,
      }),
      TaskList,
      Image.configure({
        resize: {
          enabled: true,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Underline,
      TextStyleKit,
    ],
    content:
      '<table>\n' +
      '          <tbody>\n' +
      '            <tr>\n' +
      '              <th>Name</th>\n' +
      '              <th colspan="3">Description</th>\n' +
      '            </tr>\n' +
      '            <tr>\n' +
      '              <td>Cyndi Lauper</td>\n' +
      '              <td>Singer</td>\n' +
      '              <td>Songwriter</td>\n' +
      '              <td>Actress</td>\n' +
      '            </tr>\n' +
      '          </tbody>\n' +
      '        </table>' +
      '<img src="https://placehold.co/600x400" />\n' +
      '        <img src="https://placehold.co/800x400" />',
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
  });

  return (
    <div className="size-full overflow-x-auto bg-gray-50 px-4 print:p-0 print:bg-white print:overflow-visible">
      <div className="min-w-max flex justify-center w-[816px] py-4 print:p-0 mx-auto print:w-full print:min-w-0">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
