import "todomvc-app-css/index.css";
// import "./styles.css";
import { html, render, data, computed } from "./lib";
import clsx from "clsx";
import { subscribe } from "./lib/observed";

export const SHOW_ALL = "show_all";
export const SHOW_COMPLETED = "show_completed";
export const SHOW_ACTIVE = "show_active";

// type Filters = "show_all" | "show_completed" | "show_active";

interface Todo {
	text: string;
	id: number;
	completed: boolean;
	complete(): void;
	remove(): void;
	edit(text: string): void;
}

interface StoreWithoutComputed {
	todos: Todo[];
	filter: string;
	addTodo(text: string): void;
	removeTodo(todo: Todo): void;
	completeAll(): void;
	clearCompleted(): void;
	setFilter(filter: string): void;
}

interface Store extends StoreWithoutComputed {
	completedCount: number;
	activeCount: number;
	filteredTodos: Todo[];
}

// const filterType = types.union(...[SHOW_ALL, SHOW_COMPLETED, SHOW_ACTIVE].map(types.literal))
const TODO_FILTERS: { [key: string]: (todo: Todo) => boolean } = {
	[SHOW_ALL]: () => true,
	[SHOW_ACTIVE]: (todo) => !todo.completed,
	[SHOW_COMPLETED]: (todo) => todo.completed,
};

const parent = document.querySelector("main")!;

const TodoTextInput = (props: {
	text?: string;
	onSave: (text: string) => void;
	newTodo: boolean;
	editing: boolean;
	placeholder: string;
}) => {
	const state = data({
		text: props.text || "",
	});

	subscribe(state, (e) => {
		console.error(e);
	});

	const handleSubmit = (e: KeyboardEvent) => {
		const text = (e.target! as HTMLInputElement).value.trim();
		if (e.which === 13) {
			e.preventDefault();
			e.stopPropagation();
			if (props.newTodo) state.text = "";
			props.onSave(text);
			console.log("save", text, props.newTodo, state.text, state);
		}
	};

	const handleChange = (e: Event) => {
		state.text = (e.target! as HTMLInputElement).value;
	};

	const handleBlur = (e: Event) => {
		if (!props.newTodo) {
			props.onSave((e.target! as HTMLInputElement).value);
		}
	};

	return () => {
		console.log("render", state.text, props.placeholder);

		return html`
			<input
				class=${clsx({ edit: props.editing, "new-todo": props.newTodo })}
				type="text"
				placeholder=${props.placeholder}
				autofocus="true"
				value=${state.text}
				@blur=${handleBlur}
				@change=${handleChange}
				@keydown=${handleSubmit}
			/>
		`;
	};
};

const TodoItem = (props: { todo: Todo }) => {
	const state = data({
		editing: false,
	});

	const handleDoubleClick = () => {
		state.editing = true;
	};

	const handleSave = (text: string) => {
		const { todo } = props;
		if (text.length === 0) {
			todo.remove();
		} else {
			todo.edit(text);
		}
		state.editing = false;
	};

	return () => {
		const todo = props.todo;
		let element;
		if (state.editing) {
			element = html`
				<${TodoTextInput}
					text=${todo.text}
					editing=${state.editing}
					onSave=${(text: string) => handleSave(text)}
				/>
			`;
		} else {
			element = html`
				<div class="view">
					<input
						class="toggle"
						type="checkbox"
						checked=${todo.completed}
						@change=${() => todo.complete()}
					/>
					<label @dblclick=${handleDoubleClick}>${todo.text}</label>
					<button class="destroy" @click=${() => todo.remove()} />
				</div>
			`;
		}

		return html`
			<li
				class=${clsx({
					completed: todo.completed,
					editing: state.editing,
				})}
			>
				${element}
			</li>
		`;
	};
};

