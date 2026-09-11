export type HistoryEntry = {
	readonly push: () => void;
	readonly pop: () => void;
	readonly onPopped: (handler: () => void) => void;
	readonly destroy: () => void;
};

type EntryStatus = 'absent' | 'pushed';

const pushed = (key: string): EntryStatus => {
	try {
		history.pushState({ [key]: true }, '');
		return 'pushed';
	} catch {
		return 'absent';
	}
};

const goBack = (): void => {
	try {
		history.back();
	} catch {
		return;
	}
};

export const createHistoryEntry = (key: string): HistoryEntry => {
	let status: EntryStatus = 'absent';
	const handlers = new Set<() => void>();

	const onPopState = (): void => {
		if (status === 'absent') {
			return;
		}
		status = 'absent';
		for (const handler of handlers) {
			handler();
		}
	};
	window.addEventListener('popstate', onPopState);

	return {
		push: () => {
			if (status === 'absent') {
				status = pushed(key);
			}
		},
		pop: () => {
			if (status === 'pushed') {
				status = 'absent';
				goBack();
			}
		},
		onPopped: (handler) => {
			handlers.add(handler);
		},
		destroy: () => {
			window.removeEventListener('popstate', onPopState);
			handlers.clear();
		},
	};
};
