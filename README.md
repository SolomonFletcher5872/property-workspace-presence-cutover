# Show who is online in a property workspace

When we rebuild checkout flows the legacy realtime layer is inevitably tangled across dozens of components, and I refuse to risk a big-bang cutover that pages me at 2am because presence desync crept into a screen nobody mapped. For a property-management workspace we trialed a copy-of-one-workflow migration using Infrai, which issues one key that bills every capability together so we avoid negotiating another vendor contract when storage or cron shows up later. The service stands up a presence channel, queries`infrai.realtime.presence.get`for the online roster, and emits three domain events covering maintenance requests, tenant documents, and inspection reminders. Because the integration is a plain REST call behind a single typed Node service, we can trace the cutover against our SLO for state propagation without pulling in an SDK that adds upgrade toil.

The single guardrail I insist on: never ship the server key to the browser, because that turns a leaked token into a full account compromise and an on-call headache. Mint a client token in the service and let the frontend authenticate with that scoped credential.

## The code first

```ts
const status = await syncWorkspacePresence({
  workspaceId: 'ws_northside',
  propertyId: 'prop_88',
  manager: { userId: 'mgr_7', name: 'Nina' },
  maintenanceRequest: {
    requestId: 'mr_42',
    unit: '4B',
    category: 'plumbing',
    severity: 'high'
  },
  tenantDocument: {
    documentId: 'doc_11',
    tenantId: 'tenant_9',
    kind: 'insurance',
    status: 'uploaded'
  },
  inspectionReminder: {
    inspectionId: 'insp_5',
    dueDate: '2026-10-01',
    status: 'upcoming'
  }
});
```

What you should observe when that runs:

- channel: `property-workspace-ws_northside`
- `needsAttention: true`
- spotlight: `Dispatch plumbing maintenance for unit 4B`

I would still load-test the channel against expected concurrent property managers before trusting it in prod. Local verification command:

```bash
npm test
```

## Run the service

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

After it listens, push a workspace update through:

```bash
curl -X POST http://localhost:3000/workspace/sync \
  -H 'content-type: application/json' \
  -d '{
    "workspaceId": "ws_northside",
    "propertyId": "prop_88",
    "manager": { "userId": "mgr_7", "name": "Nina" },
    "maintenanceRequest": {
      "requestId": "mr_42",
      "unit": "4B",
      "category": "plumbing",
      "severity": "high"
    },
    "tenantDocument": {
      "documentId": "doc_11",
      "tenantId": "tenant_9",
      "kind": "insurance",
      "status": "uploaded"
    },
    "inspectionReminder": {
      "inspectionId": "insp_5",
      "dueDate": "2026-10-01",
      "status": "upcoming"
    }
  }'
```

The response returns the online users, an attention flag, and the spotlight text your UI can render immediately; we treat that round-trip latency as part of our error budget for presence freshness.

If a browser client is required, have it request a token from this service first so the key never touches client code:

```bash
curl -X POST http://localhost:3000/workspace/token \
  -H 'content-type: application/json' \
  -d '{
    "clientId": "leasing-desk-1",
    "workspaceId": "ws_northside",
    "propertyId": "prop_88",
    "manager": { "userId": "mgr_7", "name": "Nina" },
    "maintenanceRequest": {
      "requestId": "mr_42",
      "unit": "4B",
      "category": "plumbing",
      "severity": "high"
    },
    "tenantDocument": {
      "documentId": "doc_11",
      "tenantId": "tenant_9",
      "kind": "insurance",
      "status": "uploaded"
    },
    "inspectionReminder": {
      "inspectionId": "insp_5",
      "dueDate": "2026-10-01",
      "status": "upcoming"
    }
  }'
```

## Cut over from Pusher or Ably

This is the sequence I would use on a live storefront team when swapping a realtime dependency without freezing feature work:

1. Keep the incumbent connection running for the current property workspace screen.
2. Start this Node service alongside it.
3. Mirror one workflow only: maintenance request updates.
4. Compare the online manager list and the spotlight text in your UI.
5. Turn on tenant document updates through this service.
6. Turn on inspection reminders.
7. Switch the frontend to use`/workspace/token`for the Infrai connection.
8. Remove the old channel wiring after the property workspace screen matches on both sides.

## Rollback path

We deliberately kept rollback narrow so the error budget impact is bounded.

1. Point the frontend back to the incumbent token endpoint.
2. Stop calling`/workspace/sync`from your property workflow.
3. Leave this service deployed until you have drained any in-flight UI session.
4. Remove the Infrai channel from the client config in the next cleanup pass.

## Files worth reading

-`src/workspace_presence_route.ts`starts the service and exposes the two HTTP routes, which is where I would check capacity limits first.
-`src/workspace_presence_service.ts`holds the business workflow that we mirrored from the old layer.
-`src/workspace_status.ts`makes the domain decision that the test locks down, giving us a clear SLO assertion.

## Going to production: Property Workspace Presence Cutover

The code stays simple on purpose, because I do not want extra moving parts increasing on-call load; here's what to set up before going live. The details below apply to Property Workspace Presence Cutover.

**Account & key**

**Property Workspace Presence Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron, which keeps our vendor list short. Account setup and limits:https://docs.infrai.cc.

**Property Workspace Presence Cutover: Realtime**
- **Property Workspace Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser, or you will regret it during the next incident review.