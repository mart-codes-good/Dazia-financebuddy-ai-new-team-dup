/**
 * Usage Tracker Service (Freemium MVP)
 * - In-memory store (resets on server restart)
 * - Supports: checkUsage (no increment) + consumeUsage (increment)
 */

const fs = require('fs');
const path = require('path');

// Store data in a local JSON file (Persistent across restarts)
const USAGE_FILE = path.join(__dirname, '../data/usage_data.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(USAGE_FILE))) {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
}

// Initialize empty file if it doesn't exist
if (!fs.existsSync(USAGE_FILE)) {
  fs.writeFileSync(USAGE_FILE, '{}');
}

// Limits per day (Per-Tool Strategy)
// Each tool gets its own independent counter of 20
const LIMITS = {
  quiz: 20,
  chat: 20,
  summarize: 20,
  flashcards: 20
};

class UsageTrackerService {
  constructor() {
    this.usageData = this._loadData();
  }

  // Load from JSON file safely
  _loadData() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load usage data:', error.message);
    }
    return {};
  }

  // Save to JSON file
  _saveData() {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usageData, null, 2));
    } catch (error) {
      console.error('Failed to save usage data:', error.message);
    }
  }

  /**
   * Check if usage needs to be reset (New day)
   * Returns true if the last reset was on a different calendar day
   */
  _shouldReset(userId) {
    const lastReset = this.usageData[userId]?.lastReset;
    if (!lastReset) return true; // Never used, or old format
    
    const lastResetDate = new Date(lastReset);
    const now = new Date();
    
    // Reset if last reset was on a different day (Server time)
    return lastResetDate.toDateString() !== now.toDateString();
  }

  /**
   * Get usage status for a user
   * Automatically resets counters if it's a new day
   */
  getUsage(userId) {
    // 1. Initialize user if missing
    if (!this.usageData[userId]) {
      this.usageData[userId] = {
        quiz: 0,
        chat: 0,
        summarize: 0,
        flashcards: 0,
        lastReset: new Date().toISOString()
      };
      this._saveData();
    }

    // 2. Check for Daily Reset
    if (this._shouldReset(userId)) {
      console.log(`♻️ Resetting daily limits for ${userId}`);
      this.usageData[userId] = {
        quiz: 0,
        chat: 0,
        summarize: 0,
        flashcards: 0,
        lastReset: new Date().toISOString() // Update reset time
      };
      this._saveData();
    }

    const used = this.usageData[userId];
    
    // 3. Return Remaining Counts
    return {
      quiz: Math.max(0, LIMITS.quiz - (used.quiz || 0)),
      chat: Math.max(0, LIMITS.chat - (used.chat || 0)),
      summarize: Math.max(0, LIMITS.summarize - (used.summarize || 0)),
      flashcards: Math.max(0, LIMITS.flashcards - (used.flashcards || 0)),
      limits: LIMITS
    };
  }

  /**
   * Check if a specific action is allowed
   */
  canUse(userId, action) {
    const usage = this.getUsage(userId); // logic inside getUsage handles the reset
    
    // Safety check: if backend maps an action we don't track, allow it (or block if strict)
    if (usage.limits[action] === undefined) return true; 
    
    // Check if remaining > 0
    return usage[action] > 0;
  }

  /**
   * Consume 1 credit for a specific action
   */
  consumeUsage(userId, action) {
    if (!LIMITS[action]) {
      throw new Error(`Unknown action type: ${action}`);
    }

    // This ensures we are working with fresh data (and resets if needed)
    this.getUsage(userId);

    const currentUsage = this.usageData[userId][action] || 0;

    if (currentUsage >= LIMITS[action]) {
      throw new Error(`USAGE_LIMIT_REACHED: You have used all your free ${action} credits for today.`);
    }

    // Increment usage
    this.usageData[userId][action] = currentUsage + 1;
    this.usageData[userId].lastActivity = new Date().toISOString();
    
    this._saveData();

    return this.getUsage(userId);
  }
}

module.exports = new UsageTrackerService();