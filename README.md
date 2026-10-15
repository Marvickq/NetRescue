# NetRescue — Network Diagnostics, Failure Recovery & Reliable Transfer

**NetRescue** is a networking project that combines network diagnostics, hysteresis-based failure detection, and chunk-based multipath file-transfer experiments in a web dashboard.

The system uses real Windows network diagnostic commands alongside controlled application-level simulations to investigate network behavior, compare recovery strategies, and evaluate transfer integrity.

> **Implementation boundary:** Real network measurements, application-level simulations, and automated software tests are reported separately. NetRescue does not use Linux `tc/netem` in its Windows-native diagnostics workflow, and its logical multipath simulation does not represent independent physical network links.

## 1. Problem Statement

Network failures, fluctuating latency, packet loss, and unstable recovery decisions can interrupt communication and file transfers. Diagnosing these conditions and comparing possible responses requires more than a static network dashboard.

NetRescue provides a common interface for inspecting real network conditions, experimenting with failure-detection parameters, evaluating logical transfer schedulers, and exporting results for further analysis.

The project focuses on observable behavior and reproducible experiments rather than claiming to eliminate all network failures.

## 2. Objectives

- Diagnose network connectivity using Windows-native tools.
- Measure ICMP round-trip time and packet loss.
- Inspect DNS resolution, route traces, and network adapters.
- Investigate failure detection using heartbeat monitoring and hysteresis.
- Compare chunk-scheduling and retransmission strategies in a logical multipath transfer model.
- Verify reconstructed file integrity using SHA-256.
- Run deterministic, application-level fault simulations.
- Export benchmark results in JSON and CSV formats.
- Provide a reproducible, browser-based demonstration.

## 3. Features

### Feature 1 — Hysteresis-Based Failure Detection

**Purpose:** Reduce unstable failure-state transitions caused by temporary changes in network responsiveness.

**How it works:**
- Monitors heartbeat-related signals.
- Uses a state machine to represent network or link status.
- Applies configurable failure and recovery thresholds.
- Supports an EWMA option where enabled by the implementation.
- Provides parameter sweeps to compare detection and recovery behavior.

**Why hysteresis matters:** If failure and recovery decisions use poorly separated conditions, a connection can repeatedly switch between healthy and failed states. Hysteresis introduces different conditions for entering and leaving a failure state.

**Evaluation:** Compare the configured thresholds, state transitions, number of flaps, and recovery time under the same test conditions.

**Scope:** Reported recovery times must be identified as simulated or measured according to the experiment that produced them. A state-machine demonstration alone does not prove physical network failover.

### Feature 2 — Multipath Reliable File Transfer

**Purpose:** Experiment with splitting a file into chunks, scheduling those chunks across logical paths, reconstructing the original file, and checking integrity.

**Implemented capabilities reported:**
- File chunking and offset-based reconstruction.
- Multiple logical path profiles.
- Scheduling strategies including DB-DSP, Round Robin (RR), Weighted Round Robin (WRR), Single-Path, and Naïve Delay-Aware, where supported by the selected experiment.
- Retransmission policies, including RTX-CL and RTX-CWND.
- Transfer metrics and completion tracking.
- SHA-256 integrity verification.

**Evaluation:** Record chunk completion, out-of-order arrivals, retransmissions, completion time, and the integrity-check result.

**Important limitation:** The current implementation models logical paths using application-level scheduling and simulated delays/loss. It does not establish that traffic is transmitted over independent physical links. A scheduler that performs best in one experiment is not guaranteed to perform best under every workload.

### Feature 3 — Windows-Native Network Diagnostics & Benchmarking Lab

**Purpose:** Diagnose real network conditions and provide a repeatable environment for comparing network experiments without requiring Linux `tc/netem`.

**Components:**
- Live Network Status and DNS Resolution.
- Latency and Packet-Loss Measurement.
- Route Trace.
- Network Adapter Inspection.
- Benchmark History.
- Hysteresis Sweep.
- Scheduler Comparison.
- JSON and CSV Report Export.

