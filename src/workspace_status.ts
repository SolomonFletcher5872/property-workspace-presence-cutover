import type { PresenceGetResponse } from './infrai_client.js';
import type { PropertyWorkspaceInput, WorkspaceStatus } from './property_workspace_models.js';

export function channelNameForWorkspace(workspaceId: string): string {
  return `property-workspace-${workspaceId}`;
}

export function buildWorkspaceStatus(
  input: PropertyWorkspaceInput,
  presence: PresenceGetResponse
): WorkspaceStatus {
  const onlineManagers = (presence.presence ?? [])
    .map((member) => member.client_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort();

  const needsAttention =
    input.maintenanceRequest.severity === 'high' ||
    input.tenantDocument.status === 'expired' ||
    input.inspectionReminder.status === 'due_today';

  const spotlight = input.maintenanceRequest.severity === 'high'
    ? `Dispatch ${input.maintenanceRequest.category} maintenance for unit ${input.maintenanceRequest.unit}`
    : input.tenantDocument.status === 'expired'
      ? `Chase updated ${input.tenantDocument.kind} from tenant ${input.tenantDocument.tenantId}`
      : input.inspectionReminder.status === 'due_today'
        ? `Inspection ${input.inspectionReminder.inspectionId} is due today`
        : `Workspace ${input.workspaceId} is in a steady state`;

  return {
    channel: channelNameForWorkspace(input.workspaceId),
    onlineManagers,
    needsAttention,
    spotlight,
    events: [
      {
        event: 'maintenance.request.updated',
        payload: {
          requestId: input.maintenanceRequest.requestId,
          propertyId: input.propertyId,
          unit: input.maintenanceRequest.unit,
          category: input.maintenanceRequest.category,
          severity: input.maintenanceRequest.severity,
          initiatedBy: input.manager.userId
        }
      },
      {
        event: 'tenant.document.updated',
        payload: {
          documentId: input.tenantDocument.documentId,
          tenantId: input.tenantDocument.tenantId,
          kind: input.tenantDocument.kind,
          status: input.tenantDocument.status,
          propertyId: input.propertyId
        }
      },
      {
        event: 'inspection.reminder.updated',
        payload: {
          inspectionId: input.inspectionReminder.inspectionId,
          dueDate: input.inspectionReminder.dueDate,
          status: input.inspectionReminder.status,
          propertyId: input.propertyId
        }
      }
    ]
  };
}
