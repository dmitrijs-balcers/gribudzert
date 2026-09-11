import { describe, expect, it } from 'vitest';
import { directionsLink, directionsPlatformOf } from '../../src/features/directions';
import type { DirectionsDestination } from '../../src/features/directions';

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1';
const IPAD_UA =
	'Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAC_SAFARI_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

const WATER_TAP: DirectionsDestination = {
	coordinates: { lat: 56.954, lon: 24.118 },
	name: 'water tap 101',
};

describe('Recognising the visitor’s device for directions', () => {
	it('sends an iPhone visitor to Apple Maps', () => {
		expect(directionsPlatformOf(IPHONE_UA)).toBe('apple');
	});

	it('sends an iPad visitor to Apple Maps', () => {
		expect(directionsPlatformOf(IPAD_UA)).toBe('apple');
	});

	it('lets an Android visitor choose among installed maps apps', () => {
		expect(directionsPlatformOf(ANDROID_UA)).toBe('android');
	});

	it('sends a desktop Chrome visitor to the web', () => {
		expect(directionsPlatformOf(DESKTOP_CHROME_UA)).toBe('web');
	});

	it('sends a Mac Safari visitor to the web rather than the Apple Maps app', () => {
		expect(directionsPlatformOf(MAC_SAFARI_UA)).toBe('web');
	});

	it('ignores letter case in the user agent', () => {
		expect(directionsPlatformOf('MOZILLA/5.0 (LINUX; ANDROID 14)')).toBe('android');
		expect(directionsPlatformOf('mozilla/5.0 (iphone; cpu iphone os 18_4)')).toBe('apple');
	});
});

describe('Building a walking directions link to a water tap', () => {
	it('opens Apple Maps with walking directions on an Apple device', () => {
		expect(directionsLink('apple', WATER_TAP)).toBe(
			'https://maps.apple.com/directions?destination=56.954,24.118&mode=walking'
		);
	});

	it('opens a geo URI with the labelled point on Android', () => {
		expect(directionsLink('android', WATER_TAP)).toBe(
			'geo:56.954,24.118?q=56.954,24.118(water%20tap%20101)'
		);
	});

	it('opens Google Maps with walking directions on the web', () => {
		expect(directionsLink('web', WATER_TAP)).toBe(
			'https://www.google.com/maps/dir/?api=1&destination=56.954,24.118&travelmode=walking'
		);
	});

	it('URL-encodes spaces and parentheses in the Android label', () => {
		const link = directionsLink('android', { ...WATER_TAP, name: 'tap (near park)' });
		expect(link).toBe('geo:56.954,24.118?q=56.954,24.118(tap%20%28near%20park%29)');
		expect(link).not.toContain(' ');
	});

	it('asks for walking mode on every platform that supports it', () => {
		expect(directionsLink('apple', WATER_TAP)).toContain('mode=walking');
		expect(directionsLink('web', WATER_TAP)).toContain('travelmode=walking');
	});

	it('keeps coordinates unrounded', () => {
		const precise: DirectionsDestination = {
			coordinates: { lat: 56.95412345678, lon: 24.11898765432 },
			name: 'spring',
		};
		expect(directionsLink('web', precise)).toContain('destination=56.95412345678,24.11898765432');
	});
});
