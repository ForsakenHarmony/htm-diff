import { html, data } from "./lib";

function createItems(count = 10) {
	let items = [];
	for (let i = 0; i < count; i++) {
		items.push({
			label: `Item #${i + 1}`,
			key: i + 1,
		});
	}
	return items;
}

function random() {
	return Math.random() < 0.5 ? 1 : -1;
}

export const App = () => {
	const state = data({
		items: createItems(),
		count: 1,
		useKeys: false,
	});

	const shuffle = () => {
		state.items = state.items.slice().sort(random);
	};

	const swapTwo = () => {
		let items = state.items.slice(),
			first = Math.floor(Math.random() * items.length),
			second;
		do {
			second = Math.floor(Math.random() * items.length);
		} while (second === first);
		let other = items[first];
		items[first] = items[second];
		items[second] = other;
		state.items = items;
	};

	const reverse = () => {
		state.items = state.items.slice().reverse();
	};

	const setCount = (e: Event) => {
		state.count = Math.round(
			parseInt((e.target! as HTMLInputElement).value, 10)
		);
	};

	const rotate = () => {
		let { items, count } = state;
		state.items = items.slice(count).concat(items.slice(0, count));
	};

	const rotateBackward = () => {
		let { items, count } = state,
			len = items.length;
		state.items = items
			.slice(len - count, len)
			.concat(items.slice(0, len - count));
	};

	const toggleKeys = () => {
		state.useKeys = !state.useKeys;
	};

	const renderItem = (item: { key: number; label: string }) =>
		html`<li key=${state.useKeys ? item.key : null}>${item.label}</li>`;

	return () => html`
		<div class="reorder-demo">
			<header>
				<button @click=${shuffle}>Shuffle</button>
				<button @click=${swapTwo}>Swap Two</button>
				<button @click=${reverse}>Reverse</button>
				<button @click=${rotate}>Rotate</button>
				<button @click=${rotateBackward}>Rotate Backward</button>
				<label
					><input
						type="checkbox"
						@click=${toggleKeys}
						checked=${state.useKeys}
					/>
					use keys?</label
				>
				<label
					><input
						type="number"
						step="1"
						min="1"
						style=${{ width: "3em" }}
						@input=${setCount}
						value=${state.count}
					/>
					count</label
				>
			</header>
			<ul>
				${state.items.map(renderItem)}
			</ul>
		</div>
	`;
};
