# kkpromote

Gitops Kubernets Kustomize image tag promoter.

Promote a container image tag for an application from one Kustomize environment
overlay to another in a GitOps repository 

It expects the conventional layout, where `path` points to the application's
directory and each environment is a subdirectory containing that overlay's
`kustomization.yaml`:

```
<path>/                      e.g. <gitops-repo>/applications/my-app
├── dev/
│   └── kustomization.yaml
├── sit/
│   └── kustomization.yaml
└── prod/
    └── kustomization.yaml
```

The application name used to match the image entry is the basename of `path`
(e.g. `my-app` above). It copies the `newTag` of the image whose name
ends with `/<application>` from the source overlay into the target overlay,
preserving comments and formatting.

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

## Relationship to kustomize

Kustomize's native `kustomize edit set image <name>=<newName>:<newTag>` can
*write* an image tag into a `kustomization.yaml`, but it has no command to
*read* a tag from another overlay and no notion of promoting between
environments. This tool performs both the read and the write directly against
the YAML, so it needs no `kustomize` binary installed and preserves comments and
formatting in the edited file.

## Development

```bash
npm install
npm test
```

## Author

Steve Swinsburg 

## License

[MIT](LICENSE)
