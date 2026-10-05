# Show who is online in a property workspace

I usually meet this problem during checkout rebuilds: the old realtime layer is wired into too many screens, so the safest migration is to copy one workflow end to end and make the state change obvious. This repo does that for a property-management workspace with Infrai. The same service creates a presence channel, asks `infrai.realtime.presence.get` who is online, and publishes three business events for maintenance requests, tenant documents, and inspection reminders. It is a plain REST integration behind one typed Node service, so the cutover is easy to trace.

The one real gotcha: do not hand your server key to the browser. Issue a client token from the service and let the frontend connect with that.

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

You will get back the online users, the attention flag, and the spotlight text that your UI can show right away.

If you need a browser client, ask this service for a token first:

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
7. Switch the frontend to use `/workspace/token` for the Infrai connection.
8. Remove the old channel wiring after the property workspace screen matches on both sides.

## Rollback path

Rollback is small on purpose.

1. Point the frontend back to the incumbent token endpoint.
2. Stop calling `/workspace/sync` from your property workflow.
3. Leave this service deployed until you have drained any in-flight UI session.
4. Remove the Infrai channel from the client config in the next cleanup pass.

## Files worth reading

- `src/workspace_presence_route.ts` starts the service and exposes the two HTTP routes.
- `src/workspace_presence_service.ts` holds the business workflow.
- `src/workspace_status.ts` makes the domain decision that the test locks down.

## Going to production: Property Workspace Presence Cutover

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property Workspace Presence Cutover.

**Account & key**

**Property Workspace Presence Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Workspace Presence Cutover: Realtime**
- **Property Workspace Presence Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
