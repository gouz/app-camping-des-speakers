import * as fs from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import fm from 'front-matter';
import * as mdjs from '@moox/markdown-to-json';

const require = createRequire(import.meta.url);
const campingPath = path.dirname(require.resolve("camping-des-speakers/package.json"));
await fs.mkdir('tmp/_data', { recursive: true });
await fs.copyFile(path.join(campingPath, '_data/site.js'), path.join('tmp/_data/site.js'));
const site = (await import('./tmp/_data/site.js')).default;
const generatedTypes = {
    "sessions": "{[key: string]: Session}",
    "speakers": "{[key: string]: Speaker}",
    "sponsors": "{[key: string]: Sponsor}",
    "days": "Day[]",
    "rooms": "{[key: string]: Room}",
};
const contentDirectories = ['sessions', 'speakers', 'sponsors'];
const siteConsts = ['days', 'rooms'];

// save the data to src/camping-data.json
await fs.writeFile(path.join("src", "camping-data.js"), await generateDataFile(contentDirectories));

// copy the camping-des-speakers/img directory recursively to src/resources
await copyDirectoryRecursively(path.join(campingPath, "img"), path.join("src", "resources"));


/**
 * Load the directories files and return
 * @param  {string[]} directories the directories to load
 * @returns
 */
async function generateDataFile(directories) {
    const promises = directories.map(async directory => {
        return `/**
* @type {${generatedTypes[directory]}}
*/
export const ${directory} = ${JSON.stringify(await loadContentDirectoryMap(directory), null, 2)}`
    });

    const parts = [
        ...siteConsts.map(constName => `/**
* @type {${generatedTypes[constName]}}
*/
export const ${constName} = ${JSON.stringify(site.fr[constName], null, 2)}`),
        ...await Promise.all(promises)
    ]
    return parts.join("\n\n");
}

/**
 * Load a directory and return the attributes and the children
 * @param {string} directory the directory to load
 * @returns 
 */
async function loadContentDirectoryMap(directory) {
    const dirPath = path.join(campingPath, "content", directory);
    const files = (await fs.readdir(dirPath)).filter(file => file.endsWith('.md'));
    const filesMap = {};
    for (const file of files) {
        const data = await loadMarkdown(path.join(dirPath, file));
        filesMap[data.attributes.key] = data;
    }
    return filesMap;
}

/**
 * Load a markdown file and return the attributes and the children
 * @param {string} filePath the file path relative to the camping path
 * @returns 
 */
async function loadMarkdown(filePath) {
    const mdContent = await fs.readFile(filePath, 'utf-8');
    const { attributes, body } = fm(mdContent);
    const children = mdjs.markdownAsJsTree(body).body.children ?? [];
    return { attributes, children };
}

/**
 * Copy a directory recursively
 * @param {string} src source directory to copy
 * @param {string} dest the destination directory
 */
async function copyDirectoryRecursively(src, dest) {
    // creates the destination directory if it does not exist
    await fs.mkdir(dest, { recursive: true });
    const files = await fs.readdir(src);
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = await fs.stat(srcPath);
        if (stat.isDirectory()) {
            await copyDirectoryRecursively(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}