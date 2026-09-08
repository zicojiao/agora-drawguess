# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub Security Advisories for this repository. Do not open a public issue containing credentials, exploit details, or personal data.

Include the affected route or component, reproduction steps, expected impact, and any suggested mitigation. Please allow a reasonable period for investigation before public disclosure.

## Secrets

Never commit `.env.local`, `.dev.vars`, `.env.production`, or a production `wrangler.jsonc`. Rotate a credential immediately if it is accidentally exposed. Variables prefixed with `VITE_` are public browser configuration and must never contain server secrets.
