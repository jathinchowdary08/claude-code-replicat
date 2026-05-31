export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'plan', 'bypassPermissions'];

export function isPermissionMode(s: string): s is PermissionMode {
  return (PERMISSION_MODES as string[]).includes(s);
}

export const MODE_LABEL: Record<PermissionMode, string> = {
  default: 'default',
  acceptEdits: 'accept edits',
  plan: 'plan',
  bypassPermissions: 'bypass (yolo)',
};
