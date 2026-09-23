# FreeCloudFarm Node Agent

This folder contains the first Android node proof-of-concept.

## Browser agent

Open `agent.html` on an Android phone:

https://kenkenny11.github.io/free-cloud-farm/node-agent/agent.html

Enter:

1. API URL: `https://free-cloud-farm.onrender.com`
2. A unique Node ID such as `phone-01`
3. A node name
4. The same NODE_TOKEN configured on the Render backend

Then tap **Register / Reconnect**.

The agent:

- registers the node automatically
- sends a heartbeat every 20 seconds
- reports browser/device information
- reads battery level when the browser exposes the Battery API
- polls the task queue
- reconnects after temporary API failures
- can open browser URLs as a proof-of-concept task

## Current limitation

A browser tab is not a real Android VM and cannot provide full remote Android control. Native app launching, screen capture, touch control and persistent background execution require a native Android agent or another Android runtime.

Use this only with devices and accounts you own or are authorized to operate, and use official platform APIs/OAuth where required.

## Next native-agent stage

Build an Android APK that keeps a foreground service alive, registers the physical device, sends heartbeats, polls tasks and reports results. Later, add approved remote screen/control using Android MediaProjection/accessibility APIs.
