const path = require("path");
const webpack = require("webpack");
const Dotenv = require('dotenv-webpack');
const nodeExternals = require("webpack-node-externals");
//const {CleanWebpackPlugin} = require('clean-webpack-plugin');
/*
const HtmlWebpackPlugin = require('html-webpack-plugin');
*/

module.exports = {
    mode: "development",
    devtool: "none",
    entry: [
        // Add the client which connects to our middleware
        //"webpack-hot-middleware/client",
        "./src/app/main.ts",
    ],
    output: {
        //publicPath: "http://localhost:8000/dist",
        filename: "bundle.js",
        path: path.resolve(__dirname, "./public/dist"),
        pathinfo: false,
        //hotUpdateChunkFilename: 'hot/hot-update.js',
        //hotUpdateMainFilename: 'hot/hot-update.json'
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
            },
            /*
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },*/
        ],
        // Apply `noParse` to Tangram to prevent mangling of UMD boilerplate
        noParse: /tangram\/dist\/tangram/
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
        // Enables reading mapbox token from .env file
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