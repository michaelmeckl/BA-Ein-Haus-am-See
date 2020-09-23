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
    //watch: true,
    entry: [
        "./src/app/main.ts",
    ],
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "./public/dist"),
        pathinfo: false,
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
    // use target: "node" in order to ignore built-in modules like path, fs, etc. for bundling
    target: "web",
    /*
    externals: [
        (function () {
            var IGNORES = [
                'electron'
            ];
            return function (context, request, callback) {
                if (IGNORES.indexOf(request) >= 0) {
                    return callback(null, "require('" + request + "')");
                }
                return callback();
            };
        })()
        
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
        //new CleanWebpackPlugin(),
        //new webpack.HotModuleReplacementPlugin(),
        /*
        new HtmlWebpackPlugin({
            title: "Ein Haus am See im Browser",
        }),
        */
    ],
};