try {
  require('ts-node').register({
    transpileOnly: true,
    skipProject: true,
    compilerOptions: {
      module: 'CommonJS',
      jsx: 'react-jsx',
      jsxImportSource: 'preact',
      moduleResolution: 'node',
      allowSyntheticDefaultImports: true,
      esModuleInterop: true
    },
    ignore: []
  });
  console.log('[test/ts-node-register] ts-node registered with preact JSX runtime');
} catch (e) {
  console.warn('[test/ts-node-register] could not register ts-node:', e && e.message);
}
