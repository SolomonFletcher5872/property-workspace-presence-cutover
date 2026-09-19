import { z } from 'zod';

export const propertyWorkspaceInputSchema = z.object({
  workspaceId: z.string().min(1),
  propertyId: z.string().min(1),
  manager: z.object({
    userId: z.string().min(1),
    name: z.string().min(1)
  }),
  maintenanceRequest: z.object({
    requestId: z.string().min(1),
    unit: z.string().min(1),
    category: z.enum(['plumbing', 'electrical', 'appliance', 'general']),
    severity: z.enum(['low', 'medium', 'high'])
  }),
  tenantDocument: z.object({
    documentId: z.string().min(1),
    tenantId: z.string().min(1),
    kind: z.enum(['lease_renewal', 'insurance', 'id_check']),
    status: z.enum(['uploaded', 'expired', 'pending_review'])
  }),
  inspectionReminder: z.object({
    inspectionId: z.string().min(1),
    dueDate: z.string().min(1),
    status: z.enum(['due_today', 'upcoming'])
  })
});

export type PropertyWorkspaceInput = z.infer<typeof propertyWorkspaceInputSchema>;

export type WorkspaceStatus = {
  channel: string;
  onlineManagers: string[];
  needsAttention: boolean;
  spotlight: string;
  events: Array<{
    event: string;
    payload: Record<string, unknown>;
  }>;
};
