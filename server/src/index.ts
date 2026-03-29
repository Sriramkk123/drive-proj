import Fastify from 'fastify';

const server = Fastify({ logger: true });

const port = Number(process.env['PORT'] ?? 3001);

server.get('/health', async () => {
  return { status: 'ok' };
});

server.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
