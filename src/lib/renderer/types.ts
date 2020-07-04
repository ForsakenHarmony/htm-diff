import { ObservedObj } from "../observed";
import { Template } from "./parser";

export const enum OperationType {
	// create element
	// @args tagName
	Element,
	// go up one level
	Up,
	// create text node
	// @args tagName
	Text,
	// render component
	// @args component
	Component,
	// set attribute
	// @args key value
	Attribute,
}

// export type Operations = (number | string | boolean | [number])[];
export type Operation = {
	typ: OperationType;
	args: any[];
};

export type Elements = Node | State | ElementsArray;
export interface ElementsArray extends Array<Elements> {}

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
	parent: Node;
	self: Elements;
	props: { [key: string]: any };
}

export interface State {
	elements: Thing[];
	components: Instance<any>[];
	template: Template;
}

export interface Instance<Props> extends State {
	props: Props;
	render: ComponentFn<Props>;
	observables: [ObservedObj, Function][];
	hooks: Function[];
	parent: Node;
	constructor: ComponentInit<Props>;
}
