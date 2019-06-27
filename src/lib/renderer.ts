import {
  createObserved,
  Obj,
  ObservedObj,
  subscribe,
  trackObservables
} from "./observed";

const enum Operation {
  // create element
  // @args tagName
  Element,
  // go up one level
  Up,
  // create text node
  // @args tagName
  Text,
  // render component
  Component,
  // set attribute
  Attribute
}

type Operations = (number | string | boolean | [number])[];

const evtMap: { [name: string]: (e: Event) => any } = {
  // @ts-ignore
  // change: (e: Event) => e.target.value,
  // @ts-ignore
  // input: (e: Event) => e.target.value
};

type ElementItemTypes = Node | State;
type ElementItem = ElementItemTypes | ElementItemTypes[];
type Elements = ElementItem | ElementItem[];

function evaluate(
  template: Template,
  ops: Operations,
  dynamics: any[],
  parent: Node
): State {
  let elements: State["elements"] = [[parent.parentNode!, parent]];
  let components: Instance<any>[] = [];
  // let dynamic: any[] = [];
  let currentElement: number[] = [0];
  let component: Component<any> | null = null;
  let props: Obj | null = null;

  let i = 0,
    len = ops.length;

  const arg = () => {
    const arg = ops[++i];
    return Array.isArray(arg) ? dynamics[arg[0]] : arg;
  };
  // const el: () => Node | undefined = () => {
  //   let elem: Node | undefined = undefined;
  //
  //   for (let i = elements.length - 1; i >= 0; --i) {
  //     const item = elements[i];
  //     if (!Array.isArray(item)) {
  //       elem = item;
  //       break;
  //     }
  //   }
  //
  //   return elem;
  // };
  const el: () => Node = () =>
    elements[currentElement[currentElement.length - 1]][1] as Node;
  const finishComponent = () => {
    if (component === null || props === null) throw new Error("invariant");
    components.push(renderComponent(component!, props, el()));
    component = null;
    props = null;
  };

  function handleText(content: any, parent: Node): Elements {
    if (content == null || content === false) {
      return [];
    } else if (Array.isArray(content)) {
      // @ts-ignore
      return content.map(c => handleText(c, parent));
    } else if (isTemplate(content)) {
      return content.exec(parent);
    }
    const newElement = document.createTextNode(content as string);
    parent.appendChild(newElement);
    return newElement;
  }

  const match = ({
    [Operation.Element]: () => {
      const tag = arg();
      const newElement = document.createElement(tag as string);
      const current = el();
      if (current) current.appendChild(newElement);
      const idx = elements.push([current, newElement]) - 1;
      currentElement.push(idx);
    },
    [Operation.Up]: () => {
      if (component !== null) return finishComponent();
      currentElement.pop();
    },
    [Operation.Text]: () => {
      const content = arg();
      const parent = el();
      elements.push([parent, handleText(content, parent)]);
    },
    [Operation.Component]: () => {
      // FIXME
      // components.push(renderComponent(arg(), {}, el()!));
      component = arg();
      props = {};
    },
    [Operation.Attribute]: () => {
      if (component && props) {
        props[arg()] = arg();
        return;
      }
      const current = el() as Element;
      if (!el) throw new Error("no element to assign attr to");
      const name = arg() as string;
      if (name.startsWith("@")) {
        const evt = name.slice(1);
        // @ts-ignore
        const listeners = current.__listeners || (current.__listeners = {});
        const fn = arg();
        listeners[evt] = (e: Event) => fn(evtMap[evt] ? evtMap[evt](e) : e);
        current.addEventListener(evt, listeners[evt]);
      } else current.setAttribute(name, arg() as string);
    }
  } as any) as Function[];

  for (; i < len; i++) {
    if (
      component !== null &&
      ops[i] !== Operation.Attribute &&
      ops[i] !== Operation.Up
    )
      finishComponent();
    (match[ops[i] as number] ||
      (() => {
        throw new Error("not a valid operation");
      }))();
  }

  return {
    elements,
    components,
    template
  };
}

function isTemplate(tmpl: any): tmpl is Template {
  return typeof tmpl[tmplSym] === "function";
}

