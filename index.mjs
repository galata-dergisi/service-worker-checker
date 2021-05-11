// Copyright 2021 Mehmet Baker
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import fs from 'fs';
import path from 'path';
import https from 'https';
import core from '@actions/core';
import styles from 'ansi-styles';
import * as Diff from 'diff';

function getURL(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(`Status code is ${response.statusCode}`);
      }

      let data = '';

      response.setEncoding('utf-8');
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
  });
}

function parseCacheName(serviceWorkerCode) {
  const regex = /const\s+CACHE_NAME\s*=\s*(?:'|")([^'"]+)(?:'|")/;
  if (!regex.test(serviceWorkerCode)) {
    throw new Error('Failed to parse cache name.');
  }

  const [, cacheName] = serviceWorkerCode.match(regex);
  return cacheName;
}

async function compareServiceWorkerCacheNames(repoPath) {
  try {
    const file = 'client/service-worker.js';
    const url = `https://galatadergisi.org/${file.replace(/^client\//, '')}`;
    const localFile = await fs.promises.readFile(path.join(repoPath, file), 'utf-8');
    const remoteFile = await getURL(url);

    const localCacheName = parseCacheName(localFile);
    const remoteCacheName = parseCacheName(remoteFile);

    if (localCacheName === remoteCacheName) {
      core.setFailed('Cache names are the same.');
      return;
    }

    core.info(`${styles.color.greenBright.open}Cache names are different.${styles.color.close}`);
  } catch (ex) {
    console.trace(ex);
    core.setFailed('Failed to compare service cache names.');
  }
}

async function main() {
  try {
    const repoPath = core.getInput('REPO_PATH');

    try {
      await fs.promises.access(repoPath);
    } catch (ex) {
      core.setFailed(`Failed to access REPO_PATH: "${repoPath}"`);
      return;
    }

    const files = [
      'public/global.css',
      'public/legacy-player.js',
      'public/index.html',
      'public/bundle.css',
      'public/bundle.js',
      'public/katkida-bulunun/index.html',
      'public/katkida-bulunun/bundle.js',
      'public/katkida-bulunun/bundle.css',
    ];

    for (const file of files) {
      const url = `https://galatadergisi.org/${file.replace(/^public\//, '')}`;
      const localFile = (await fs.promises.readFile(path.join(repoPath, file), 'utf-8'))
        .replace(/\r*/g, '')
        .replace(/\\r\\n/g, '\\n');

      core.info(`${styles.color.blueBright.open}Downloading ${url}${styles.color.close}`);
      const remoteFile = (await getURL(url))
        .replace(/\r*/g, '')
        .replace(/\\r\\n/g, '\\n');

      if (localFile !== remoteFile) {
        const diff = Diff.diffChars(localFile, remoteFile);
        diff.forEach((part) => {
          const color = part.added ? 'green' :
            part.removed ? 'red' : 'grey';
          process.stderr.write(`${styles.color[color].open}${part.value}${styles.color.close}`);
        });

        process.stderr.write('\n\n');
        core.info(`${styles.color.yellowBright.open}${file} has changed.${styles.color.close}`);
        fs.writeFileSync('local.txt', localFile);
        fs.writeFileSync('remote.txt', remoteFile);
        return compareServiceWorkerCacheNames(repoPath);
      } else {
        core.info(`${styles.color.greenBright.open}${file} didn't change.${styles.color.close}`);
      }
    }

    core.info(`${styles.color.greenBright.open}There are no changes.${styles.color.close}`);
  } catch (ex) {
    console.trace(ex);
    core.setFailed('Failed to compare bundles.');
  }
}

main();
