import { INSTALL_PROMPT_STORAGE_KEY } from '../../core/config';
import type { InstallHistory } from '../../domain';
import { noInstallHistory, timestamp } from '../../domain';

const parseStoredHistory = (value: unknown): InstallHistory | null => {
	if (typeof value !== 'object' || value === null) {
		return null;
	}
	const { visits, dismissedAt, installed } = value as Record<string, unknown>;
	if (typeof visits !== 'number' || typeof installed !== 'boolean') {
		return null;
	}
	if (dismissedAt !== null && typeof dismissedAt !== 'number') {
		return null;
	}
	const validDismissedAt = dismissedAt === null ? null : timestamp(dismissedAt);
	if (dismissedAt !== null && validDismissedAt === null) {
		return null;
	}
	return { visits, dismissedAt: validDismissedAt, installed };
};

export const loadInstallHistory = (storage: Pick<Storage, 'getItem'>): InstallHistory => {
	try {
		const raw = storage.getItem(INSTALL_PROMPT_STORAGE_KEY);
		return raw === null
			? noInstallHistory
			: (parseStoredHistory(JSON.parse(raw)) ?? noInstallHistory);
	} catch {
		return noInstallHistory;
	}
};

export const saveInstallHistory = (
	storage: Pick<Storage, 'setItem'>,
	history: InstallHistory
): void => {
	try {
		storage.setItem(INSTALL_PROMPT_STORAGE_KEY, JSON.stringify(history));
	} catch {
		// Storage unavailable (private mode, quota): the invitation simply is not remembered.
	}
};
