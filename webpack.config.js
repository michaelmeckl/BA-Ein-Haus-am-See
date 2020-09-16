const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const Dotenv = require('dotenv-webpack');
/*
//TODO:
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
*/

module.exports = {
    mode: "development",
    devtool: "none",
    entry: [
        "./src/app/main.ts",
    ],
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "./public/dist"),
        pathinfo: false,
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            //Required for non-browserify bundlers (like webpack):
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
            }
            /*
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            */
        ],
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
        // Enables reading secret keys from .env file
        new Dotenv({
            path: path.resolve(__dirname, './.env'), // Path to .env file
        }),
        //new CleanWebpackPlugin(),
        //new webpack.HotModuleReplacementPlugin(),
        /*
        new HtmlWebpackPlugin({
            title: "Ein Haus am See im Browser",
        }),
        */
    ],
};