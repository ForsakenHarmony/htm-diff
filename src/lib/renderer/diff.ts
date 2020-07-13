import { Obj } from "../observed";
import { isTemplate } from "./parser";
import {
	Component,
	Elements,
	Instance,
	OperationType,
	Operation,
	State,
	Thing,
	Template,
} from "./types";
import { destroyState, renderComponent } from "./index";
import { tmplSym } from "../consts";

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
	self: Element,
	props: { [key: string]: any } = {}
): State["elements"][0] {
	return {
		self,
		props,
	};
}

export function evaluate(
	template: Template,
	ops: Operation[],
	dynamics: any[]
	// parent: Node
): State {
	let parent = document.createDocumentFragment();
	let elements: State["elements"] = [makeElement((parent as Node) as Element)];
	let components: Instance<any>[] = [];
	let currentElement: number[] = [0];
	let component: Component<any> | null = null;
	let props: Obj | null = null;
	let text: [Element, Elements][] = [];

	let el: () => Thing = () =>
		elements[currentElement[currentElement.length - 1]];

	let finishComponent = () => {
		if (component === null || props === null) throw new Error("invariant");
		let comp = renderComponent(component!, props);
		let current = el().self;
		current.append(...comp.state.rootElements);
		components.push(comp);
		component = null;
		props = null;
	};

	const match = {
		[OperationType.Element]: (tag: string) => {
			let newElement = document.createElement(tag);
			let current = el().self;
			if (current) current.appendChild(newElement);
			let idx = elements.push(makeElement(newElement)) - 1;
			currentElement.push(idx);
		},
		[OperationType.Up]: () => {
			currentElement.pop();
		},
		[OperationType.Text]: (content: any) => {
			let elem = el();
			let res = handleText(content, elem.self);

			text.push([elem.self, res]);
		},
		[OperationType.Component]: (comp: Component<any>) => {
			component = comp;
			props = {};
		},
		[OperationType.Attribute]: (key: string, val: any) => {
			if (component && props) {
				props[key] = val;
				return;
			}
			let elem = el();
			let current = elem.self;
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

			if (mapped === "key") {
				// skip
			} else if (mapped === "style") {
				Object.assign(
					((current as unknown) as ElementCSSInlineStyle).style,
					val
				);
			} else if (elem.props[mapped] !== val) {
				(current as any)[mapped] = val;
			}
			elem.props[mapped] = val;
		},
	} as { [typ: string]: Function };

	let len = ops.length;
	for (let i = 0; i < len; i++) {
		let typ = ops[i].typ;
		if (component !== null && typ !== OperationType.Attribute)
			finishComponent();
		let fn = match[typ];
		if (!fn) throw new Error("not a valid operation");
		fn(
			...ops[i].args.map((arg) => (Array.isArray(arg) ? dynamics[arg[0]] : arg))
		);
	}
	if (component !== null) {
		finishComponent();
	}

	return {
		rootElements: Array.from(parent.children),
		elements,
		text,
		components,
		template,
		key: template.key,
	};
}

export function destroy(element: Elements): void {
	if (element == null) {
		return;
	} else if (Array.isArray(element)) element.forEach((e) => destroy(e));
	else if (element instanceof Node || element instanceof Text)
		element.isConnected && element.parentNode!.removeChild(element);
	else destroyState(element);
}

function insertBefore(parent: Element, elements: Element[], ref: Node | null) {
	for (let i = 0; i < elements.length; i++) {
		console.log("insertBefore", elements[i], ref);
		parent.insertBefore(elements[i], ref);
	}
}

function handleText(
	content: any,
	parent: Element,
	element?: Elements
): Elements {
	if (content == null || content === false) {
		element && destroy(element);
		return null;
	} else if (Array.isArray(content)) {
		if (!element)
			return content.reduce((acc, c) => acc.concat(handleText(c, parent)), []);

		if (!Array.isArray(element)) {
			if (element && "rootElements" in element) {
				element = [element];
			} else {
				destroy(element);
				element = [];
			}
		}

		let existing = <State[]>element;
		let next = <Template[]>content;

		let diffed = [];
		let keep = [];

		let skew = 0;
		let alreadyDiffed = new Map();

		console.log(element, content);
		for (let i = 0; i < next.length; i++) {
			// previously empty
			if (existing.length === 0) {
				let state = next[i].exec();
				diffed.push(state);
				insertBefore(parent, state.rootElements, null);
				continue;
			}
			let key = next[i].key;
			for (let j = 0; j < existing.length; j++) {
				let other = existing[j].key;
				// console.log(i, key, j, other);
				if (key != null && key === other) {
					keep[j] = true;
					diffed[i] = next[i].exec(existing[j]);

					let skewed = j + i;
					// position has to change, we can push back stuff that's after it's old positions
					if (i < skewed) {
						let offset = i - skew;
						// skip the ones we already diffed
						while (
							offset < existing.length &&
							alreadyDiffed.get(existing[offset].key)
						)
							offset++;

						if (j !== offset)
							insertBefore(
								parent,
								diffed[i].rootElements,
								offset < existing.length
									? existing[offset].rootElements[0]
									: null
							);
						skew++;
					}
					alreadyDiffed.set(key, true);
					break;
				} else if (j === existing.length - 1) {
					// no match found, create new
					let state = next[i].exec();
					diffed[i] = state;
					insertBefore(
						parent,
						state.rootElements,
						i >= existing.length ? null : existing[i].rootElements[0]
					);
				}
			}
		}

		// console.log(keep);
		for (let i = 0; i < existing.length; i++) {
			if (keep[i]) continue;
			destroy(existing[i]);
		}

		return diffed;
	} else if (isTemplate(content)) {
		if (Array.isArray(element) && element.length === 1) element = element[0];

		if (Array.isArray(element)) {
			return handleText([content], parent, element);
		} else if (!element) {
			let state = content.exec();
			parent.append(...state.rootElements);
			return state;
		} else if (
			element instanceof Node ||
			element.template[tmplSym] !== content[tmplSym]
		) {
			destroy(element);
			let state = content.exec();
			parent.append(...state.rootElements);
			return state;
		} else {
			return content.exec(element);
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

	const match = {
		[OperationType.Text]: (idx: number, content: any) => {
			let [parent, current] = instance.text[idx];
			instance.text[idx][1] = handleText(content, parent, current);
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
			if (mapped === "key") {
				// skip
			} else if (mapped === "style") {
				Object.assign(
					((element as unknown) as ElementCSSInlineStyle).style,
					val
				);
			} else if (elem.props[mapped] !== val) (element as any)[mapped] = val;
			elem.props[mapped] = val;
		},
	} as { [typ: string]: Function };

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
