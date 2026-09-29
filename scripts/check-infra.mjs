import net from 'node:net';

const targets = [
    { name: 'postgres', host: 'localhost', port: 5432 },
    { name: 'redis', host: 'localhost', port: 6379 },
    { name: 'rabbitmq', host: 'localhost', port: 5672 },
    { name: 'minio', host: 'localhost', port: 9000 },
];

const probe = (host, port, timeout = 1000) =>
    new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const done = ok => {
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
    });

const results = await Promise.all(targets.map(async (t) => ({
    ...t,
    ok: await probe(t.host, t.port)
})));

for (const r of results) {
    console.log(`${r.ok ? 'OK' : 'FAIL'} ${r.name.padEnd(9)} ${r.host}:${ r.port }`);
}

const failed = results.filter(r => !r.ok);

if (failed.length > 0) {
    console.error(`\nНедоступно сервисов: ${failed.length}`);
    process.exit(1);
}

console.log('Все сервисы отвечают');