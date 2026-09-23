# FreeCloudFarm Android Node

This folder is the node-agent specification for the next stage.

The Android/Termux agent will:

1. Register with the backend using the node token.
2. Send a heartbeat every 20–30 seconds.
3. Poll its task queue.
4. Execute only locally supported, user-approved actions.
5. Report task results.

For a first test, use a normal Android/Termux HTTP client. A full Android app can be added after the backend is deployed.