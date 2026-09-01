import { type Editor } from "@tiptap/react";
import {create} from "zustand/react";

interface EditorState {
    editor: Editor | null;
    setEditor: (editor: Editor | null) => void;
}

// todo correct types!!!
export const useEditorStore = create<EditorState>((set) => ({
    editor: null,
    setEditor: (editor) => set({ editor }),
}))