import { glob } from 'glob';
import async from 'async';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import util from 'node:util';
import childProcess from 'node:child_process';
import { WebPInfo } from "webpinfo";
import { contentDir, homeDir } from '../nublog/constants.mjs';

const exec = util.promisify(childProcess.exec);

const q = async.queue(async (filePath, cb) => {
    console.log(`start converting ${filePath}`);

    const start = Date.now();
    const statBefore = await fs.stat(filePath);

    const splited = filePath.split('.');
    const ext = splited.pop().toLowerCase();
    const webpPath = splited.join('.') + '.webp';

    try {
        await fs.stat(webpPath);
        console.log(`skip converting ${filePath}`);
        if (!filePath.endsWith('.webp')) await fs.rm(filePath);
        return;
    } catch (e) {}

    const lossless = ext === 'png' || ext === 'gif' ? true
        : ext === 'webp' ? await WebPInfo.from(filePath).then(info => info.lossless)
        : false;

    await sharp(filePath, { animated: true })
        .rotate()
        .toFormat('webp', {
            quality: 90,
            smartSubsample: true,
            effort: 6,
            lossless,
        })
        .toFile(webpPath);
    await fs.rm(filePath);

    const statAfter = await fs.stat(webpPath);

    console.log(`finish converting ${filePath}`);
    console.log(`time: ${Date.now() - start}ms, before: ${statBefore.size / 1024} KiB, after: ${statAfter.size / 1024} KiB`);
    cb(null, webpPath);
}, 6);

export const imageGlob = `docs/**/*.+(jpg|jpeg|png|gif|webp|JPG|JPEG|PNG|GIF|WEBP)`;

const filesPaths = glob.sync(imageGlob, { nodir: true, cwd: homeDir });
console.log(`found ${filesPaths.length} files`);
await Promise.all(filesPaths.map((path, i, arr) => q.push(path)));
// need git stage
//await exec(`git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch ${filesPaths.map(x => `"${x.replace(homeDir, '')}"`).join(' ')}' --prune-empty --tag-name-filter cat -- --all`)
