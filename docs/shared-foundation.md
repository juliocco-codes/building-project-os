# One foundation across local agents

A user should be able to start in the same directory and obtain consistent preferences, context routing, and work records from either supported engine. That requires deliberate installation. A knowledge folder elsewhere on disk is not automatically included just because it contains an instruction file.

This guide describes a setup pattern. It includes templates, not an installer. Keep the completed personal workspace private and separate from this public repo.

## Put information in its place

| Information | Home |
| --- | --- |
| Identity, authority, writing defaults, retrieval and retention triggers | Short canonical startup instructions |
| Where relevant truth lives | Context index with source owners |
| Personal facts and approved writing examples | Private canonical domain records |
| Repeatable task procedures | Shared skills, with supporting references |
| Current work, completed effects, blockers | Existing work record and portable checkpoints |
| Historical incidents | Dated evidence linked from current documentation |

Start with [workspace/AGENTS.md](../workspace/AGENTS.md). Replace its placeholders and private-reference links with absolute locations in your private workspace. Keep always-needed rules short; read detailed examples and domain procedures only when relevant. Do not expand startup instructions into a biography or repair history.

## Install for the actual starting directory

Codex reads user guidance from `AGENTS.md` in its configured home, normally `~/.codex/AGENTS.md`, and discovers project guidance along its startup directory chain. See [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Claude Code supports user guidance at `~/.claude/CLAUDE.md` and project files; a `CLAUDE.md` can import another file with `@path`. See [Claude Code memory](https://code.claude.com/docs/en/memory).

Generate the same resolved instruction body from your canonical source into both user entry points. Preserve unrelated existing guidance when adopting the setup; never overwrite it blindly. Mark generated files with their source and a hash. Edit the source, then regenerate. A project can use the included [CLAUDE.md](../workspace/CLAUDE.md) to import its shared `AGENTS.md` instead of maintaining two versions.

Startup rules should explicitly retrieve the relevant context index and read the local instructions of a target repository before editing it. Starting from home does not imply every nested project's rules are already loaded. Keep domain rules specific rather than copying the whole foundation.

## Share skill sources

Keep each shared skill in one canonical directory. Register that directory in each engine through supported discovery mechanisms, such as per-skill symbolic links where supported. Codex documents `~/.agents/skills` and symlink support in [skills](https://learn.chatgpt.com/docs/build-skills); Claude Code documents `~/.claude/skills` in [skills](https://code.claude.com/docs/en/skills). Check installed versions and name collisions before adopting these paths.

Resolve entries to their targets and compare source hashes. Editing a linked skill updates the shared source; independent copies require regeneration. Running sessions may hold older instructions, so refresh or restart them when needed. Engine-specific plugins, hooks, connectors, permissions, and credentials do not become shared through skill text. Cloud sessions need their own installation and access.

## Preserve continuity and installation evidence

Use the same private knowledge and work records in both engines. Read the current checkpoint before resuming and verify completed side effects, especially after a timeout. See [knowledge and continuity](knowledge-and-continuity.md). Full chat histories do not automatically transfer. An interactive alternative does not establish automatic scheduler failover.

Record the reviewed source revision, generated instruction hashes, resolved skill targets, and installed files separately from observed behavior. Correct shared causes when routine use exposes omissions. Private source control preserves system definitions; personal data and operational state still need their own backups.
