# LNWordToHtml (Python Port)

This document captures the design for the new Python-based replacement of the
legacy Windows/.NET `LNWordToHtml` utility. The goal is to keep every feature of
the C# tool while making it easier to run on Linux/macOS, eliminate inline
styles, and slot neatly into this repo.

## Goals

- Convert DOCX sources from OneDrive into HTML + CSS suitable for the public
  docs site with zero inline `style=` attributes.
- Synchronise generated HTML, CSS, and asset files with the `lnweb-docs` S3
  bucket, matching the legacy naming/layout (e.g. `docs/...`,
  `docs/images/<hash>.png`).
- Rebuild the DynamoDB `LN-Knowledge` hierarchy so the navigation tree stays up
  to date.
- Provide clear logging, dry-run support, and deterministic behaviour for CI or
  manual runs.
- Ship as a Python CLI under `apps/litter-networker/src/python-utils/lnwordtohtml`
  (e.g. `python -m lnwordtohtml.cli sync`).

## Getting Started

The workflow now lives inside the Electron “Content” panel, so authors can trigger dry runs or real syncs directly from the desktop app. To execute the converter manually:

```bash
cd apps/litter-networker/src/python-utils
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m lnwordtohtml.cli sync --dry-run --dump-dir tmp/lnwordtohtml-new
```

Key CLI flags:

- `--config PATH` overrides bucket/table/profile defaults via YAML.
- `--source PATH` can point to any DOCX tree (absolute or relative).
- `--dry-run/--no-dry-run` toggles upload mode (defaults to real sync).
- `--dump-dir PATH` writes the generated HTML/CSS/assets locally so you can diff
  against S3 before uploading.

## Typical Workflow

1. Run the converter with `--dry-run --dump-dir tmp/lnwordtohtml-new` (either through the Electron UI’s dry-run toggle or via the CLI command shown above).
2. Compare `tmp/lnwordtohtml-new` with a golden snapshot from S3 (for example
   by syncing `s3://lnweb-docs/docs` into `tmp/lnwordtohtml-golden`) and review
   the diffs.
3. Once satisfied, re-run without `--dry-run`. This uploads HTML,
   CSS, assets, updates Dynamo, and automatically requests a CloudFront
   invalidation for `/knowledge*` and `/docs/styles/*`.
4. Spot-check `litternetworks.org` (or the Content panel) after the
   invalidation completes to confirm the changes are live.

## Source Inputs

- OneDrive folder: `one-drive/Core Team Shared/Litter Networks/_web_docs`
  - Index pages live as `knowledge/<section>.docx` files in the root.
  - Child pages live in folders (e.g. `knowledge/our-organisation/documents/*.docx`).
  - Each `.docx` should become `docs/<same-structure>.html` in S3.

## Outputs

- HTML fragments that link to their scoped stylesheet via
  `<link rel="stylesheet" href="https://cdn.litternetworks.org/docs/styles/<slug>.css">`
  (no inline `style=` attributes).
- One deterministic CSS file per document (`docs/styles/<slug>.css`), also
  written to the dump directory when `--dump-dir` is used.
- Asset uploads for embedded images (hashed filenames, existing CDN URLs kept).
- Optional `build-manifest.json` describing generated files to help debugging.
- DynamoDB items per `uniqueId` mirroring the legacy `HierarchyNode` shape.

## Components

1. **CLI entry point** (`__main__.py`) – parses args (watch directory, AWS
   profile, dry-run) and orchestrates sync steps.
2. **Scanner** – walks the source tree, collecting DOCX files and metadata; keeps
   track of relative paths.
3. **Converter** – uses `python-docx` (or `mammoth`) to convert paragraphs,
   headings, lists, tables, hyperlinks, images, and videos to HTML fragments. It
   also builds a style registry to map inline formatting to CSS classes (e.g.
   `.ln-align-center`, `.ln-image-wide`).
4. **CSS Generator** – writes the deduplicated class definitions to one or more
   `.css` files and ensures HTML references them via `<link>` tags.
5. **S3 Sync** – compares local artifacts against S3 (using `list_objects_v2`),
   uploads new/changed files with cache headers, deletes strays when the source
   `.docx` is removed, and reuses hashes for images.
6. **DynamoDB Updater** – rebuilds the `LN-Knowledge` tree exactly as the C#
   version (title/description, nested `childPages`).
7. **Config Layer** – reads defaults from `config.yaml` or CLI flags (bucket
   name, DynamoDB table, temp dirs, etc.).
8. **Tests** – unit tests for converter, CSS mapping, and DynamoDB serialization
   (using moto/boto3 stubs).

## Workflow

1. `sync` command identifies DOCX files and determines which need processing by
   comparing timestamps or hashes with the cached state file.
2. For changed files, converter produces HTML fragment + metadata + style usage,
   and registers any referenced assets.
3. CSS generator writes/updates the per-page stylesheet(s) before uploads (and
   stores them locally when `--dump-dir` is provided).
4. Upload step pushes HTML, CSS, and assets to S3 and records checksums to avoid
   redundant uploads.
5. Once uploads succeed, S3 listing feeds into the DynamoDB hierarchy updater.
6. After a successful non-dry run, the CloudFront distribution is invalidated so
   the new pages/styles go live immediately.
7. Script exits non-zero on any failed upload/DB write (so CI can react).

## Implementation Milestones

- **Text & Metadata** – finish porting paragraph/run handling so headings,
  emphasis, links, and metadata tags render exactly like the C# output.
- **Lists/Tables/CSS** – emit semantic classes for lists + tables, generate a
  scoped CSS bundle per page, and ensure every HTML page references it via
  `<link>`.
- **Assets** – hash and upload embedded images/videos, reuse cached objects, and
  ensure the converter records required asset keys.
- **Dynamo Hierarchy** – rebuild the `HierarchyNode` tree and cover it with
  boto3/moto-based unit tests.
- **Automation** – add helper scripts/CI wiring plus lint/test tooling so
  content authors can run `sync_docs.sh` locally.

## Integration with Litter Networker

The desktop Content panel includes a **Sync Knowledge Docs** button. Use the Dry
Run toggle to exercise a no-op deployment (the logs stream live in the panel),
then uncheck it to perform the real sync + invalidation from the app. This is
handy when you don’t want to run commands manually but still want to see the
full output before promoting.

## Styling Strategy

- Normalise paragraph alignment (`justify`, `center`, `right`) via classes.
- Wrap the page content in `.ln-knowledge-shell` to provide the width/margin that
  currently lives on `<body style="max-width:700px;margin:0 auto;">`.
- Translate table widths and image size/float information into classes or inline
  `width="" height=""` attributes (allowed by CSP) plus CSS classes for float.
- Emit a manifest describing which generated CSS files are required so the SPA
  can preload or bundle them.

## AWS Considerations

- Use boto3 with the existing `ln` profile by default; allow overrides.
- Preserve metadata headers: `Cache-Control: public, max-age=3600, immutable`
  and `Content-Disposition: inline`.
- Respect current S3 key scheme (`docs/...`, `docs/images/...`).
- DynamoDB writes should mirror the legacy schema (single table, put by
  `uniqueId`). Include a dry-run to inspect JSON before writing.

## Open Questions / TODOs

- Finalise whether we generate a single global CSS file or one per section.
- Decide if we store per-file state locally (e.g. `.lnwordtohtml-cache.json`) to
  avoid re-converting unchanged DOCX even if S3 listing timestamps differ.
- Add linting/formatting rules for this tool (ruff/black?).
- Hook the CLI into CI or document the Electron workflow further as it evolves.

Once this design is approved we can start scaffolding the package and porting the
converter logic.
