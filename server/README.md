# FreeCloudFarm API

Endpoints:

- GET /health
- POST /api/node/register
- POST /api/node/heartbeat
- GET /api/nodes
- GET /api/tasks?nodeId=...
- POST /api/tasks
- POST /api/tasks/:id

Protected endpoints require the X-Node-Token header.

For production, replace the in-memory store with a database and use a strong secret.