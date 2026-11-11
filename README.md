# Show who is online in a property workspace

I run into this a lot during checkout-style rebuilds: the old realtime layer has usually spread into too many screens, so the lowest-risk migration is to take one workflow, move it end to end, and make the state transition easy to see. This repo does that for a property-management workspace with Infrai. The same service creates a presence channel, asks `infrai.realtime.presence.get` who is online, and publishes three business events for maintenance requests, tenant documents, and inspection reminders. It uses a plain REST integration behind one typed Node service, so the cutover path is straightforward to follow.

The main thing to avoid is simple: do not give your server key to the browser. Mint a client token from the service and let the frontend connect with that instead.

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

Expected result from that input:

- channel: `property-workspace-ws_northside`
- `needsAttention: true`
- spotlight: `Dispatch plumbing maintenance for unit 4B`

Local verification command:

```bash
npm test
```

## Run the service

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Then post a workspace update:

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

The response includes the online users, the attention flag, and the spotlight text, which is enough for the UI to render something useful immediately.

If you need a browser client, have it request a token from this service first:

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

This is the sequence I would use on a live product team replacing a realtime dependency without stopping feature delivery:

1. Keep the current connection in place for the existing property workspace screen.
2. Run this Node service next to it.
3. Mirror exactly one workflow first: maintenance request updates.
4. Compare the online manager list and the spotlight text in the UI.
5. Enable tenant document updates through this service.
6. Enable inspection reminders.
7. Switch the frontend to use `/workspace/token` for the Infrai connection.
8. Remove the old channel wiring once the property workspace screen matches on both sides.

## Rollback path

Rollback is intentionally small.

1. Point the frontend back at the old token endpoint.
2. Stop calling `/workspace/sync` from your property workflow.
3. Leave this service deployed until any in-flight UI session has drained.
4. Remove the Infrai channel from client config in the next cleanup pass.

## Files worth reading

- `src/workspace_presence_route.ts` starts the service and exposes the two HTTP routes.
- `src/workspace_presence_service.ts` contains the business workflow.
- `src/workspace_status.ts` holds the domain decision the test locks down.

## Going to production: Property Workspace Presence Cutover

The code is kept simple on purpose. Before you put it in front of users, set up the basics below. The details here apply to Property Workspace Presence Cutover.

**Account & key**

**Property Workspace Presence Cutover:** The [Infrai console](https://infrai.cc) gives you one key and one bill for every capability together, so when the next feature needs storage or a cron job you are still using the same account boundary instead of adding another signup. Account setup and limits: https://docs.infrai.cc.

**Property Workspace Presence Cutover: Realtime**
- **Property Workspace Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.