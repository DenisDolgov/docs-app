'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export const Editor = () => {
    const editor = useEditor({
        editorProps: {
          attributes: {
              // style: ''
              class: 'focus:outline-none print:border-0 bg-white border border-gray-100 flex flex-col min-h-[1054px] w-[816px] pt-10 px-14 pb-10 cursor-text'
          }
        },
        extensions: [StarterKit],
        content: '<p>Hello World! 🌎️</p>',
        // Don't render immediately on the server to avoid SSR issues
        immediatelyRender: false,
    })

    return (
        <div className="size-full overflow-x-auto bg-gray-50 px-4 print:p-0 print:bg-white print:overflow-visible">
            <div className="min-w-max flex justify-center w-[816px] py-4 print:p-0 mx-auto print:w-full print:min-w-0">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}