#!/usr/bin/env node
const msg = require('fs').readFileSync(process.argv[2], 'utf8');

if (msg.length > 150) {
  console.error('Сообщение коммита длиннее 150 символов');
  process.exit(1);
}

if (!/^[a-zа-я0-9]/.test(msg)) {
  console.error('Сообщение коммита должно начинаться со строчной буквы');
  process.exit(1);
}
