const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const Dotenv = require('dotenv-webpack');

module.exports = {
    mode: "development", //TODO change to production later ?!
    devtool: "inline-source-map", //todo omit this or change to none
    entry: [
        "./src/app/main.ts",
    ],
    output: {
        publicPath: "./dist/",
        filename: "bundle.js",
        path: path.resolve(__dirname, "./public/dist"),
    },
    resolve: {
        // Bundle '.ts' files as well as '.js' files.
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            //Required for non-browserify bundlers (like webpack):
            "mapbox-gl$": path.resolve("./node_modules/mapbox-gl/dist/mapbox-gl.js"),
        },
    },
    module: {
        rules: [{
            test: /\.worker\.ts$/,
            use: {
                loader: 'worker-loader',
                /*
                options: {
                    // for cors - problems:
                    inline: 'fallback'
                },*/
            },
        }, {
            test: /\.tsx?$/,
            use: [{
                loader: "ts-loader",
                options: {
                    transpileOnly: true,
                    experimentalWatchApi: true,
                },
            }],
            exclude: /node_modules/,
        }],
    },
    // use target: "node" in order to ignore built-in modules like path, fs, etc. for bundling
    target: "web",
    /*
    externals: [
        nodeExternals({
        whitelist: ["mapbox-gl"],
        })
    ],
    */
    plugins: [
        // Enables reading secret keys from .env file
        new Dotenv({
            path: path.resolve(__dirname, './.env'), // Path to .env file
        }),
    ],
};