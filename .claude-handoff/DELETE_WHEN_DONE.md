# DELETE THIS ENTIRE DIRECTORY WHEN DONE

**Created:** 2026-07-27
**Contains live HMAC secrets** — must be removed after Claude Code completes tasks.

## Cleanup steps for Claude Code

Once all three tasks are complete (see `prompts/claude_code_distribute_federation_secrets.md`):

```bash
cd <thecros repo>
git rm -r .claude-handoff/
git commit -m "chore: remove Claude Code handoff bundle (tasks completed)"
git push origin main
```

## Follow-up rotation (user should do next session)

Because these secrets were committed to Git, they remain in Git history even after
`git rm`. To fully purge:

1. Rotate all 14 federation forwarding secrets and both hub webhook secrets
2. Update Lovable env vars on thecros + 14 satellites with new values
3. Update Stripe webhook endpoints with new whsec values
4. Optionally: use `git filter-repo` to purge from history (destructive, coordinate with any collaborators)

Or accept the risk if this repo stays private, single-owner, no CI/deploy keys with read access.
