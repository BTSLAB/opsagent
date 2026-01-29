import type { OpsAgentPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: OpsAgentPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