const MainSection = (props: { store: Store }) => {
	function renderToggleAll() {
		const { store } = props;
		if (store.todos.length > 0) {
			return html`
				<span>
					<input
						class="toggle-all"
						id="toggle-all"
						type="checkbox"
						checked=${store.completedCount === store.todos.length}
						@change=${() => store.completeAll()}
					/>
					<label for="toggle-all">Mark all as complete</label>
				</span>
			`;
		}
	}

	function renderFooter() {
		const { store } = props;

		if (store.todos.length) {
			return html` <${Footer} store=${store} /> `;
		}
	}

	return () => {
		const { filteredTodos } = props.store;

		return html`
			<section class="main">
				${renderToggleAll()}
				<ul class="todo-list">
					${filteredTodos.map(
						(todo) => html` <${TodoItem} key=${todo.id} todo=${todo} /> `
					)}
				</ul>
				${renderFooter()}
			</section>
		`;
	};
};

const FILTER_TITLES = {
	[SHOW_ALL]: "All",
	[SHOW_ACTIVE]: "Active",
	[SHOW_COMPLETED]: "Completed",
};

const Footer = (props: { store: Store }) => {
	function renderTodoCount() {
		const { activeCount } = props.store;
		const itemWord = activeCount === 1 ? "item" : "items";

		return html`
			<span class="todo-count">
				<strong>${activeCount || "No"}</strong> ${itemWord} left
			</span>
		`;
	}

	function renderFilterLink(filter: string) {
		// @ts-ignore
		const title = FILTER_TITLES[filter];
		const { store } = props;
		const selectedFilter = store.filter;

		return html`
			<a
				class=${clsx({ selected: filter === selectedFilter })}
				style=${{ cursor: "pointer" }}
				@click=${() => store.setFilter(filter)}
			>
				${title}
			</a>
		`;
	}

	function renderClearButton() {
		const { completedCount, clearCompleted } = props.store;
		if (completedCount > 0) {
			return html`
				<button class="clear-completed" @click=${() => clearCompleted()}>
					Clear completed
				</button>
			`;
		}
	}

	return () => html`
		<footer class="footer">
			${renderTodoCount()}
			<ul class="filters">
				${[SHOW_ALL, SHOW_ACTIVE, SHOW_COMPLETED].map(
					(filter) => html` <li key=${filter}>${renderFilterLink(filter)}</li> `
				)}
			</ul>
			${renderClearButton()}
		</footer>
	`;
};

const Header = (props: { addTodo: (text: string) => void }) => {
	const handleSave = (text: string) => {
		if (text.length !== 0) {
			props.addTodo(text);
		}
	};

	return () =>
		html`
			<header class="header">
				<h1>todos</h1>
				<${TodoTextInput}
					newTodo
					onSave=${handleSave}
					placeholder="What needs to be done?"
				/>
			</header>
		`;
};

export const App = () => {
	const internal = data<StoreWithoutComputed>({
		todos: [],
		filter: SHOW_ALL,
		addTodo(text: string) {
			store.todos.push({
				text,
				completed: false,
				id:
					internal.todos.reduce((maxId, todo) => Math.max(todo.id, maxId), -1) +
					1,
				complete() {
					this.completed = !this.completed;
				},
				remove() {
					internal.removeTodo(this);
				},
				edit(text: string) {
					this.text = text;
				},
			});
		},
		removeTodo(todo: Todo): void {
			internal.todos.splice(internal.todos.indexOf(todo) >>> 0, 1);
		},
		completeAll(): void {
			const areAllMarked = internal.todos.every((todo) => todo.completed);
			internal.todos.forEach((todo) => (todo.completed = !areAllMarked));
		},
		clearCompleted(): void {
			internal.todos
				.filter((todo) => todo.completed)
				.forEach((todo) => internal.removeTodo(todo));
		},
		setFilter(filter: string): void {
			internal.filter = filter;
		},
	});

	const store = computed<Store>(() => ({
		...internal,
		completedCount: internal.todos.filter((t) => t.completed).length,
		activeCount:
			internal.todos.length - internal.todos.filter((t) => t.completed).length,
		filteredTodos: internal.todos.filter(TODO_FILTERS[internal.filter]),
	}));

	return () =>
		html`
			<div class="todoapp">
				<${Header} addTodo=${store.addTodo} />
				<${MainSection} store=${store} />
			</div>
		`;
};

// render(
//   html`
//     <${App} />
//   `,
//   parent
// );
