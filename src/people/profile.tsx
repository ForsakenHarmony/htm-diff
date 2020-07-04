// import { RouteChildProps } from "./router"
import { Store } from "./store";
import { data, html, computed } from "../lib";

export type ProfileProps = {
	id: string;
	store: Store;
};

export const Profile = ({ id, store }: ProfileProps) => {
	const state = data({
		busy: false,
		id: "",
		user: null,
	});

	const remove = async () => {
		state.busy = true;
		await new Promise<void>((cb) => setTimeout(cb, 1500));
		store.deleteUser(state.id);
		state.busy = false;
	};

	const { user } = computed(() => ({
		id: id,
		user: store.users.find((u: { id: string }) => u.id === id),
	}));

	return () =>
		user == null
			? null
			: html`
					<div class="profile">
						<img class="avatar" src=${user.picture.large} />
						<h2>
							${user.name.first} ${user.name.last}
						</h2>
						<div class="details">
							<p>
								${user.gender === "female" ? "👩" : "👨"} {user.id}
							</p>
							<p>🖂 ${user.email}</p>
						</div>
						<p>
							<button
								class=${state.busy ? "secondary busy" : "secondary"}
								disabled=${state.busy}
								@click=${remove}
							>
								Remove contact
							</button>
						</p>
					</div>
			  `;
};
