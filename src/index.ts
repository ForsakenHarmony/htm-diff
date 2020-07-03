import {html, render} from "./lib";
import {App} from "./people";

const parent = document.querySelector("main")!;

render(
  html`
    <${App} />
  `,
  parent
);
