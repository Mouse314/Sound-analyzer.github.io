const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth - 50;
canvas.height = 0.7 * window.innerHeight;

var points = [];

function fft(points) {
    if (points.length == 1) return points
    const N = points.length;
    const even_slice = [];
    const odd_slice = [];
    for (let i = 0; i < N; i++){
        if (i % 2 === 0) even_slice.push(points[i]);
        else odd_slice.push(points[i]);
    }
    const result = Array(N);
    const x_even = fft(even_slice);
    const x_odd = fft(odd_slice);
    for (let i = 0; i < N / 2; i++) {
        const cos = Math.cos(-2 * Math.PI * i / N);
        const sin = Math.sin(-2 * Math.PI * i / N);
        const this_re = x_even[i].re + (cos * x_odd[i].re - sin * x_odd[i].im);
        const this_im = x_even[i].im + (cos * x_odd[i].im + sin * x_odd[i].re);
        result[i] = {re : this_re, im : this_im};
    } 
    for (let i = N / 2; i < N; i++) {
        const cos = Math.cos(-2 * Math.PI * i / N);
        const sin = Math.sin(-2 * Math.PI * i / N);
        const this_re = x_even[i - N / 2].re + (cos * x_odd[i - N / 2].re - sin * x_odd[i - N / 2].im);
        const this_im = x_even[i - N / 2].im + (cos * x_odd[i - N / 2].im + sin * x_odd[i - N / 2].re);
        result[i] = {re : this_re, im : this_im};
    }
    return result; 
}

function ifft(points) {
    const N = points.length;
    const result = Array(N);
    for (let k = 0; k < N; k++) {
        let k_re = 0;
        let k_im = 0;
        for (let n = 0; n < N; n++) {
            const arg = 2 * Math.PI * k * n / N;
            const cos = Math.cos(arg);
            const sin = Math.sin(arg);
            k_re += (points[n].re * cos - points[n].im * sin);
            k_im += (points[n].im * cos + points[n].re * sin);
        }
        result[k] = {re : k_re / N, im : k_im / N};
    }
    return result;
}

function toLog(x, x_max, y_max) {
    const base = 2;
    const tipValue = Math.log(x_max) / Math.log(base);
    const multiplier = y_max / tipValue;
    return Math.log(x) / Math.log(base) * multiplier;
}

var pointer = null;

function drawGraph() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const points_max = Math.max(...points);
    const max = Math.max(points_max, 5);

    const screen_points = [];

    for (let i = 1; i < points.length / 2; i++){
        screen_points.push({x : toLog(i, points.length / 2, canvas.clientWidth),
                            y : 0.85 * canvas.clientHeight - points[i] / max * (0.66 * canvas.clientHeight) });
    }

    // Рисуем график частот
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    ctx.moveTo(screen_points[0].x, screen_points[0].y);
    screen_points.forEach(p => {ctx.lineTo(p.x, p.y)});
    ctx.stroke();

    // Рисуем и пишем максимум
    const max_pos_y = 0.85 * canvas.clientHeight - (0.66 * canvas.clientHeight);
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgb(41, 14, 96)";
    ctx.moveTo(0, max_pos_y);
    ctx.lineTo(canvas.width, max_pos_y);
    ctx.stroke();
    ctx.font = '18px Arial';
    ctx.fillText(`A max: ${points_max.toFixed(1)}`, 10, 0.85 * canvas.clientHeight - 0.66 * canvas.clientHeight - 20);

    // Рисуем указатель на частоту
    if (pointer != null) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "red";
        ctx.moveTo(pointer.x, 0);
        ctx.lineTo(pointer.x, canvas.height);
        ctx.stroke();

        ctx.font = '18px Arial';
        ctx.fillText(`${Math.floor(pointer.f)} Гц`, (pointer.x < canvas.width - 80) ? pointer.x + 2 : pointer.x - 80, 50);

        const vaweLenght = 335 / pointer.f;

        if (vaweLenght >= 0.5) ctx.fillText(`${vaweLenght.toFixed(2)} м`, (pointer.x < canvas.width - 80) ? pointer.x + 2 : pointer.x - 80, 70);
        else if (vaweLenght >= 0.01 && vaweLenght < 0.5) ctx.fillText(`${(vaweLenght * 100).toFixed(2)} см`, (pointer.x < canvas.width - 80) ? pointer.x + 2 : pointer.x - 80, 70);
        else ctx.fillText(`${(vaweLenght * 1000).toFixed(2)} мм`, (pointer.x < canvas.width - 80) ? pointer.x + 2 : pointer.x - 80, 70);
    }
}

var sampleRate = 48000;

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        sampleRate = audioContext.sampleRate;
        console.log('Частота дискретизации:', sampleRate);
        // Создать процессор аудио
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = audioProcessingEvent => {
            const inputBuffer = audioProcessingEvent.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            // Здесь можно работать с массивом семплов inputData
            const complex_points = [];
            inputData.forEach(p => complex_points.push({re : p, im : 0}));
            const freq = fft(complex_points);
            points = freq.map(c => {return Math.sqrt(c.re * c.re + c.im * c.im)});
            drawGraph();
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        })
    .catch(err => {
        console.error('Ошибка при доступе к микрофону:', err);
    });



canvas.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const touchX = touch.clientX - 20;
    pointer = {x : touchX, f : Math.exp(touchX * Math.log(2048) / canvas.clientWidth) / 2048 * sampleRate / 2};
});

canvas.addEventListener("mousemove", (e) => {
    pointer = {x : e.offsetX, f : Math.exp(e.offsetX * Math.log(2048) / canvas.clientWidth) / 2048 * sampleRate / 2};
    drawGraph();
});
canvas.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    const touchX = touch.clientX - 20;
    pointer = {x : touchX, f : Math.exp(touchX * Math.log(2048) / canvas.clientWidth) / 2048 * sampleRate / 2};
    drawGraph();
});

canvas.addEventListener("mouseleave", (e) => {
    pointer = null;
});
canvas.addEventListener("touchend", (e) => {
    pointer = null;    
});