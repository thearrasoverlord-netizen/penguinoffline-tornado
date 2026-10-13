# Single-file offline build

This branch adds an experimental build that emits `build-offline/PenguinMod.html`.

## Build (requires internet the first time)

Install the repository dependencies while connected, then run:

```sh
npm run build:offline
```

After the build finishes, disconnect from the internet and open `build-offline/PenguinMod.html` in a modern browser.

The build embeds the editor JavaScript, webpack file-loader assets, and Blockly media into the HTML. It intentionally does not bundle optional extensions or promise that cloud features, APIs, or other network-backed functionality work offline. Those will be handled separately.

This is an experimental packaging path: test project creation, block rendering, run/stop, save-to-computer, and reopening an `.sb3` file with the network disconnected. Report any missing asset or browser security errors before treating the file as fully offline.
