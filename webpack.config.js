const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
/*
//TODO:
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
*/

module.exports = {
    mode: "development",
    devtool: "none",
    entry: [
        "./src/public/app/main.ts",
    ],
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "src/public/dist"),
        pathinfo: false,
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            //Required for non-browserify bundlers (e.g. webpack):
            "mapbox-gl$": path.resolve("./node_modules/mapbox-gl/dist/mapbox-gl.js"),
        },
    },
    module: {
        rules: [{
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
    // in order to ignore built-in modules like path, fs, etc. for bundling
    target: "node",
    /*
    // TODO: don't bundle node_modules except for the mapbox-gl module to decrease bundle size
    externals: [nodeExternals({
        whitelist: ["mapbox-gl"],
    })],
    */
    plugins: [
        //new CleanWebpackPlugin(),
        /*
        new HtmlWebpackPlugin({
            title: "Ein Haus am See im Browser",
        }),
        */
    ],
};