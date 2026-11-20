# TaskMasterProMax | local dashboard

## Start on Windows
From the TaskMaster checkout in PowerShell:

    node .\dashboard\demo.mjs --simulate

Open http://127.0.0.1:8917/ on that same computer. This creates three **synthetic** projects in a unique temp folder. After 24 seconds it atomically moves the Atlas checklist and one subtask from Review to Done, unblocking promotion. Leave off the flag for a static demo. Stop with Ctrl+C. No npm install required for the dashboard; use a supported Node 22+ runtime. Demo prints its temporary source folder; it does not modify a real task file or the editor installations.

## Add your projects

    node dashboard/server.mjs

Open http://127.0.0.1:8917/ and choose **Add project**. Enter a display name and paste the absolute path to the project folder containing `.taskmaster`. Leave the task tag set to **master** unless your project uses a different tag. The dashboard checks that it can read the backlog before adding the project.

The dashboard saves the list to `.taskmaster-promax/portfolio.json` in your home directory. If you already use a portfolio JSON file, keep passing its path with `--config`. New projects will be saved to that file.

    node .\dashboard\server.mjs --config C:\path\portfolio.json
    node --test dashboard/model.test.mjs dashboard/server.test.mjs

## What the console does

Use **Group by → Progress** to see tasks by status across projects. Each row shows its project and flags open dependencies. **Group by → Project** restores the project sections. Both views share the search and status filters. Observed activity sits below the full-width portfolio.

Search project, task and subtask names; filter statuses or open/missing dependencies; open a task to see its nested subtasks and evidence status. Mission Control and Day Shift themes use local system fonts. Two stable reads confirm changes, so another local editor's task status normally appears within a few seconds. An invalid, missing or unavailable source is isolated, with its last snapshot explicitly marked stale. History is bounded and in memory, begins when the console starts, and records observed status changes, not actor identity or live agent presence. A Done task does not prove acceptance or browser UAT. No task editing, Git publishing, agent presence, or external evidence ingestion in this slice.

## Privacy and scope
The dashboard serves requests on loopback and accepts project registrations from its own origin. Task files are read-only. The dashboard has no dependencies, outbound client calls, CDN or telemetry. Config and task files are not public routes. Responses include selected task/project title, ID, status and dependencies, not paths, descriptions or secrets. Treat displayed titles as visible to other processes on the same OS account/machine if they can access the loopback service; do not place secrets in titles. Do not expose this port through proxies, tunnels or forwarding.

## Validation
See REQUIREMENTS.md for acceptance mapping. The Node suite exercises parsing, dependencies/subtasks, denied escaping paths, stale project isolation, two-read change detection and API boundaries.
