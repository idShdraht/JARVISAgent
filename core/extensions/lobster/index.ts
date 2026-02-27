import type {
  AnyAgentTool,
  JARVISPluginApi,
  JARVISPluginToolFactory,
} from "../../src/plugins/types.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: JARVISPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as JARVISPluginToolFactory,
    { optional: true },
  );
}
