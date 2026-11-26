# Signal Works | Industrial Systems Academy

[Open the academy](https://industrial-systems-academy.pages.dev/) · [Go straight to the practice bench](https://industrial-systems-academy.pages.dev/labs)

A personal learning site for the engineer responsible for the server room and production line. In the [production workshop](https://industrial-systems-academy.pages.dev/production), release a carton order, configure two application servers, write the PLC permissive, design an operator screen and teach the robot. Inspect the event history to reconcile blank consumption, rejects and finished stock after an interface outage. The [3D server room](https://industrial-systems-academy.pages.dev/room) and [installation guide](https://industrial-systems-academy.pages.dev/room-guide) cover the physical facility.

## A route through the academy

1. **Commission the infrastructure.** Study servers and industrial networks, then correct the historian settings on the server bench. Explain separately what the subnet, route, resolver and clock each control.
2. **Trace a machine signal.** Work through PLC and SCADA lessons. Step the conveyor one scan at a time, interrupt its permissive and explain why recovery does not cause a restart.
3. **Trace an order.** Study MES and ERP. Dispatch a simulated order, reject a carton, reconcile the shortfall and replay the interface messages without duplicating inventory.
4. **Integrate and accept the cell.** Study robotics and systems engineering. Jog the two-link robot to a pick fixture, teach a position and explain why an unreachable target cannot be fixed by jogging. Use the six [field projects](https://industrial-systems-academy.pages.dev/fieldwork) to produce an interface map, acceptance evidence and a recovery plan. Distinguish a successful simulation from a tested installation.

Quiz progress stays in the current browser profile and origin. It does not sync to an account. Lab controls change fictional equipment in the browser; no plant network, account or credentials are involved.

## Run and publish

Double-click `index.html`, `room.html` or `production.html` to use the academy directly from a Windows folder. Keep the accompanying scripts and styles in that folder. Workshop state stays within the current browser's storage for that entry point. To serve the release locally over HTTP, run these commands from the repository root:

```sh
node build.mjs
python -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8080/. To publish a checked revision from a Wrangler session authorised for the project's Cloudflare account, build first, then run:

```sh
npx wrangler@4.168.0 pages deploy dist --project-name industrial-systems-academy --branch main
```

This is a direct-upload Pages project. Pushing to GitHub alone does not deploy. Only the browser assets included in the build are published.

The browser regression in `tests/production.cjs` opens the local files by default. With Playwright and its browser available, run `node tests/production.cjs`. Set `QA_BROWSER=msedge` to use installed Edge. Pass the public site URL as the first argument to exercise the same flow on the deployed site.
