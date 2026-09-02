'use client';

import {
  BoldIcon,
  FileIcon,
  FileJsonIcon,
  FilePenIcon,
  FilePlusIcon,
  GlobeIcon,
  ItalicIcon,
  PrinterIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  StrikethroughIcon,
  TextIcon,
  TrashIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { DocumentInput } from '@/app/documents/[documentId]/document-input';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';

// todo добавить шорткаты
export const Navbar = () => {
  return (
    <nav className="flex items-center justify-between p-2">
      <div className="flex gap-2 items-center">
        <Link href="/">
          <Image src="/logo.svg" alt="Logo" width={36} height={36} />
        </Link>
        <div className="flex flex-col">
          <DocumentInput />
          <div className="flex">
            <Menubar className="border-none p-0 h-auto">
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted">
                  Файл
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <FileIcon className="size-4" />
                      Сохранить
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem>
                        <FileJsonIcon className="size-4" />
                        JSON
                      </MenubarItem>
                      <MenubarItem>
                        <GlobeIcon className="size-4" />
                        HTML
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarItem>
                    <FilePlusIcon className="size-4" />
                    Создать
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem>
                    <FilePenIcon className="size-4" />
                    Переименовать
                  </MenubarItem>
                  <MenubarItem>
                    <TrashIcon className="size-4" />
                    Удалить
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={() => window.print()}>
                    <PrinterIcon />
                    Печать <MenubarShortcut>⌘P</MenubarShortcut>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted">
                  Правка
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarItem>
                    <Undo2Icon className="size-4" />
                    Отменить <MenubarShortcut>⌘Z</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem>
                    <Redo2Icon className="size-4" />
                    Повторить <MenubarShortcut>⌘Y</MenubarShortcut>
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted">
                  Вставка
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>Таблица</MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem>1 x 1</MenubarItem>
                      <MenubarItem>2 x 2</MenubarItem>
                      <MenubarItem>3 x 3</MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-sm font-normal py-0.5 px-[7px] rounded-sm hover:bg-muted">
                  Формат
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <TextIcon className="size-4" />
                      Текст
                    </MenubarSubTrigger>
                    <MenubarSubContent>
                      <MenubarItem>
                        <BoldIcon className="size-4" />
                        Полужирный
                      </MenubarItem>
                      <MenubarItem>
                        <ItalicIcon className="size-4" />
                        Курсив
                      </MenubarItem>
                      <MenubarItem>
                        <UnderlineIcon className="size-4" />
                        Подчеркнутый
                      </MenubarItem>
                      <MenubarItem>
                        <StrikethroughIcon className="size-4" />
                        Зачеркнутый
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                  <MenubarItem>
                    <RemoveFormattingIcon className="size-4" />
                    Очистить форматирование
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>
        </div>
      </div>
    </nav>
  );
};
