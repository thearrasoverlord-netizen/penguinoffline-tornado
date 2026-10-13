/* Turn webpack's production build into a single portable HTML file. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build-offline');
const htmlPath = path.join(outDir, 'PenguinMod.html');
const bundlePath = path.join(outDir, 'offline.bundle.js');

function fail(message) {
    console.error('[offline packager] ' + message);
    process.exit(1);
}
if (!fs.existsSync(htmlPath)) fail('Missing build-offline/PenguinMod.html. Run webpack.offline.config.js first.');
if (!fs.existsSync(bundlePath)) fail('Missing offline.bundle.js. The build may have emitted extra chunks.');

let html = fs.readFileSync(htmlPath, 'utf8');
let bundle = fs.readFileSync(bundlePath, 'utf8');

function mimeFor(file) {
    const ext = path.extname(file).toLowerCase();
    return ({
        '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
        '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
        '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
        '.woff2': 'font/woff2', '.ico': 'image/x-icon'
    })[ext] || 'application/octet-stream';
}
function dataUri(file) {
    return 'data:' + mimeFor(file) + ';base64,' + fs.readFileSync(file).toString('base64');
}

// Inline every file-loader asset into the generated JavaScript.
const assetDir = path.join(outDir, 'static', 'assets');
if (fs.existsSync(assetDir)) {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
    for (const file of walk(assetDir)) {
        const relative = path.relative(outDir, file).split(path.sep).join('/');
        const uri = dataUri(file);
        bundle = bundle.split(relative).join(uri);
        bundle = bundle.split('/' + relative).join(uri);
    }
}

// Blockly requests media by filename at runtime. Embed it in a lookup table,
// then translate those media URLs to data URLs before the editor starts.
const mediaDir = path.join(outDir, 'static', 'blocks-media');
const media = {};
if (fs.existsSync(mediaDir)) {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
    for (const file of walk(mediaDir)) {
        const relative = path.relative(mediaDir, file).split(path.sep).join('/');
        media[relative] = dataUri(file);
    }
}
const offlineBootstrap = '<script>window.__PENGUINMOD_OFFLINE_MEDIA__=' +
    JSON.stringify(media).replace(/</g, '\\u003c') + ';(function(){' +
    'var map=window.__PENGUINMOD_OFFLINE_MEDIA__||{};' +
    'function lookup(value){if(typeof value!=="string")return value;var s=value.replace(/\\\\/g,"/");var marker="/blocks-media/";var i=s.indexOf(marker);var key=i>=0?s.slice(i+marker.length):s.indexOf("blocks-media/")>=0?s.slice(s.indexOf("blocks-media/")+13):"";key=key.replace(/^\\.\\//,"");return map[key]||value;}' +
    'var imageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");' +
    'if(imageSrc&&imageSrc.set)Object.defineProperty(HTMLImageElement.prototype,"src",{configurable:true,enumerable:imageSrc.enumerable,get:imageSrc.get,set:function(v){imageSrc.set.call(this,lookup(v));}});' +
    'var setAttr=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if((this.tagName==="IMG"&&String(n).toLowerCase()==="src")||(this.tagName==="AUDIO"&&String(n).toLowerCase()==="src")||(this.tagName==="SOURCE"&&String(n).toLowerCase()==="src"))v=lookup(v);return setAttr.call(this,n,v);};' +
    'if(window.fetch){var oldFetch=window.fetch;window.fetch=function(input,init){var url=typeof input==="string"?input:input&&input.url;var mapped=lookup(url);if(mapped!==url&&typeof mapped==="string"&&mapped.indexOf("data:")===0)input=mapped;return oldFetch.call(this,input,init);};}' +
    'var oldOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){var mapped=lookup(url);arguments[1]=mapped;return oldOpen.apply(this,arguments);};' +
    '})();</script>';

const scripts = [];
html = html.replace(/<script\\b[^>]*\\bsrc=["']([^"']+\\.js(?:\\?[^"']*)?)["'][^>]*>\\s*<\\/script>/gi, (tag, src) => {
    const filename = path.basename(src.split('?')[0]);
    const file = path.join(outDir, filename);
    if (!fs.existsSync(file)) fail('Unexpected external script in generated HTML: ' + src);
    scripts.push(fs.readFileSync(file, 'utf8'));
    return '';
});
if (!scripts.length) fail('No webpack script tag found in generated HTML.');
bundle = scripts.join('\n') + '\n' + bundle;
html = html.replace('</head>', offlineBootstrap + '\\n</head>');
html = html.replace('</body>', '<script>\\n' + bundle + '\\n</script>\\n</body>');
if (/<script\\b[^>]*\\bsrc=["']https?:/i.test(html)) fail('A remote script tag remains in the HTML.');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('[offline packager] Created ' + htmlPath);
console.log('[offline packager] HTML size: ' + (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MiB');
console.log('[offline packager] Embedded Blockly media files: ' + Object.keys(media).length);
