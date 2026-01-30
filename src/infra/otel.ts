import type { DiagnosticsOtelConfig } from "../config/types.base.js";

export type OtelHandle = {
  shutdown: () => Promise<void>;
};

const NOOP_HANDLE: OtelHandle = { shutdown: async () => {} };

/**
 * Initialize OpenTelemetry SDK based on config.
 * Returns a handle with a shutdown method to flush and stop the SDK.
 * If OTEL is not enabled or deps are unavailable, returns a no-op handle.
 */
export async function initOtel(otelConfig: DiagnosticsOtelConfig | undefined): Promise<OtelHandle> {
  if (!otelConfig?.enabled) {
    return NOOP_HANDLE;
  }

  const endpoint = otelConfig.endpoint;
  if (!endpoint) {
    return NOOP_HANDLE;
  }

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-proto");
    const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-proto");
    const { PeriodicExportingMetricReader } = await import("@opentelemetry/sdk-metrics");
    const { TraceIdRatioBasedSampler } = await import("@opentelemetry/sdk-trace-node");

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: otelConfig.serviceName ?? "opsagent-gateway",
    });

    const headers = otelConfig.headers ?? {};

    const traceExporter =
      otelConfig.traces !== false
        ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces`, headers })
        : undefined;

    const metricReader =
      otelConfig.metrics !== false
        ? new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: `${endpoint}/v1/metrics`,
              headers,
            }),
            exportIntervalMillis: otelConfig.flushIntervalMs ?? 30_000,
          })
        : undefined;

    const sampler = new TraceIdRatioBasedSampler(otelConfig.sampleRate ?? 1.0);

    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      sampler,
    });

    sdk.start();

    return {
      shutdown: async () => {
        try {
          await sdk.shutdown();
        } catch {
          // Best-effort shutdown
        }
      },
    };
  } catch {
    // OTEL SDK not available or failed to initialize — degrade gracefully
    return NOOP_HANDLE;
  }
}
