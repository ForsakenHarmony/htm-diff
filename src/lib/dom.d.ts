interface Node extends EventTarget {
	__listeners?: {
		[name: string]: {
			fn: (evt: Event) => void;
			listen: (evt: Event) => void;
		};
	};
}
