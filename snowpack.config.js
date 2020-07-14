module.exports = {
    exclude: ['**/node_modules/**/*', '**/__tests__/*', '**/*.@(spec|test).@(js|mjs)'],
    scripts: {
        "mount:public": "mount public --to /",
        "mount:src": "mount src/app --to /_dist_/app",
        "mount:shared": "mount src/shared --to /_dist_/shared",
        "run:tsc": "tsc --noEmit",
        "run:tsc::watch": "$1 --watch",
        "run:dev_server": "ts-node-dev --files -r dotenv/config src/index.ts",
    },
    plugin: [],
    installOptions: {
        installTypes: true,
        namedExports: ["mapbox-gl-framerate"],
        rollup: {
            plugins: [require("rollup-plugin-node-polyfills")()],
        },
    },
};