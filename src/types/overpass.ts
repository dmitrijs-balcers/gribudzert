export type Overpass = {
	readonly version: number;
	readonly generator: string;
	readonly osm3s: Osm3S;
	readonly elements: Element[];
};

export type Element = {
	readonly type: 'node';
	readonly id: number;
	readonly lat: number;
	readonly lon: number;
	readonly tags: Tags;
};

export type Tags = {
	readonly amenity: 'drinking_water';
	readonly man_made?: 'water_tap';
	readonly access?: Access;
	readonly drinking_water?: Access;
	readonly fee?: Covered;
	readonly operator?: Operator;
	readonly 'operator:wikidata'?: 'Q124713902';
	readonly seasonal?: Covered;
	readonly bottle?: Access;
	readonly note?: Note;
	readonly wheelchair?: Access;
	readonly fountain?: string;
	readonly indoor?: Covered;
	readonly level?: string;
	readonly colour?: string;
	readonly dog?: Access;
	readonly mapillary?: string;
	readonly start_date?: string;
	readonly covered?: Covered;
	readonly panoramax?: string;
	readonly height?: string;
	readonly fixme?: string;
	readonly image?: string;
	readonly lit?: Access;
};

export type Access = 'yes' | 'customers';

export type Covered = 'no' | 'yes';

export type Note = 'turned off during winter' | 'dismantled during winter';

export type Operator = 'Rīgas ūdens' | 'Mārupes komunālie pakalpojumi' | 'Riga Airport';

export type Osm3S = {
	readonly timestamp_osm_base: Date;
	readonly copyright: string;
};
