import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/**/*.test.ts'],
		fileParallelism: false,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
		},
	},
});
