/**
 * Entry point: load styles and start the application once the DOM is ready
 */

import 'leaflet/dist/leaflet.css';
import './ui/theme.css';
import { bootstrap } from './app';

const start = (): void => {
	bootstrap();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', start);
} else {
	start();
}
