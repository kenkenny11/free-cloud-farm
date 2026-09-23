# FreeCloudFarm

A mobile-friendly control panel inspired by cloud-phone farm products.

## What this version does

- Device/node dashboard
- Node registration token with rotation
- Device list and connection state
- Task queue
- Social account labels
- Local browser storage
- GitHub Pages-ready static deployment

## Important architecture note

A static website cannot create real Android virtual machines. Real cloud phones require an Android runtime/VM, emulator host, physical Android nodes, or another device provider. This repository provides the control plane first.

The intended next stage is an Android node agent that connects to this dashboard/backend and exposes approved device actions.

Use social platforms through their official APIs/OAuth or user-approved browser automation. Do not use the system for spam, fake engagement, mass account creation, or bypassing platform controls.
