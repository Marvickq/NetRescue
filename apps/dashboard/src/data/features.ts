export type FeatureId = 'feature-a' | 'feature-c' | 'feature-d';

export interface FeatureSection {
    id: string;
    heading: string;
    body?: string;
    bullets?: string[];
    table?: {
        columns: string[];
        rows: string[][];
    };
}

export interface Feature {
    id: FeatureId;
    index: string;
    title: string;
    tagline: string;
    heroSub: string;
    watermark: string;
    heroVideoUrl: string;
    highlights: string[];
    sections: FeatureSection[];
    researchAnchor: string[];
}

const VIDEO_URLS = {
    hero: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_083515_290e5a10-0b95-41af-a5e2-32b6389baa4d.mp4',
    cinematic: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_092455_089c54f8-3b03-4966-9df1-e9746063d0ef.mp4',
    metrics: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_095810_ecea3dd2-fc5e-4e41-8696-4219290b6589.mp4',
    features: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_095750_32a52ce0-2005-45c9-9093-41f03fde9530.mp4',
    footer: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_080203_fd7f4f85-3a86-4837-8192-85e7bfe68e75.mp4',
};

export { VIDEO_URLS };

export const features: Feature[] = [
    {
        id: 'feature-a',
        index: 'A',
        title: 'Hysteresis Recovery',
        tagline: 'Three-state detection with a dead band that eliminates route flapping.',
        heroSub: 'Maintain overlay connectivity when a forwarding process or link becomes unavailable, while avoiding route flapping caused by oscillation around a single detection threshold.',
        watermark: 'A',
        heroVideoUrl: VIDEO_URLS.cinematic,
        highlights: [
            'Three-state hysteresis: HEALTHY → SUSPECT → FAILED with configurable dead band',
            'Peer-reviewed: based on Maltz thesis (CMU) §7.6.1 and VNT control literature',
            'Route flap reduction ≥ 50% at hysteresis ratio ≥ 2.0',
        ],
        sections: [
            {
                id: 'purpose',
                heading: 'Purpose',
                body: 'Maintain overlay connectivity when a forwarding process or configured link becomes unavailable, while avoiding route flapping caused by oscillation around a single detection threshold. Naïve threshold detection declares a link healthy above a threshold and failed below it. When quality oscillates around that threshold, the system repeatedly declares failure and recovery, causing routing instability.',
            },
            {
                id: 'specification',
                heading: 'Specification',
                body: 'The hysteresis state machine uses two distinct thresholds: a lower threshold to enter the failed state, and a higher threshold to return to the healthy state. The gap between them is a dead band that absorbs oscillations.',
                table: {
                    columns: ['Transition', 'Condition', 'Default'],
                    rows: [
                        ['HEALTHY → SUSPECT', 'Consecutive missed heartbeats ≥ F_thresh', '3'],
                        ['SUSPECT → FAILED', 'Consecutive missed heartbeats ≥ N', '5'],
                        ['FAILED → HEALTHY', 'Consecutive successful heartbeats ≥ R_thresh', '5'],
                        ['Dead band', 'R_thresh > F_thresh', 'ratio ≥ 1.5'],
                    ],
                },
                bullets: [
                    'No direct HEALTHY ↔ FAILED transitions; all transitions pass through SUSPECT',
                    'F_thresh, N, R_thresh, and heartbeat interval are configurable at run start',
                    'hysteresis_ratio = R_thresh / F_thresh is a primary experimental variable',
                    'Optional EWMA filter on heartbeat quality to accelerate convergence',
                    'Hop limits, route versioning, and stale-route rejection prevent loops',
                ],
            },
            {
                id: 'acceptance',
                heading: 'Acceptance Criteria',
                bullets: [
                    'With an alternate route, traffic resumes after a forwarding process is terminated',
                    'Without an alternate route, the system reports unreachable rather than claiming recovery',
                    'Repeated fail/restart tests do not create a persistent forwarding loop',
                    'Sweep hysteresis_ratio ∈ {1.0, 1.5, 2.0, 2.5, 3.0} produces a trade-off curve between route flap count and recovery time',
                    'Recovery time and sent/received message counts are recorded per run',
                ],
            },
            {
                id: 'research',
                heading: 'Research Anchor',
                body: 'The hysteresis approach is grounded in peer-reviewed research on overlay and ad hoc network routing stability.',
            },
        ],
        researchAnchor: [
            'Maltz thesis (CMU), §7.6.1 — Route hysteresis for ad hoc/overlay networks',
            'VNT control literature — Two-state utilization hysteresis',
            'Overlay routing stability research — Hysteresis-based layered traffic engineering',
        ],
    },
    {
        id: 'feature-c',
        index: 'C',
        title: 'Multipath Transfer',
        tagline: 'DB-DSP scheduling and RTX-CL retransmission across heterogeneous paths.',
        heroSub: 'Transfer a file in chunks across multiple logical overlay paths, reconstruct it, verify integrity, and compare research-proven scheduling algorithms against baselines.',
        watermark: 'C',
        heroVideoUrl: VIDEO_URLS.metrics,
        highlights: [
            'DB-DSP delay-based scheduling with EWMA smoothing on forward-delay and throughput',
            'RTX-CL retransmission: selects path by cwnd + loss, not delay alone',
            'SHA-256 verified integrity. Bounded failure — no silent data corruption',
        ],
        sections: [
            {
                id: 'purpose',
                heading: 'Purpose',
                body: 'Transfer a file in chunks across multiple logical overlay paths, reconstruct it, verify integrity, and compare a research-proven delay-based scheduler (DB-DSP) and retransmission policy (RTX-CL) against baselines under identical emulated conditions.',
            },
            {
                id: 'specification',
                heading: 'Specification',
                body: 'The DB-CMT approach addresses out-of-order arrival with three components: DB-DSP (delay-based scheduling), RTX-CL (loss-and-delay-aware retransmission), and DB-FRP (fast retransmission).',
                table: {
                    columns: ['Variant', 'Rule', 'Role'],
                    rows: [
                        ['DB-DSP', 'Send on path minimising estimated arrival time', 'Primary algorithm'],
                        ['Round-Robin', 'Cycle chunks across paths in order', 'Naïve baseline'],
                        ['Weighted RR', 'Allocate proportional to bandwidth', 'Bandwidth-aware baseline'],
                        ['Single-Path TCP', 'Use only lowest-RTT path', 'Lower bound'],
                        ['Naïve Delay-Aware', 'Use only forward delay, ignore throughput', 'DB-DSP ablation'],
                    ],
                },
                bullets: [
                    'Estimate forward delay FD_i from RTT; smooth with EWMA',
                    'Estimate throughput TP_i from cwnd_i / RTT_i; smooth with EWMA',
                    'RTX-CL: on retransmission, select path with larger cwnd when delays are similar',
                    'Bounded retry policy per chunk and per transfer',
                    'Path failure → remove from candidate set and re-route in-flight chunks',
                ],
            },
            {
                id: 'acceptance',
                heading: 'Acceptance Criteria',
                bullets: [
                    'SHA-256 match between source and receiver on successful transfer',
                    'Missing, duplicate, and out-of-order chunks handled per documented protocol',
                    'Interrupting one path does not corrupt the file',
                    'DB-DSP achieves ≤ 50% out-of-order count vs round-robin under 5:1 heterogeneity',
                    'RTX-CL achieves ≤ 90% of RTX-CWND transfer time under 5% loss',
                    'All comparison runs repeated ≥ 5 times with median and p95 reported',
                ],
            },
            {
                id: 'research',
                heading: 'Research Anchor',
                body: 'DB-CMT is a peer-reviewed multipath transfer protocol with delay-based scheduling validated in simulation.',
            },
        ],
        researchAnchor: [
            'Verma et al., J. Network and Systems Management, 2022 — DB-CMT / DB-DSP / RTX-CL',
            'CMT-SCTP literature — Delay-based chunk scheduling reduces reordering',
            'Liu et al., IEEE, 2008 — Receive buffer blocking',
        ],
    },
    {
        id: 'feature-d',
        index: 'D',
        title: 'Network Emulation',
        tagline: 'Kernel-level delay, jitter, loss, and rate control via tc/netem.',
        heroSub: 'Reproduce network conditions using the Linux kernel\'s tc/netem facility and serve as the controlled experimental apparatus for Features A and C.',
        watermark: 'D',
        heroVideoUrl: VIDEO_URLS.features,
        highlights: [
            'Linux tc/netem: kernel-level delay, jitter, loss, duplication, corruption, reordering',
            'Deterministic reproducibility with fixed seed; config hashed and verified per run',
            'Hysteresis sweep harness and scheduler comparison harness built in',
        ],
        sections: [
            {
                id: 'purpose',
                heading: 'Purpose',
                body: 'Independently measure network behaviour under configurable conditions, and serve as the controlled experimental apparatus for Features A and C. Emulation is performed by the Linux kernel\'s tc/netem queue discipline, the standard tool for protocol testing under emulated real-world conditions.',
            },
            {
                id: 'specification',
                heading: 'Specification',
                body: 'All 9 tc/netem emulation parameters are configurable per-path, per-run. Emulation must be deterministic when a fixed seed is supplied.',
                table: {
                    columns: ['Condition', 'tc/netem Parameter', 'Notes'],
                    rows: [
                        ['Delay', 'delay TIME [JITTER [CORRELATION]]', 'Milliseconds; supports multiple distributions'],
                        ['Loss', 'loss random PERCENT [CORRELATION]', 'Gilbert-Elliot model for correlated loss'],
                        ['Duplication', 'duplicate PERCENT', 'Stress testing'],
                        ['Corruption', 'corrupt PERCENT', 'Simulates bit errors'],
                        ['Reordering', 'reorder PERCENT [gap DISTANCE]', 'Out-of-order delivery'],
                        ['Rate Limit', 'rate RATE', 'Token bucket rate limiting'],
                        ['Queue Depth', 'limit COUNT', 'Max packets in qdisc queue'],
                        ['Seed', 'seed VALUE', 'Deterministic emulation'],
                    ],
                },
                bullets: [
                    'Fault injection: kill node, drop link, delay link, rate-limit link',
                    'Hysteresis sweep harness: run recovery scenario with ratio ∈ {1.0 … 3.0}',
                    'Scheduler comparison harness: run same transfer with each scheduler variant',
                    'Emulation config verified and hashed before each run',
                    'tc/netem requires CAP_NET_ADMIN — documented setup for Linux / WSL2',
                ],
            },
            {
                id: 'acceptance',
                heading: 'Acceptance Criteria',
                bullets: [
                    'Repeatable scenarios with same configuration and seed',
                    'Reports include units, workload, repetition count, environment, and limitations',
                    'Benchmarking works independently without other feature modules',
                    'Hysteresis sweep harness produces documented trade-off curve',
                    'Scheduler comparison harness produces complete comparison table',
                    'Measured values within ≤ 10% of configured tc/netem values',
                ],
            },
            {
                id: 'research',
                heading: 'Research Anchor',
                body: 'tc/netem is the standard Linux facility for protocol testing under emulated network conditions, used extensively in published TCP and routing research.',
            },
        ],
        researchAnchor: [
            'Linux tc-netem(8) man page — Standard network emulation facility',
            'TCP BBR / VM research — Emulation in protocol performance testing',
            'GitHub projects — Docker bridge tc/netem on veth interfaces',
        ],
    },
];

export const getFeature = (id: string): Feature | undefined =>
    features.find(f => f.id === id);

export const getAdjacent = (id: string) => {
    const i = features.findIndex(f => f.id === id);
    return {
        prev: i > 0 ? features[i - 1] : null,
        next: i >= 0 && i < features.length - 1 ? features[i + 1] : null,
    };
};
