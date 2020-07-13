import { Operation, OperationType, State, Template } from "./types";
import { diff, evaluate } from "./diff";
import { tmplSym } from "../consts";

const enum Mode {
	Text,
	Tag,
	TagEnd,
	Attribute,
	AttributeValue,
}

export function isTemplate(tmpl: any): tmpl is Template {
	return typeof tmpl[tmplSym] === "function";
}

const CACHE: Map<
	TemplateStringsArray,
	[(dynamics: unknown[], state?: State) => State, number?]
> = new Map();

function makeOp(typ: OperationType, args: any[] = []) {
	return { typ, args };
}

export function parse(
	staticStrings: TemplateStringsArray
): { ops: Operation[]; diffOps: Operation[] } {
	const statics = staticStrings.map(
		(s, i) =>
			(i === 0
				? s.trimStart()
				: i === staticStrings.length
				? s.trimEnd()
				: s
			).replace(/[\n\r\t\s]+/g, " ")
		// .replace(/\s{2,}/g, " ")
	);

	let ops: Operation[] = [];
	let diffOps: Operation[] = [];
	let elementIdx = 0;
	let textIdx = 0;

	let buffer = "";
	let mode = Mode.Text;

	let addOpArg = (arg: any) => {
		ops[ops.length - 1].args.push(arg);
	};
	let lastIsComponent = () => {
		for (let i = ops.length - 1; i >= 0; i--) {
			if (ops[i].typ === OperationType.Component) return true;
			if (ops[i].typ !== OperationType.Attribute) return false;
		}
		return false;
	};

	for (let i = 0; i < statics.length; i++) {
		for (let j = 0; j < statics[i].length; j++) {
			const char = statics[i][j];

			if (i && !j) {
				if (mode === Mode.Tag) {
					ops.push(makeOp(OperationType.Component, [[i - 1]]));
					mode = Mode.Attribute;
				} else if (mode === Mode.Text) {
					if (buffer) {
						ops.push(makeOp(OperationType.Text, [buffer]));
						textIdx++;
					}
					ops.push(makeOp(OperationType.Text, [[i - 1]]));
					diffOps.push(makeOp(OperationType.Text, [textIdx, [i - 1]]));
					textIdx++;
					buffer = "";
				} else if (mode === Mode.Attribute) {
					throw new Error("dynamic attrs not supported");
				} else if (mode === Mode.AttributeValue) {
					addOpArg([i - 1]);
					diffOps.push(
						makeOp(OperationType.Attribute, [
							ops[ops.length - 1].args[0],
							[i - 1],
							elementIdx,
						])
					);
					mode = Mode.Attribute;
					if (char === '"') continue;
				}
			}

			if (mode === Mode.Text) {
				if (char === "<") {
					mode = Mode.Tag;
					if (buffer) {
						ops.push(makeOp(OperationType.Text, [buffer]));
						textIdx++;
					}
					buffer = "";
				} else buffer += char;
			} else if (mode === Mode.Tag) {
				if (!buffer && char === "/") mode = Mode.TagEnd;
				else if (/\w/.test(char)) buffer += char;
				else {
					ops.push(makeOp(OperationType.Element, [buffer]));
					elementIdx++;
					buffer = "";
					mode = char === " " ? Mode.Attribute : Mode.Text;
				}
			} else if (mode === Mode.Attribute) {
				if (char === " " && !buffer) continue;
				if (char === "/" || char === ">") {
					if (buffer) ops.push(makeOp(OperationType.Attribute, [buffer, true]));
					mode = char === "/" ? Mode.TagEnd : Mode.Text;
				} else if (char === "=") {
					mode = Mode.AttributeValue;
					if (buffer) ops.push(makeOp(OperationType.Attribute, [buffer]));
					buffer = "";
				} else if (char === " ") {
					ops.push(makeOp(OperationType.Attribute, [buffer, true]));
					buffer = "";
				} else buffer += char;
			} else if (mode === Mode.AttributeValue) {
				if (
					(char === " " && !buffer.startsWith('"')) ||
					(buffer && char === '"' && buffer.startsWith('"'))
				) {
					mode = Mode.Attribute;
					if (buffer) addOpArg(buffer.slice(1));
					buffer = "";
				} else buffer += char;
			} else if (mode === Mode.TagEnd) {
				if (char === ">") {
					mode = Mode.Text;
					if (!lastIsComponent()) ops.push(makeOp(OperationType.Up));
					buffer = "";
				}
			}
		}
	}

	if (mode !== Mode.Text) {
		throw new Error("something is fucked");
	}

	return {
		ops,
		diffOps,
	};
}

function compile(
	staticStrings: TemplateStringsArray
): [(dynamics: unknown[], state?: State) => State, number?] {
	let { ops, diffOps } = parse(staticStrings);

	let keyIdx;
	if (
		ops[0].typ === OperationType.Element ||
		ops[0].typ === OperationType.Component
	) {
		for (let i = 1; i < ops.length; i++) {
			if (ops[i].typ !== OperationType.Attribute) {
				break;
			}
			let [k, v] = ops[i].args;
			if (k === "key" && Array.isArray(v)) {
				keyIdx = v[0];
			}
		}
	}

	function exec(this: Template, dynamics: unknown[], state?: State) {
		return state
			? diff(this, diffOps, dynamics, state)
			: evaluate(this, ops, dynamics);
	}

	return [exec, keyIdx];
}

export function html(
	staticStrings: TemplateStringsArray,
	...dynamic: unknown[]
): Template {
	let template, keyIdx;
	let res = CACHE.get(staticStrings);
	if (res == null) {
		[template, keyIdx] = compile(staticStrings);
		CACHE.set(staticStrings, [template, keyIdx]);
	} else {
		[template, keyIdx] = res;
	}

	const tmpl: Partial<Template> = { [tmplSym]: template };
	tmpl.exec = template.bind(tmpl, dynamic);
	tmpl.__raw = staticStrings.join("{...}");
	if (keyIdx != null) {
		tmpl.key = dynamic[keyIdx];
	}
	return tmpl as Template;
}
