// audio-recorder.js — Voice message recorder for Group Chat
// Records audio using MediaRecorder API, converts to base64, uploads to Supabase
(function () {
    if (window._audioRecorderLoaded) return;
    window._audioRecorderLoaded = true;

    const style = document.createElement('style');
    style.textContent = `
        .audio-rec-btn {
            width: 36px; height: 36px;
            border-radius: 50%;
            border: 1.5px solid rgba(0,255,255,0.15);
            background: rgba(0,255,255,0.04);
            color: rgba(0,255,255,0.6);
            font-size: 1rem;
            cursor: pointer;
            transition: all .3s;
            display: flex; align-items: center; justify-content: center;
        }
        .audio-rec-btn:hover { border-color: rgba(0,255,255,0.3); background: rgba(0,255,255,0.08); }
        .audio-rec-btn.recording {
            border-color: #f87171; background: rgba(248,113,113,0.1);
            animation: recPulse 1s ease infinite;
        }
        @keyframes recPulse { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 12px rgba(248,113,113,0.3)} }
        .audio-rec-timer {
            font-size: .65rem; color: #f87171; font-weight: 600;
            font-variant-numeric: tabular-nums; min-width: 32px;
        }
        .audio-msg {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 12px; border-radius: 12px;
            background: rgba(0,255,255,0.03); border: 1px solid rgba(0,255,255,0.06);
        }
        .audio-msg .play-btn {
            width: 28px; height: 28px; border-radius: 50%;
            border: 1px solid rgba(0,255,255,0.15);
            background: rgba(0,255,255,0.06); color: rgba(0,255,255,0.7);
            cursor: pointer; font-size: .8rem;
            display: flex; align-items: center; justify-content: center;
            transition: all .2s;
        }
        .audio-msg .play-btn:hover { background: rgba(0,255,255,0.12); }
        .audio-msg .audio-bar {
            flex: 1; height: 3px; border-radius: 2px;
            background: rgba(255,255,255,0.06); overflow: hidden;
        }
        .audio-msg .audio-bar .progress {
            height: 100%; width: 0%; border-radius: 2px;
            background: linear-gradient(90deg, #00ffff, #0066ff);
            transition: width .1s linear;
        }
        .audio-msg .audio-dur {
            font-size: .6rem; color: rgba(255,255,255,0.25);
            font-variant-numeric: tabular-nums;
        }
    `;
    document.head.appendChild(style);

    // ═══ AUDIO RECORDER CLASS ═══
    window.AudioRecorder = class AudioRecorder {
        constructor(options = {}) {
            this.onComplete = options.onComplete || (() => { });
            this.maxDuration = options.maxDuration || 120; // 2 min max
            this.mediaRecorder = null;
            this.chunks = [];
            this.startTime = null;
            this.timerInterval = null;
            this.isRecording = false;
        }

        createButton(container) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;align-items:center;gap:6px';

            this.btn = document.createElement('button');
            this.btn.className = 'audio-rec-btn';
            this.btn.innerHTML = '🎤';
            this.btn.title = 'Record voice message';
            this.btn.onclick = () => this.toggle();

            this.timer = document.createElement('span');
            this.timer.className = 'audio-rec-timer';
            this.timer.style.display = 'none';

            wrapper.appendChild(this.btn);
            wrapper.appendChild(this.timer);
            container.appendChild(wrapper);
            return wrapper;
        }

        async toggle() {
            if (this.isRecording) {
                this.stop();
            } else {
                await this.start();
            }
        }

        async start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.chunks = [];
                this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.chunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    stream.getTracks().forEach(t => t.stop());
                    const blob = new Blob(this.chunks, { type: 'audio/webm' });
                    const duration = Math.round((Date.now() - this.startTime) / 1000);
                    this.onComplete(blob, duration);
                };

                this.mediaRecorder.start(250);
                this.startTime = Date.now();
                this.isRecording = true;
                this.btn.classList.add('recording');
                this.btn.innerHTML = '⏹';
                this.timer.style.display = 'block';
                this.timer.textContent = '0:00';

                this.timerInterval = setInterval(() => {
                    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
                    this.timer.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
                    if (elapsed >= this.maxDuration) this.stop();
                }, 500);

            } catch (err) {
                console.error('Mic access denied:', err);
                alert('Microphone access required for voice messages.');
            }
        }

        stop() {
            if (!this.isRecording) return;
            clearInterval(this.timerInterval);
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.btn.classList.remove('recording');
            this.btn.innerHTML = '🎤';
            this.timer.style.display = 'none';
        }
    };

    // ═══ AUDIO PLAYER FOR MESSAGES ═══
    window.createAudioPlayer = function (fileUrl, durationSec) {
        const el = document.createElement('div');
        el.className = 'audio-msg';

        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn';
        playBtn.textContent = '▶';

        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        const progress = document.createElement('div');
        progress.className = 'progress';
        bar.appendChild(progress);

        const dur = document.createElement('span');
        dur.className = 'audio-dur';
        dur.textContent = durationSec ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : '0:00';

        el.appendChild(playBtn);
        el.appendChild(bar);
        el.appendChild(dur);

        let audio = null;
        let playing = false;

        playBtn.onclick = () => {
            if (!audio) {
                audio = new Audio(fileUrl);
                audio.ontimeupdate = () => {
                    if (audio.duration) {
                        const pct = (audio.currentTime / audio.duration) * 100;
                        progress.style.width = pct + '%';
                        const remaining = Math.round(audio.duration - audio.currentTime);
                        dur.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
                    }
                };
                audio.onended = () => {
                    playing = false;
                    playBtn.textContent = '▶';
                    progress.style.width = '0%';
                    dur.textContent = durationSec ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : '0:00';
                };
            }
            if (playing) {
                audio.pause();
                playing = false;
                playBtn.textContent = '▶';
            } else {
                audio.play();
                playing = true;
                playBtn.textContent = '⏸';
            }
        };

        return el;
    };

    // ═══ UPLOAD AUDIO TO BACKEND ═══
    window.uploadAudioMessage = async function (blob, email, groupId) {
        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
        const base64Data = await base64Promise;
        const fileName = `voice_${Date.now()}.webm`;

        // Upload file
        const uploadRes = await fetch('/.netlify/functions/group-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'upload_file',
                email,
                file_data: base64Data,
                file_name: fileName,
                file_type: 'audio/webm'
            })
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

        // Send message with audio type
        const msgRes = await fetch('/.netlify/functions/group-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send_message',
                email,
                group_id: groupId,
                type: 'audio',
                content: '🎤 Voice message',
                file_url: uploadData.file_url,
                file_name: fileName
            })
        });
        return await msgRes.json();
    };
})();
