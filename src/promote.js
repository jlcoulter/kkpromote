import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { parseDocument } from 'yaml';

const KUSTOMIZATION_FILE = 'kustomization.yaml';

/** Raised for expected, user-facing errors (missing files, no matching image, etc). */
export class PromoteError extends Error {}

/** Resolve the kustomization.yaml for an application's environment overlay. */
export function kustomizationPath(path, environment) {
  return join(path, environment, KUSTOMIZATION_FILE);
}

function readFileOrThrow(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new PromoteError(`${file} does not exist`);
    }
    throw err;
  }
}

// The kustomization image name is the fully qualified registry path, e.g.
// "registry.example.com/hcd-search-api"; match on the trailing image name.
function imageMatches(name, application) {
  return typeof name === 'string' && (name === application || name.endsWith(`/${application}`));
}

function findImage(doc, application, file) {
  const images = doc.get('images');
  if (images && Array.isArray(images.items)) {
    for (const item of images.items) {
      if (typeof item?.get === 'function' && imageMatches(item.get('name'), application)) {
        return item;
      }
    }
  }
  throw new PromoteError(`no image entry for '${application}' found in ${file}`);
}

// yaml stringifies with LF; restore CRLF when the original file used it.
function withLineEndings(output, original) {
  return original.includes('\r\n') ? output.replace(/\n/g, '\r\n') : output;
}

/**
 * Copy an application's image tag from a source environment overlay into a target one.
 *
 * @param {object} options
 * @param {string} options.path directory for the application, containing an environment
 *   subdirectory per overlay (e.g. `<gitops-repo>/applications/hcd-search-api`); the
 *   application name used to match the kustomize image entry is the directory's basename
 * @param {string} options.sourceEnv environment subdirectory to copy the tag from
 * @param {string} options.targetEnv environment subdirectory to copy the tag into
 * @param {boolean} [options.dryRun] when true, compute the change without writing
 * @returns {{changed: boolean, application: string, sourceEnv: string, targetEnv: string,
 *   tag: string, previousTag: string, targetFile: string}}
 */
export function promote({ path, sourceEnv, targetEnv, dryRun = false }) {
  if (sourceEnv === targetEnv) {
    throw new PromoteError('source and target environment must be different');
  }

  const application = basename(path);
  const sourceFile = kustomizationPath(path, sourceEnv);
  const targetFile = kustomizationPath(path, targetEnv);

  const sourceDoc = parseDocument(readFileOrThrow(sourceFile));
  const sourceTag = findImage(sourceDoc, application, sourceFile).get('newTag');
  if (sourceTag == null || `${sourceTag}`.trim() === '') {
    throw new PromoteError(`no newTag set for '${application}' in ${sourceFile}`);
  }

  const targetRaw = readFileOrThrow(targetFile);
  const targetDoc = parseDocument(targetRaw);
  const targetImage = findImage(targetDoc, application, targetFile);
  const previousTag = targetImage.get('newTag');

  const result = { changed: false, application, sourceEnv, targetEnv, tag: sourceTag, previousTag, targetFile };
  if (previousTag === sourceTag) {
    return result;
  }

  targetImage.set('newTag', sourceTag);
  if (!dryRun) {
    writeFileSync(targetFile, withLineEndings(targetDoc.toString(), targetRaw));
  }
  result.changed = true;
  return result;
}

