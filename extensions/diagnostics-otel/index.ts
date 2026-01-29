import type { OpsAgentPluginApi } from "opsagent/plugin-sdk";
import { emptyPluginConfigSchema } from "opsagent/plugin-sdk";

import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpsAgentPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
