import { test } from "node:test";
import { strict as assert } from "node:assert";
import { finalCompiledName, isFinalCompiled } from "./vault-file-label";

test("selecting Final Compiled places an ordinary filename in the final slot without reuploading", () => {
  const name = finalCompiledName("Interview Questions.docx");
  assert.equal(name, "Final Compiled - Interview Questions.docx");
  assert.equal(isFinalCompiled({ file_name: name, assigned_to: null }), true);
});

test("individual assignments take priority over a final filename", () => {
  assert.equal(isFinalCompiled({ file_name: "Final Compiled.pdf", assigned_to: "student" }), false);
});

test("existing final labels are not duplicated", () => {
  assert.equal(finalCompiledName("Final Compiled.pdf"), "Final Compiled.pdf");
});