import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import { jest } from '@jest/globals';

jest.mock('node-fetch', () => jest.fn());

// We need to mock the Telegram context object for testing commands
function createMockContext(text: string) {
  return {
    message: { text },
    chat: { id: 1234 },
    from: { id: 1234 },
    reply: jest.fn(),
  };
}

// Import bot module after mocks to get real code
import('./index').then(({ bot }) => {
  describe('Telegram bot /health command', () => {
    afterEach(() => {
      (fetch as jest.Mock).mockReset();
    });

    it('replies with formatted health info from the API', async () => {
      const mockCtx = createMockContext('/health');

      // Mock API response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          uptimeSeconds: '123.4',
          memoryUsage: { rss: 123456 },
          serverTime: '2024-06-10T12:00:00Z',
          apiVersion: '1.0.0',
        }),
      });

      const commandHandler = bot.command.mock.calls.find(c => c[0] === 'health')[1];
      await commandHandler(mockCtx);

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/health/detailed'));
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('ok: true')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('uptimeSeconds: 123.4')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('apiVersion: 1.0.0')
      );
    });

    it('replies with error message when API fails', async () => {
      const mockCtx = createMockContext('/health');

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const commandHandler = bot.command.mock.calls.find(c => c[0] === 'health')[1];
      await commandHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'API health check failed with status: 500'
      );
    });

    it('replies with error message when fetch throws', async () => {
      const mockCtx = createMockContext('/health');

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      const commandHandler = bot.command.mock.calls.find(c => c[0] === 'health')[1];
      await commandHandler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Could not reach API at')
      );
    });
  });
});
