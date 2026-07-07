# Security Policy

## Supported Versions

Currently, only the latest `main` branch of the Kitsune WhatsApp Bot is supported with security updates. If you are using an older version or a detached fork, please pull the latest changes.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < `1.0` | :x:                |

## Reporting a Vulnerability

We take the security of Kitsune and the privacy of our users very seriously. 

If you discover a security vulnerability within this project, please **do not** open a public issue on GitHub. Instead, please follow these steps:

1. Send an email to the repository maintainer (or open a private security advisory if supported by the platform).
2. Include a detailed description of the vulnerability.
3. Provide step-by-step instructions to reproduce the issue.
4. If applicable, suggest a potential fix or mitigation.

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will send you regular updates about our progress.
- Once the vulnerability is resolved, we will publish a security advisory and credit you for the discovery (unless you prefer to remain anonymous).

### Scope

Please note that vulnerabilities relating to the underlying dependencies (`whatsapp-web.js`, `express`, `mongoose`, etc.) should generally be reported to their respective maintainers upstream, unless the vulnerability is caused by our specific implementation or configuration of those libraries.
