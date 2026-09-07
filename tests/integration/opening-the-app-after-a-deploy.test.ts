import { describe, expect, it } from 'vitest';
import { buildId, shellAssetPath } from '../../src/features/shell';
import { startWorker } from '../offline-harness';

const assertResponded = (response: Response | null): Response => {
	if (response === null) {
		throw new Error('Expected a response, got passthrough');
	}
	return response;
};

const ORIGIN = 'https://gribudzert.test';
const DEFAULT_BUILD_ID = 'abcdef0123456789';
const DEFAULT_ASSETS = [
	'/index.html',
	'/assets/index-abc.js',
	'/assets/index-abc.css',
	'/manifest.json',
];

describe('Opening the app after a deploy', () => {
	it('precaches every asset from the shell manifest on install', async () => {
		const worker = startWorker();
		await worker.install();

		for (const asset of DEFAULT_ASSETS) {
			const path = shellAssetPath(asset);
			if (path === null) {
				throw new Error(`Unexpected invalid shell asset path: ${asset}`);
			}
			const build = buildId(DEFAULT_BUILD_ID);
			if (build === null) {
				throw new Error('Unexpected invalid build id');
			}
			expect(await worker.shell.match(build, path)).not.toBeNull();
		}
	});

	it('sends an online navigation to the network and returns the network HTML', async () => {
		const worker = startWorker();
		await worker.install();

		const response = assertResponded(await worker.request(`${ORIGIN}/`, { mode: 'navigate' }));

		expect(await response.text()).toBe('network:/');
		expect(worker.shellFetches).toEqual([`${ORIGIN}/`]);
	});

	it('returns the precached index.html for an offline navigation', async () => {
		const worker = startWorker();
		await worker.install();
		worker.goOffline();
		worker.replyToShell(() => 'network-error');

		const response = assertResponded(await worker.request(`${ORIGIN}/`, { mode: 'navigate' }));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('');
	});

	it('serves a hashed asset from the shell cache without touching the network', async () => {
		const worker = startWorker();
		await worker.install();

		const response = assertResponded(await worker.request(`${ORIGIN}/assets/index-abc.js`));

		expect(response.status).toBe(200);
		expect(worker.shellFetches).toHaveLength(0);
	});

	it('drops caches from other builds and keeps this one when the worker activates', async () => {
		const worker = startWorker();
		const oldBuildId = buildId('1111111111111111');
		const oldAssetPath = shellAssetPath('/index.html');
		if (oldBuildId === null || oldAssetPath === null) {
			throw new Error('Unexpected invalid seed values');
		}
		worker.shell.seed(oldBuildId, oldAssetPath, new Response('old build', { status: 200 }));

		await worker.install();
		await worker.activate();

		expect(worker.shell.builds()).not.toContain(oldBuildId);
		expect(worker.shell.builds()).toContain(DEFAULT_BUILD_ID);
	});

	it('treats navigations and assets as passthrough when the shell manifest is invalid', async () => {
		const worker = startWorker({ shell: null });
		await worker.install();

		const navigation = await worker.request(`${ORIGIN}/`, { mode: 'navigate' });
		const asset = await worker.request(`${ORIGIN}/assets/index-abc.js`);

		expect(navigation).toBeNull();
		expect(asset).toBeNull();
	});
});
