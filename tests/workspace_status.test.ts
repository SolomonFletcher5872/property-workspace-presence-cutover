import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceStatus } from '../src/workspace_status.js';
import type { PropertyWorkspaceInput } from '../src/property_workspace_models.js';

const input: PropertyWorkspaceInput = {
  workspaceId: 'ws_northside',
  propertyId: 'prop_88',
  manager: {
    userId: 'mgr_7',
    name: 'Nina'
  },
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
};

test('high severity maintenance puts the workspace into attention mode and sorts online managers', () => {
  const status = buildWorkspaceStatus(input, {
    presence: [
      { client_id: 'manager_b' },
      { client_id: 'manager_a' }
    ]
  });

  assert.equal(status.channel, 'property-workspace-ws_northside');
  assert.deepEqual(status.onlineManagers, ['manager_a', 'manager_b']);
  assert.equal(status.needsAttention, true);
  assert.equal(status.spotlight, 'Dispatch plumbing maintenance for unit 4B');
  assert.equal(status.events[0]?.event, 'maintenance.request.updated');
});
