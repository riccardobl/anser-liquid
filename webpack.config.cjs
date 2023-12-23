const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    experiments: {
        asyncWebAssembly: true,
    },
    resolve: {
        fallback: {
            "buffer": require.resolve("buffer/"),
            "stream": require.resolve("stream-browserify"),
            "path": require.resolve("path-browserify"),
            "fs": false
            
        }
    },
    node: {
        global: true,
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: false,
        port: 9000,
    },
    entry: './src/js/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new HtmlWebpackPlugin({
            template: './src/html/index.html',
            filename: 'index.html', 
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: './src/static', to: 'static' },
            ],
        }),
    ],
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};