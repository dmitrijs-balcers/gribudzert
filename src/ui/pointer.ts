export function isCoarsePointer(): boolean {
	if (typeof matchMedia !== 'function') {
		return false;
	}
	return matchMedia('(pointer: coarse)').matches;
}
