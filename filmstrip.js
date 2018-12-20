
const metrics = {
    "LastInteractive": "Interactive",
    "FirstInteractive": "First Interactive",
    "SpeedIndex": "Speed Index",
    "TTFB": "Time to First Byte",
    "TimeToInteractive": "Time to Interactive",
    "domComplete": "DOM  Complete",
    "domContentLoadedEventStart": "DOM Content Loaded",
    "domInteractive": "DOM Interactive",
    "firstContentfulPaint": "First Contentful Paint",
    "firstMeaningfulPaint": "First Meaningful Paint",
    "fullyLoaded": "Fully Loaded",
    "lastVisualChange": "Last Visual Change",
    "docTime": "Load Time",
    "render": "Start Render",
    "loadEventStart": "Load Event",
    "visualComplete": "Visually Complete",
    "visualComplete85": "85% Visually Complete",
    "visualComplete90": "90% Visually Complete",
    "visualComplete95": "95% Visually Complete",
    "visualComplete99": "99% Visually Complete",
};

const highlightMetrics = {
    "docTime": true,
    "FirstInteractive": true,
    "LastInteractive": true,
    "fullyLoaded": true,
    "render": true,
    "loadEventStart": true
}

Vue.component('filmstrip-animation', {
    template: `
        <div class="animationView">
            <div class="customization">
                <label><input v-model="showTimings" type="checkbox" /> Show metrics</label>
                <label>Slowdown factor:</label>
                <input v-model="slowdownFactor" type="number" min="1" max="50" step="1" />
                <br>
                <span><kbd>Left</kbd> <kbd>Right</kbd> Change frame</span>
                <span><kbd>m</kbd> Toggle metrics</span>
                <span><kbd>r</kbd> Reset animation</span>
                <span><kbd>Space</kbd> Resume/Pause</span>
            </div>
            <div class="controls">
                <button @click="previousFrame" :disabled="this.time < this.interval">-0.1s</button>
                <button v-if="isStarted" @click="pause">Pause</button>
                <button v-else-if="paused && time > 0" @click="resume">Resume</button>
                <button v-else @click="start">Start</button>
                <button @click="nextFrame" :disabled="this.time > this.end">+0.1s</button>
            </div>
            <div v-if="frame" class="thumbnail" :class="{hasMetric: !!frame.metrics.length, highlight: frame.metrics.some(m => m.highlight)}" @click="togglePlay">
                <img :src="frame.url" :style="{width: width + 'px'}" />
                <span class="time">{{ (time / 1000).toFixed(1) }}s</span>
                <ul v-if="showTimings && frame.metrics.length" class="metrics" :style="{'max-width': width + 'px'}">
                    <li v-for="metric in frame.metrics"
                        :class="{custom: metric.type != 'metric', highlight: metric.highlight}">{{ metric.name }} ({{metric.value.toFixed(1) + "s"}})</li>
                </ul>
            </div>
        </div>
    `,
    props: [
        'stepData',
        'timings'
    ],
    watch: { 
        stepData: function() { 
            this.reset();
        }
    },
    data: function() { return {
        frame: null,
        time: 0,
        end: 0,
        slowdownFactor: 4,
        showTimings: false,
        width: 400,
        paused: false,
        keydownHandler: null,
        interval: 100,
        filmstrip: []
    }},
    created: function() {
        this.reset();
        this.keydownHandler = document.addEventListener("keydown", (event) => {
            if (event.key == "ArrowLeft") {
                this.previousFrame();
            } else if (event.key == "ArrowRight") {
                this.nextFrame();
            } else if (event.key == " ") {
                this.togglePlay();
            } else if (event.key == "m") {
                this.showTimings = !this.showTimings;
            } else if (event.key == "r") {
                this.reset();
            } else {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        });
    },
    beforeDestroy: function() {
        if (this.keydownHandler) {
            window.removeEventListener("keydown", this.keydownHandler);
            this.keydownHandler = null;
        }
    },
    computed: {
        isStarted: function() {
            return this.time <= this.end && !this.paused;
        }
    },
    methods: {
        start: function() {
            this.reset();
            this.resume();
        },
        reset: function() {
            if (!this.stepData) {
                return;
            }
            this.filmstrip = createFilmstrip(this.stepData, this.interval, this.timings);
            this.time = 0;
            this.paused = true;
            this.end = this.filmstrip[this.filmstrip.length - 1].time;
            this.frame = this.filmstrip[0];
        },
        pause: function() {
            this.paused = true;
        },
        resume: function() {
            if (this.time > this.end) {
                this.time = 0;
            }
            this.paused = false;
            this.animate();
        },
        togglePlay: function() {
            if (this.paused || this.time > this.end) {
                this.resume();
            } else {
                this.pause();
            }
        },
        animate: function() {
            if (!this.isStarted) {
                return;
            }
            if (this.time == 0) {
                this.frame = this.filmstrip[0];
            }
            const shouldWait = this.frame.time == this.time && this.frame.metrics.some(metric => metric.highlight) && this.showTimings;
            const waitFactor = shouldWait ? 5 : 1;
            setTimeout(() => {
                if (this.isStarted) {
                    this.nextFrame();
                    this.animate();
                }
            }, this.interval * this.slowdownFactor * waitFactor);
        },
        previousFrame: function() {
            if (this.time >= this.interval) {
                this.updateFrame(-this.interval);
            }
        },
        nextFrame: function() {
            if (this.time <= this.end) {
                this.updateFrame(this.interval);
            }
        },
        updateFrame: function(interval) {
            this.time += interval;
            this.frame = this.filmstrip.find(frame => frame.time == this.time) || this.frame;
        }
    }
});

Vue.component('filmstrip-view', {
    template: `
        <div class="filmstripView">
            <div class="customization">
                <label><input v-model="showTimings" type="checkbox" /> Show metrics</label>
                <label>Thumbnail width:</label>
                <input v-model="thumbnailWidth" type="number" min="50" max="400" step="50" @change="saveState" />
                <label>Columns:</label>
                <input v-model="columns" type="number" min="0" :max="filmstrip.length" @change="updateFilmstrip" />
                <label>Interval (ms):</label>
                <input v-model="interval" type="number" min="100" :max="5000" step="100" @change="updateFilmstrip" />
            </div>
            <div class="stage" :style="{'grid-template-columns': 'repeat(' + columns + ', max-content)'}">
                <div v-for="thumbnail in this.filmstrip" @click="showTimings = !showTimings"
                    class="thumbnail" :class="{hasChange: thumbnail.hasChange}">
                    <img :src="thumbnail.url" :style="{width: thumbnailWidth + 'px'}" :title="thumbnail.visuallyComplete + '% Visual Progress'" />
                    <span class="time">{{ thumbnail.timeFormatted }}</span>
                    <ul v-if="!!thumbnail.metrics.length && showTimings" class="metrics" :style="{'max-width': thumbnailWidth + 'px'}">
                        <li v-for="metric in thumbnail.metrics"
                            :class="{custom: metric.type != 'metric', highlight: metric.highlight}">{{ metric.name }} ({{metric.value.toFixed(1) + "s"}})</li>
                    </ul>
                </div>
            </div>
        </div>
    `,
    props: [
        "stepData",
        "timings"
    ],
    data: function() { return {
        showTimings: true,
        thumbnailWidth: 150,
        interval: 200,
        columns: 9,
        interval: 500,
        filmstrip: []
    }},
    watch: { 
        stepData: function() { 
            this.updateFilmstrip();
        }
    },
    created: function() {
        this.loadState();
        this.updateFilmstrip();
    },
    methods: {
        updateFilmstrip: function() {
            if (!this.stepData) {
                return;
            }
            this.filmstrip = createFilmstrip(this.stepData, this.interval, this.timings)
            this.saveState();
        },
        loadState: function() {
            this.columns = Number(localStorage.getItem('filmstripView.columns')) || this.columns;
            this.interval = Number(localStorage.getItem('filmstripView.interval')) || this.interval;
            this.thumbnailWidth = Number(localStorage.getItem('filmstripView.thumbnailWidth')) || this.thumbnailWidth;
        },
        saveState: function() {
            localStorage.setItem('filmstripView.columns', this.columns);
            localStorage.setItem('filmstripView.interval', this.interval);
            localStorage.setItem('filmstripView.thumbnailWidth', this.thumbnailWidth);
        }
    }
});

var app = new Vue({
    el: '#app',
    data: {
        wptUrl: "",
        selectedRun: 1,
        selectedStep: 1,
        availableSteps: [1],
        availableRuns: [1],
        testId: "",
        testData: null,
        error: null,
        stepData: null,
        timings: [],
        testLabel: "",
        loading: false,
        testUrl: "",
        showAnimation: true,
        frameImages: []
    },
    created: function () {
        this.loadState();
        if (this.testUrl) {
            this.loadData();
        }
    },
    computed: {
        waterfallUrl: function() {
            if (!this.testData || !this.testId) {
                return null;
            }
            return `${this.wptUrl}/result/${this.testId}/${this.selectedRun}/details/#waterfall_view_step${this.selectedStep}`;
        },
        videoUrl: function() {
            if (!this.testData || !this.testId) {
                return null;
            }
            return `${this.wptUrl}/video/create.php?tests=${this.testId}-r:${this.selectedRun}-c:0-s:${this.selectedStep}&id=${this.testId}${this.selectedRun}${this.selectedStep}`;
        }
    },
    methods: {
        loadData: function() {
            try {
                [this.wptUrl, this.testId] = parseTestUrl(this.testUrl);
            } catch {
                this.error = "Invalid URL or test ID!";
                return;
            }
            this.loading = true;
            fetchData(this.wptUrl, this.testId)
                .then(response => {
                    this.testData = response.data;
                    this.updateTestData();
                })
                .catch(error => this.error = "Failed to load data: " + error)
                .then(() => this.loading = false);
        },
        updateTestData: function() {
            const runs = (this.testData || {}).runs || {};
            this.availableRuns = Object.keys(runs);
            this.selectedRun = this.availableRuns.find(run => run == this.selectedRun) || this.availableRuns[0];
            if (!(((runs[this.selectedRun] || {}).firstView || {}).steps || []).length) {
                this.error = "Invalid response data";
                return;
            }
            const runData = this.testData.runs[this.selectedRun].firstView;
            this.availableSteps = runData.steps.map(step => step.eventName || `${step.id}`);
            this.selectedStep = Math.min(this.selectedStep, runData.numSteps);
            this.testLabel = this.testData.label || `${this.testData.url}, ${this.testData.location}`; 
            this.stepData = runData.steps[this.selectedStep - 1];
            if (!this.stepData) {
                this.error = "Invalid test data";
                return;
            }
            this.timings = createTimings(this.stepData);
            this.frameImages = this.stepData.videoFrames.map(frame => frame.image);
            this.error = "";
            this.saveState();
        },
        loadState: function() {
            this.testUrl = localStorage.getItem('loadedTestUrl') || this.testUrl;
            this.selectedStep = Number(localStorage.getItem('selectedStep')) || this.selectedStep;
            this.selectedRun = localStorage.getItem('selectedRun') || this.selectedRun;
        },
        saveState: function() {
            localStorage.setItem('loadedTestUrl', this.testUrl);
            localStorage.setItem('selectedStep', this.selectedStep);
            localStorage.setItem('selectedRun', this.selectedRun);
        }
    }
})

function parseTestUrl(testUrl) {
    const testIdPattern = /([0-9]{6}_[A-Za-z0-9]{2}_[A-Za-z0-9]+)/;
    const match = testUrl.match(testIdPattern);
    if (!match) {
        throw "Provide a valid test id.";
    }
    const testId = match[1];
    if (testUrl.indexOf("://") < 0) {
        return ["https://www.webpagetest.org", testId];
    }
    const [protocol, url] = testUrl.split("://", 2);
    return [protocol + "://" + url.split("/", 1)[0], testId];
}

function createTimings(stepData) {
    const userTimings = Object.keys(stepData.userTimes || {}).map(name => ({
        name: name,
        type: "user",
        value: Number(stepData.userTimes[name]) / 1000,
        highlight: false
    }));
    const heroTimings = Object.keys(stepData.heroElementTimes || {}).map(name => ({
        name: "Hero: " + name,
        type: "hero",
        value: Number(stepData.heroElementTimes[name]) / 1000,
        highlight: false
    }));
    const timings = Object.keys(metrics)
        .filter(metric => stepData[metric] != undefined)
        .map(metric => ({
           name: metrics[metric],
           type: "metric",
           value: Number(stepData[metric]) / 1000,
           highlight: !!highlightMetrics[metric]
        }));
    return [...timings, ...userTimings, ...heroTimings].sort((a, b) => a.value - b.value);
}

function createFilmstrip (stepData, interval, timings) {
    interval = Number(interval);
    const end = Math.max(...timings.map(t => t.value)) * 1000;
    const filmstrip = [];
    let lastVideoFrame = null;
    for (let time = 0; time < end + interval; time += interval) {
        const videoFrame = findFrame(stepData.videoFrames, time);
        filmstrip.push({
            time: time,
            timeFormatted: (time / 1000.0).toFixed(1) + "s",
            visuallyComplete: videoFrame.VisuallyComplete,
            url: videoFrame.image,
            frameTime: videoFrame.time,
            hasChange: !lastVideoFrame || lastVideoFrame.time != videoFrame.time,
            metrics: findTimings(timings, time - interval, time)
        });
        lastVideoFrame = videoFrame;
    }
    return filmstrip;
}

function fetchData(wptUrl, wptTestId) {
    const wptParams = "average=0&median=0&standard=0&requests=0&console=0&multistepFormat=1"
    return fetch(`${wptUrl}/result/${wptTestId}/?f=json&${wptParams}`)
        .then(response => response.json())
        .then(testData => {
            if (!testData || testData.statusCode != 200) {
                throw (testData || {}).statusText || "Invalid response";
            }
            return testData;
        })
}

function findFrame(videoFrames, time) {
    let frame = videoFrames[0];
    for (let currentFrame of videoFrames) {
        if (time >= currentFrame.time) {
            frame = currentFrame;
        } else {
            break;
        }
    }
    return frame;
}

function findTimings(timings, start, end) {
    return timings.filter(timing => timing.value > start / 1000 && timing.value <= end / 1000);
}
