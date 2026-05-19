const EventEmitter = require('events');

class BackgroundAgent extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.roles = ['PM', 'BM', 'Dev'];
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Background agent started.');
    this.processLoop();
  }

  stop() {
    this.isRunning = false;
    console.log('Background agent stopped.');
  }

  async processLoop() {
    while (this.isRunning) {
      try {
        const conversations = await this.fetchNewConversations();
        for (const convo of conversations) {
          const keyInfo = this.extractKeyInformation(convo);
          await this.saveKeyInformation(keyInfo);
        }
      } catch (error) {
        console.error('Error processing conversations:', error);
      }
      await this.sleep(5000); // wait 5 seconds before next check
    }
  }

  async fetchNewConversations() {
    // Placeholder: fetch new conversations from a data source or queue
    // For demonstration, return empty array
    return [];
  }

  extractKeyInformation(conversation) {
    // Extract key info based on role and business rules
    // Assume conversation has { role, messages }
    if (!this.roles.includes(conversation.role)) {
      // For other roles, apply generic extraction
      return {
        conversationId: conversation.id,
        summary: this.summarizeMessages(conversation.messages),
        role: conversation.role
      };
    }

    // Role-specific extraction logic
    switch (conversation.role) {
      case 'PM':
        return this.extractForPM(conversation);
      case 'BM':
        return this.extractForBM(conversation);
      case 'Dev':
        return this.extractForDev(conversation);
      default:
        return {
          conversationId: conversation.id,
          summary: this.summarizeMessages(conversation.messages),
          role: conversation.role
        };
    }
  }

  extractForPM(conversation) {
    // Example: extract deadlines, milestones
    const deadlines = conversation.messages.filter(m => /deadline/i.test(m.text));
    return {
      conversationId: conversation.id,
      role: 'PM',
      deadlines: deadlines.map(m => m.text),
      summary: this.summarizeMessages(conversation.messages)
    };
  }

  extractForBM(conversation) {
    // Example: extract budget, financial info
    const budgets = conversation.messages.filter(m => /budget|cost|price/i.test(m.text));
    return {
      conversationId: conversation.id,
      role: 'BM',
      budgets: budgets.map(m => m.text),
      summary: this.summarizeMessages(conversation.messages)
    };
  }

  extractForDev(conversation) {
    // Example: extract technical requirements, blockers
    const blockers = conversation.messages.filter(m => /blocker|issue|bug/i.test(m.text));
    return {
      conversationId: conversation.id,
      role: 'Dev',
      blockers: blockers.map(m => m.text),
      summary: this.summarizeMessages(conversation.messages)
    };
  }

  summarizeMessages(messages) {
    // Simple summary: join first 3 messages
    return messages.slice(0, 3).map(m => m.text).join(' | ');
  }

  async saveKeyInformation(keyInfo) {
    // Placeholder: save key info to database or storage
    console.log('Saving key information:', keyInfo);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new BackgroundAgent();
