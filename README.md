# WPT Filmstrip

Simply animate, unwind and explore test metrics of WebPagetest filmstrips.

## Features
* Works with both official and private WPT instances
* Animation of the filmstrip with slowdown, optional metrics, step through frames, keyboard support
* Unwind the Filmstrip, in columns and rows, optional metrics, variable interval length
* Support for User Timings and Hero Times
* Use the URL hash to save/restore most settings

## Usage
* Paste WPT test url OR test ID
* Optional: Select run or step

## URLs
You can pass several parameters in the hash of the URL
* `testId`: the WPT test ID
* `wptUrl`: URL of the WPT server to use, defaults to `https://www.webpagetest.org`
* `run`: run number of the test, defaults to `1`
* `step`: step number of the test, defaults to `1`
* `view`: the view to open. Either `animation` or `filmstrip`, defaults to `animation`
* `showMetrics`: if metrics should be enabled. Either `true` or `false`. Default is `true`

in filmstrip view:
* `interval`: the interval between the thumbnails, defaults to `500`
* `columns`: the number of columns, defaults to `10`
* `thumbnailWidth`: the width of thumbnails in pixels, defaults to `150`

Example: [https://iteratec.github.io/wpt-filmstrip/#testId=181222_H8_48d7b7cb240cb62a7f4faa4b38482501&run=2&step=2&view=filmstrip&interval=100](https://iteratec.github.io/wpt-filmstrip/#testId=181222_H8_48d7b7cb240cb62a7f4faa4b38482501&run=2&step=2&view=filmstrip&interval=100)

## Known issues
* Start/Pause quirk on animation with keyboard
* No keyboard support with unwinded filmstrip
* No filmstrip comparison
* Available metrics and "important" metrics are hardcoded
* Not all settings are saved and restored, not possible to reset settings

PRs welcome!