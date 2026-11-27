# Signal Works | Industrial Systems Academy

## French fry plant

The [facility services workbench](https://industrial-systems-academy.pages.dev/fries?mode=solved#facility) covers office and staff facilities, raw storage, process support and water services. Use it to distinguish an installed endpoint from an accepted service. A learner can commission fictional cabinet connections, check power and link readbacks, and hand over each area. The exercise uses an independent training layout.

[Run one batch across Momentum, APS, AVEVA and SAP](https://industrial-systems-academy.pages.dev/fries?mode=batch#momentum). This workspace supplies a commissioned model plant and a draft order. Receive the actual potato lot from its weighbridge ticket, release quality stock, reserve a production slot, operate all ten stations from the InTouch-style panel, and reconcile the same movements in the SAP trace. The guide follows the current handover. The software names describe public workflows modelled for training; the combined interfaces and shift clock are fictional. Run `node tests/batch.cjs` for the end-to-end regression, optionally passing the deployed base URL.

[Production software labs](https://industrial-systems-academy.pages.dev/vendor-labs) cover Brighteye Momentum MES workflows, AVEVA InTouch and Historian workflows, and APS 4FACTORY scheduling. The lab page links the public implementation evidence by location and date. Each exercise uses fictional orders, signals or materials.

Start the [guided greenfield build](https://industrial-systems-academy.pages.dev/fries?mode=build#site) on a vacant 24-cell parcel. Survey it, lay out six buildings, choose and place their foundations, frames and shell finishes, connect eight services, and prove vehicle access before handover. Select a completed building to enter its workshop. The [step-by-step guide](https://industrial-systems-academy.pages.dev/fries?mode=build#guide) explains the actions, purpose, acceptance checks and fault recovery from the plot survey to dispatch. The [worked site](https://industrial-systems-academy.pages.dev/fries?mode=worked#site) shows the accepted arrangement.

The [French fry plant](https://industrial-systems-academy.pages.dev/fries?mode=solved#floor) follows a 1,000 kg training charge through receiving, washing, peeling, cutting, blanching, drying, par-frying, freezing, packing and dispatch. Start, hold or single-step each operation and release the batch to its next station. The operator screen, MES genealogy and simulated SAP postings share the batch and order identifiers.

- [Fit out existing buildings](https://industrial-systems-academy.pages.dev/fries?mode=fitout#rack) to practise the rack, servers, field I/O, VMs, PLC, SCADA, HMI, MES, SAP and process machinery on a commissioned site. Earlier build-from-rack work resumes in this workspace.
- [Operate an installed plant](https://industrial-systems-academy.pages.dev/fries?mode=solved#floor) to inspect and change a worked installation while running your own batch.
- [Inspect a completed batch](https://industrial-systems-academy.pages.dev/fries?mode=worked#history) to compare recipes, weights and postings against a completed worked example.

Open `fries.html` directly from the repository for the offline workshop. The empty and installed workspaces save separately in the browser. The worked example is regenerated from the model. Process times, mass coefficients and control limits are classroom assumptions. For regression checks, `node tests/fries.cjs` exercises the local files, or accepts the deployed base URL.

`node tests/site.cjs` exercises the vacant parcel through construction, layout faults, service and road acceptance, upstream rework, reinspection, equipment fit-out, batch dispatch and retained site evidence. It takes the same optional base URL.

[Open the academy](https://industrial-systems-academy.pages.dev/) · [Go straight to the practice bench](https://industrial-systems-academy.pages.dev/labs)

A personal learning site for the engineer responsible for the server room and production line. In the [production workshop](https://industrial-systems-academy.pages.dev/production), release a carton order, configure two application servers, write the PLC permissive, design an operator screen and teach the robot. Inspect the event history to reconcile blank consumption, rejects and finished stock after an interface outage. The [3D server room](https://industrial-systems-academy.pages.dev/room) and [installation guide](https://industrial-systems-academy.pages.dev/room-guide) cover the physical facility.

## A route through the academy

The [3D reference line](https://industrial-systems-academy.pages.dev/production?bench=reference#line) starts with a released order, taught robot and example control program. Its storage is separate from your commissioning workspace. Watch a single carton or advance the controller one scan at a time. In the [sequence editor](https://industrial-systems-academy.pages.dev/production#sequence), edit and prove both the accepted and rejected routes. In the [equipment workbench](https://industrial-systems-academy.pages.dev/equipment), trace faults between physical components, software settings and production records.

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

Run `node tests/line.cjs` for the precommissioned line, carton tracking, hardware and software benches, SAP worksheet and multi-tab checks. It accepts the same browser setting and optional base URL.
