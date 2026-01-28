const fs = require('fs');
const ts = require('typescript');
const path = require('path');

const targetFile = path.join(process.cwd(), process.argv[2] || 'src/islands/ChatWorkspaceIsland.tsx');
const src = fs.readFileSync(targetFile, 'utf8');

const result = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    jsxImportSource: 'preact',
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    target: ts.ScriptTarget.ES2020
  },
  fileName: targetFile
});

console.log('--- Transpiled Output Start ---');
console.log(result.outputText.slice(0, 2000));
console.log('--- Transpiled Output End ---');

if (result.outputText.indexOf('export ') !== -1) {
  console.error('Found `export` token in transpiled output!');
  process.exit(2);
}
console.log('No stray `export` token found in first chunk of transpiled output.');