function diff(
  _template: Template,
  diffOps: Operations[],
  dynamics: any[],
  instance: State
): State {
  let i = 0;
  let j = 0;
  const len = diffOps.length;
  let component: Instance<any> | null = null;

  const arg = () => {
    const arg = diffOps[i][++j];
    return Array.isArray(arg) ? dynamics[arg[0]] : arg;
  };
  // const el = () => elements[currentElement[currentElement.length - 1]];

  function destroy(element: ElementItem | ElementItem[]): void {
    if (Array.isArray(element)) element.forEach(e => destroy(e));
    else if (element instanceof Node || element instanceof Text)
      element.parentNode!.removeChild(element);
    else destroyState(element);
  }

  function handleText(
    content: any,
    element: ElementItem | ElementItem[],
    parent: Node
  ): Elements {
    if (content == null || content === false) {
      destroy(element);
      return [];
    } else if (Array.isArray(content)) {
      // TODO: MAGIC SHIT
      destroy(element);

      // @ts-ignore
      return content.map(c => handleText(c, [], parent));
      // return content.map(c => handleText(c, element));
    } else if (isTemplate(content)) {
      // // TODO: MAGIC SHIT
      // destroy(element);
      if (
        Array.isArray(element) ||
        element instanceof Node ||
        element.template[tmplSym] !== content[tmplSym]
      ) {
        destroy(element);
        return content.exec(parent);
      } else {
        return content.exec(parent, element);
      }
    } else if (element instanceof Text) {
      (element as Text).data = content;
      return element;
    }
    const newElement = document.createTextNode(content as string);
    parent.appendChild(newElement);
    return newElement;
  }

  const match = ({
    // [Operation.Element]: () => {
    //   const tag = arg();
    //   const newElement = createElement(tag as string);
    //   const current = el();
    //   if (current) current.appendChild(newElement);
    //   const idx = elements.push(newElement) - 1;
    //   currentElement.push(idx);
    // },
    // [Operation.Up]: () => {
    //   currentElement.pop();
    // },
    [Operation.Text]: () => {
      const idx = arg() as number;
      const [parent, element] = instance.elements[idx];
      instance.elements[idx] = [parent, handleText(arg(), element, parent)];

      // if (element instanceof Node) (element as Text).data = arg();
      //
      // if (Array.isArray(element)) return;
      //
      // (element as Text).data = arg();
    },
    [Operation.Component]: () => {
      component = instance.components[arg()];
    },
    [Operation.Attribute]: () => {
      if (component) return (component.props[arg()] = arg());

      const element = instance.elements[arg()][1] as Node;
      // if (Array.isArray(element) || element instanceof ) return null;
      const name = arg();

      if (name.startsWith("@")) {
        const evt = name.slice(1);
        // @ts-ignore
        const listeners = element.__listeners;
        element.removeEventListener(evt, listeners[evt]);
        const fn = arg();
        listeners[evt] = (e: Event) => fn(evtMap[evt] ? evtMap[evt](e) : e);
        element.addEventListener(evt, listeners[evt]);

        return;
      }

      (element as Element).setAttribute(name, arg() as string);
    }
  } as any) as Function[];

  for (; i < len; i++, j = 0) {
    if (component !== null && diffOps[i][j] !== Operation.Attribute)
      component = null;
    (match[diffOps[i][j] as number] ||
      (() => {
        throw new Error("not a valid operation");
      }))();
  }

  return instance;
}

const enum Mode {
  Text,
  Tag,
  TagEnd,
  Attribute,
  AttributeValue
}

const tmplSym = Symbol("template");

interface Template {
  exec(parent: Node, state?: State): State;
  [tmplSym]: Function;
}

const CACHE = new Map();

function compile(
  staticStrings: TemplateStringsArray
): (dynamics: unknown[], parent: Node, state?: State) => State {
  const statics = staticStrings.map((s, i) =>
    (i === 0 ? s.trimStart() : i === staticStrings.length ? s.trimEnd() : s)
      .replace(/[\n\r]/g, " ")
      .replace(/\s{2,}/g, " ")
  );

  let ops: Operations = [];
  let diffOps: Operations[] = [];
  let elementIdx = 0;

  let buffer = "";
  let mode = Mode.Text;

  for (let i = 0; i < statics.length; i++) {
    for (let j = 0; j < statics[i].length; j++) {
      const char = statics[i][j];

      if (i && !j) {
        if (mode === Mode.Tag) {
          ops.push(Operation.Component, [i - 1]);
          mode = Mode.Attribute;
        } else if (mode === Mode.Text) {
          if (buffer) {
            ops.push(Operation.Text, buffer);
            elementIdx++;
          }
          ops.push(Operation.Text, [i - 1]);
          elementIdx++;
          diffOps.push([Operation.Text, elementIdx, [i - 1]]);
          buffer = "";
        } else if (mode === Mode.Attribute) {
          throw new Error("dynamic attrs not supported");
        } else if (mode === Mode.AttributeValue) {
          ops.push([i - 1]);
          diffOps.push([
            Operation.Attribute,
            elementIdx,
            ops[ops.length - 2],
            [i - 1]
          ]);
          mode = Mode.Attribute;
          if (char === '"') continue;
        }
      }

      if (mode === Mode.Text) {
        if (char === "<") {
          mode = Mode.Tag;
          if (buffer) {
            ops.push(Operation.Text, buffer);
            elementIdx++;
          }
          buffer = "";
        } else buffer += char;
      } else if (mode === Mode.Tag) {
        if (!buffer && char === "/") mode = Mode.TagEnd;
        else if (/\w/.test(char)) buffer += char;
        else {
          ops.push(Operation.Element, buffer);
          elementIdx++;
          buffer = "";
          mode = char === " " ? Mode.Attribute : Mode.Text;
        }
      } else if (mode === Mode.Attribute) {
        if (char === " " && !buffer) continue;
        if (char === "/" || char === ">") {
          if (buffer) ops.push(Operation.Attribute, buffer, true);
          mode = char === "/" ? Mode.TagEnd : Mode.Text;
        } else if (char === "=") {
          mode = Mode.AttributeValue;
          if (buffer) ops.push(Operation.Attribute, buffer);
          buffer = "";
        } else if (char === " ") {
          ops.push(Operation.Attribute, buffer, true);
          buffer = "";
        } else buffer += char;
      } else if (mode === Mode.AttributeValue) {
        if (
          (char === " " && !buffer.startsWith('"')) ||
          (buffer && char === '"' && buffer.startsWith('"'))
        ) {
          mode = Mode.Attribute;
          if (buffer) ops.push(buffer.slice(1));
          buffer = "";
        } else buffer += char;
      } else if (mode === Mode.TagEnd) {
        if (char === ">") {
          mode = Mode.Text;
          ops.push(Operation.Up);
          buffer = "";
        }
      }
    }
  }

  if (mode !== Mode.Text) {
    throw new Error("something is fucked");
  }

  return function(this: Template, dynamics: unknown[], parent, state) {
    return state
      ? diff(this, diffOps, dynamics, state)
      : evaluate(this, ops, dynamics, parent);
  };
}

