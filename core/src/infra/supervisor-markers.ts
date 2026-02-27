export const SUPERVISOR_HINT_ENV_VARS = [
  // macOS launchd
  "LAUNCH_JOB_LABEL",
  "LAUNCH_JOB_NAME",
  // JARVIS service env markers
  "JARVIS_LAUNCHD_LABEL",
  "JARVIS_SYSTEMD_UNIT",
  "JARVIS_SERVICE_MARKER",
  // Linux systemd
  "INVOCATION_ID",
  "SYSTEMD_EXEC_PID",
  "JOURNAL_STREAM",
] as const;

export function hasSupervisorHint(env: NodeJS.ProcessEnv = process.env): boolean {
  return SUPERVISOR_HINT_ENV_VARS.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
