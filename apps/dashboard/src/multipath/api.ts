/**
 * api.ts — the only place the transfer lab talks to the backend.
 *
 * The file the browser picks is read with FileReader and sent as base64 to the
 * backend, which chunks it, schedules it and hashes it. Nothing here fabricates
 * a progress value: a chunk is shown as delivered because the backend said so,
 * and a transfer is shown as verified because the two SHA-256 values the backend
 * computed matched.
 */
import type {
    LabCapabilities,
    LabState,
    PathInput,
    SchedulerComparison,
    VariantComparison,
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
    // The lab uploads files and starts transfers, so it asks for the operator
    // role explicitly rather than inheriting a read-only default.
    return {
        'X-NetRescue-Principal': import.meta.env.VITE_PRINCIPAL ?? 'multipath-lab',
        'X-NetRescue-Role': import.meta.env.VITE_ROLE ?? 'operator',
    };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${RAW_BASE}${path}`, {
            ...init,
            headers: {
                ...authHeaders(),
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...(init.headers as Record<string, string> | undefined),
            },
        });
    } catch (cause) {
        const crossOrigin =
            !IS_RELATIVE_BASE && window.location.origin !== new URL(RAW_BASE).origin;
        throw new ApiError(
            crossOrigin
                ? `The request was blocked before it reached the API. The API allows ` +
                  `loopback origins by default and this page is served from ` +
                  `${window.location.origin}.`
                : `Could not reach the NetRescue API at ${RAW_BASE}. Start it with: ` +
                  `uvicorn apps.api.main:app --host 127.0.0.1 --port 8000`,
            0,
            cause,
        );
    }

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

function describe(payload: unknown): string {
    const detail =
        payload && typeof payload === 'object' && 'detail' in payload
            ? (payload as { detail: unknown }).detail
            : payload;

    if (detail && typeof detail === 'object' && 'message' in detail) {
        return String((detail as { message: unknown }).message);
    }
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
        return detail
            .map(d =>
                typeof d === 'object' && d && 'msg' in d ? String(d.msg) : String(d),
            )
            .join('; ');
    }
    return 'The request failed.';
}

export interface UploadBody {
    filename: string;
    data_b64: string;
    chunk_size_bytes: number;
    paths: PathInput[];
    scheduler_variant: string;
    retransmit_policy: string;
    max_retries: number;
    seed?: number | null;
}

export const xferApi = {
    state: () => request<LabState>('/api/xfer/state'),

    capabilities: () => request<LabCapabilities>('/api/xfer/variants'),

    upload: (body: UploadBody) =>
        request<LabState>('/api/xfer/upload', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    start: (body: Partial<{
        scheduler_variant: string;
        retransmit_policy: string;
        chunk_size_bytes: number;
        max_retries: number;
        seed: number;
        paths: PathInput[];
    }> = {}) =>
        request<LabState>('/api/xfer/start', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    cancel: () => request<LabState>('/api/xfer/cancel', { method: 'POST' }),

    reset: () => request<LabState>('/api/xfer/reset', { method: 'POST' }),

    events: () =>
        request<{ events: import('./types').LabEvent[]; count: number }>('/api/xfer/events'),

    clearEvents: () => request<LabState>('/api/xfer/events/clear', { method: 'POST' }),

    compareSchedulers: (body: {
        workload: Record<string, number>;
        link: Record<string, number>;
    }) =>
        request<SchedulerComparison>('/api/xfer/schedulers/compare', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    compareVariants: (body: {
        paths: PathInput[];
        payload_bytes: number;
        chunk_size_bytes: number;
        repetitions: number;
        variants: string[];
        retransmit_policies: string[];
        seed?: number;
    }) =>
        request<VariantComparison>('/api/xfer/variants/compare', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    exportLog: (fmt: 'json' | 'csv') =>
        request<{ filename: string; content: string; rows?: number }>(
            `/api/xfer/export?fmt=${fmt}`,
        ),

    /** The reconstructed payload, fetched as bytes rather than JSON. */
    download: async () => {
        const response = await fetch(`${RAW_BASE}/api/xfer/download`, {
            headers: authHeaders(),
        });
        if (!response.ok) {
            let detail: unknown = null;
            try {
                detail = await response.json();
            } catch {
                /* a body we cannot parse is not worth a second failure */
            }
            throw new ApiError(describe(detail), response.status, detail);
        }
        return {
            blob: await response.blob(),
            filename: filenameFrom(response.headers.get('Content-Disposition')),
            sourceSha256: response.headers.get('X-NetRescue-Source-Sha256') ?? '',
            reconstructedSha256:
                response.headers.get('X-NetRescue-Reconstructed-Sha256') ?? '',
        };
    },
};

/**
 * The server names the download from the transfer id, never from the uploaded
 * file's name. Parsing it is only a convenience for the browser's save dialog.
 */
function filenameFrom(disposition: string | null): string {
    const match = disposition?.match(/filename="([^"]+)"/);
    return match ? match[1] : 'reconstructed.bin';
}

/** Read a File as base64 so the backend receives the real bytes. */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.onload = () => {
            const result = reader.result as string;
            // strip "data:...;base64,"
            resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.readAsDataURL(file);
    });
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
    downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}