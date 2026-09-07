import type { DurationMs, Timestamp } from './units';

export type InstallHistory = {
	readonly visits: number;
	readonly dismissedAt: Timestamp | null;
	readonly installed: boolean;
};

export type InvitationPolicy = {
	readonly minVisits: number;
	readonly dismissCooldownMs: DurationMs;
};

export type InvitationVerdict = 'invite' | 'installed' | 'too-few-visits' | 'recently-dismissed';

export const noInstallHistory: InstallHistory = { visits: 0, dismissedAt: null, installed: false };

export const recordVisit = (history: InstallHistory): InstallHistory => ({
	...history,
	visits: history.visits + 1,
});

export const recordDismissal = (history: InstallHistory, at: Timestamp): InstallHistory => ({
	...history,
	dismissedAt: at,
});

export const recordInstall = (history: InstallHistory): InstallHistory => ({
	...history,
	installed: true,
});

export const invitationVerdict = (
	history: InstallHistory,
	policy: InvitationPolicy,
	now: Timestamp
): InvitationVerdict => {
	if (history.installed) {
		return 'installed';
	}
	if (history.visits < policy.minVisits) {
		return 'too-few-visits';
	}
	if (history.dismissedAt !== null && now - history.dismissedAt < policy.dismissCooldownMs) {
		return 'recently-dismissed';
	}
	return 'invite';
};
