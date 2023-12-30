const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");

module.exports = [
    // lib bundle
    {
        performance: {
            hints: false,
        },
        experiments: {
            asyncWebAssembly: true,
        },
        resolve: {
            fallback: {
                buffer: require.resolve("buffer/"),
                stream: require.resolve("stream-browserify"),
                path: require.resolve("path-browserify"),
                fs: false,
            },
        },
        node: {
            global: true,
        },
        optimization: {
            minimize: true,
        },
        entry: "./src/js/LiquidWallet.js",
        output: {
            filename: "liquidwallet.lib.js",
            path: path.resolve(__dirname, "dist", "lib"),
            library: {
                name: "LiquidWallet",
                type: "umd", // Universal module definition
                export: "LiquidWallet",
            },
            globalObject: "this",
        },
        plugins: [
            new webpack.ProvidePlugin({
                Buffer: ["buffer", "Buffer"],
            }),
        ],
        mode: "production",
    },

    // extra css for embedding full page
    {
        performance: {
            hints: false,
        },
        entry: "./src/less/page.less",
        output: {
            path: path.resolve(__dirname, "dist", "app"),
        },
        module: {
            rules: [
                {
                    test: /\.less$/,
                    use: [MiniCssExtractPlugin.loader, "css-loader", "less-loader"],
                },
            ],
        },
        plugins: [
            new MiniCssExtractPlugin({
                filename: "page.css",
            }),
        ],
        mode: "production",
    },

    // ui bundle
    {
        // stats: {
        // warningsFilter: warning => {
        //     return warning.startsWith("GenerateSW has been called multiple times")
        // },
        // },
        performance: {
            hints: false,
        },
        experiments: {
            asyncWebAssembly: true,
        },
        resolve: {
            fallback: {
                buffer: require.resolve("buffer/"),
                stream: require.resolve("stream-browserify"),
                path: require.resolve("path-browserify"),
                fs: false,
            },
        },
        node: {
            global: true,
        },
        entry: "./src/js/index.js",
        output: {
            filename: "liquidwallet.js",
            path: path.resolve(__dirname, "dist", "app"),
        },
        plugins: [
            new webpack.ProvidePlugin({
                Buffer: ["buffer", "Buffer"],
            }),
            new HtmlWebpackPlugin({
                template: "./src/assets/app/index.html",
                filename: "index.html",
            }),
            new MiniCssExtractPlugin({
                filename: "ui.css",
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "src", "assets", "app"),
                        to: path.resolve(__dirname, "dist", "app"),
                        globOptions: {
                            ignore: ["**/index.html"],
                        },
                    },
                ],
            }),
            ...(!process.env.WEBPACK_DEV_SERVER
                ? [
                      new WorkboxPlugin.GenerateSW({
                          maximumFileSizeToCacheInBytes: 5000000, // 5MB
                          clientsClaim: true,
                          skipWaiting: true,
                      }),
                  ]
                : []),
        ],
        module: {
            rules: [
                {
                    test: /\.less$/,
                    use: [MiniCssExtractPlugin.loader, "css-loader", "less-loader"],
                },
            ],
        },
        mode: process.env.BUILD_MODE === "production" ? "production" : "development",
    },

    {
        performance: {
            hints: false,
        },
        entry: "./src/assets/pack.js",
        devServer: {
            static: {
                directory: path.join(__dirname, "dist"),
            },
            compress: false,
            port: 9000,
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "src", "assets"),
                        to: path.resolve(__dirname, "dist"),
                        globOptions: {
                            ignore: ["**/app"],
                        },
                    },
                ],
            }),
        ],
        mode: "production",
    },
];
