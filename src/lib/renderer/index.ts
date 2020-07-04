import { createObserved, subscribe, trackObservables } from "../observed";
import { Component, Instance, State } from "./types";
import { isTemplate, Template } from "./parser";
import { html } from "./parser";

export { html };

let toDiff: Instance<any>[] = [];

export function queue(inst: Instance<any>) {
	if (!toDiff.length)
		requestAnimationFrame(() => {
			toDiff.forEach((inst) => diffComponent(inst));
			toDiff = [];
		});

	!toDiff.includes(inst) && toDiff.push(inst);
}

let currentRendering: Instance<any> | null = null;

export function getCurrentRendering(): Instance<any> {
	if (!currentRendering) throw new Error("No component currently rendering");
	return currentRendering;
}

export function renderComponent<Props>(
	init: Component<Props>,
	props: Props,
	parent: Node
): Instance<Props> {
	props = createObserved(props);

	// possibly bad idea
	const instance: Instance<Props> = (({
		props,
		observables: [],
		hooks: [],
		elements: [],
		components: [],
		parent,
		constructor: init,
	} as Partial<Instance<Props>>) as unknown) as Instance<Props>;
	currentRendering = instance;

	let render = init;
	const [tmpl, observables] = trackObservables(() => {
		let tmpl = render(props);
		if (isTemplate(tmpl)) return tmpl;
		render = tmpl;
		return render(props);
	});
	const state = tmpl.exec(parent);

	Object.assign(instance, state, { render });

	instance.observables = observables.map((obs) => [
		obs,
		subscribe(obs, () => queue(instance)),
	]);

	return instance;
}

function diffComponent<Props>(instance: Instance<Props>) {
	const [tmpl, observables] = trackObservables(() =>
		instance.render(instance.props)
	);
	const state = tmpl.exec(instance.parent, instance);

	instance.elements
		.slice(1)
		.filter((e) => !state.elements.includes(e))
		.map(({ parent, self }) => self instanceof Node && self.isConnected && parent.removeChild(self));
	instance.components
		.filter((c) => !state.components.includes(c))
		.map((c) => destroyComponent(c));

	instance.observables
		.filter((o) => !observables.includes(o[0]))
		.map((o) => o[1]());

	instance.observables = observables.map(
		(obs) =>
			instance.observables.find((io) => io[0] === obs) || [
				obs,
				subscribe(obs, () => queue(instance)),
			]
	);
}

export function destroyState(state: State) {
	state.elements
		.slice(1)
		.map(({ parent, self}) => self instanceof Node && self.isConnected && parent.removeChild(self));
	state.components.map((c) => destroyComponent(c));
}

export function destroyComponent(inst: Instance<any>) {
	inst.hooks.map((f) => f());
	inst.observables.map((o) => o[1]());
	destroyState(inst);
}

// function diffComponent<Props>(
//   component: Component<Props>,
//   props: Props,
//   data: Data,
//   state: State
// ) {
//   component(props, data, [])(parent, state);
// }

export function render(template: Template, parent: Element) {
	template.exec(parent);
}
