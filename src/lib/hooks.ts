import { getCurrentRendering } from "./renderer";
import {
	createObserved,
	Obj,
	ObservedObj,
	subscribe,
	trackObservables,
} from "./observed";

export function data<Data extends Obj>(initial: Data): Data {
	return createObserved(initial);
}

export function computed<Data extends Obj>(exec: () => Data): Data {
	const comp = getCurrentRendering();

	const [res, observables] = trackObservables(exec);
	const state = data(res);
	let subscribed: Function[] = [];

	function unsub() {
		subscribed.map((s) => s());
	}

	let queued = false;
	function enqueue() {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => recompute());
	}

	function recompute() {
		const [res, obs] = trackObservables(exec);
		Object.assign(state, res);
		subscribeToAll(obs);
		queued = false;
	}

	function subscribeToAll(observables: ObservedObj[]) {
		subscribed = observables.map((o) => subscribe(o, enqueue));
	}

	subscribeToAll(observables);

	comp.hooks.push(unsub);

	return state;
}
