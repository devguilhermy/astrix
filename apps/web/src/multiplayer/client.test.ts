import { expect, test } from 'bun:test';
import { PROTOCOL_VERSION, MAX_CLIENT_FRAME_BYTES } from '@astrix/session';
import { RoomClient } from './client';
import { clearRoom, readCredential, roomSession } from './session';

/** Browser transport seam; each case restores every global and closes its client. */
async function connectedClient(run: (client: RoomClient, socket: TestSocket) => void) {
  const names = ['window', 'document', 'location', 'sessionStorage', 'fetch', 'WebSocket'] as const;
  const descriptors = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const values = new Map<string, string>();
  const sockets: TestSocket[] = [];
  class Socket extends TestSocket { constructor() { super(); sockets.push(this); } }
  const globals = {
    window: new EventTarget(),
    document: Object.assign(new EventTarget(), { querySelector: () => ({ src: 'http://localhost:3000/assets/main-test.js' }) }),
    location: new URL('http://localhost:3000/host'),
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    fetch: async (input: string | URL | Request) => Response.json(String(input) === '/health' ? { protocol: PROTOCOL_VERSION, buildId: '/assets/main-test.js' } : { ticket: 'test-ticket' }),
    WebSocket: Socket,
  };
  let client: RoomClient | undefined;
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: globals[name] });
    clearRoom();
    client = new RoomClient();
    await client.start({ credential: 'fixture-host', host: true, playerId: 'host' });
    expect(sockets).toHaveLength(1);
    run(client, sockets[0]);
  } finally {
    client?.exit();
    clearRoom();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
class TestSocket {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  send(text: string) { this.sent.push(text); }
  close() { this.readyState = 3; }
}

test('unsupported and oversized socket requests preserve host identity for recovery', async () => {
  for (const code of [1008, 1009]) await connectedClient((_client, socket) => {
    socket.onclose?.({ code, reason: 'BAD_MESSAGE' });
    expect(roomSession().status).toBe('repair');
    expect(roomSession().identity?.credential).toBe('fixture-host');
    expect(readCredential()?.credential).toBe('fixture-host');
  });
});

test('actual authentication loss or revocation forgets the credential', async () => {
  for (const code of [4401, 4403]) await connectedClient((_client, socket) => {
    socket.onclose?.({ code, reason: 'UNAUTHORIZED' });
    expect(roomSession().identity).toBeNull();
    expect(readCredential()).toBeNull();
  });
});

test('UTF-8 oversized frames are refused locally without sending or losing identity', async () => {
  await connectedClient((client, socket) => {
    expect(client.send({ type: 'PING', nonce: 'é'.repeat(MAX_CLIENT_FRAME_BYTES / 2) })).toBe(false);
    expect(socket.sent).toEqual([]);
    expect(roomSession().error).toBe('MESSAGE_TOO_LARGE');
    expect(readCredential()?.credential).toBe('fixture-host');
    expect(client.send({ type: 'PING', nonce: 'normal-request' })).toBe(true);
    expect(socket.sent.map(text => JSON.parse(text))).toEqual([{ type: 'PING', nonce: 'normal-request' }]);
  });
});
