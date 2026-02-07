/**
 * K BRAIN - KEYWORDS DATABASE
 * All keywords in ENGLISH ONLY
 * Translation happens dynamically when user language is detected
 */

window.BRAIN_KEYWORDS = {

    // 📄 DOCUMENTS
    DOCUMENTS: {
        module: 'text',
        keywords: {
            open: ['open', 'load', 'upload', 'open file', 'import'],
            save: ['save', 'store', 'keep'],
            download: ['download', 'export', 'get file'],
            copy: ['copy', 'clipboard'],
            edit: ['edit', 'modify', 'change'],
            view: ['view', 'show', 'display', 'see'],
            delete: ['delete', 'remove', 'erase'],
            print: ['print'],
            formats: ['word', 'docx', 'doc', 'excel', 'xlsx', 'pdf', 'text', 'txt', 'video', 'mp4']
        }
    },

    // 🎨 IMAGES
    IMAGES: {
        module: 'image',
        keywords: {
            generate: ['generate', 'create', 'make', 'produce'],
            draw: ['draw', 'paint', 'sketch', 'illustrate'],
            image: ['image', 'picture', 'photo', 'photograph'],
            save: ['save image', 'download image'],
            styles: ['realistic', 'artistic', 'cartoon', 'anime', '3d', 'oil painting', 'watercolor']
        }
    },

    // 🎬 VIDEO
    VIDEO: {
        module: 'text',
        keywords: {
            play: ['play', 'start', 'run'],
            pause: ['pause', 'stop', 'hold'],
            control: ['forward', 'backward', 'rewind', 'skip'],
            volume: ['volume', 'sound', 'mute', 'unmute'],
            formats: ['video', 'mp4', 'webm', 'mov', 'avi', 'movie', 'clip']
        }
    },

    // 💻 CODE
    CODE: {
        module: 'code',
        keywords: {
            open: ['code', 'python', 'script', 'program', 'programming'],
            run: ['run', 'execute', 'start code'],
            write: ['write code', 'code'],
            save: ['save code', 'save script'],
            copy: ['copy code'],
            debug: ['debug', 'fix', 'error', 'bug']
        }
    },

    // 📷 SCAN/MICROSCOPE
    SCAN: {
        module: 'scan',
        keywords: {
            open: ['microscope', 'camera', 'webcam', 'usb camera'],
            scan: ['scan', 'capture', 'take photo'],
            photo: ['capture', 'photo', 'picture', 'snapshot'],
            save: ['save capture', 'save photo', 'download capture'],
            stop: ['stop camera', 'close camera', 'turn off camera']
        }
    },

    // 📍 MAPS
    MAPS: {
        module: 'map',
        keywords: {
            location: ['where', 'location', 'gps', 'position', 'my location', 'where am i'],
            navigate: ['navigate', 'directions', 'take me', 'go to', 'route'],
            search: ['find place', 'search place', 'locate'],
            distance: ['distance', 'how far', 'how long'],
            map: ['map', 'maps', 'google maps']
        }
    },

    // 🌤️ WEATHER
    WEATHER: {
        module: 'weather',
        keywords: {
            weather: ['weather', 'forecast'],
            temperature: ['temperature', 'degrees', 'celsius', 'fahrenheit'],
            conditions: ['outside', 'rain', 'sun', 'clouds', 'snow', 'wind'],
            forecast: ['forecast', 'tomorrow', 'next week']
        }
    },

    // 📁 ZIP
    ZIP: {
        module: 'folder',
        keywords: {
            open: ['archive', 'zip', 'rar', '7z', 'compressed'],
            extract: ['extract', 'unzip', 'decompress'],
            compress: ['compress', 'zip', 'archive', 'pack'],
            list: ['show contents', 'list files']
        }
    },

    // 🔍 SEARCH
    SEARCH: {
        module: 'search',
        keywords: {
            search: ['search', 'find', 'look for', 'google'],
            info: ['info', 'information', 'about', 'what is', 'who is'],
            web: ['google', 'web', 'online', 'internet']
        }
    },

    // ⚙️ ACTIONS
    ACTIONS: {
        module: 'action',
        keywords: {
            fullscreen: ['fullscreen', 'maximize', 'full screen'],
            back: ['back', 'return', 'go back'],
            close: ['close', 'exit', 'quit'],
            cancel: ['cancel', 'abort', 'stop'],
            help: ['help', 'tutorial', 'how to']
        }
    }
};

// Match helper
window.BRAIN_KEYWORDS.match = function (message, category, action) {
    const cat = this[category];
    if (!cat?.keywords[action]) return false;
    const msg = message.toLowerCase();
    return cat.keywords[action].some(kw => msg.includes(kw));
};

console.log('🧠 BRAIN: Keywords loaded -', Object.keys(window.BRAIN_KEYWORDS).length - 1, 'modules');
