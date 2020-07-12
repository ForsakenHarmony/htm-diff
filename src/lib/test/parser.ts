import { test } from "uvu";
import * as assert from "uvu/assert";
import { parse } from "../renderer/parser";
import { Operation, OperationType } from "../renderer/types";

function html(
	staticStrings: TemplateStringsArray,
	..._: any[]
): { ops: Operation[]; diffOps: Operation[] } {
	return parse(staticStrings);
}

test("parse:basic", () => {
	const { ops, diffOps } = html`<div>test</div>`;
	assert.equal(diffOps, []);
	assert.equal(ops, [
		{
			typ: OperationType.Element,
			args: ["div"],
		},
		{
			typ: OperationType.Text,
			args: ["test"],
		},
		{
			typ: OperationType.Up,
			args: [],
		},
	] as Operation[]);
});

test.run();
