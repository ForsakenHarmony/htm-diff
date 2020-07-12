import { ObservedObj } from "../observed";
import { tmplSym } from "../consts";

export const enum OperationType {
	// create element
	// @args tagName
	Element = "elem",
	// go up one level
	Up = "up",
	// create text node
	// @args tagName
	Text = "text",
	// render component
	// @args component
	Component = "comp",
	// set attribute
	// @args key value
	Attribute = "attr",
}

// export type Operations = (number | string | boolean | [number])[];
export type Operation = {
	typ: OperationType;
	args: any[];
};

export type Elements = Node | State | ElementsArray;
export interface ElementsArray extends Array<Elements> {}

export interface Template {
	exec(state?: State): State;
	key?: any;
	__raw: string;

	[tmplSym]: Function;
}

// type ContentTypes = null | undefined | boolean | string | Template | Content[];
export type Content =
	| null
	| undefined
	| boolean
	| string
	| Template
	| ContentArray;
export interface ContentArray extends Array<Content> {}

export interface ComponentFn<Props> {
	(props: Props): Template;
}

export interface ComponentInit<Props> {
	(props: Props): ComponentFn<Props>;
}

export type Component<Props> = ComponentInit<Props> | ComponentFn<Props>;

// export interface Instance<Props> {
//   elements: Node[];
//
//   props: Props;
//   fn: ComponentFn;
//
//   observables: ObservedObj[];
//   components: Instance<any>[];
// }

export interface Thing {
	parent: Element;
	self: Elements;
	props: { [key: string]: any };
}

export interface State {
	rootElements: Element[];
	elements: Thing[];
	components: Instance<any>[];
	template: Template;
	key?: any;
}

export interface Instance<Props> {
	props: Props;
	render: ComponentFn<Props>;
	observables: [ObservedObj, Function][];
	hooks: Function[];
	constructor: ComponentInit<Props>;
	state: State,
}
