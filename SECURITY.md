# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's "Report a vulnerability" button on the Security tab of this repository. Do not open a public issue. Include what you found, how to reproduce it, and which version or commit. You will get a reply as soon as a maintainer can read it.

## Things to know before you run it

- **Provider keys.** The CLI and MCP read keys from your environment and send text only to the provider you choose. The desktop app stores keys encrypted with the operating system's keychain through Electron `safeStorage`.
- **The API has no authentication by default.** If neither `WORKOS_CLIENT_ID` nor `JWKS_URL` is set, or `PROSODEUS_DEV=true`, every request is the same local user. Do not expose such an instance to a network. See `docs/deployment.md`.
- **The MCP server and plugin run `npx -y @prosodeus/mcp`** and pass your text to your chosen model provider. Pin a version in `.mcp.json` if you want to control updates.
- **Text you analyze leaves your machine** when it goes to a model provider. Do not analyze text you may not share with that provider.
