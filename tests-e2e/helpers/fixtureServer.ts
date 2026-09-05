import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export type FixtureServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/**
 * Sert les pages de fixture E2E sur 127.0.0.1, port choisi par l'OS.
 * Evite toute dependance a un vrai fournisseur externe pour les tests.
 */
export function startFixtureServer(): Promise<FixtureServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(FIXTURES_DIR, (req.url ?? '/').replace(/^\//, '') || 'home.html');
      fs.readFile(filePath, (error, content) => {
        if (error) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Impossible de determiner le port du serveur de fixture.'));
        return;
      }

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((res) => server.close(() => res()))
      });
    });
  });
}
