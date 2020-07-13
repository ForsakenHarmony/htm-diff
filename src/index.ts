import { html, render } from "./lib";
import { App } from "./reorder";

const parent = document.querySelector("main")!;

render(html` <${App} /> `, parent);
