const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const AdmZip = require('adm-zip');
const log = require('./logger');

/**
 * SDE Updater
 *
 * Downloads and keeps up to date CCP's new (September 2025+) JSON Lines Static
 * Data Export. The app no longer ships static data in the repo; instead it is
 * fetched on startup and refreshed whenever CCP publishes a newer build.
 *
 * Endpoints (https://developers.eveonline.com/docs/services/static-data/):
 *   - Latest build metadata: /static-data/tranquility/latest.jsonl
 *     (record with `_key === "sde"` carries the buildNumber)
 *   - Latest JSONL archive:  /static-data/eve-online-static-data-latest-jsonl.zip
 */

const SDE_BASE_URL = (process.env.SDE_BASE_URL || 'https://developers.eveonline.com/static-data').replace(/\/$/, '');
const LATEST_META_URL = `${SDE_BASE_URL}/tranquility/latest.jsonl`;
const LATEST_ZIP_URL = `${SDE_BASE_URL}/eve-online-static-data-latest-jsonl.zip`;

// JSONL files the application actually loads (the full archive has ~60 files).
const REQUIRED_FILES = [
  'types.jsonl',
  'groups.jsonl',
  'categories.jsonl',
  'typeDogma.jsonl',
  'dogmaAttributes.jsonl',
  'dogmaEffects.jsonl'
];

const VERSION_FILE = '.sde-version.json';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch the latest published SDE build number from CCP. */
async function getLatestBuild() {
  const response = await axios.get(LATEST_META_URL, {
    responseType: 'text',
    timeout: 30000,
    headers: { Accept: 'application/jsonlines, text/plain, */*' }
  });

  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (record._key === 'sde' && record.buildNumber) {
      return { buildNumber: record.buildNumber, releaseDate: record.releaseDate };
    }
  }
  throw new Error('Could not find sde build record in latest.jsonl');
}

/** Read the locally installed SDE version metadata, or null if absent. */
async function getInstalledVersion(staticDataPath) {
  const versionPath = path.join(staticDataPath, VERSION_FILE);
  try {
    if (await fs.pathExists(versionPath)) {
      return await fs.readJson(versionPath);
    }
  } catch (error) {
    log.warn('Could not read SDE version file', { error: error.message });
  }
  return null;
}

/** True only when every JSONL file the app needs is present on disk. */
async function hasRequiredFiles(staticDataPath) {
  for (const file of REQUIRED_FILES) {
    if (!(await fs.pathExists(path.join(staticDataPath, file)))) {
      return false;
    }
  }
  return true;
}

/** Stream a URL to a destination file, retrying with exponential backoff. */
async function downloadFile(url, dest, { retries = 4 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 600000,
        maxRedirects: 5
      });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(dest);
        response.data.pipe(writer);
        response.data.on('error', reject);
        writer.on('error', reject);
        writer.on('finish', resolve);
      });
      return;
    } catch (error) {
      attempt += 1;
      if (attempt > retries) throw error;
      const backoff = 2000 * 2 ** (attempt - 1);
      log.warn(`SDE download failed (attempt ${attempt}/${retries}), retrying in ${backoff}ms`, { error: error.message });
      await sleep(backoff);
    }
  }
}

/** Download the latest JSONL archive and extract the files the app needs. */
async function downloadAndExtract(staticDataPath, buildNumber) {
  await fs.ensureDir(staticDataPath);
  const tmpZip = path.join(os.tmpdir(), `eve-sde-${buildNumber || 'latest'}-${process.pid}.zip`);

  try {
    log.info(`Downloading EVE SDE archive (build ${buildNumber || 'latest'})...`);
    await downloadFile(LATEST_ZIP_URL, tmpZip);

    log.info('Extracting required SDE files...');
    const zip = new AdmZip(tmpZip);
    for (const file of REQUIRED_FILES) {
      const entry = zip.getEntry(file);
      if (!entry) {
        throw new Error(`SDE archive is missing expected file: ${file}`);
      }
      // overwrite existing, write into staticDataPath flat (no nested dirs)
      zip.extractEntryTo(entry, staticDataPath, false, true);
    }

    await fs.writeJson(path.join(staticDataPath, VERSION_FILE), {
      buildNumber: buildNumber || null,
      updatedAt: new Date().toISOString()
    }, { spaces: 2 });

    log.info(`EVE SDE updated to build ${buildNumber || 'latest'}`);
  } finally {
    await fs.remove(tmpZip).catch(() => {});
  }
}

/**
 * Ensure the JSONL SDE is present and (optionally) up to date.
 *
 * @param {object} opts
 * @param {string} opts.staticDataPath  Directory to store the JSONL files.
 * @param {boolean} [opts.autoUpdate=true]  Check CCP for a newer build on startup.
 * @returns {Promise<{buildNumber:?number, updated:boolean}>}
 */
async function ensureStaticData({ staticDataPath, autoUpdate = true } = {}) {
  await fs.ensureDir(staticDataPath);

  const present = await hasRequiredFiles(staticDataPath);
  const installed = await getInstalledVersion(staticDataPath);

  // Nothing on disk: we must download regardless of the autoUpdate preference.
  if (!present) {
    log.info('No local EVE SDE found, downloading latest JSON Lines export...');
    let buildNumber = null;
    try {
      ({ buildNumber } = await getLatestBuild());
    } catch (error) {
      log.warn('Could not determine latest SDE build number, downloading latest anyway', { error: error.message });
    }
    await downloadAndExtract(staticDataPath, buildNumber);
    return { buildNumber, updated: true };
  }

  if (!autoUpdate) {
    log.info(`SDE auto-update disabled; using installed build ${installed?.buildNumber ?? 'unknown'}`);
    return { buildNumber: installed?.buildNumber ?? null, updated: false };
  }

  // Files present: check whether CCP has a newer build.
  try {
    const { buildNumber } = await getLatestBuild();
    if (!installed || installed.buildNumber !== buildNumber) {
      log.info(`Newer EVE SDE available (installed: ${installed?.buildNumber ?? 'unknown'}, latest: ${buildNumber}), updating...`);
      await downloadAndExtract(staticDataPath, buildNumber);
      return { buildNumber, updated: true };
    }
    log.info(`EVE SDE is up to date (build ${buildNumber})`);
    return { buildNumber, updated: false };
  } catch (error) {
    // Network hiccup but we already have usable data: carry on with what we have.
    log.warn('Could not check for SDE updates, using existing data', { error: error.message });
    return { buildNumber: installed?.buildNumber ?? null, updated: false };
  }
}

module.exports = {
  ensureStaticData,
  getLatestBuild,
  getInstalledVersion,
  downloadAndExtract,
  REQUIRED_FILES,
  VERSION_FILE,
  SDE_BASE_URL
};
