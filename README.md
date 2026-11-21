# Coffee Research

A workflow for coffee product research, editorial content, site publishing, and measurement.

- [Implementation plan](docs/planning-spec.md)
- [Product knowledge format](knowledge/README.md)
- [Research pilot](agent/research-pilot.md)
- [Project learning log](docs/learnings.md)

Validate the product cards with Node.js. There are no dependencies to install.

```sh
node agent/validate-knowledge.mjs
```

Generate the next local research batch as JSON.

```sh
node agent/research-plan.mjs --limit 5
node agent/research-plan.mjs --category machines --limit 3
```

The queue starts with 10 machines and 10 grinders. The planner checks product cards, lists refreshes before new products, and reports unresolved claims. The default refresh interval is 90 days from each claim's verification date. Use `--refresh-days` to override it. See the research pilot for how to act on the report.

## Local backoffice

Run `node backoffice/server.mjs` and open the printed loopback URL. The dashboard reads the local product cards, queue, roadmap, learning log, and recorded planner activity. Refresh data after local changes. The server binds to the loopback interface and serves only the dashboard assets and its data endpoint.

Run `node agent/research-plan.mjs --limit 5 --record` to record a planner run in the dashboard. Run history lives in the ignored `.backoffice/runs.jsonl` file. A recorded planner run represents batch planning. The research runner can add its own events once integrated.
