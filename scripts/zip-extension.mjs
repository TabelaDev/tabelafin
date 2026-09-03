import JSZip from 'jszip';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = process.cwd();
const src = join(root, 'extension');
const out = join(root, 'static', 'extension.zip');

const zip = new JSZip();

async function addDir(dir, base) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			await addDir(full, rel);
		} else {
			zip.file(rel, await readFile(full));
		}
	}
}

await addDir(src, 'extension');
const buf = await zip.generateAsync({ type: 'nodebuffer' });
await mkdir(dirname(out), { recursive: true });
await writeFile(out, buf);
console.log(`wrote ${out} (${buf.length} bytes)`);
