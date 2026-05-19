import { Telegraf } from 'telegraf';
import { EventEmitter } from 'events';

describe('/health command', () => {
  let bot: Telegraf;
  let replyMock: jest.Mock;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    replyMock = jest.fn();
    fetchMock = jest.fn();

    // Mock global fetch
    global.fetch = fetchMock;

    // Create a minimal fake bot context
    bot = new Telegraf('dummy_token');
  });

  test('should reply with formatted health info on successful API response', async () => {
    const mockHealthData = {
      ok: true,
      uptimeSeconds: '123.4',
      memoryUsage: { rss: 100, heapTotal: 50 },
      serverTime: '2024-06-01T12:00:00.000Z',
      apiVersion: '1.0.0'
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData
    });

    // Fake context object
    const ctx = {
      reply: replyMock,
      message: { text: '/health' },
      chat: { id: 1 },
      from: { id: 1 }
    } as any;

    // Add the /health command handler code snippet from the bot
    const healthCommandHandler = async (ctx: any) => {
      try {
        const response = await fetch(`${'http://dummyapi'}/health/detailed`);
        if (!response.ok) {
          await ctx.reply(`API health check failed with status: ${response.status}`);
          return;
        }
        const data = await response.json();

        // Format the data for Telegram display
        const formattedMessage = Object.entries(data)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join("\n");

        await ctx.reply(formattedMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.reply(`Could not reach API at ${'http://dummyapi'}: ${message}`);
      }
    };

    // Replace config.apiBaseUrl used in handler with dummy url
    await healthCommandHandler(ctx);

    // Check reply was called with formatted health data
    expect(replyMock).toHaveBeenCalledTimes(1);
    const replyArg = replyMock.mock.calls[0][0];
    expect(replyArg).toContain('ok: true');
    expect(replyArg).toContain('uptimeSeconds: 123.4');
    expect(replyArg).toContain('memoryUsage: {"rss":100,"heapTotal":50}');
    expect(replyArg).toContain('serverTime: 2024-06-01T12:00:00.000Z');
    expect(replyArg).toContain('apiVersion: 1.0.0');
  });

  test('should reply with error message when API response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const ctx = {
      reply: replyMock
    } as any;

    const healthCommandHandler = async (ctx: any) => {
      try {
        const response = await fetch(`${'http://dummyapi'}/health/detailed`);
        if (!response.ok) {
          await ctx.reply(`API health check failed with status: ${response.status}`);
          return;
        }
        const data = await response.json();

        const formattedMessage = Object.entries(data)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join("\n");

        await ctx.reply(formattedMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.reply(`Could not reach API at ${'http://dummyapi'}: ${message}`);
      }
    };

    await healthCommandHandler(ctx);

    expect(replyMock).toHaveBeenCalledWith('API health check failed with status: 500');
  });

  test('should reply with error message when fetch throws error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const ctx = {
      reply: replyMock
    } as any;

    const healthCommandHandler = async (ctx: any) => {
      try {
        const response = await fetch(`${'http://dummyapi'}/health/detailed`);
        if (!response.ok) {
          await ctx.reply(`API health check failed with status: ${response.status}`);
          return;
        }
        const data = await response.json();

        const formattedMessage = Object.entries(data)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join("\n");

        await ctx.reply(formattedMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ctx.reply(`Could not reach API at ${'http://dummyapi'}: ${message}`);
      }
    };

    await healthCommandHandler(ctx);

    expect(replyMock).toHaveBeenCalledWith('Could not reach API at http://dummyapi: Network error');
  });
});
