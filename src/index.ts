import { html, render } from "./lib";
import { App } from "./todomvc";

const parent = document.querySelector("main")!;

render(html` <${App} /> `, parent);
