import type { JARVISPluginApi } from "jarvis/plugin-sdk";
import { emptyPluginConfigSchema } from "jarvis/plugin-sdk";
import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: JARVISPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