**Live diagnostics:** Uses Windows-native commands for network inspection, including ping, route tracing, DNS queries, and network-adapter/gateway information.

**Application-level experiments:** Uses seeded simulations for reproducible fault scenarios and compares supported hysteresis and transfer-scheduling configurations.

**Security and reliability:** External commands are invoked using argument arrays with `shell=False`, validated inputs, and asynchronous thread offloading for blocking subprocess calls. API routes apply role-based authorization and map validation, unsupported-operation, timeout, and command failures to appropriate HTTP errors.

**Important distinction:** ICMP round-trip time is not application-response latency. ICMP may be filtered or rate-limited, and a failed ping does not by itself prove that a network link is down. Simulated results are not presented as real network measurements.

## 4. System Architecture

```text
                         User
                          |
                          v
                React + TypeScript UI
                          |
                      HTTP / JSON
                          |
                          v
                    FastAPI Backend
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
    Diagnostics       Recovery         Transfer
    & Benchmark      State Machine     & Scheduling
          |               |               |
          v               v               v
    Windows tools    Heartbeat and     Chunking,
    and real probes  hysteresis logic  reassembly,
          |               |            integrity
          v               v               v
    Real measurement  Experiment data   Transfer results
          |               |               |
          +---------------+---------------+
                          |
                          v
                History and Reports
                  JSON / CSV export
```

The diagram represents the logical software architecture. It does not imply that every component communicates over separate physical network paths.

## 5. Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend logic, diagnostics, simulation, and benchmarking |
| FastAPI | HTTP API, typed request/response schemas, and API documentation |
| Pydantic | Input validation and schema enforcement |
| React | Interactive dashboard |
| TypeScript | Frontend type checking and API data contracts |
| Vite | Frontend development server and production build |
| asyncio and subprocess | Asynchronous orchestration of supported diagnostic commands |
| SHA-256 | Checking reconstructed-file integrity |
| pytest | Automated backend and regression testing |
| SQLite/PostgreSQL or other configured database | Persistence, where enabled by the selected configuration |
| Docker | Optional containerized deployment, where configured |

Use the actual dependency and configuration files as the source of truth for database and deployment details.

## 6. Working Methodology

### Real diagnostic workflow

1. Select a supported diagnostic operation and target.
2. Validate the request.
3. Execute the appropriate Windows network command.
4. Parse the command output and collect supported measurements.
5. Return a typed API response.
6. Display the results in the dashboard and store them in bounded history where supported.
7. Export the available report.

### Simulated experiment workflow

1. Select a scenario and configuration.
2. Set a seed for reproducible simulation.
3. Execute the simulation or parameter sweep.
4. Collect state transitions, timing, and comparison metrics.
5. Inspect results in the dashboard.
6. Export the experiment results.

The two workflows must remain clearly distinguishable in the UI and reports.

## 7. Testing and Verification

The following verification results were reported for the project:

| Verification | Reported result |
|---|---|
| Full backend test suite | 402 passed |
| Feature 3 tests | Run using `pytest tests/test_diagnostics.py -v` |
| Frontend production build | TypeScript and Vite build completed successfully |
| Live API integration | Diagnostics run completed with `data_kind=real` |
| Deterministic simulation | Repeated runs with identical seeds produced matching fault behavior |
| Hysteresis sweep | Ratios from 1.0 to 3.0 observed in the reported experiment |
| Scheduler comparison | DB-DSP and RR results produced with integrity checking |
| Input validation | Injection-oriented invalid input rejected with HTTP 422 |
| Authorization | Read-only role denied a write operation with HTTP 403 |
| History and reports | History, export, and comparison paths exercised |

These are reported verification results, not a substitute for publishing reproducible logs or a test report. Re-run the tests against the committed revision before using these figures in a formal submission.

### Recommended test matrix

