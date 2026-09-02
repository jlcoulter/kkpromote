import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { promote, PromoteError, kustomizationPath } from '../src/promote.js';

const REGISTRY = 'registry.example.com';

function kustomization(application, tag) {
  return `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../base

images:
- name: ${REGISTRY}/${application}
  newName: ${REGISTRY}/${application}
  newTag: ${tag} # pinned by CI
`;
}

function makeApplication({ application = 'hcd-search-api', envs }) {
  const repo = mkdtempSync(join(tmpdir(), 'kip-'));
  const path = join(repo, 'applications', application);
  for (const [env, tag] of Object.entries(envs)) {
    const dir = join(path, env);
    mkdirSync(dir, { recursive: true });
    writeFileSync(kustomizationPath(path, env), kustomization(application, tag));
  }
  return path;
}

function tagIn(path, env) {
  const raw = readFileSync(kustomizationPath(path, env), 'utf8');
  return raw.match(/newTag:\s*(\S+)/)[1];
}

// path is `<tmp-root>/applications/<application>`; remove the whole tmp root.
function cleanup(path) {
  rmSync(dirname(dirname(path)), { recursive: true, force: true });
}

test('promotes the source tag into the target overlay', () => {
  const path = makeApplication({ envs: { dev: '1.2.3', sit: '1.0.0' } });
  try {
    const result = promote({ path, sourceEnv: 'dev', targetEnv: 'sit' });
    assert.equal(result.changed, true);
    assert.equal(result.application, 'hcd-search-api');
    assert.equal(result.previousTag, '1.0.0');
    assert.equal(result.tag, '1.2.3');
    assert.equal(tagIn(path, 'sit'), '1.2.3');
  } finally {
    cleanup(path);
  }
});

test('preserves comments when writing', () => {
  const path = makeApplication({ envs: { dev: '1.2.3', sit: '1.0.0' } });
  try {
    promote({ path, sourceEnv: 'dev', targetEnv: 'sit' });
    const raw = readFileSync(kustomizationPath(path, 'sit'), 'utf8');
    assert.match(raw, /# pinned by CI/);
  } finally {
    cleanup(path);
  }
});

test('is a no-op when the tags already match', () => {
  const path = makeApplication({ envs: { dev: '1.2.3', sit: '1.2.3' } });
  try {
    const result = promote({ path, sourceEnv: 'dev', targetEnv: 'sit' });
    assert.equal(result.changed, false);
  } finally {
    cleanup(path);
  }
});

test('dry-run does not write the file', () => {
  const path = makeApplication({ envs: { dev: '1.2.3', sit: '1.0.0' } });
  try {
    const result = promote({ path, sourceEnv: 'dev', targetEnv: 'sit', dryRun: true });
    assert.equal(result.changed, true);
    assert.equal(tagIn(path, 'sit'), '1.0.0');
  } finally {
    cleanup(path);
  }
});

test('rejects identical source and target environments', () => {
  const path = makeApplication({ envs: { dev: '1.2.3' } });
  try {
    assert.throws(
      () => promote({ path, sourceEnv: 'dev', targetEnv: 'dev' }),
      PromoteError,
    );
  } finally {
    cleanup(path);
  }
});

test('errors when an overlay is missing', () => {
  const path = makeApplication({ envs: { dev: '1.2.3' } });
  try {
    assert.throws(
      () => promote({ path, sourceEnv: 'dev', targetEnv: 'sit' }),
      /sit[/\\]kustomization\.yaml does not exist/,
    );
  } finally {
    cleanup(path);
  }
});

test('errors when no image entry matches the application', () => {
  const repo = mkdtempSync(join(tmpdir(), 'kip-'));
  const path = join(repo, 'applications', 'mystery');
  try {
    for (const env of ['dev', 'sit']) {
      const dir = join(path, env);
      mkdirSync(dir, { recursive: true });
      // overlay exists but its image is for a different application
      writeFileSync(kustomizationPath(path, env), kustomization('other-app', '1.0.0'));
    }
    assert.throws(
      () => promote({ path, sourceEnv: 'dev', targetEnv: 'sit' }),
      /no image entry for 'mystery'/,
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
