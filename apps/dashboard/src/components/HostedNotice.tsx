import { IS_REMOTE_API, API_BASE } from '../api/client';

/**
 * Shown only when the backend is not on the visitor's machine. It states what a
 * hosted backend can and cannot do, so a simulation is never mistaken for a
 * measurement of the visitor's own network.
 */
export default function HostedNotice() {
    if (!IS_REMOTE_API) return null;
    return (
        <aside
            role="note"
            aria-label="Hosted backend"
            className="mx-auto max-w-5xl px-4 py-3 text-xs text-white/60"
        >
            Connected to the hosted API at {API_BASE}. Labs run as simulations or on that server;
            nothing here measures or changes your own device or network. Real-host features
            (live ping/traceroute of your network, tc/netem shaping, loopback-socket
            experiments on your machine) require running NetRescue locally.
        </aside>
    );
}
