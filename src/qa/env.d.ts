declare const __BUILD_TIME__: string;
declare const __BUILD_COMMIT__: string;
declare module '*.css';
interface ImportMeta { readonly env: Record<string, string | undefined> }
declare module 'virtual:asset-hashes' { const hashes: Record<string, string>; export default hashes; }
declare module 'virtual:webp-twins' { const twins: string[]; export default twins; }
