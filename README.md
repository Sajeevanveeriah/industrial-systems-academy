# Signal Works | Industrial Systems Academy

[Open the academy](https://industrial-systems-academy.pages.dev/) · [Go straight to the practice bench](https://industrial-systems-academy.pages.dev/labs)

A personal learning site for the engineer responsible for both the server room and the production line. Start with **Start learning**, or search the dashboard for a system you already work with. Each lesson includes a worked example, a practical exercise, an official reference and a knowledge check with an explanation.

## A route through the academy

1. **Commission the infrastructure.** Study servers and industrial networks, then correct the historian settings on the server bench. Explain separately what the subnet, route, resolver and clock each control.
2. **Trace a machine signal.** Work through PLC and SCADA lessons. Step the conveyor one scan at a time, interrupt its permissive and explain why recovery does not cause a restart.
3. **Trace an order.** Study MES and ERP. Dispatch a simulated order, reject a carton, reconcile the shortfall and replay the interface messages without duplicating inventory.
4. **Integrate and accept the cell.** Study robotics and systems engineering. Jog the two-link robot to a pick fixture, teach a position and explain why an unreachable target cannot be fixed by jogging. Use the six [field projects](https://industrial-systems-academy.pages.dev/fieldwork) to produce an interface map, acceptance evidence and a recovery plan. Distinguish a successful simulation from a tested installation.

Quiz progress stays in the current browser profile and origin. It does not sync to an account. Lab controls change fictional equipment in the browser; no plant network, account or credentials are involved.

## Run and publish

The website needs no framework, database or external script at runtime. From the repository root:

```sh
node build.mjs
python -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8080/. To publish a checked revision from a Wrangler session authorised for the project's Cloudflare account, build first, then run:

```sh
npx wrangler@4.168.0 pages deploy dist --project-name industrial-systems-academy --branch main
```

This is a direct-upload Pages project. Pushing to GitHub alone does not deploy. Only the browser assets included in the build are published.
