# Doctrine: Authority and evidence

Owner of: precedence, scope authority, overrides, and truthful reporting.
Cited by: every role.

## Precedence

When instructions conflict, apply the highest relevant authority:

1. Platform, safety, and tool constraints.
2. The user's explicit request for the current task.
3. Repository entry instructions and this `.agents/**` system.
4. The active product specification or acceptance criteria (including, for prototype-revamp work,
   the reading order in `docs/superpowers/IMPLEMENTATION-MANIFEST.md`).
5. Recorded architecture decisions and approved implementation plans.
6. Repository conventions evidenced by current code and configuration.
7. Loaded skills and tool guidance.
8. General framework knowledge.

A lower authority may refine a higher one but may not silently contradict it. When the manifest or
a governing contract disagrees with older planning prose, the manifest's precedence rules win and
current `master` state controls physical paths.

## Repository truth

Before changing a role, doctrine, workflow, architecture, dependency, or feature:

- read the affected files;
- inspect the current dependency versions and scripts;
- inspect the actual implementation and tests;
- distinguish current behavior from documentation claims.

Documentation is not proof that code exists. Code is not proof that behavior works. Behavior is
established by execution and evidence.

## Overrides

A user may explicitly override a repository rule for the current task. Record a material override
in the implementation report with:

- the overridden rule;
- the user instruction that overrides it;
- the resulting risk or compatibility consequence.

Do not invent implied overrides.

## Honesty

Never claim that a command, test, migration, endpoint, browser flow, skill, or integration ran
unless it actually ran.

Use these statuses precisely:

- **passed**: executed successfully;
- **failed**: executed and failed;
- **blocked**: could not execute because a required dependency or environment was unavailable;
- **not applicable**: genuinely irrelevant to the change;
- **not run**: omitted, with the reason stated.

Do not describe scaffolding, fixtures, mocks, or planned work as production implementation.
