import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { NEAREST_TAP_TO_USER, USER, WATER_MARKER_COUNT } from '../fixtures';
import { renderApp } from '../harness';

describe('Navigating to a point from its popup', () => {
	it('opens the navigation app for the coordinates of the point', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.openPopupOf(app.markers().findIndex((m) => m.classList.contains('nearest-marker')));
		await waitFor(() => expect(app.popupText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`));
		within(app.popup() as HTMLElement)
			.getByRole('button', { name: /Navigate to/ })
			.click();

		expect(open).toHaveBeenCalledTimes(1);
		const [url, target] = open.mock.calls[0] ?? [];
		expect(String(url)).toContain(`${NEAREST_TAP_TO_USER.lat},${NEAREST_TAP_TO_USER.lon}`);
		expect(target).toBe('_blank');
	});
});
