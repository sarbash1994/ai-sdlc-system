# GitHub Worker

The MVP worker performs:

1. clone repo
2. checkout default branch
3. pull latest
4. create branch
5. apply generated unified diffs
6. run agent-provided commands
7. commit
8. push
9. create PR

Configure with:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_DEFAULT_BRANCH`
