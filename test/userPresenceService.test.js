const userPresenceService = require('../src/services/userPresenceService');

describe('UserPresenceService', () => {
  beforeEach(() => {
    userPresenceService.userStatus.clear();
  });

  test('should update and retrieve user status', () => {
    userPresenceService.updateUserStatus('user1', 'online');
    expect(userPresenceService.getUserStatus('user1')).toBe('online');
  });

  test('should respect privacy settings and remove status if not shared', () => {
    userPresenceService.updateUserStatus('user2', 'online', { sharePresence: false });
    expect(userPresenceService.getUserStatus('user2')).toBeNull();
  });

  test('should remove stale statuses after cleanup', () => {
    const oldTimestamp = Date.now() - 11 * 60 * 1000; // 11 minutes ago
    userPresenceService.userStatus.set('user3', { status: 'online', lastUpdated: oldTimestamp, privacySettings: { sharePresence: true } });
    userPresenceService.cleanupStaleStatuses();
    expect(userPresenceService.getUserStatus('user3')).toBeNull();
  });
});
