import { infrai } from './infrai_client.js';
import { propertyWorkspaceInputSchema, type PropertyWorkspaceInput, type WorkspaceStatus } from './property_workspace_models.js';
import { buildWorkspaceStatus, channelNameForWorkspace } from './workspace_status.js';

function publishKey(input: PropertyWorkspaceInput, suffix: string): string {
  return [
    input.workspaceId,
    input.maintenanceRequest.requestId,
    input.tenantDocument.documentId,
    input.inspectionReminder.inspectionId,
    suffix
  ].join(':');
}

export async function syncWorkspacePresence(rawInput: unknown): Promise<WorkspaceStatus> {
  const input = propertyWorkspaceInputSchema.parse(rawInput);
  const channel = channelNameForWorkspace(input.workspaceId);

  await infrai.realtime.channel.create({
    channel,
    type: 'presence'
  });

  const presence = await infrai.realtime.presence.get(channel);
  const status = buildWorkspaceStatus(input, presence);

  for (const item of status.events) {
    await infrai.realtime.publish({
      channel,
      event: item.event,
      data: JSON.stringify({
        ...item.payload,
        publishKey: publishKey(input, item.event)
      }),
      account_id: publishKey(input, item.event)
    });
  }

  return status;
}

export async function issueWorkspaceToken(rawInput: unknown, clientId: string) {
  const input = propertyWorkspaceInputSchema.parse(rawInput);
  const channel = channelNameForWorkspace(input.workspaceId);

  return infrai.realtime.token.issue({
    client_id: clientId,
    channels: [channel],
    capabilities: ['subscribe', 'presence'],
    ttl_seconds: 3600
  });
}
