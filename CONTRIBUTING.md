Thank you for taking the time to read through the Litter Networks sources. At the moment we do not have an active contribution backlog, but we are always happy to hear about bugs, security polish, or recommendations for improving the code. Please email [dev@litternetworks.org](mailto:dev@litternetworks.org) with any suggestions.

If you are touching code that ships with this repository, please include our short SPDX notice at the top of new files and scripts so a future audit tool can see the licensing information quickly. Use the following literal block:

```
Copyright 2025 Litter Networks / Clean and Green Communities CIC
SPDX-License-Identifier: Apache-2.0
```

Avoid committing any secrets (AWS keys, passwords, private PEMs, etc.); the `.gitignore` already filters `.env*`, Terraform state, OneDrive caches, and so on. If you find work that requires AWS or other infrastructure access, request it via the same email address. Access is awarded manually and for obvious reasons we do not share service credentials in the repository.
