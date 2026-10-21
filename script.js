/**
 * ChromaShift: Algorithmic Color Grading & LUT Playground
 * Vanilla JavaScript Image Processing Engine & UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // State & Parameters
    const state = {
        exposure: 0.0,
        contrast: 1.0,
        highlights: 0,
        shadows: 0,
        saturation: 1.0,
        vibrance: 0,
        temp: 0,
        tint: 0,
        lift: { x: 0, y: 0, lum: 0 },
        gamma: { x: 0, y: 0, lum: 0 },
        gain: { x: 0, y: 0, lum: 0 },
        hlHue: 40,
        hlSat: 0,
        shHue: 210,
        shSat: 0,
        splitBalance: 0,
        vignette: 0,
        vignetteMid: 50,
        grain: 0,
        sharpen: 0,
        halation: 0,
        activePreset: 'normal',
        compareOriginal: false,
        splitView: false,
        zoom: 1.0
    };

    const defaultState = JSON.parse(JSON.stringify(state));

    // DOM Elements
    const canvas = document.getElementById('editor-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const histCanvas = document.getElementById('histogram-canvas');
    const histCtx = histCanvas.getContext('2d');
    
    // Image containers
    let sourceImage = null;
    let originalImageData = null;
    let processedImageData = null;

    // Initialize Sample Images (Procedural Generated High Quality Canvas art as built-in samples)
    const sampleGenerators = {
        portrait: (c, w, h) => {
            const x = c.getContext('2d');
            const grad = x.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#3b2f2f');
            grad.addColorStop(0.5, '#e0a96d');
            grad.addColorStop(1, '#1e293b');
            x.fillStyle = grad;
            x.fillRect(0, 0, w, h);
            // Add some geometric shapes for texture
            x.fillStyle = 'rgba(255,255,255,0.1)';
            x.beginPath(); x.arc(w*0.5, h*0.4, w*0.25, 0, Math.PI*2); x.fill();
            x.fillStyle = '#111827';
            x.fillRect(w*0.2, h*0.7, w*0.6, h*0.3);
        },
        landscape: (c, w, h) => {
            const x = c.getContext('2d');
            const grad = x.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#0284c7');
            grad.addColorStop(0.5, '#38bdf8');
            grad.addColorStop(0.51, '#fde047');
            grad.addColorStop(1, '#15803d');
            x.fillStyle = grad;
            x.fillRect(0, 0, w, h);
            // Sun
            x.fillStyle = '#ffffff';
            x.beginPath(); x.arc(w*0.7, h*0.4, 40, 0, Math.PI*2); x.fill();
            // Mountains
            x.fillStyle = '#1e3a8a';
            x.beginPath(); x.moveTo(0, h*0.5);
            x.lineTo(w*0.3, h*0.2);
            x.lineTo(w*0.7, h*0.5);
            x.lineTo(w, h*0.3);
            x.lineTo(w, h*0.5);
            x.closePath(); x.fill();
        },
        urban: (c, w, h) => {
            const x = c.getContext('2d');
            const grad = x.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#475569');
            grad.addColorStop(1, '#0f172a');
            x.fillStyle = grad;
            x.fillRect(0, 0, w, h);
            // Neon lights
            x.fillStyle = '#f43f5e';
            x.fillRect(w*0.2, h*0.3, w*0.15, h*0.7);
            x.fillStyle = '#06b6d4';
            x.fillRect(w*0.6, h*0.2, w*0.2, h*0.8);
        }
    };

    function loadSample(name) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 800;
        tempCanvas.height = 533;
        sampleGenerators[name](tempCanvas, 800, 533);
        
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            initCanvasSize();
            applyGrade();
        };
        img.src = tempCanvas.toDataURL();
    }

    function initCanvasSize() {
        if (!sourceImage) return;
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        ctx.drawImage(sourceImage, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processedImageData = ctx.createImageData(originalImageData);
    }

    // UI Binding & Event Listeners
    function initUI() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            });
        });

        // Sliders binding
        const bindRange = (id, stateKey, formatter = v => v) => {
            const input = document.getElementById(id);
            const valSpan = document.getElementById('val-' + id.replace('range-', ''));
            if (!input) return;
            input.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                state[stateKey] = val;
                if (valSpan) valSpan.textContent = formatter(val);
                requestAnimationFrame(applyGrade);
            });
        };

        bindRange('range-exposure', 'exposure', v => v.toFixed(2));
        bindRange('range-contrast', 'contrast', v => v.toFixed(2));
        bindRange('range-highlights', 'highlights');
        bindRange('range-shadows', 'shadows');
        bindRange('range-saturation', 'saturation', v => v.toFixed(2));
        bindRange('range-vibrance', 'vibrance');
        bindRange('range-temp', 'temp');
        bindRange('range-tint', 'tint');

        bindRange('range-hl-hue', 'hlHue', v => v + '°');
        bindRange('range-hl-sat', 'hlSat', v => v + '%');
        bindRange('range-sh-hue', 'shHue', v => v + '°');
        bindRange('range-sh-sat', 'shSat', v => v + '%');
        bindRange('range-split-balance', 'splitBalance');

        bindRange('range-vignette', 'vignette', v => v + '%');
        bindRange('range-vignette-mid', 'vignetteMid', v => v + '%');
        bindRange('range-grain', 'grain', v => v + '%');
        bindRange('range-sharpen', 'sharpen', v => v + '%');
        bindRange('range-halation', 'halation', v => v + '%');

        // Wheel Luminance Sliders
        document.getElementById('range-lift-lum').addEventListener('input', e => {
            state.lift.lum = parseFloat(e.target.value);
            requestAnimationFrame(applyGrade);
        });
        document.getElementById('range-gamma-lum').addEventListener('input', e => {
            state.gamma.lum = parseFloat(e.target.value);
            requestAnimationFrame(applyGrade);
        });
        document.getElementById('range-gain-lum').addEventListener('input', e => {
            state.gain.lum = parseFloat(e.target.value);
            requestAnimationFrame(applyGrade);
        });

        // Presets
        document.querySelectorAll('.preset-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.preset-card').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                applyPreset(e.target.dataset.preset);
            });
        });

        // Samples
        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                loadSample(e.target.dataset.sample);
            });
        });

        // File Upload
        document.getElementById('file-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    sourceImage = img;
                    initCanvasSize();
                    applyGrade();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Compare & Split toggle
        const compareBtn = document.getElementById('btn-compare');
        compareBtn.addEventListener('mousedown', () => {
            state.compareOriginal = true;
            renderCanvasView();
        });
        window.addEventListener('mouseup', () => {
            if (state.compareOriginal) {
                state.compareOriginal = false;
                renderCanvasView();
            }
        });

        // Reset button
        document.getElementById('btn-reset').addEventListener('click', () => {
            Object.assign(state, JSON.parse(JSON.stringify(defaultState)));
            syncUIFromState();
            applyGrade();
        });

        // Export Image
        document.getElementById('btn-export-img').addEventListener('click', () => {
            if (!sourceImage) return;
            const link = document.createElement('a');
            link.download = 'chromashift-graded.jpg';
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
        });

        // Export .CUBE LUT
        document.getElementById('btn-export-cube').addEventListener('click', exportCubeLUT);

        // Color Wheels Interaction
        initColorWheels();
    }

    function syncUIFromState() {
        for (let key in state) {
            const el = document.getElementById('range-' + key);
            if (el) {
                el.value = state[key];
                const valSpan = document.getElementById('val-' + key);
                if (valSpan) valSpan.textContent = el.value;
            }
        }
        document.querySelectorAll('.preset-card').forEach(b => {
            b.classList.toggle('active', b.dataset.preset === state.activePreset);
        });
    }

    // Interactive Color Wheels setup
    function initColorWheels() {
        const setupWheel = (wheelId, wheelState) => {
            const wCanvas = document.getElementById(wheelId);
            const wCtx = wCanvas.getContext('2d');
            const radius = wCanvas.width / 2;

            function draw() {
                wCtx.clearRect(0, 0, wCanvas.width, wCanvas.height);
                // Draw hue gradient ring
                for (let angle = 0; angle < 360; angle += 2) {
                    const rad = (angle * Math.PI) / 180;
                    wCtx.strokeStyle = `hsl(${angle}, 70%, 50%)`;
                    wCtx.lineWidth = 12;
                    wCtx.beginPath();
                    wCtx.arc(radius, radius, radius - 10, rad, rad + 0.04);
                    wCtx.stroke();
                }
                // Draw picker knob
                const dist = wheelState.x * (radius - 15);
                const angleRad = (wheelState.y * Math.PI) / 180;
                const kX = radius + dist * Math.cos(angleRad);
                const kY = radius + dist * Math.sin(angleRad);

                wCtx.fillStyle = '#ffffff';
                wCtx.strokeStyle = '#000000';
                wCtx.lineWidth = 2;
                wCtx.beginPath();
                wCtx.arc(kX, kY, 5, 0, Math.PI * 2);
                wCtx.fill();
                wCtx.stroke();
            }

            let isDragging = false;
            wCanvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                updatePos(e);
            });
            window.addEventListener('mousemove', (e) => {
                if (isDragging) updatePos(e);
            });
            window.addEventListener('mouseup', () => {
                isDragging = false;
            });

            function updatePos(e) {
                const rect = wCanvas.getBoundingClientRect();
                const dx = e.clientX - rect.left - radius;
                const dy = e.clientY - rect.top - radius;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius - 10);
                const angle = Math.atan2(dy, dx);
                
                wheelState.x = dist / (radius - 10);
                wheelState.y = (angle * 180) / Math.PI;
                draw();
                requestAnimationFrame(applyGrade);
            }

            draw();
        };

        setupWheel('wheel-lift', state.lift);
        setupWheel('wheel-gamma', state.gamma);
        setupWheel('wheel-gain', state.gain);
    }

    // Presets definitions
    function applyPreset(name) {
        state.activePreset = name;
        // Reset baseline
        state.exposure = 0; state.contrast = 1; state.saturation = 1;
        state.temp = 0; state.tint = 0; state.vignette = 0; state.grain = 0;
        state.hlSat = 0; state.shSat = 0;

        if (name === 'technicolor') {
            state.contrast = 1.35;
            state.saturation = 1.4;
            state.temp = 15;
            state.shHue = 210; state.shSat = 30;
            state.hlHue = 40; state.hlSat = 25;
            state.vignette = 30;
        } else if (name === 'bleach') {
            state.contrast = 1.5;
            state.saturation = 0.4;
            state.exposure = 0.1;
            state.grain = 25;
        } else if (name === 'cross') {
            state.contrast = 1.2;
            state.saturation = 1.3;
            state.temp = -20;
            state.hlHue = 80; state.hlSat = 40;
            state.shHue = 280; state.shSat = 40;
        } else if (name === 'noir') {
            state.contrast = 1.6;
            state.saturation = 0.0;
            state.vignette = 60;
            state.grain = 40;
        } else if (name === 'cyberpunk') {
            state.contrast = 1.3;
            state.saturation = 1.5;
            state.hlHue = 300; state.hlSat = 50;
            state.shHue = 190; state.shSat = 60;
            state.halation = 30;
            state.vignette = 40;
        }
        syncUIFromState();
        applyGrade();
    }

    // Core Image Processing Pipeline
    function applyGrade() {
        if (!originalImageData) return;
        const src = originalImageData.data;
        const dst = processedImageData.data;
        const len = src.length;

        // Precompute color wheel offsets in RGB
        const getOffsetRGB = (wheel) => {
            const rad = (wheel.y * Math.PI) / 180;
            const mag = wheel.x * 50;
            const r = Math.cos(rad) * mag;
            const g = Math.sin(rad + (Math.PI * 2) / 3) * mag;
            const b = Math.sin(rad + (Math.PI * 4) / 3) * mag;
            return [r, g, b];
        };

        const liftOff = getOffsetRGB(state.lift);
        const gammaOff = getOffsetRGB(state.gamma);
        const gainOff = getOffsetRGB(state.gain);

        // Helper for Split Toning
        const hlRad = (state.hlHue * Math.PI) / 180;
        const hlR = Math.cos(hlRad) * state.hlSat * 1.5;
        const hlG = Math.sin(hlRad + 2.09) * state.hlSat * 1.5;
        const hlB = Math.sin(hlRad + 4.18) * state.hlSat * 1.5;

        const shRad = (state.shHue * Math.PI) / 180;
        const shR = Math.cos(shRad) * state.shSat * 1.5;
        const shG = Math.sin(shRad + 2.09) * state.shSat * 1.5;
        const shB = Math.sin(shRad + 4.18) * state.shSat * 1.5;

        for (let i = 0; i < len; i += 4) {
            let r = src[i];
            let g = src[i + 1];
            let b = src[i + 2];
            let a = src[i + 3];

            // 1. Temperature & Tint
            if (state.temp !== 0) {
                r += state.temp * 0.8;
                b -= state.temp * 0.8;
            }
            if (state.tint !== 0) {
                g += state.tint * 0.8;
            }

            // 2. Exposure & Contrast
            let normR = r / 255;
            let normG = g / 255;
            let normB = b / 255;

            if (state.exposure !== 0) {
                const expMult = Math.pow(2, state.exposure);
                normR *= expMult;
                normG *= expMult;
                normB *= expMult;
            }

            // Contrast pivot at 0.5
            if (state.contrast !== 1.0) {
                normR = (normR - 0.5) * state.contrast + 0.5;
                normG = (normG - 0.5) * state.contrast + 0.5;
                normB = (normB - 0.5) * state.contrast + 0.5;
            }

            // 3. Highlights & Shadows recovery
            let lum = 0.299 * normR + 0.587 * normG + 0.114 * normB;
            if (state.highlights !== 0 && lum > 0.5) {
                const factor = (lum - 0.5) * 2 * (state.highlights / 100);
                normR += factor; normG += factor; normB += factor;
            }
            if (state.shadows !== 0 && lum < 0.5) {
                const factor = (0.5 - lum) * 2 * (state.shadows / 100);
                normR += factor; normG += factor; normB += factor;
            }

            // 4. Lift, Gamma, Gain (Primary Color Wheels)
            normR = normR * (1 + gainOff[0]/100) + liftOff[0]/100;
            normG = normG * (1 + gainOff[1]/100) + liftOff[1]/100;
            normB = normB * (1 + gainOff[2]/100) + liftOff[2]/100;

            // 5. Split Toning
            if (state.hlSat > 0 || state.shSat > 0) {
                const hlWeight = Math.max(0, (lum - 0.5) * 2);
                const shWeight = Math.max(0, (0.5 - lum) * 2);
                normR += (hlR * hlWeight + shR * shWeight) / 100;
                normG += (hlG * hlWeight + shG * shWeight) / 100;
                normB += (hlB * hlWeight + shB * shWeight) / 100;
            }

            // 6. Saturation & Vibrance
            if (state.saturation !== 1.0 || state.vibrance !== 0) {
                const l = 0.299 * normR + 0.587 * normG + 0.114 * normB;
                let satFactor = state.saturation;
                if (state.vibrance !== 0) {
                    const maxChan = Math.max(normR, normG, normB);
                    const minChan = Math.min(normR, normG, normB);
                    const currentSat = maxChan - minChan;
                    satFactor += (state.vibrance / 100) * (1 - currentSat);
                }
                normR = l + (normR - l) * satFactor;
                normG = l + (normG - l) * satFactor;
                normB = l + (normB - l) * satFactor;
            }

            // Clamp values
            dst[i] = Math.min(255, Math.max(0, normR * 255));
            dst[i + 1] = Math.min(255, Math.max(0, normG * 255));
            dst[i + 2] = Math.min(255, Math.max(0, normB * 255));
            dst[i + 3] = a;
        }

        // Post-processing effects (Vignette & Grain)
        applyPostEffects(dst, canvas.width, canvas.height);

        renderCanvasView();
        updateHistogram(dst);
    }

    function applyPostEffects(data, width, height) {
        // Vignette
        if (state.vignette > 0) {
            const cx = width / 2;
            const cy = height / 2;
            const maxDist = Math.sqrt(cx * cx + cy * cy);
            const vigAmount = state.vignette / 100;
            const midPoint = state.vignetteMid / 100;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxDist;
                    if (dist > midPoint) {
                        const factor = 1 - Math.min(1, (dist - midPoint) / (1 - midPoint)) * vigAmount;
                        data[idx] *= factor;
                        data[idx + 1] *= factor;
                        data[idx + 2] *= factor;
                    }
                }
            }
        }

        // Film Grain
        if (state.grain > 0) {
            const grainStrength = (state.grain / 100) * 35;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * grainStrength;
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
            }
        }
    }

    function renderCanvasView() {
        if (!originalImageData) return;
        if (state.compareOriginal) {
            ctx.putImageData(originalImageData, 0, 0);
        } else {
            ctx.putImageData(processedImageData, 0, 0);
        }
    }

    // Histogram generation
    function updateHistogram(data) {
        const histR = new Array(256).fill(0);
        const histG = new Array(256).fill(0);
        const histB = new Array(256).fill(0);
        const len = data.length;

        for (let i = 0; i < len; i += 16) { // sampled for performance
            histR[data[i]]++;
            histG[data[i + 1]]++;
            histB[data[i + 2]]++;
        }

        const maxVal = Math.max(...histR, ...histG, ...histB, 1);
        const w = histCanvas.width;
        const h = histCanvas.height;

        histCtx.fillStyle = '#121214';
        histCtx.fillRect(0, 0, w, h);

        const drawChannel = (hist, color) => {
            histCtx.strokeStyle = color;
            histCtx.lineWidth = 1;
            histCtx.beginPath();
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * w;
                const y = h - (hist[i] / maxVal) * h;
                if (i === 0) histCtx.moveTo(x, y);
                else histCtx.lineTo(x, y);
            }
            histCtx.stroke();
        };

        histCtx.globalCompositeOperation = 'screen';
        drawChannel(histR, 'rgba(239, 68, 68, 0.7)');
        drawChannel(histG, 'rgba(34, 197, 94, 0.7)');
        drawChannel(histB, 'rgba(59, 130, 246, 0.7)');
        histCtx.globalCompositeOperation = 'source-over';
    }

    // Export 3D LUT (.cube format generator)
    function exportCubeLUT() {
        const size = 17; // 17x17x17 standard LUT grid
        let cubeContent = `# Created with ChromaShift LUT Playground\n`;
        cubeContent += `TITLE "ChromaShift Custom Grade"
`;
        cubeContent += `LUT_3D_SIZE ${size}

`;

        // Generate LUT table mapping
        for (let b = 0; b < size; b++) {
            for (let g = 0; g < size; g++) {
                for (let r = 0; r < size; r++) {
                    const rf = r / (size - 1);
                    const gf = g / (size - 1);
                    const bf = b / (size - 1);

                    // Simulate grade on normalized rgb
                    let ro = rf, go = gf, bo = bf;
                    if (state.exposure !== 0) {
                        const exp = Math.pow(2, state.exposure);
                        ro *= exp; go *= exp; bo *= exp;
                    }
                    if (state.contrast !== 1.0) {
                        ro = (ro - 0.5) * state.contrast + 0.5;
                        go = (go - 0.5) * state.contrast + 0.5;
                        bo = (bo - 0.5) * state.contrast + 0.5;
                    }
                    const lum = 0.299 * ro + 0.587 * go + 0.114 * bo;
                    if (state.saturation !== 1.0) {
                        ro = lum + (ro - lum) * state.saturation;
                        go = lum + (go - lum) * state.saturation;
                        bo = lum + (bo - lum) * state.saturation;
                    }

                    cubeContent += `${Math.min(1, Math.max(0, ro)).toFixed(6)} ${Math.min(1, Math.max(0, go)).toFixed(6)} ${Math.min(1, Math.max(0, bo)).toFixed(6)}
`;
                }
            }
        }

        const blob = new Blob([cubeContent], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = 'chromashift-look.cube';
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    // Boot
    initUI();
    loadSample('portrait');
});
