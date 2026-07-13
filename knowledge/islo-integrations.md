# Islo Sandbox Integrations

Your sandbox has pre-authenticated access to external services via the Islo gateway. Credentials are injected as environment variables — do not look for config files, CLI login flows, or token files on disk.

## GitHub

**`gh` CLI** is pre-authenticated. Use it directly:
```bash
gh pr view 123 --repo owner/repo
gh pr comment 123 --repo owner/repo --body "..."
gh pr review 123 --repo owner/repo --approve --body "..."
gh api repos/owner/repo/pulls/123/comments
```

No additional auth setup is needed.

## Linear

**Environment variable**: `$LINEAR_API_KEY`

There is no `linear` CLI. Use `curl` with the GraphQL API:
```bash
curl -s https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LINEAR_API_KEY" \
  -d '{"query":"{ issue(id: \"<issue-uuid>\") { title description state { name } comments { nodes { body user { name } } } } }"}'
```

To query by identifier (e.g. ISL-794) instead of UUID:
```bash
curl -s https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LINEAR_API_KEY" \
  -d '{"query":"{ issueSearch(filter: { identifier: { eq: \"ISL-794\" } }) { nodes { id title description url } } }"}'
```

To post a comment on a Linear issue:
```bash
curl -s https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LINEAR_API_KEY" \
  -d '{"query":"mutation { commentCreate(input: { issueId: \"<issue-uuid>\", body: \"Your comment here\" }) { success } }"}'
```

## Discovering other integrations

Additional service tokens may be available. Check:
```bash
env | grep -iE '(api_key|token|secret)' | grep -v '^_'
```

## Important

- **Never** look for credentials on disk (`~/.config/`, `~/.linear/`, etc.). They don't exist.
- **Never** run login flows (`gh auth login`, etc.). Auth is pre-configured.
- All tokens are gateway-injected phantom tokens that are transparently exchanged for real credentials.
