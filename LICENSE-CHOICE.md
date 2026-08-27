# Open Source License Selection Guide

> [!IMPORTANT]
> **RELEASE GATE**: A public push is **BLOCKED** until the repository owner selects and adds a final `LICENSE` file.
> This repository candidate does not silently assume a license on the owner's behalf.

Before publishing this repository publicly, choose and commit an open source license that aligns with your distribution and IP goals.

---

## Comparison of Recommended Open Source Licenses

| License | Type | Commercial Use | Patent Protection | Copyleft Requirement | Best Suited For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Apache-2.0** *(Recommended)* | Permissive | Allowed | **Explicit** patent grant | None | Maximum adoption with strong patent risk mitigation. |
| **MIT** | Permissive | Allowed | Implicit / None | None | Absolute simplicity and minimal restriction. |
| **AGPL-3.0** | Strong Network Copyleft | Allowed (with source disclosure) | Explicit | **Mandatory** source disclosure for hosted/network services | Preventing closed-source SaaS competitors from hosting your code without sharing changes. |
| **GPL-3.0** | Standard Copyleft | Allowed (with source disclosure) | Explicit | Mandatory source disclosure for distributed binaries/code | Traditional distributed software derivatives. |

---

## Summary of Options

### 1. Apache License 2.0 (Recommended for Community Platforms)
- **Permissions**: Commercial use, modification, distribution, private use.
- **Conditions**: License and copyright notice preservation, state changes made to files.
- **Key Advantage**: Includes an explicit contributor grant of patent rights and protects users against patent litigation.

### 2. MIT License
- **Permissions**: Commercial use, modification, distribution, sublicensing, private use.
- **Conditions**: License and copyright notice preservation.
- **Key Advantage**: Extremely simple, well understood across the software industry.

### 3. GNU Affero General Public License v3.0 (AGPL-3.0)
- **Permissions**: Commercial use, modification, distribution.
- **Conditions**: Anyone offering modified versions over a network (e.g. SaaS) must release the complete corresponding source code under AGPL-3.0.
- **Key Advantage**: Protects the core project from being closed-sourced and hosted as a commercial cloud service without contributing modifications back.

---

## Action Required to Unblock Release

1. Select your preferred license.
2. Create a `LICENSE` file in the root directory containing the official license text from [choosealicense.com](https://choosealicense.com/).
3. Remove this `LICENSE-CHOICE.md` file (or keep it as an archive).
4. Commit the new `LICENSE` file.
