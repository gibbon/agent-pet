// Side-effect CSS imports — Vite handles these at build time. TS 6 wants
// an explicit module declaration before it'll accept `import './foo.css'`.
declare module '*.css';
declare module '*.css?inline' {
  const content: string;
  export default content;
}
