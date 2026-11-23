# Security notes: quay

What the slotting engine enforces, what it leaves out, and how to place it.
Read alongside the [OpenAPI specification](engine/api/src/main/resources/openapi.yaml);
the operational knobs named here are documented there too.

## What this is

A deterministic slotting engine with an HTTP face and a workbench page. It
plans fictional pick faces; it stores nothing, keeps no accounts, and
collects no personal data. The threat model is an operator's machine or a
closed lab network. The public internet is out of scope.

## What is enforced

- **A bearer-token gate** (`QUAY_TOKEN`). When set, every route except
  `/health`, `/ready`, `/metrics`, and the workbench page itself answers
  401 without `Authorization: Bearer …`. The comparison is constant-time.
  The workbench asks for the token on the first refusal and keeps it in
  `sessionStorage` for the tab's life only.
- **A per-client rate limit** (`QUAY_RATE_LIMIT`, default 600 requests per
  minute). Fixed window per address; refusals carry `Retry-After` and are
  counted on the metrics page as `quay_refusals_total`.
- **A request body cap** (`QUAY_MAX_BODY`, default 1 MiB). Oversize requests
  are refused before the body is read, and the server enforces the same cap
  at the socket for requests that lie about their length.
- **Strict request shapes.** Unknown JSON fields are refused by name; the
  SKU-master CSV importer validates every row and refuses the whole file on
  a bad header.
- **Escaped output everywhere.** Every document-derived string in the
  workbench passes through an HTML escaper before it reaches the page;
  a hostile fixture or CSV cannot inject markup.
- **Read-only fixtures.** The engine reads its faces and days from the
  classpath; no route writes to disk.

## What it leaves out

- **No per-user identity.** One shared token, no SSO, no scoping. Two people
  who share the token look the same to the engine.
- **No audit trail.** Requests are logged structured (method, route, status,
  latency), but nothing records who asked.
- **No TLS termination.** The jar speaks plain HTTP. Put a real gateway in
  front if it leaves the loopback.
- **No secret management.** The token arrives by environment variable and is
  never rotated by the service itself.

## Deployment guidance

The default bind is loopback with the gate off, which suits an operator's
machine. For anything wider: set `QUAY_TOKEN`, front the service with a TLS
terminating gateway, and scrape `/metrics` from inside. The Docker image and
`compose.yaml` carry the same knobs.

## Fixture provenance

The engine's input fixtures carry a checksum manifest
(`engine/fixtures/MANIFEST`, `sha256sum -c` format). CI verifies it on every
push, so a figure on the site can be traced to the exact fixture bytes it
was computed from. Regenerate the manifest over the committed bytes, not
the checked-out files, because line-ending conversion differs by platform:
`git cat-file -p HEAD:<fixture> | sha256sum` is the portable way, and the
diff review is the checkpoint.

## Reporting

Open an issue in this repository. This is a portfolio project. These notes
describe the posture; they certify nothing.
