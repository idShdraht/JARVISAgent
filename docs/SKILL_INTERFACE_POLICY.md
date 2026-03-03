# JARVIS Skill Interface Invariant Policy

## 1. Absolute ABI Compatibility
JARVIS is structurally bound to maintain 100% ABI compatibility with the upstream OpenClaw skill ecosystem.
Under no circumstances may the following be mutated natively by the JARVIS wrapper:
- `skill.json` manifest schemas
- Skill Registration API `/api/skills/register`
- The expected execution lifecycle hooks (e.g., `initialize()`, `execute()`, `terminate()`)
- Default loading resolution paths within the abstract file system

## 2. Namespace Shielding Rule
All internal default skills and capabilities distributed within JARVIS MUST strictly utilize the prefixed identifier: `jarvis.*`.
- Collisions with community generic clawhub namespaces (e.g., `system.*`, `util.*`) are strictly prohibited.
- JARVIS runtime will mechanically scan its payload on boot and exit(1) if a violation occurs.

## 3. Telemetry and Error Delegation
Skills will never fail silently. The wrapper layer acts strictly as a pass-through delegator. 
All intercepted skill errors are appended to `~/.jarvis/skill-runtime.log` with structural `skill_id` and bounded stack traces.

## 4. Permission Hardening Guards
Internal hooks are permitted ONLY to validate granted scopes versus manifest-declared scopes natively. Any deviation will prompt interactive interactive remediation (or standard CI warnings) but never silently degrade the context.
