/* 快速列出 app.asar 里的文件（不需要额外依赖） */
const fs = require('node:fs');
const path = require('node:path');

const file = process.argv[2];
const fd = fs.openSync(file, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);

const headerSize = head.readUInt32LE(12);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 16);
const header = JSON.parse(headerBuf.toString('utf8'));

const out = [];
(function walk(node, prefix) {
  for (const [name, val] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (val.files) walk(val, p);
    else out.push(p + '  (' + (val.size || 0) + 'B)');
  }
})(header, '');

console.log('asar:', file);
console.log('files:', out.length);
out.forEach(l => console.log('  ' + l));
fs.closeSync(fd);