export function html(
  staticStrings: TemplateStringsArray,
  ...dynamic: unknown[]
): Template {
  let template = CACHE.get(staticStrings);
  !template && CACHE.set(staticStrings, (template = compile(staticStrings)));

  const tmpl: Partial<Template> = { [tmplSym]: template };
  tmpl.exec = template.bind(tmpl, dynamic);
  return tmpl as Template;
}

export interface ComponentFn<Props> {
  (props: Props): Template;
}

export interface ComponentInit<Props> {
  (props: Props): ComponentFn<Props>;
}

export type Component<Props> = ComponentInit<Props> | ComponentFn<Props>;

// export interface Instance<Props> {
//   elements: Node[];
//
//   props: Props;
//   fn: ComponentFn;
//
//   observables: ObservedObj[];
//   components: Instance<any>[];
// }

export interface State {
  elements: ([Node, Elements])[];
  components: Instance<any>[];
  template: Template;
}

export interface Instance<Props> extends State {
  props: Props;
  render: ComponentFn<Props>;
  observables: [ObservedObj, Function][];
  hooks: Function[];
  parent: Node;
  constructor: ComponentInit<Props>;
}

let toDiff: Instance<any>[] = [];

export function queue(inst: Instance<any>) {
  if (!toDiff.length)
    requestAnimationFrame(() => {
      toDiff.forEach(inst => diffComponent(inst));
      toDiff = [];
    });

  !toDiff.includes(inst) && toDiff.push(inst);
}

let currentRendering: Instance<any> | null = null;

export function getCurrentRendering(): Instance<any> {
  if (!currentRendering) throw new Error("No component currently rendering");
  return currentRendering;
}

function renderComponent<Props>(
  init: Component<Props>,
  props: Props,
  parent: Node
): Instance<Props> {
  props = createObserved(props);

  // possibly bad idea
  const instance: Instance<Props> = (({
    props,
    observables: [],
    hooks: [],
    elements: [],
    components: [],
    parent,
    constructor: init
  } as Partial<Instance<Props>>) as unknown) as Instance<Props>;
  currentRendering = instance;

  let render = init;
  const [tmpl, observables] = trackObservables(() => {
    let tmpl = render(props);
    if (isTemplate(tmpl)) return tmpl;
    render = tmpl;
    return render(props);
  });
  const state = tmpl.exec(parent);

  Object.assign(instance, state, { render });

  instance.observables = observables.map(obs => [
    obs,
    subscribe(obs, () => queue(instance))
  ]);

  return instance;
}

function diffComponent<Props>(instance: Instance<Props>) {
  const [tmpl, observables] = trackObservables(() =>
    instance.render(instance.props)
  );
  const state = tmpl.exec(instance.parent, instance);

  instance.elements
    .slice(1)
    .filter(e => !state.elements.includes(e))
    .map(([p, c]) => c instanceof Node && c.isConnected && p.removeChild(c));
  instance.components
    .filter(c => !state.components.includes(c))
    .map(c => destroyComponent(c));

  instance.observables
    .filter(o => !observables.includes(o[0]))
    .map(o => o[1]());

  instance.observables = observables.map(
    obs =>
      instance.observables.find(io => io[0] === obs) || [
        obs,
        subscribe(obs, () => queue(instance))
      ]
  );
}

function destroyState(state: State) {
  state.elements
    .slice(1)
    .map(([p, c]) => c instanceof Node && c.isConnected && p.removeChild(c));
  state.components.map(c => destroyComponent(c));
}

function destroyComponent(inst: Instance<any>) {
  inst.hooks.map(f => f());
  inst.observables.map(o => o[1]());
  destroyState(inst);
}

// function diffComponent<Props>(
//   component: Component<Props>,
//   props: Props,
//   data: Data,
//   state: State
// ) {
//   component(props, data, [])(parent, state);
// }

export function render(template: Template, parent: Element) {
  template.exec(parent);
}
