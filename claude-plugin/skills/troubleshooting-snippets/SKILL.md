---
name: troubleshooting-snippets
description: Diagnoses and resolves snip CLI issues. Use when snip commands fail, the snippet library has problems, qmd search is broken, or the user reports errors with their snippet setup.
---

# Troubleshooting Snippets

## Diagnostic Workflow

1. **Run health check first**: `snip doctor`
2. **Check configuration**: `snip config --json`
3. **Verify library exists**: Check the path from config exists and contains .md files
4. **Test basic operations**: `snip list`, `snip tags`

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Library not found" | No init or bad path | `snip init` or fix `snip config library.path` |
| "qmd not found" | qmd not installed | Install qmd, then `snip doctor` |
| Search returns nothing | Index stale or empty | Re-index with `snip doctor` |
| "No LLM provider available" | No provider configured/running | Start Ollama, set an API key (`snip config:llm:key`), or use `--no-enrich` |
| "Invalid provider" error | Typo in `--provider` flag | Check spelling; valid values: ollama, gemini, gemini-cli, claude, claude-cli, openai, openai-cli, auto |
| Enrichment hangs | Provider API unresponsive | Requests timeout after 45s; try a different provider with `--provider` |
| Enrichment returns empty | API key invalid or quota exceeded | Verify key with `snip config:llm`, check provider dashboard for quota |
| Wrong provider used | Auto mode picks unexpected provider | Check chain order with `snip config:llm`; set explicit provider with `snip config:llm:provider <name>` |
| Import fails | Bad URL or file path | Check path exists, URL is accessible |
| Completions not working | Shell config stale | `snip install completions zsh` |

## Escalation

If `snip doctor` passes but issues persist:
1. Check `snip config --json` for unexpected values
2. Inspect a failing snippet file directly with `cat`
3. Try `snip list --json` to see if the issue is display vs data
