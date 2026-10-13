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
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js',
    publicPath: ''
};
// The normal web build emits imported icons as separate files. In the offline
// build, inline every imported image, icon, font, and media asset as a data URI
// so controls such as the green flag and stop button work from file:// URLs.
config.module.rules = config.module.rules.filter(rule => rule.loader !== 'file-loader');
config.module.rules.push({
    test: /\.(svg|png|wav|gif|jpe?g|mp3|ttf|otf|ico|webp|woff2?|mp4|webm|ogg|m4a|aac|oga)$/i,
    loader: 'url-loader',
    options: {
        limit: Number.MAX_SAFE_INTEGER,
        esModule: false
    }
});

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
config.plugins.push(new HtmlWebpackPlugin({
    chunks: ['editor'],
    template: 'src/playground/index-offline.ejs',
    filename: 'PenguinMod.html',
    title: 'PenguinMod Offline'
}));
config.entry['addon-settings'] = './src/playground/addon-settings.jsx';
config.plugins.push(new HtmlWebpackPlugin({
    chunks: ['addon-settings'],
    template: 'src/playground/simple.ejs',
    filename: 'addons.html',
    title: 'PenguinMod Offline - Addon Settings'
}));

module.exports = config;
