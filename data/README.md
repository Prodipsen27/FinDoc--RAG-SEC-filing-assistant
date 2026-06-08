# Data

Local data artifacts for development live here.

- `downloads/` holds raw source files fetched from SEC EDGAR, grouped by year.
- `markdown/` holds converted Markdown exports with the same year layout and manifest.
- Downloaded and converted payloads are gitignored because the corpus can get large.
- The active JS backend ingests from `data/markdown/manifest.json` and the Markdown/table files beside it.
- The checked-in app workflow starts from the existing local corpus rather than Python helper scripts.
