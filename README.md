# kkpromote

A container image tag promoter for Gitops that works with Kubernetes and Kustomize, promoting an application from one Kustomize environment overlay to another.

[![CI](https://github.com/steveswinsburg/kkpromote/actions/workflows/ci.yml/badge.svg)](https://github.com/steveswinsburg/kkpromote/actions/workflows/ci.yml)

Promotes a container image tag for an application from one Kustomize environment
overlay to another in a GitOps repository.

### Relationship to kustomize

Kustomize's native `kustomize edit set image <name>=<newName>:<newTag>` can
*write* an image tag into a `kustomization.yaml`, but it has no command to
*read* a tag from another overlay and no notion of *promoting* between
environments. 

**kkpromote** performs both the read and the write directly against
the YAML, so it needs no `kustomize` binary installed and preserves comments and
formatting in the edited file.

## How it works

This tool reads the kustomization.yaml from the environment and updates the image tag.

Let's assume your gitops repo is laid out like this:

```
my-app/                     
├── dev/
│   └── kustomization.yaml
├── test/
│   └── kustomization.yaml
└── prod/
    └── kustomization.yaml
```

When you run `kkpromote my-app dev test` it will copy the `newTag` of the `my-app` image from the source overlay (dev) into the target overlay (test).

## Install

Global install:

```bash
npm install -g kkpromote
```

Or run without installing:

```bash
npx kkpromote ~/dev/my-gitops-repo/applications/my-app dev sit
```

## Usage

```bash
kkpromote <path> <source-env> <target-env> [options]
```

| Option | Description |
| --- | --- |
| `-n, --dry-run` | Show the change without writing the file |
| `-h, --help` | Show help |
| `-v, --version` | Show the version |

Example:

```bash
kkpromote ~/dev/my-gitops-repo/applications/my-app dev sit
# my-app (dev -> sit): 1.0.0 -> 1.2.3
```

## Programmatic use

```js
import { promote } from 'kkpromote';

const result = promote({
  path: '/path/to/my-gitops-repo/applications/my-app',
  sourceEnv: 'dev',
  targetEnv: 'sit',
});
// { changed: true, tag: '1.2.3', previousTag: '1.0.0', ... }
```

## Development

```bash
npm install
npm test
```

## Author

Steve Swinsburg 

## License

[MIT](LICENSE)