| Test case | Expected observation |
|---|---|
| Valid DNS query | Domain resolves when the configured resolver and network permit it |
| Unreachable or blocked ICMP target | Failure or missing replies are reported without automatically declaring the entire link down |
| Valid route trace | Route information is returned when supported |
| Invalid diagnostic input | Request is rejected with a validation error |
| Unsupported Windows operation | Clear unsupported-operation response |
| Command timeout | Timeout is reported instead of hanging indefinitely |
| Identical simulation seeds | Equivalent deterministic fault behavior |
| Different scheduling strategies | Individual results and metrics are recorded for comparison |
| File reconstruction | Integrity succeeds when the reconstructed content matches |
| Unauthorized write request | Request is rejected |
| Report export | JSON/CSV output matches the selected experiment data |

## 8. Performance Results

Performance results must include the target, configuration, repetitions, units, and whether they came from a real measurement or simulation.

### Example: Reported ICMP measurement

| Metric | Example result |
|---|---:|
| Target | `10.21.0.1` |
| Probes sent | 4 |
| Replies received | 4 |
| Packet loss | 0% |
| Minimum RTT | 1 ms |
| Average RTT | 10.50 ms |
| Maximum RTT | 35 ms |
| RTT standard deviation | 14.19 ms |

This is a small sample from one reported run, not a general performance guarantee. It shows no loss among four probes, but the observed response times varied. Repeat the measurement with a larger sample before drawing stronger conclusions.

### Example: Reported logical transfer experiment

A reported run transferred a 76,702-byte image in 19 chunks, with 19/19 chunks completed, 14 out-of-order arrivals, zero retransmissions, and a matching SHA-256 digest.

This result demonstrates successful reconstruction and integrity checking for that particular run. It does not establish a universal speed advantage over single-path transfer.

### Performance reporting rules

- Report real measurements separately from simulated values.
- State whether latency means ICMP RTT, simulated path delay, or transfer completion time.
- Include all relevant configuration parameters.
- Do not combine unrelated metrics into an undocumented overall score.
- Report failed runs and trade-offs, not only the best result.

## 9. Installation and Execution on Windows

### Prerequisites

- Windows.
- Python compatible with the dependencies in `requirements.txt`.
- Node.js and npm.
- Git, if cloning the repository.
- Access to the network targets you intend to diagnose.

### Backend

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

If the virtual environment already exists, activate it rather than recreating it.

### Frontend

Open a second terminal:

```powershell
cd apps/dashboard
npm install
npm run dev
```

Open the local URL printed by Vite. The default development URL is usually `http://localhost:5173`.

Navigate to:

`http://localhost:5173/features/feature-d`

Click **Run Diagnostics** to launch the Feature 3 workflow.

### Tests

From the repository root:

```powershell
pytest tests/test_diagnostics.py -v
pytest
```

The second command runs the full test suite. Use the same committed revision and environment when reproducing reported test totals.

## 10. API and Message Format

The backend exposes HTTP endpoints under `/api/diagnostics/`. The exact route list and schemas are defined by the committed router and can be inspected through FastAPI's API documentation.

Local API documentation:

`http://127.0.0.1:8000/docs`

The API uses JSON request and response bodies where applicable. Requests are validated, and errors are mapped to HTTP status codes.

| HTTP status | Meaning in the diagnostics API |
|---|---|
| 200 | Operation completed, including a valid ping result with zero replies |
| 403 | Authenticated role is not permitted to perform the operation |
| 422 | Invalid request or rejected input |
| 502 | Underlying diagnostic command failed |
| 503 | Requested capability is unsupported |
| 504 | Diagnostic command timed out |

Exact behavior depends on the endpoint and response schema. Consult the API definitions rather than assuming every endpoint returns the same fields.

## 11. Limitations and Scope

- The diagnostics lab uses Windows-native commands; it does not use Linux `tc/netem` to emulate kernel-level network conditions.
- The legacy Linux emulation package is retained for compatibility and is reported unavailable when its capabilities cannot be used.
- ICMP latency is not application-level latency.
- A failed ping alone does not prove that the link is down.
- Sub-millisecond measurements recorded as `0.0` are lower bounds caused by measurement resolution, not proof of zero latency.


## 12. References

Add the canonical documentation and standards that directly support the implementation:

- Python documentation: https://docs.python.org/3/
- FastAPI documentation: https://fastapi.tiangolo.com/
- React documentation: https://react.dev/

