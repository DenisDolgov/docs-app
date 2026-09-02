'use client';

import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { Ruler } from '@/app/documents/[documentId]/ruler';
import { useEditorStore } from '@/store/use-editor-store';

// todo use tiptap hooks for state sharing
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
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        markdownLinks: true,
        defaultProtocol: 'https',
        protocols: ['https'],
      }),
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
      Highlight.configure({ multicolor: true }),
    ],
    content:
      '<table>\n' +
      '          <tbody>\n' +
      '            <tr>\n' +
      '              <th><mark>Name</mark></th>\n' +
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
      '        <img src="https://placehold.co/800x400" />' +
      '<p>\n' +
      '          Wow, this editor has support for links to the whole <a href="https://en.wikipedia.org/wiki/World_Wide_Web">world wide web</a>. We tested a lot of URLs and I think you can add *every URL* you want. Isn’t that cool? Let’s try <a href="https://statamic.com/">another one!</a> Yep, seems to work.\n' +
      '        </p>\n' +
      '        <p>\n' +
      '          By default every link will get a <code>rel="noopener noreferrer nofollow"</code> attribute. It’s configurable though.\n' +
      '        </p>',
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
  });

  return (
    <div className="size-full overflow-x-auto bg-gray-50 px-4 print:p-0 print:bg-white print:overflow-visible">
      <Ruler />
      <div className="min-w-max flex justify-center w-[816px] py-4 print:p-0 mx-auto print:w-full print:min-w-0">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
