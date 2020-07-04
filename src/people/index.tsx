import { Profile } from "./profile";
import { createStore } from "./store";

import "./styles/index.scss";
import { data, html } from "../lib";

export const App = () => {
	const store = createStore();
	store.loadUsers().catch(console.error);

	const state = data({
		id: "",
	});

	function clickLink(e: Event) {
		e.preventDefault();
		const href = (e.target as HTMLAnchorElement).href;
		state.id = href.split("/")[1];
	}

	return () => html`
		<div id="people-app">
			<nav>
				<div style=${{ margin: 16, textAlign: "center" }}>
					Sort by ${" "}
					<select
						value=${store.usersOrder}
						@change=${(ev: any) => {
							store.setUsersOrder(ev.target.value);
						}}
					>
						<option value="name">Name</option>
						<option value="id">ID</option>
					</select>
				</div>
				<ul>
					${store.getSortedUsers().map(
						(user, i) =>
							html`<li
								key=${user.id}
								style=${{
									animationDelay: `${i * 20}ms`,
									top: `calc(var(--menu-item-height) * ${i})`,
									transitionDelay: `${i * 20}ms`,
								}}
							>
								<a href=${`people/${user.id}`} active @click=${clickLink}>
									<img class="avatar" src=${user.picture.large} />
									${user.name.first} ${user.name.last}
								</a>
							</li>`
					)}
				</ul>
			</nav>
			<section id="people-main">
				${state.id ? html`<${Profile} store=${store} id=${state.id} />` : null}
			</section>
		</div>
	`;
};
