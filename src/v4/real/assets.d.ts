// Vite inlines the real-art atlases into the lab bundle as data URLs, so the published lab stays one script.
declare module '*.png?inline' {
  const src: string;
  export default src;
}
