
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

const OFFICIAL_WPT_URL = "https://www.webpagetest.org";

const STATE_DEFAULTS = {
    wptUrl: OFFICIAL_WPT_URL,
    testId: "",
    testUrl: "",
    view: "animation",
    run: 1,
    step: 1,
    interval: 500,
    columns: 10,
    thumbnailWidth: 150,
    showMetrics: true
};

const STATE_PARAMS = {
    numbers: ["run", "step", "interval", "columns", "thumbnailWidth"],
    strings: ["testId", "wptUrl", "view"],
    booleans: ["showMetrics"],
    decode(key, value) {
        if (this.numbers.indexOf(key) >= 0) {
            return Number(value);
        }
        if (this.booleans.indexOf(key) >= 0) {
            return value && value != "false" && value != "null";
        }
        return decodeURIComponent(value);
    },
    contains(key) {
        return this.strings.indexOf(key) >= 0 || this.numbers.indexOf(key) >= 0 || this.booleans.indexOf(key) >= 0;
    }
}

const store = {
    state: Object.assign({}, STATE_DEFAULTS),
    setMinorSetting(key, value) {
        this.state[key] = value;
        this.saveMinorChanges();
    },
    setView(view) {
        if ((view != "animation" && view != "filmstrip") || view == this.state.view) {
            return;
        }
        this.state.view = view;
        this.saveChanges();
    },
    toggleMetrics(enabled) {
        if (enabled == this.state.showMetrics) {
            return;
        }
        this.state.showMetrics = enabled;
        this.saveChanges();
    },
    setRun(run) {
        if (!run || run == this.state.run) {
            return;
        }
        this.state.run = run;
        this.saveChanges();
    },
    setStep(step) {
        if (!step || step == this.state.step) {
            return;
        }
        this.state.step = step;
        this.saveChanges();
    },
    setTest(wptUrl, testId) {
        if (this.state.wptUrl == wptUrl && this.state.testId) {
            return;
        }
        this.state.wptUrl = wptUrl;
        this.state.testId = testId;
        this.updateTestUrl();
        this.saveChanges();
    },
    updateTestUrl() {
        this.state.testUrl = this.state.wptUrl == OFFICIAL_WPT_URL
          ? this.state.testId
          : `${this.state.wptUrl}/result/${this.state.testId}`;
    },
    loadState() {
        Object.assign(this.state, this.decodeState(window.location.hash));
        this.updateTestUrl();
    },
    saveChanges() {
        window.history.pushState(null, null, "#" + this.encodeState(this.state));
    },
    saveMinorChanges() {
        window.history.replaceState(null, null, "#" + this.encodeState(this.state));
    },
    decodeState(parameters) {
        parameters = parameters.startsWith("#") ? parameters.substr(1) : parameters;
        return parameters.split("&").reduce((state, keyValue) => {
            const [key, value] = keyValue.split("=");
            if (STATE_PARAMS.contains(key)) {
                state[key] = STATE_PARAMS.decode(key, value);
            }
            return state;
        }, Object.assign({}, STATE_DEFAULTS));
    },
    encodeState(state) {
        return Object.keys(state)
            .filter(key => state[key] != STATE_DEFAULTS[key] && STATE_PARAMS.contains(key))
            .map(key => key + "=" + encodeURIComponent(state[key]))
            .join("&");
    }
}

