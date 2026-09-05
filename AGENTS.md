# Repository contribution rules

This is a sanitized reference implementation. Read README.md, SYSTEM.md, and
SECURITY.md before changing its architecture or examples. Keep fictional examples
fictional and preserve the distinction between implemented helpers and production
requirements. The rules under workspace/ are templates for a user's own workspace.

This repository is public and must remain a standalone sanitized codebase. It is
not a publication remote, mirror, or branch of any private operational system.
Before every push or PR, verify this repository's root and GitHub remote, start
from its own clean public base, and inspect the complete outgoing file list and
commit ancestry.

Do not import a private operating-system repository or its Git history. Exclude
real task exports, personal context, machine paths, credentials, runtime state,
approval endpoints, and incident screenshots. Review every outgoing commit and
file, not only the final working tree.

Keep authority separate from status and automation classification. Background
execution must not require foreground navigation. Preserve independent review
and explicit authority for external effects. Do not claim a platform notification,
delivery, or merge worked without evidence for that exact operation.

Run npm test and check local documentation links. Changes to a production design
description do not imply that this repository implements its runtime adapters.
