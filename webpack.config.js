const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const Dotenv = require('dotenv-webpack');

//common config for client and server:
const config = {
    //mode: "development",
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
    plugins: [
        // Enables reading secret keys from .env file
        new Dotenv({
            path: path.resolve(__dirname, './.env'), // Path to .env file
        }),
    ],
};

const clientConfig = Object.assign({}, config, {
    target: "web",
    name: 'client',
    entry: [
        "./src/app/main.ts",
    ],
    output: {
        publicPath: "./dist/",
        filename: "client.js",
        path: path.resolve(__dirname, "./public/dist"),
    },
    devtool: 'inline-source-map',
});

const serverConfig = Object.assign({}, config, {
    //use target: "node" in order to ignore built-in modules like path, fs, etc. for bundling
    target: 'node',
    name: 'server',
    entry: [
        "./src/index.ts",
    ],
    output: {
        publicPath: "./dist/",
        filename: "server.js",
        path: path.resolve(__dirname, "./public/dist"),
    },
    // webpack-node-externals package used to exclude other packages like express in the final bundle
    externals: [nodeExternals()]
});

// Combined 'module.exports'
module.exports = [clientConfig, serverConfig];