export type BuildId = string & { readonly __brand: 'BuildId' };

export type ShellAssetPath = string & { readonly __brand: 'ShellAssetPath' };

export type ShellManifest = {
	readonly buildId: BuildId;
	readonly assets: readonly ShellAssetPath[];
};

const BUILD_ID_PATTERN = /^[a-z0-9]{8,64}$/;

export const buildId = (value: string): BuildId | null =>
	BUILD_ID_PATTERN.test(value) ? (value as BuildId) : null;

export const shellAssetPath = (value: string): ShellAssetPath | null => {
	if (!value.startsWith('/')) {
		return null;
	}
	if (value.includes('://')) {
		return null;
	}
	if (value.split('/').includes('..')) {
		return null;
	}
	return value as ShellAssetPath;
};

export const SHELL_ENTRY = shellAssetPath('/index.html') as ShellAssetPath;

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

export const parseShellManifest = (value: unknown): ShellManifest | null => {
	if (typeof value !== 'object' || value === null) {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.buildId !== 'string' || !isStringArray(record.assets)) {
		return null;
	}
	const parsedBuildId = buildId(record.buildId);
	if (parsedBuildId === null) {
		return null;
	}
	const assets: ShellAssetPath[] = [];
	const seen = new Set<ShellAssetPath>();
	for (const raw of record.assets) {
		const asset = shellAssetPath(raw);
		if (asset === null) {
			return null;
		}
		if (seen.has(asset)) {
			continue;
		}
		seen.add(asset);
		assets.push(asset);
	}
	if (!seen.has(SHELL_ENTRY)) {
		return null;
	}
	return { buildId: parsedBuildId, assets };
};
