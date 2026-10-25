/**
 * api.ts — the only place the diagnostics lab talks to the backend.
 *
 * The same two rules the other labs follow: a panel is only populated from a
 * response the backend actually returned, and an error carries the server's own
 * explanation rather than a generic message. Nothing here invents a latency, a
 * packet-loss figure or a "healthy" verdict.
 */
import type {
    BaselineComparison,
    DiagnosticsRun,
    DiagnosticsStatus,
    DnsResult,
    FaultScenarioResult,
    FeatureBPair,
    HysteresisSweep,
    IpConfigurationResult,
    PingResult,
    RunComparison,
    RunHistory,
    SchedulerComparison,
    ScenariosResponse,
    TracerouteResult,
} from './types';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(
    /\/$/,
    '',
);

export const API_BASE = RAW_BASE;
const IS_RELATIVE_BASE = RAW_BASE.startsWith('/');

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly detail?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

function authHeaders(): Record<string, string> {
    // Diagnostics read the host's real network and start benchmarks, so the lab
    // asks for the operator role explicitly rather than a read-only default.
    return {
        'X-NetRescue-Principal': import.meta.env.VITE_PRINCIPAL ?? 'diagnostics-lab',
        'X-NetRescue-Role': import.meta.env.VITE_ROLE ?? 'operator',
    };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await send(path, init);
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }
    if (!response.ok) throw new ApiError(describe(payload), response.status, payload);
    return payload as T;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
    try {
        return await fetch(`${RAW_BASE}${path}`, {
            ...init,
            headers: {
                ...authHeaders(),
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...(init.headers as Record<string, string> | undefined),
            },
        });
    } catch (cause) {
        const crossOrigin = !IS_RELATIVE_BASE && window.location.origin !== new URL(RAW_BASE).origin;
        throw new ApiError(
            crossOrigin
                ? `The request was blocked before it reached the API. The API allows ` +
                  `loopback origins by default and this page is served from ${window.location.origin}.`
                : `Could not reach the NetRescue API at ${RAW_BASE}. Start it with: ` +
                  `uvicorn apps.api.main:app --host 127.0.0.1 --port 8000`,
            0,
            cause,
        );
    }
}

function describe(payload: unknown): string {
    const detail =
        payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail: unknown }).detail
            : payload;

    // The diagnostics router returns { error, kind, hint } so the operator reads
    // the specific reason ("ping is not available here") and what to do about it.
    if (detail && typeof detail === 'object') {
        const d = detail as Record<string, unknown>;
        if (typeof d.error === 'string') {
            return d.hint ? `${d.error} ${String(d.hint)}` : d.error;
        }
        if ('message' in d) return String(d.message);
    }
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
        return detail
            .map((d) => (typeof d === 'object' && d && 'msg' in d ? String(d.msg) : String(d)))
            .join('; ');
    }
    return 'The request failed.';
}

export interface RunBody {
    target?: string;
    count?: number;
    timeout_s?: number;
    include_traceroute?: boolean;
    max_hops?: number;
    trace_timeout_s?: number;
    include_adapters?: boolean;
    dns_name?: string;
    dns_timeout_s?: number;
}

export interface BenchmarkBody {
    target: string;
    count: number;
    timeout_s: number;
    repetitions: number;
    interval_s?: number;
    label?: string;
}

export interface FaultBody {
    scenario: string;
    seed?: number;
    count?: number;
    repetitions?: number;
    timeout_s?: number;
    latency_ms?: number;
    jitter_ms?: number;
    loss_rate?: number;
    period?: number;
    target?: string;
}

export const diagnosticsApi = {
    status: () => request<DiagnosticsStatus>('/api/diagnostics/status'),

    scenarios: () => request<ScenariosResponse>('/api/diagnostics/scenarios'),

    network: () =>
        request<{ adapters: import('./types').AdaptersResult; ip_configuration: IpConfigurationResult }>(
            '/api/diagnostics/network',
        ),

    ping: (body: { target: string; count?: number; timeout_s?: number; size_bytes?: number }) =>
        request<PingResult>('/api/diagnostics/ping', { method: 'POST', body: JSON.stringify(body) }),

    traceroute: (body: { target: string; max_hops?: number; timeout_s?: number }) =>
        request<TracerouteResult>('/api/diagnostics/traceroute', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    dns: (body: { name: string; server?: string; timeout_s?: number }) =>
        request<DnsResult>('/api/diagnostics/dns', { method: 'POST', body: JSON.stringify(body) }),

    run: (body: RunBody = {}) =>
        request<DiagnosticsRun>('/api/diagnostics/run', { method: 'POST', body: JSON.stringify(body) }),

    benchmark: (body: BenchmarkBody) =>
        request<DiagnosticsRun>('/api/diagnostics/benchmarks', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    faults: (body: FaultBody) =>
        request<FaultScenarioResult>('/api/diagnostics/faults', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    hysteresisSweep: (body: {
        ratios?: number[];
        f_thresh?: number;
        repetitions?: number;
        seed?: number;
        total_intervals?: number;
    } = {}) =>
        request<HysteresisSweep>('/api/diagnostics/hysteresis-sweep', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    schedulerComparison: (body: {
        paths?: { path_id: string; fd_ms: number; tp_bps: number; loss_rate: number; cwnd_bytes?: number }[];
        payload_bytes?: number;
        chunk_size_bytes?: number;
        repetitions?: number;
        variants?: string[];
        retransmit_policies?: string[];
        seed?: number;
    } = {}) =>
        request<SchedulerComparison>('/api/diagnostics/scheduler-comparison', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    history: (limit = 50) => request<RunHistory>(`/api/diagnostics/runs?limit=${limit}`),

    runDetail: (id: string) =>
        request<DiagnosticsRun>(`/api/diagnostics/runs/${encodeURIComponent(id)}`),

    compare: (runIds: string[]) =>
        request<RunComparison>('/api/diagnostics/runs/compare', {
            method: 'POST',
            body: JSON.stringify({ run_ids: runIds }),
        }),

    clearHistory: () =>
        request<{ removed: number; count: number }>('/api/diagnostics/runs', { method: 'DELETE' }),

    baselineCapture: (body: {
        phase: 'before' | 'after';
        target?: string;
        count?: number;
        timeout_s?: number;
        repetitions?: number;
        label?: string;
    }) =>
        request<DiagnosticsRun>('/api/diagnostics/integrations/feature-a/capture', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    baselineCompare: (before: string, after: string) =>
        request<BaselineComparison>('/api/diagnostics/integrations/feature-a/compare', {
            method: 'POST',
            body: JSON.stringify({ before_run_id: before, after_run_id: after }),
        }),

    featureBPair: (diagnosticsRunId: string, transfer: Record<string, unknown>) =>
        request<FeatureBPair>('/api/diagnostics/integrations/feature-b', {
            method: 'POST',
            body: JSON.stringify({ diagnostics_run_id: diagnosticsRunId, transfer }),
        }),

    /** The server streams the export body; read it as text and hand it to a download. */
    exportRun: async (id: string, format: 'json' | 'csv') => {
        const response = await send(
            `/api/diagnostics/runs/${encodeURIComponent(id)}/export?format=${format}`,
        );
        if (!response.ok) {
            let payload: unknown = null;
            try {
                payload = await response.json();
            } catch {
                /* an unparseable error body is not worth a second failure */
            }
            throw new ApiError(describe(payload), response.status, payload);
        }
        return { filename: `${id}.${format}`, content: await response.text() };
    },
};

/** Hand generated content to the browser as a real download. */
export function downloadText(filename: string, content: string, mime = 'text/plain') {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
