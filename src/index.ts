import "./styles.css";

const parent = document.querySelector("main");

function renderComponent<Data>(component: Component<Data>, state?: Data): Data {
  if (!state) state = component.data();
  component.template(state);
  return state;
}

const enum Operations {
  // create element
  Element,
  // go up one level
  Up,
  // create text node
  Text,
  // render component
  Component,
  // set attribute
  Attribute
}

function createElement(tag: string): Element {
  return document.createElement(tag);
}

function evaluate(ops: (number | string | [string])[]) {
  let elements: Node[] = [];
  // let dynamic: any[] = [];
  let currentElement: number[] = [];

  let i = 0,
    len = ops.length;

  const arg = () => ops[++i];
  const el = () => elements[currentElement[currentElement.length - 1]];

  const match = ({
    [Operations.Element]: () => {
      const tag = arg();
      const newElement = createElement(tag as string);
      const current = el();
      if (current) current.appendChild(newElement);
      const idx = elements.push(newElement) - 1;
      currentElement.push(idx);
    },
    [Operations.Up]: () => {
      currentElement.pop();
    },
    [Operations.Text]: () => {
      const content = arg();
      const newElement = document.createTextNode(content as string);
      const current = el();
      if (current) current.appendChild(newElement);
    },
    [Operations.Component]: () => {
      throw new Error("Todo");
    },
    [Operations.Attribute]: () => {
      const current = el() as Element;
      if (!el) throw new Error("no element to assign attr to");
      current.setAttribute(arg() as string, arg() as string);
    }
  } as any) as Function[];

  for (; i < len; i++) {
    (match[ops[i] as number] ||
      (() => {
        throw new Error("not a valid operation");
      }))();
  }

  return elements[0];
}

const enum Mode {
  Text,
  Tag,
  Attribute,
  AttributeValue
}

function html(statics: string[], ...dynamic: any[]) {
  console.log(statics, dynamic);
  statics = statics.map((s, i) =>
    (i === 0 ? s.trimStart() : i === statics.length ? s.trimEnd() : s)
      .replace(/[\n\r]/g, " ")
      .replace(/\s{2,}/g, " ")
  );

  let ops = [];

  let buffer = "";
  let mode = Mode.Text;

  for (let i = 0; i < statics.length; i++) {
    if (mode === Mode.Tag) {
      ops.push(Operations.Component, dynamic[i - 1]);
      mode = Mode.Attribute;
    }
    if (mode === Mode.Text) {
      ops.push(Operations.Text, buffer, Operations.Text, dynamic[i-1]);
      buffer = "";
    }
    if (mode === Mode.Attribute) {
      throw new Error("dynamic attrs not supported");
    }
    if (mode === Mode.AttributeValue) {
      ops.push(dynamic[i-1]);
      mode = Mode.Attribute;
    }

    for (let j = 0; j < statics[i].length; j++) {
      const char = statics[i][j];

      if (mode === Mode.Text) {
        if (char === "<") {
          mode = Mode.Tag;
          if (buffer) ops.push(Operations.Text, buffer);
          buffer = "";
        } else buffer += char;
      }

      if (mode === Mode.Tag) {
        if (/\w/.test(char)) buffer += char;
        else {
          ops.push(Operations.Element, buffer);
          buffer = "";
          mode = char === " " ? Mode.Attribute : Mode.Text; 
        }
      }

      if (mode === Mode.Attribute) { 
        if (char === "=") {
          mode = Mode.AttributeValue;
          if (buffer) ops.push(Operations.Attribute, buffer);
          buffer = "";
        } else buffer += char;
      }

      if (mode === Mode.AttributeValue) {
        if (char === ' ' && !buffer.startsWith('"') || char === '"' && buffer.startsWith('"')) {
          mode = Mode.Attribute;
          if (buffer) ops.push(buffer);
          buffer = ""; 
        }
        if (char !== '"') buffer += char;
      }
    }
  }

  if (mode !== Mode.Text) {
    throw new Error("something is fucked");
  }
}

type Template = {};

interface Component<
  Props extends { [name: string]: any } = {},
  Data extends { [name: string]: any } = {}
> {
  template(props: Props, state: Data, children: any): Template;
  data(): Data;
  update(): void;
}

const App: Component<{}, { name: string }> = {
  template: (_, state) => html`
    <div>
      <h1>Hello ${state.name}</h1>
      <input id=${"name"} />
    </div>
  `,
  data: () => ({
    name: "World"
  }),
  update() {}
};

renderComponent(App);
const rendered = evaluate([
  Operations.Element,
  "div",
  Operations.Element,
  "h1",
  Operations.Text,
  "Hello ",
  Operations.Text,
  "World",
  Operations.Up,
  Operations.Element,
  "input",
  Operations.Attribute,
  "id",
  "name",
  Operations.Up,
  Operations.Up
]);

parent!.appendChild(rendered);
