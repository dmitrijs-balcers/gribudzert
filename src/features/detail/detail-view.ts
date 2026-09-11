import type {
	CompassPoint,
	Coordinates,
	ExternalLink,
	Facility,
	FacilityId,
	FacilityKind,
	GuidanceCourse,
	Heading,
	Located,
	Meters,
	Photo,
	ToiletFacility,
	ViewpointFacility,
	WaterFacility,
	WheelchairAccess,
	YesNoUnknown,
} from '../../domain';
import { compassPointOf, osmUrl } from '../../domain';
import type { DirectionsPlatform } from '../directions';
import { directionsLink } from '../directions';
import { presentationOf } from '../presentation';

export type FactIcon =
	| 'elevation'
	| 'hours'
	| 'wheelchair'
	| 'changing-table'
	| 'fee'
	| 'unisex'
	| 'seasonal'
	| 'bottle'
	| 'operator'
	| 'note';

export type DetailFact = {
	readonly icon: FactIcon;
	readonly label: string;
	readonly value: string | null;
};

export type DetailWarning = {
	readonly title: string;
	readonly body: string;
};

export type DetailLive = {
	readonly distance: Meters;
	readonly bearing: Heading | null;
	readonly compassPoint: CompassPoint | null;
};

export type DetailView = {
	readonly id: FacilityId;
	readonly kind: FacilityKind;
	readonly kindLabel: string;
	readonly title: string;
	readonly nearest: boolean;
	readonly identity: string;
	readonly osmId: number;
	readonly osmUrl: string;
	readonly coordinates: Coordinates;
	readonly directionsUrl: string;
	readonly directionsLabel: string;
	readonly live: DetailLive;
	readonly warnings: readonly DetailWarning[];
	readonly description: string | null;
	readonly facts: readonly DetailFact[];
	readonly photo: Photo | null;
	readonly links: readonly ExternalLink[];
};

export const NOT_DRINKABLE_WARNING: DetailWarning = {
	title: 'Not Drinkable',
	body: 'This water source is not safe for drinking.',
};

const fact = (icon: FactIcon, label: string, value: string | null = null): DetailFact => ({
	icon,
	label,
	value,
});

const isFact = (candidate: DetailFact | null): candidate is DetailFact => candidate !== null;

const wheelchairFact = (access: WheelchairAccess): DetailFact | null => {
	switch (access) {
		case 'yes':
			return fact('wheelchair', 'Wheelchair Accessible');
		case 'no':
			return fact('wheelchair', 'Not wheelchair accessible');
		case 'limited':
			return fact('wheelchair', 'Limited wheelchair access');
		case 'unknown':
			return null;
		default: {
			const exhaustive: never = access;
			return exhaustive;
		}
	}
};

const yesNoFact = (
	icon: FactIcon,
	value: YesNoUnknown,
	labels: { readonly yes: string; readonly no: string | null }
): DetailFact | null => {
	switch (value) {
		case 'yes':
			return fact(icon, labels.yes);
		case 'no':
			return labels.no === null ? null : fact(icon, labels.no);
		case 'unknown':
			return null;
		default: {
			const exhaustive: never = value;
			return exhaustive;
		}
	}
};

const commonFacts = (facility: Facility): readonly (DetailFact | null)[] => [
	facility.openingHours === undefined ? null : fact('hours', 'Hours', facility.openingHours),
	facility.operator === undefined ? null : fact('operator', 'Operator', facility.operator),
	facility.note === undefined ? null : fact('note', 'Note', facility.note),
];

const waterFacts = (facility: WaterFacility): readonly (DetailFact | null)[] => [
	wheelchairFact(facility.wheelchair),
	facility.seasonal ? fact('seasonal', 'Seasonal') : null,
	facility.bottleRefill ? fact('bottle', 'Bottle refill') : null,
];

const toiletFacts = (facility: ToiletFacility): readonly (DetailFact | null)[] => [
	wheelchairFact(facility.accessibility.wheelchair),
	yesNoFact('changing-table', facility.accessibility.changingTable, {
		yes: 'Baby changing table',
		no: 'No changing table',
	}),
	yesNoFact('fee', facility.fee, { yes: 'Fee required', no: 'Free' }),
	yesNoFact('unisex', facility.unisex, { yes: 'Gender-neutral', no: null }),
];

const viewpointFacts = (facility: ViewpointFacility): readonly (DetailFact | null)[] => [
	facility.elevation === undefined
		? null
		: fact('elevation', 'Elevation', `${facility.elevation} m`),
];

const kindFacts = (facility: Facility): readonly (DetailFact | null)[] => {
	switch (facility.kind) {
		case 'water':
			return waterFacts(facility);
		case 'toilet':
			return toiletFacts(facility);
		case 'viewpoint':
			return viewpointFacts(facility);
		default: {
			const exhaustive: never = facility;
			return exhaustive;
		}
	}
};

export const factsOf = (facility: Facility): readonly DetailFact[] =>
	[...kindFacts(facility), ...commonFacts(facility)].filter(isFact);

export const warningsOf = (facility: Facility): readonly DetailWarning[] =>
	facility.kind === 'water' && !facility.drinkable ? [NOT_DRINKABLE_WARNING] : [];

const descriptionOf = (facility: Facility): string | null =>
	facility.kind === 'viewpoint' && facility.description !== undefined ? facility.description : null;

const liveOf = (item: Located<Facility>, course: GuidanceCourse | null): DetailLive =>
	course === null
		? { distance: item.distance, bearing: null, compassPoint: null }
		: {
				distance: course.distance,
				bearing: course.bearing,
				compassPoint: compassPointOf(course.bearing),
			};

const destinationNameOf = (facility: Facility, kindLabel: string): string =>
	facility.name ?? `${kindLabel} ${facility.osm.id}`;

export const detailViewOf = (
	item: Located<Facility>,
	course: GuidanceCourse | null,
	platform: DirectionsPlatform
): DetailView => {
	const { facility } = item;
	const kindLabel = presentationOf(facility).label;
	const destinationName = destinationNameOf(facility, kindLabel);
	return {
		id: facility.id,
		kind: facility.kind,
		kindLabel,
		title: facility.name ?? kindLabel,
		nearest: item.isNearest,
		identity: `${facility.osm.type} ${facility.osm.id}`,
		osmId: facility.osm.id,
		osmUrl: osmUrl(facility.osm),
		coordinates: facility.coordinates,
		directionsUrl: directionsLink(platform, {
			coordinates: facility.coordinates,
			name: destinationName,
		}),
		directionsLabel: `Get walking directions to ${destinationName}`,
		live: liveOf(item, course),
		warnings: warningsOf(facility),
		description: descriptionOf(facility),
		facts: factsOf(facility),
		photo: facility.media.photo,
		links: facility.media.links,
	};
};
