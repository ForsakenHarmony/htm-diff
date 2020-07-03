// import { flow, Instance, types } from "mobx-state-tree"
import {data} from "../lib";

const cmp = <T, U>(fn: (x: T) => U) => (a: T, b: T): number => (fn(a) > fn(b) ? 1 : -1)

interface User {
  email: string,
  gender: "male" | "female",
  id: string,
  name: {
    first: string,
    last: string
  },
  picture: {
    large: string
  }
}

export interface Store {
  users: User[],
  usersOrder: "name" | "id"
  setUsersOrder(order: ("name" | "id")): void;
  addUser(): Promise<void>;
  loadUsers(): Promise<void>;
  deleteUser(id: string): void;
  getSortedUsers(): (any[])
}

// function createUser(): User {
//
// }

export function createStore(): Store {
  const store: Store = data({
    users: [],
    usersOrder: "name",

    getSortedUsers() {
      if (store.usersOrder === "name") return store.users.slice().sort(cmp<User, string>(x => x.name.first));
      if (store.usersOrder === "id") return store.users.slice().sort(cmp<User, string>(x => x.id));
      throw Error(`Unknown ordering ${store.usersOrder}`)
    },

    addUser() {
      return fetch("https://randomuser.me/api?results=1")
        .then(res => res.json())
        .then(data => data.results.map((user: any) => ({ ...user, id: user.login.username })))
        .then(data => {store.users.push(...data);});
    },
    loadUsers() {
      return fetch(`https://randomuser.me/api?seed=${12321}&results=12`)
        .then(res => res.json())
        .then(data => data.results.map((user: any) => ({ ...user, id: user.login.username })))
        .then(data => {store.users = data;});
    },
    deleteUser(id: string) {
      const user = store.users.find(u => u.id === id)
      if (user != null) store.users.splice(store.users.indexOf(user), 1)
    },
    setUsersOrder(order: "name" | "id") {
      store.usersOrder = order
    },
  });

  return store;
}

