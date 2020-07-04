import { Obj } from "../observed";
import { isTemplate, Template, tmplSym } from "./parser";
import {
	Component,
	Elements,
	Instance,
	OperationType,
	Operation,
	State, Thing,
} from "./types";
import { destroyState, renderComponent } from "./index";

const evtMap: { [name: string]: (e: Event) => any } = {
	// @ts-ignore
	// change: (e: Event) => e.target.value,
	// @ts-ignore
	// input: (e: Event) => e.target.value
};

const attrMap: { [name: string]: string } = {
	class: "className",
};

function makeElement(
	parent: Node,
	self: Elements,
	props: { [key: string]: any } = {},
): State["elements"][0] {
	return {
		parent,
		self,
		props,
	};
}

export function evaluate(
	template: Template,
	ops: Operation[],
	dynamics: any[],
	parent: Node
): State {
	let elements: State["elements"] = [makeElement(parent.parentNode!, parent)];
	let components: Instance<any>[] = [];
	// let dynamic: any[] = [];
	let currentElement: number[] = [0];
	let component: Component<any> | null = null;
	let props: Obj | null = null;

	// const el: () => Node | undefined = () => {
	//   let elem: Node | undefined = undefined;
	//
	//   for (let i = elements.length - 1; i >= 0; --i) {
	//     const item = elements[i];
	//     if (!Array.isArray(item)) {
	//       elem = item;
	//       break;
	//     }
	//   }
	//
	//   return elem;
	// };
	let el: () => Thing = () => elements[currentElement[currentElement.length - 1]];

	let finishComponent = () => {
		if (component === null || props === null) throw new Error("invariant");
		components.push(renderComponent(component!, props, el().self as Node));
		component = null;
		props = null;
	};

	const match = ({
		[OperationType.Element]: (tag: string) => {
			let newElement = document.createElement(tag);
			let current = el().self as Node;
			if (current) current.appendChild(newElement);
			let idx = elements.push(makeElement(current, newElement)) - 1;
			currentElement.push(idx);
		},
		[OperationType.Up]: () => {
			currentElement.pop();
		},
		[OperationType.Text]: (content: any) => {
			let elem = el();
			elements.push(makeElement(elem.self as Node, handleText(content, elem.self as Node)));
		},
		[OperationType.Component]: (comp: Component<any>) => {
			// FIXME
			// components.push(renderComponent(arg(), {}, el()!));
			component = comp;
			props = {};
		},
		[OperationType.Attribute]: (key: string, val: any) => {
			if (component && props) {
				props[key] = val;
				return;
			}
			let elem = el();
			let current = elem.self as Element;
			if (!el) throw new Error("no element to assign attr to");
			let name = key as string;
			if (name.startsWith("@")) {
				let evt = name.slice(1);
				let listeners = current.__listeners || (current.__listeners = {});
				let fn = val;
				listeners[evt] = { fn, listen: evtHandler.bind(null, evt, fn) };
				current.addEventListener(evt, listeners[evt].listen);
				elem.props[name] = val;
				return;
			}

			let mapped = attrMap[name] || name;
			// console.log("eval", current, mapped, val);

			if (mapped === "style") {
				Object.assign(
					((current as unknown) as ElementCSSInlineStyle).style,
					val
				);
			} else if (elem.props[mapped] !== val) {
				(current as any)[mapped] = val;
			}
		},
	} as any) as Function[];

	let len = ops.length;
	for (let i = 0; i < len; i++) {
		let typ = ops[i].typ;
		if (
			component !== null &&
			typ !== OperationType.Attribute
		)
			finishComponent();
		let fn = match[typ];
		if (!fn) throw new Error("not a valid operation");
		fn(
			...ops[i].args.map((arg) => (Array.isArray(arg) ? dynamics[arg[0]] : arg))
		);
	}

	return {
		elements,
		components,
		template,
	};
}

