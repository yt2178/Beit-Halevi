const { performance } = require('perf_hooks');

async function testBatched() {
    const imagesToDownload = Array(50).fill({src: 'http://example.com/img.jpg'});
    const start = performance.now();
    let maxBlock = 0;

    const batchSize = 5;
    for (let i = 0; i < imagesToDownload.length; i += batchSize) {
        const batch = imagesToDownload.slice(i, i + batchSize);
        const blockStart = performance.now();
        let j = 0;
        for (const img of batch) {
            // Simulate work done by browser when clicking download link
            for(let k=0; k<1000000; k++) {}
            j++;
        }
        const blockDuration = performance.now() - blockStart;
        if (blockDuration > maxBlock) maxBlock = blockDuration;

        if (i + batchSize < imagesToDownload.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    return { total: performance.now() - start, maxBlock };
}

async function testSequential() {
    const imagesToDownload = Array(50).fill({src: 'http://example.com/img.jpg'});
    const start = performance.now();
    let maxBlock = 0;

    for (let i = 0; i < imagesToDownload.length; i++) {
        const blockStart = performance.now();
        // Simulate work done by browser when clicking download link
        for(let k=0; k<1000000; k++) {}
        const blockDuration = performance.now() - blockStart;
        if (blockDuration > maxBlock) maxBlock = blockDuration;

        if (i < imagesToDownload.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2));
        }
    }
    return { total: performance.now() - start, maxBlock };
}

async function run() {
    const batched = await testBatched();
    const sequential = await testSequential();
    console.log("Batched - Max Block:", batched.maxBlock.toFixed(2), "ms");
    console.log("Sequential - Max Block:", sequential.maxBlock.toFixed(2), "ms");
}
run();
