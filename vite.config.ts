import { defineConfig } from "vite";
import { BuildOptions } from "vite";
const build: BuildOptions = {
    target: "modules",
    lib: {
        entry: "./src/index",
        fileName: "index",
        formats: ['cjs']
    },
    rollupOptions: {
        external: [/node:.*/],
    },
    minify: true
};
if (process.env.MODE?.trim() == "test") {
    build.outDir = "./test";
    if (build.lib) {
        build.lib.entry = "./src/test"
    }
} 
export default defineConfig({
    plugins: [],
    build,
    resolve: {
        alias: {
            '@': (new URL('./src', import.meta.url)).href
        }
    },

});