export function destroy(element: Elements): void {
	if (Array.isArray(element)) element.forEach((e) => destroy(e));
	else if (element instanceof Node || element instanceof Text)
		element.parentNode!.removeChild(element);
	else destroyState(element);
}

function handleText(content: any, parent: Node, element?: Elements): Elements {
	if (content == null || content === false) {
		element && destroy(element);
		return [];
	} else if (Array.isArray(content)) {
		if (!element)
			return content.reduce((acc, c) => acc.concat(handleText(c, parent)), []);
		// TODO: MAGIC SHIT

		if (!Array.isArray(element)) element = [element];

		// const keep = [];
		// const newArr = [];

		// const toRemove = [];

		// let ci = 0, cl = content.length;
		// let eo = 0, ei = 0, el = element.length;
		//
		// for (; ci < cl; ci++) {
		//   let contentEl = content[ci];
		//   for (ei = eo; ei < el; ei++) {
		//
		//   }
		// }

		console.log(element, content);
		// destroy(toRemove);

		destroy(element);
		return content.reduce((acc, c) => acc.concat(handleText(c, parent)), []);
		// return content.map(c => handleText(c, element));
	} else if (isTemplate(content)) {
		if (Array.isArray(element)) {
			return handleText([content], parent, element);
		} else if (!element) {
			return content.exec(parent);
		} else if (
			element instanceof Node ||
			element.template[tmplSym] !== content[tmplSym]
		) {
			destroy(element);
			return content.exec(parent);
		} else {
			return content.exec(parent, element);
		}
	} else if (element instanceof Text) {
		(element as Text).data = content;
		return element;
	}
	element && destroy(element);
	const newElement = document.createTextNode(content as string);
	parent.appendChild(newElement);
	return newElement;
}

function evtHandler(evt: string, fn: (evt: Event) => void, e: Event) {
	fn(evtMap[evt] ? evtMap[evt](e) : e);
}

export function diff(
	_template: Template,
	diffOps: Operation[],
	dynamics: any[],
	instance: State
): State {
	let component: Instance<any> | null = null;

	// const el = () => elements[currentElement[currentElement.length - 1]];

	const match = ({
		[OperationType.Text]: (idx: number, content: any) => {
			const el = instance.elements[idx];
			instance.elements[idx] = makeElement(el.parent, handleText(content, el.parent, el.self));

			// if (element instanceof Node) (element as Text).data = arg();
			//
			// if (Array.isArray(element)) return;
			//
			// (element as Text).data = arg();
		},
		[OperationType.Component]: (idx: number) => {
			component = instance.components[idx];
		},
		[OperationType.Attribute]: (key: string, val: any, idx: number) => {
			if (component) return (component.props[key] = val);

			const elem = instance.elements[idx];
			const element = elem.self as Node;
			// if (Array.isArray(element) || element instanceof ) return null;
			const name = key;

			if (name.startsWith("@")) {
				const evt = name.slice(1);
				const fn = val;
				const listeners = element.__listeners || (element.__listeners = {});
				if (listeners[evt].fn === fn) return;
				element.removeEventListener(evt, listeners[evt].listen);
				listeners[evt] = { fn, listen: evtHandler.bind(null, evt, fn) };
				element.addEventListener(evt, listeners[evt].listen);
				elem.props[name] = val;
				return;
			}

			const mapped = attrMap[name] || name;
			// console.log("diff", element, mapped, val);
			if (elem.props[mapped] !== val) (element as any)[mapped] = val;
		},
	} as any) as Function[];

	let len = diffOps.length;
	for (let i = 0; i < len; i++) {
		let typ = diffOps[i].typ;
		if (component !== null && typ !== OperationType.Attribute) component = null;
		let fn = match[typ];
		if (!fn) throw new Error("not a valid operation");
		fn(
			...diffOps[i].args.map((arg) =>
				Array.isArray(arg) ? dynamics[arg[0]] : arg
			)
		);
	}

	return instance;
}
