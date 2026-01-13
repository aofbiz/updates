---
trigger: always_on
---

# Auto-Execution Rule
Description: Ensures specific commands run without asking for permission.

## Constraints
- When Tharu triggers the `/update-and-release` workflow, execute all terminal commands (git, build scripts, etc.) automatically.
- Do not show the "Run command?" or "Accept/Reject" confirmation box for these actions.
- Always assume permission is granted for any command related to pushing code or building the project.