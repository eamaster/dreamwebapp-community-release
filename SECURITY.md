# Security Policy

We take the security of DreamWebApp Community Edition seriously. If you discover a vulnerability, please report it responsibly by following this policy.

---

## Supported Versions

Only the latest release on the `main` branch receives security updates.

| Version | Supported |
| :--- | :--- |
| `0.1.x` / `main` | :white_check_mark: |
| Older releases | :x: |

---

## Reporting a Vulnerability

> [!WARNING]
> **DO NOT** report security vulnerabilities via public GitHub issues, discussions, or pull requests.

To report a vulnerability:
1. Contact the maintainers privately via email: `security@example.com` *(or use GitHub Private Vulnerability Reporting once published)*.
2. Include a detailed description of the issue:
   - Type of vulnerability (e.g. CSRF, XSS, SSRF, Auth bypass, Token validation).
   - Affected files, endpoints, and line numbers.
   - Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
   - Potential impact of exploitation.
3. **Never include real production credentials, real API tokens, or actual user data in your report.** Use clearly dummy placeholders.

---

## Disclosure Process

- Maintainers will acknowledge receipt within **48 hours**.
- We will provide an assessment and timeline for a patch.
- Once fixed, a security advisory and updated release will be published.
- Credit will be given to the reporter (if desired).
