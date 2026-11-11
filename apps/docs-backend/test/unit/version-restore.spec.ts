import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createVersionRestoreUpdate } from '../../src/collab/version-restore';

// Контракт куска S22: апдейт переводит живую комнату к содержимому версии и
// ничего не мутирует сам по себе.
const documentWithText = (text: string) => {
  const doc = new Y.Doc();
  doc.getText('content').insert(0, text);

  return doc;
};

const text = (doc: Y.Doc) => doc.getText('content').toString();

describe('createVersionRestoreUpdate', () => {
  it('возвращает апдейт, после применения которого текст равен версии', () => {
    const doc = documentWithText('Hello');
    const snapshot = Y.encodeStateAsUpdate(doc);
    doc.getText('content').insert(5, ' World');

    const update = createVersionRestoreUpdate(doc, snapshot);
    Y.applyUpdate(doc, update);

    expect(text(doc)).toBe('Hello');
  });

  it('убирает правки, сделанные после версии', () => {
    const doc = documentWithText('one');
    doc.getText('content').insert(3, ' two');
    const snapshot = Y.encodeStateAsUpdate(doc);
    doc.getText('content').insert(7, ' three');

    Y.applyUpdate(doc, createVersionRestoreUpdate(doc, snapshot));

    expect(text(doc)).toBe('one two');
  });

  it('не мутирует текущий документ', () => {
    const doc = documentWithText('Hello');
    const snapshot = Y.encodeStateAsUpdate(doc);
    doc.getText('content').insert(5, ' World');

    createVersionRestoreUpdate(doc, snapshot);

    expect(text(doc)).toBe('Hello World');
  });

  it('сходится у двух реплик, которые видели одни и те же правки', () => {
    const first = documentWithText('version');
    const second = new Y.Doc();
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));

    const snapshot = Y.encodeStateAsUpdate(first);
    first.getText('content').insert(7, ' edited');
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
    expect(text(second)).toBe('version edited');

    const update = createVersionRestoreUpdate(first, snapshot);
    Y.applyUpdate(first, update);
    Y.applyUpdate(second, update);

    expect(text(first)).toBe('version');
    expect(text(second)).toBe('version');
  });

  it('восстанавливает содержимое Y.XmlFragment, а не только Y.Text', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');
    const paragraph = new Y.XmlElement('paragraph');
    const paragraphText = new Y.XmlText();
    paragraphText.insert(0, 'Version');
    paragraph.insert(0, [paragraphText]);
    fragment.insert(0, [paragraph]);

    const snapshot = Y.encodeStateAsUpdate(doc);

    paragraphText.insert(7, ' edited');
    const extra = new Y.XmlElement('paragraph');
    const extraText = new Y.XmlText();
    extraText.insert(0, 'Added later');
    extra.insert(0, [extraText]);
    fragment.insert(1, [extra]);

    Y.applyUpdate(doc, createVersionRestoreUpdate(doc, snapshot));

    expect(String(fragment)).toBe('<paragraph>Version</paragraph>');
  });
});
