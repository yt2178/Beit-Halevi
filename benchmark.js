const fetch = require('node-fetch');

const urls = Array(10).fill('https://via.placeholder.com/150');

async function sequential() {
    const start = Date.now();
    for (const url of urls) {
        await fetch(url);
    }
    return Date.now() - start;
}

async function parallel() {
    const start = Date.now();
    await Promise.all(urls.map(url => fetch(url)));
    return Date.now() - start;
}

async function run() {
    // Warmup
    await sequential();
    await parallel();

    const seqTime = await sequential();
    const parTime = await parallel();

    console.log(`Sequential: ${seqTime}ms`);
    console.log(`Parallel: ${parTime}ms`);
    console.log(`Improvement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}%`);
}

run();
