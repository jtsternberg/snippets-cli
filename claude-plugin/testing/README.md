# Plugin Testing

## Evaluation Scenarios

`skill-evaluations.json` contains test scenarios for validating the snippets-cli plugin. Each scenario includes:

- **id**: Unique identifier
- **skills**: Which skills should activate
- **query**: User input to test with
- **expected_behavior**: Checklist of expected actions/outputs

## Testing Methodology

1. Start a fresh Claude Code session with the plugin installed
2. For each scenario, provide the `query` as user input
3. Verify that:
   - The correct skill(s) activate automatically
   - Claude follows the expected behavior checklist
   - Commands execute successfully (or fail gracefully with helpful suggestions)
   - Output is presented clearly to the user

## Running Tests

Manual evaluation — provide each query to Claude and verify behavior against expected outcomes. Score each expected_behavior item as pass/fail.
