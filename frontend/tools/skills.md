# Skills

OpenPocket skills are markdown documents discovered from configured source directories.

## Source Order

Loader scan order (highest priority first):

1. `workspace/skills` (`source=workspace`)
2. `OPENPOCKET_HOME/skills` (`source=local`)
3. repository `skills/` (`source=bundled`)

If multiple files have the same skill ID, first source wins.

## Discovery

- recursive scan under each source root
- include `*.md` files
- exclude `README.md`

## Skill Metadata

From each markdown file:

- `id`: file basename without `.md`
- `name`: first level-1 heading (`# ...`) if present, else `id`
- `description`: first non-empty non-heading line, truncated to 180 chars
- `source`: `workspace | local | bundled`
- `path`: absolute file path

## Injection Format

Runtime injects a summarized list into system prompt:

```text
- [workspace] Skill Name: one line description
- [local] Another Skill: one line description
```

If no skill exists, summary text is `(no skills loaded)`.

## Workspace Template

```md
# Search App

Find and open app quickly by name.

## Trigger
Use when user asks to open an app by name.

## Steps
- Open launcher
- Type app name
- Tap app icon
```

Only title and first non-heading line are parsed structurally; the rest is free-form guidance for future prompt usage.

## Generated Skills

After successful tasks, `AutoArtifactBuilder` may create:

- `workspace/skills/auto/<timestamp>-<slug>.md`

Generated file includes trigger, execution outline, final result, and source session path.