Vue.component('filmstrip-animation', {
    template: `
        <div class="animationView">
            <div class="customization">
                <label><input :checked="state.showMetrics" type="checkbox" @change="store.toggleMetrics($event.target.checked)" /> Show metrics</label>
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
                <ul v-if="state.showMetrics && frame.metrics.length" class="metrics" :style="{'max-width': width + 'px'}">
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
        store: store,
        state: store.state,
        time: 0,
        end: 0,
        slowdownFactor: 4,
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
                store.toggleMetrics(!this.state.showMetrics);
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
            const shouldWait = this.frame.time == this.time && this.frame.metrics.some(metric => metric.highlight) && this.state.showMetrics;
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
                <label><input :checked="state.showMetrics" type="checkbox" @change="store.toggleMetrics($event.target.checked)" /> Show metrics</label>
                <label>Thumbnail width:</label>
                <input :value="state.thumbnailWidth" type="number" min="50" max="400" step="50" @change="store.setMinorSetting('thumbnailWidth', Number($event.target.value))" />
                <label>Columns:</label>
                <input :value="state.columns" type="number" min="0" :max="filmstrip.length" @change="store.setMinorSetting('columns', Number($event.target.value))" />
                <label>Interval (ms):</label>
                <input :value="state.interval" type="number" min="100" :max="5000" step="100" @change="updateInterval($event.target.value)" />
            </div>
            <div class="stage" :style="{'grid-template-columns': 'repeat(' + state.columns + ', max-content)'}">
                <div v-for="thumbnail in this.filmstrip"
                    class="thumbnail" :class="{hasChange: thumbnail.hasChange}">
                    <img :src="thumbnail.url" :style="{width: state.thumbnailWidth + 'px'}" :title="thumbnail.visuallyComplete + '% Visual Progress'" />
                    <span class="time">{{ thumbnail.timeFormatted }}</span>
                    <ul v-if="!!thumbnail.metrics.length && state.showMetrics" class="metrics" :style="{'max-width': state.thumbnailWidth + 'px'}">
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
        store: store,
        state: store.state,
        filmstrip: []
    }},
    watch: { 
        stepData: function() { 
            this.updateFilmstrip();
        }
    },
    created: function() {
        this.updateFilmstrip();
    },
    methods: {
        updateInterval: function(interval) {
            store.setMinorSetting("interval", Number(interval));
            this.updateFilmstrip();
        },
        updateFilmstrip: function() {
            if (!this.stepData) {
                return;
            }
            this.filmstrip = createFilmstrip(this.stepData, this.state.interval, this.timings)
        }
    }
});

var app = new Vue({
    el: '#app',
    data: {
        state: store.state,
        store: store,
        availableSteps: [1],
        availableRuns: [1],
        testData: null,
        error: null,
        stepData: null,
        timings: [],
        testLabel: "",
        loading: false,
        frameImages: []
    },
    created: function () {
        this.loadState();
        window.onpopstate = () => this.loadState();
    },
    computed: {
        showAnimation: function() {
            return this.state.view == "animation";
        },
        waterfallUrl: function() {
            if (!this.testData || !this.state.testId) {
                return null;
            }
            return `${this.state.wptUrl}/result/${this.state.testId}/${this.state.run}/details/#waterfall_view_step${this.state.step}`;
        }
    },
    methods: {
        loadState: function() {
            store.loadState();
            if (this.state.testId) {
                this.loadData();
            }
        },
        loadDataByUrl: function(testUrl) {
            try {
                const [wptUrl, testId] = parseTestUrl(testUrl);
                store.setTest(wptUrl, testId);
                this.loadData();
            } catch (error) {
                console.error(error);
                this.error = `Invalid URL or test ID!: ${error}`;
            }
        },
        loadData: function() {
            this.loading = true;
            fetchData(this.state.wptUrl, this.state.testId)
                .then(response => {
                    this.testData = response.data;
                    this.updateTestData(this.state.run, this.state.step);
                })
                .catch(error => this.error = "Failed to load data: " + error)
                .then(() => this.loading = false);
        },
        selectRun: function(run) {
            this.updateTestData(Number(run), this.state.step);
        },
        selectStep: function(step) {
            this.updateTestData(this.state.run, Number(step));
        },
        updateTestData: function(selectedRun, selectedStep) {
            const runs = (this.testData || {}).runs || {};
            this.availableRuns = Object.keys(runs);
            selectedRun = this.availableRuns.find(run => run == selectedRun) || this.availableRuns[0];
            store.setRun(selectedRun);
            if (!(((runs[selectedRun] || {}).firstView || {}).steps || []).length) {
                this.error = "Invalid response data";
                return;
            }
            const runData = this.testData.runs[selectedRun].firstView;
            this.availableSteps = runData.steps.map(step => step.eventName || `${step.id}`);
            selectedStep = Math.min(selectedStep, runData.numSteps);
            store.setStep(selectedStep);
            this.testLabel = this.testData.label || `${this.testData.url}, ${this.testData.location}`; 
            this.stepData = runData.steps[selectedStep - 1];
            if (!this.stepData) {
                this.error = "Invalid test data";
                return;
            }
            if (!this.stepData.videoFrames) {
                this.error = "The test data doesn't include video data. Make sure the 'Capture Video' option was enabled."
                return;
            }
            this.timings = createTimings(this.stepData);
            this.frameImages = this.stepData.videoFrames.map(frame => frame.image);
            this.error = "";
        },
    }
})

function extractTestId(testUrl) {
    const testIdPattern = /([0-9]{6}_[A-Za-z0-9]{2}_[A-Za-z0-9]+)/;
    const match = testUrl.match(testIdPattern);
    return match ? match[1] : null;
}

function parseTestUrl(testUrl) {
    const testId = extractTestId(testUrl);
    if (!testId) {
        throw "Provide a valid test id.";
    }
    if (testUrl.indexOf("://") < 0) {
        return [OFFICIAL_WPT_URL, testId];
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
