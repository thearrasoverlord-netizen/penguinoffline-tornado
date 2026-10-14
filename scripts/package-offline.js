/* Inline the editor and addon settings pages into portable HTML files. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build-offline');

function fail(message) {
    console.error('[offline packager] ' + message);
    process.exit(1);
}
function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}
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

// Blockly requests media by filename at runtime. Embed all available media once
// in each page and map the normal media URLs to their data URLs.
const mediaDir = path.join(outDir, 'static', 'blocks-media');
const media = {};
if (fs.existsSync(mediaDir)) {
    for (const file of walk(mediaDir)) {
        const relative = path.relative(mediaDir, file).split(path.sep).join('/');
        media[relative] = dataUri(file);
    }
}
const offlineBootstrap = '<script>window.__PENGUINMOD_OFFLINE_MEDIA__=' +
    JSON.stringify(media).replace(/</g, '\\u003c') + ';(function(){' +
    'var map=window.__PENGUINMOD_OFFLINE_MEDIA__||{};' +
    'function lookup(value){if(typeof value!=="string")return value;var s=value.replace(/\\\\/g,"/").split("#")[0].split("?")[0];try{s=decodeURIComponent(s);}catch(e){}var marker="/blocks-media/";var i=s.lastIndexOf(marker);var key=i>=0?s.slice(i+marker.length):s.indexOf("blocks-media/")>=0?s.slice(s.lastIndexOf("blocks-media/")+13):"";key=key.replace(/^\\.\\//,"");if(map[key])return map[key];var tail=key.split("/").pop();return map[tail]||value;}' +
    'var imageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");' +
    'if(imageSrc&&imageSrc.set)Object.defineProperty(HTMLImageElement.prototype,"src",{configurable:true,enumerable:imageSrc.enumerable,get:imageSrc.get,set:function(v){imageSrc.set.call(this,lookup(v));}});' +
    'var setAttr=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){var name=String(n).toLowerCase();if(((this.tagName==="IMG"||this.tagName==="AUDIO"||this.tagName==="SOURCE")&&name==="src")||(this.namespaceURI==="http://www.w3.org/2000/svg"&&(name==="href"||name==="xlink:href")))v=lookup(v);return setAttr.call(this,n,v);};' +
    'if(window.fetch){var oldFetch=window.fetch;window.fetch=function(input,init){var url=typeof input==="string"?input:input&&input.url;var mapped=lookup(url);if(mapped!==url&&typeof mapped==="string"&&mapped.indexOf("data:")===0)input=mapped;return oldFetch.call(this,input,init);};}' +
    'var oldOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){var mapped=lookup(url);arguments[1]=mapped;return oldOpen.apply(this,arguments);};' +
    '})();</script>';

// Webpack emits lazy-loaded JavaScript chunks for features such as Scratch Blocks.
// Embed them before the entry bundle so file:// pages do not request sb.chunk.js.
const chunkScripts = walk(outDir)
    .filter(file => file.endsWith('.chunk.js'))
    .map(file => fs.readFileSync(file, 'utf8'));

const pages = [
    { html: 'PenguinMod.html', bundle: 'editor.bundle.js' },
    { html: 'addons.html', bundle: 'addon-settings.bundle.js' }
];
for (const page of pages) {
    const htmlPath = path.join(outDir, page.html);
    const bundlePath = path.join(outDir, page.bundle);
    if (!fs.existsSync(htmlPath)) fail('Missing ' + page.html + ' from webpack output.');
    if (!fs.existsSync(bundlePath)) fail('Missing ' + page.bundle + ' from webpack output.');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    let replaced = false;
    html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>\s*<\/script>/gi, (tag, src) => {
        if (path.basename(src.split('?')[0]) !== page.bundle) {
            fail('Unexpected external script in ' + page.html + ': ' + src);
        }
        replaced = true;
        const preload = '<script>window.webpackJsonp = window.webpackJsonp || [];</script>\n' + chunkScripts.map(code => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>').join('\n');
        return preload + '\n<script>\n' + bundle.replace(/<\/script/gi, '<\\/script') + '\n</script>';
    });
    if (!replaced) fail('No ' + page.bundle + ' script tag found in ' + page.html + '.');
    html = html.replace('</head>', offlineBootstrap + '\n</head>');
    if (/<script\b[^>]*\bsrc=["']https?:/i.test(html)) fail('A remote script tag remains in ' + page.html + '.');
    if (html.includes(page.bundle)) fail('A reference to ' + page.bundle + ' remains in ' + page.html + '.');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('[offline packager] Created ' + htmlPath + ' (' +
        (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MiB)');
}
console.log('[offline packager] Inlined lazy JavaScript chunks: ' + chunkScripts.length);
console.log('[offline packager] Embedded Blockly media files: ' + Object.keys(media).length);
