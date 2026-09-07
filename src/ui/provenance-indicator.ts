import * as L from 'leaflet';
import type { DataProvenance } from '../app/sync';
import './provenance-indicator.css';

export type ProvenanceIndicator = {
	readonly control: L.Control;
	readonly render: (view: DataProvenance | null) => void;
};

type ProvenanceCopy = {
	readonly label: string;
	readonly title: string;
};

const copyOf = (provenance: DataProvenance): ProvenanceCopy => {
	switch (provenance) {
		case 'live':
			return { label: 'Live', title: 'Points fetched just now' };
		case 'saved':
			return { label: 'Saved', title: 'Points from your saved copy' };
		case 'updating':
			return { label: 'Updating', title: 'Refreshing points…' };
		case 'failed':
			return { label: 'Failed', title: "Couldn't refresh. Showing saved points if any." };
		case 'offline':
			return { label: 'Offline', title: 'No connection. Showing saved points.' };
		default: {
			const exhaustive: never = provenance;
			throw new Error(`Unhandled data provenance: ${JSON.stringify(exhaustive)}`);
		}
	}
};

const applyView = (
	container: HTMLElement,
	label: HTMLElement,
	view: DataProvenance | null
): void => {
	if (view === null) {
		container.hidden = true;
		container.removeAttribute('data-provenance');
		container.removeAttribute('title');
		container.removeAttribute('aria-label');
		label.textContent = '';
		return;
	}
	const copy = copyOf(view);
	container.hidden = false;
	container.setAttribute('data-provenance', view);
	container.title = copy.title;
	container.setAttribute('aria-label', copy.title);
	label.textContent = copy.label;
};

export function createProvenanceIndicator(
	position: L.ControlPosition = 'topleft'
): ProvenanceIndicator {
	let container: HTMLElement | null = null;
	let label: HTMLElement | null = null;

	const ProvenanceIndicatorImpl = L.Control.extend({
		onAdd: (): HTMLElement => {
			const created = L.DomUtil.create('div', 'leaflet-control provenance-indicator');
			created.setAttribute('role', 'status');
			created.setAttribute('aria-live', 'polite');
			created.hidden = true;
			const dot = L.DomUtil.create('span', 'provenance-indicator-dot', created);
			dot.setAttribute('aria-hidden', 'true');
			const labelSpan = L.DomUtil.create('span', 'provenance-indicator-label', created);
			L.DomEvent.disableClickPropagation(created);
			container = created;
			label = labelSpan;
			return created;
		},
	});

	const control: L.Control = new ProvenanceIndicatorImpl({ position });

	return {
		control,
		render: (view) => {
			if (container !== null && label !== null) {
				applyView(container, label, view);
			}
		},
	};
}
