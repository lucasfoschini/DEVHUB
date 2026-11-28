# 0007 — Local Agent inside the desktop app

Date: 2026-11-27. Status: accepted.

## Context

Phase 5 (MASTER_PLAN §08, §38) connects DevHub to the developer's machine from anywhere: a browser on another computer should be able to ask "what is the Git status of this folder on my desktop?" without opening a port on that machine. §08 says to start inside Tauri and extract a separate agent only when it must run without the desktop app.

## Decision

- The desktop app (ADR 0006) is the agent. It runs while the app is open, including hidden in the tray. A separate background service is out of scope.
- **Pairing.** A signed-in session creates a pairing code (`POST /api/devices/pairings`): 8 base32 characters, stored as a SHA-256 hash, single use, valid 10 minutes. In the desktop app the page passes it to the `agent_pair` command, which claims it (`POST /api/agent/pair`) with the device name and platform. The API creates a `Device` and returns its secret once.
- **Identity and storage.** The device secret (32 random bytes) is stored on the device in the OS credential store (Windows Credential Manager, `keyring` 3.6) and on the server only as a SHA-256 hash.
- **Short-lived tokens.** The agent trades its secret for an access token valid 10 minutes (`POST /api/agent/token`): `deviceId.expiry.HMAC-SHA256`, keyed from `BETTER_AUTH_SECRET`. Every agent request checks the signature, the expiry and that the device still exists.
- **Revocation.** Deleting a device in Settings removes the row, so its secret and tokens stop working at the next request. The agent then forgets its local secret.
- **Outbound only.** The agent polls `GET /api/agent/jobs/next` every 3 seconds and sends a heartbeat every 30 seconds with its authorized folders. No listening port.
- **Typed actions, checked twice.** `git.status {path}`, `docker.listContainers`, `tools.list`. The server accepts a job only if the action is in the device's enabled capabilities (Settings) and its parameters validate. `git.status` needs a path from the folders the device reported. The agent checks the action against its own allowlist and the server's capability list again, and the path against its authorized folders. No action takes a command string.
- **Replay and limits.** A job is claimed once (status guard), expires 60 seconds after it is queued, and accepts one result. At most 20 queued jobs per device. Results are capped at 64 KB. Local work times out after 20 seconds.
- **Audit.** `device.pair`, `device.update`, `device.revoke` and `agent.job` (action and device, never the result) go to the audit log.
- Agent routes authenticate with the bearer token only and ignore cookies. The agent sends the DevHub origin, so the CSRF origin check stays unchanged.

## Consequences

- Remote actions work only while the desktop app is running and signed in to the network. The UI shows a device as online when its last request was under 30 seconds ago.
- Opening an editor remotely and any write action are not offered: they need a confirmation on the device, which is not built.
- On macOS and Linux `keyring` needs its platform store feature; only Windows is built today.
- New dependencies in the desktop crate: `reqwest` 0.13 (already in the Tauri graph; `blocking`, `json`, `native-tls`) and `keyring` 3.6.
