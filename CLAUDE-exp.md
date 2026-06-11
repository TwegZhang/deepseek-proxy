# CLAUDE-exp.md — Universal AI-Assisted Development Playbook

Lessons learned from hands-on vibe coding. Copy this into any project's CLAUDE.md or reference it as a standalone guide. It gives actionable guidance to both the human developer and the AI agent.

---

## 1. Project Kickoff

### Developer

**Declare constraints in the first message.** Before any code is written:
- Non-goals: no databases, no Redis, no cloud, localhost only
- Tech preferences: Express, TypeScript, zero-deps
- Deployment model: single binary, Docker, static site
- Team size: solo, small team, public

Example: *"Solo project. No databases. No Redis. Config through .env only. HTTP only. Keep it as simple as possible."*

**Describe specific use cases, not abstract features.** Instead of "image recognition," say "user pastes a screenshot → agent sends base64 to vision model → returns text description."

**State non-goals explicitly.** Features you do NOT want prevent the agent from over-engineering.

### Agent

When receiving a brief, ask clarifying questions before designing:
- "Is this for personal use or a team?"
- "Any infrastructure I should avoid?"
- "Should I favor simplicity over extensibility?"

Default to the simplest viable architecture unless told otherwise.

---

## 2. Architecture Decisions

### Developer

**Use the "single-user heuristic."** Solo project → one file per concern, zero abstraction layers without 2+ concrete instances, config in env vars.

**When you see over-engineering, say it immediately:**
- "Is there a simpler way?"
- "That seems like over-engineering for a solo project."
- "Can this be one file instead of three?"

**Make architecture calls yourself.** The agent presents tradeoffs but doesn't know your taste. "Put everything in .env" is faster than iterating through designs.

### Agent

**Match abstraction level to project scale:**
- 1 dev · 1 provider · 1 deployment → no abstractions
- 1+ devs · 2+ providers → interfaces
- Team · multi-cloud → plugin/strategy patterns

**Before adding any abstraction, ask:** Are there currently 2+ concrete implementations? If not, skip it.

**Proactively suggest:** "This design has 3 layers. For a solo project, would 1 layer work?"

---

## 3. Debugging Workflow

### The 3-Round Rule

After 3 rounds of "add log → deploy → check → repeat" without locating the bug, **stop and switch methods:**

- Write a standalone test script that isolates the dependency
- Compare raw request/response at each layer boundary
- Binary-search disable middleware to find the breaking one
- Reduce to minimal reproduction

### Independent Test Scripts

For any external dependency (API, DB, filesystem), write a standalone script that tests ONLY that dependency. Do not debug through framework code.

Template: read config → make the call → dump request/response to file → analyze.

### Evidence-First Principle

Every technical conclusion must cite a specific log line, code line, or doc reference. If the agent claims something without evidence: **"What line proves that?"**

### Developer

- After 3 incremental debugging rounds: "Write a standalone test script instead."
- Challenge unsupported claims: "How do you know? Show me the log."
- If the agent keeps saying "add another log," redirect to a faster method.

### Agent

- Trace data flow from the outermost layer inward. Log at each boundary.
- After 3 rounds without resolution, suggest an alternative approach.
- Never present speculation as fact. "I need more data — let me write a test."

---

## 4. Code Review

### Developer

Launch 3 parallel review agents for comprehensive coverage:
- **Reuse**: Duplicated patterns, missing shared utilities
- **Quality**: Unsafe casts, dead code, error swallowing
- **Efficiency**: Hot-path bloat, memory leaks, missed concurrency

Fix HIGH severity immediately. MEDIUM/LOW can be deferred.

### Agent

When launching parallel agents, **verify all were created.** It's easy to claim "three running" but only dispatch one. Count before moving on.

Always check for:
1. Duplicate code (especially across adapters/providers)
2. Unsafe type assertions
3. Error swallowing (empty catch, `.catch(() => "")`)
4. Debug logs left at WARN or INFO
5. Dead code (unused imports, unreachable branches, orphaned config)

---

## 5. Context Management

### Developer

**Checkpoint after each phase.** Commit code, save session summary, push. These are restore points.

**End sessions before context degrades.** Signs of fatigue:
- Agent forgets earlier decisions
- Agent promises parallel actions but executes only one
- Agent stuck in thought loops (1+ min with no output)
- "Churned for Xs" in logs

**Start new sessions with a brief recap:** current state, next goal, key constraints.

### Agent

**When asked to do N things in parallel, dispatch N tool calls in one message.** Verify the count.

**If blocked by a gate, retry with facts immediately — don't replan.** Pattern: blocked → state facts → retry.

---

## 6. Developer Quick Reference

| Principle | Action |
|-----------|--------|
| Constrain early | "Solo project, no DB, no Redis" |
| Describe concretely | "Paste screenshot → text → DeepSeek" not "image recognition" |
| Challenge claims | "What evidence supports that?" |
| Decide architecture | "Put it in .env" is faster than iterating |
| Push method changes | After 3 log-deploy cycles, demand a standalone test |
| Checkpoint often | Commit + session summary after each phase |
| Trust but verify | Agent code can have bugs from assumptions about data flow |

---

## 7. Agent Quick Reference

| Principle | Action |
|-----------|--------|
| Trace data flow | Log at layer boundaries before guessing root cause |
| Cite evidence | "Log line N shows X" not "I think X" |
| Verify parallelism | "3 agents" = 3 Agent() calls in one message |
| Match scale | Solo → no abstractions. Team → interfaces |
| Switch after 3 | Three rounds incremental → suggest alternative approach |
| Gate → retry | Blocked? State facts, retry. Don't replan. |
| Be honest | "Need more data" not confident speculation |

---

## 8. Anti-Patterns

### Hallucination

**Symptom**: Agent confidently asserts something without evidence. "The client strips image data when using custom endpoints."

**Fix**: Developer asks "What line proves that?" Agent preemptively cites the specific log or code path.

### Execution Gaps

**Symptom**: "Launching 3 parallel agents" but only 1 Agent() call created. Or "let me commit everything" followed by 1-minute thought loop.

**Fix**: Agent counts and verifies after claiming parallelism. Developer interrupts when seeing a mismatch.

### Dead-End Loops

**Symptom**: 4+ cycles of "add log → deploy → check → add another log" without finding the bug.

**Fix**: Agent self-checks at round 3. Developer demands a different approach at round 4.

### Over-Engineering

**Symptom**: Abstract base classes, plugin registries, config layers for one provider, one deployment, one developer.

**Fix**: Developer declares scale in first message. Agent checks "are there 2+ instances?" before adding any abstraction.

### Gate-Induced Stalling

**Symptom**: GateGuard blocks a write → agent enters long thought loop instead of retrying.

**Fix**: Blocked → state facts → retry immediately. 3-step pattern, no thinking needed.

---

## Summary

The most productive vibe coding sessions share these traits:

- **Developer**: provides constraints up front, decides architecture, challenges unsupported claims, pushes for method changes after 3+ rounds
- **Agent**: traces data flow, cites evidence, matches abstraction to scale, switches methods when stuck, never confuses speculation with fact
- **Both**: checkpoint regularly, manage context, treat long sessions as focused sprints not marathons
