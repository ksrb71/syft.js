import 'regenerator-runtime/runtime';

import { Logger, SOCKET_PING } from 'syft-helpers.js';
import { WebSocket, Server } from 'mock-socket';

import Socket from '../src/sockets';

global.WebSocket = WebSocket;

const url = 'ws://localhost:8080/';

// Create a promise that is resolved when the event is triggered.
const makeEventPromise = (emitter, event) => {
  let resolver;

  const promise = new Promise(resolve => (resolver = resolve));
  emitter.on(event, data => resolver(data));

  return promise;
};

describe('Sockets', () => {
  const logger = new Logger('syft.js', true);

  let mockServer;

  jest.spyOn(console, 'log');

  beforeEach(() => {
    mockServer = new Server(url);
    mockServer.connected = makeEventPromise(mockServer, 'connection');
  });

  afterEach(() => {
    mockServer.close();
    jest.clearAllMocks();
  });

  test('sends keep-alive messages automatically', async () => {
    const keepAliveTimeout = 300,
      expectedMessagesCount = 3,
      messages = [],
      expectedTypes = [];

    // TODO: @Vova - do we need this line at all? Apparently we're not using 'mySocket' anymore.
    // TODO: @Vova - matter of fact, it seems like we don't even need this test... removing the whole thing doesn't affect our coverage at all
    // TODO: @Vova - would you mind making sure this test is actually testing the keep-alive functionality or just remove it if we don't need it
    const mySocket = new Socket({
      url,
      logger,
      keepAliveTimeout
    });

    const serverSocket = await mockServer.connected;

    serverSocket.on('message', message => messages.push(JSON.parse(message)));

    await new Promise(done =>
      setTimeout(
        done,
        keepAliveTimeout * expectedMessagesCount + keepAliveTimeout / 2
      )
    );

    // One keep-alive message is sent right after connection, hence +1.
    expect(messages).toHaveLength(expectedMessagesCount + 1);

    for (let i = 0; i < expectedMessagesCount + 1; i++) {
      expectedTypes.push(SOCKET_PING);
    }

    expect(messages.map(message => message['type'])).toEqual(expectedTypes);
  });

  test('triggers onOpen event', async () => {
    // TODO: @Vova - this test does do something, but why is 'mySocket' still unused?
    // TODO: @Vova - can you correct this test to actually use the variable or remove it?
    const onOpen = jest.fn(),
      mySocket = new Socket({
        url,
        logger,
        onOpen
      });

    await mockServer.connected;

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('triggers onClose event', async () => {
    const closed = makeEventPromise(mockServer, 'close'),
      onClose = jest.fn(),
      mySocket = new Socket({
        url,
        logger,
        onClose
      });

    await mockServer.connected;

    mySocket.stop();

    await closed;

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mySocket.timerId).toBeNull();
  });

  test('sends data correctly', async () => {
    const testReqType = 'test',
      testReqData = { blob: 1 },
      testResponse = { response: 'test' },
      testInstanceId = 'test-instance',
      mySocket = new Socket({
        instanceId: testInstanceId,
        url,
        logger,
        onMessage: data => data
      });

    const serverSocket = await mockServer.connected;

    // Skip first keep-alive message.
    await makeEventPromise(serverSocket, 'message');

    const responsePromise = mySocket.send(testReqType, testReqData);
    const message = await makeEventPromise(serverSocket, 'message');

    serverSocket.send(JSON.stringify(testResponse));

    const response = await responsePromise;

    expect(JSON.parse(message)).toEqual({
      type: testReqType,
      data: testReqData
    });
    expect(response).toEqual(testResponse);
  });

  test('returns error when .send() fails', async () => {
    const mySocket = new Socket({
      url,
      logger,
      onMessage: data => data
    });

    const serverSocket = await mockServer.connected;

    // Skip first keep-alive message.
    await makeEventPromise(serverSocket, 'message');

    const responsePromise = mySocket.send('test', {});

    mockServer.simulate('error');

    expect.assertions(1);

    try {
      await responsePromise;
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  test('disconnects from server after .stop()', async () => {
    const mySocket = new Socket({
      url,
      logger
    });

    // TODO: @Vova - are we using 'serverSocket'? What's the point of this variable?
    const serverSocket = await mockServer.connected;

    expect(mockServer.clients()).toHaveLength(1);

    mySocket.stop();

    await new Promise(done => setTimeout(done, 100));

    expect(mockServer.clients()).toHaveLength(0);
  });

  test('triggers onMessage event', async () => {
    const testResponse = { response: 'test' },
      testInstanceId = 'test-instance',
      onMessage = jest.fn(message => message),
      mySocket = new Socket({
        instanceId: testInstanceId,
        url,
        logger,
        onMessage: onMessage
      });

    const serverSocket = await mockServer.connected;

    // Skip first keep-alive message.
    await makeEventPromise(serverSocket, 'message');

    serverSocket.on('message', () => {
      serverSocket.send(JSON.stringify(testResponse));
    });

    await mySocket.send('test1', {});
    await mySocket.send('test2', {});

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenLastCalledWith(testResponse);
  });
});
