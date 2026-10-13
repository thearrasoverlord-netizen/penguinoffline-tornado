/* Build the editor as one self-contained HTML file. */
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const configs = require('./webpack.config');

const config = configs[0];
const outputDir = path.resolve(__dirname, 'build-offline');

config.mode = 'production';
config.devtool = false;
config.entry = { editor: './src/playground/editor.jsx' };
config.output = {
    ...config.output,
    path: outputDir,
    filename: 'offline.bundle.js',
    chunkFilename: '[name].chunk.js',
    publicPath: ''
};
config.optimization = {
    ...(config.optimization || {}),
    splitChunks: false,
    runtimeChunk: false
};

// Keep the static copy plugin (Blockly media is bundled by package-offline.js),
// but remove all multi-page HTML and the web-only service worker.
config.plugins = (config.plugins || []).filter(plugin => {
    const name = plugin && plugin.constructor && plugin.constructor.name;
    return name !== 'HtmlWebpackPlugin' && name !== 'TWGenerateServiceWorkerPlugin';
});
config.plugins.push(new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }));
config.plugins.push(new HtmlWebpackPlugin({
    chunks: ['editor'],
    template: 'src/playground/index-offline.ejs',
    filename: 'PenguinMod.html',
    title: 'PenguinMod Offline'
}));

module.exports = config;
