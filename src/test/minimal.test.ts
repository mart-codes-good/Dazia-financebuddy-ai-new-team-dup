const PromptManagerModule = require('../services/PromptManager');

describe('Minimal Test', () => {
  it('should import PromptManager', () => {
    console.log('Module exports:', Object.keys(PromptManagerModule));
    console.log('Default export:', PromptManagerModule.default);
    console.log('PromptManager export:', PromptManagerModule.PromptManager);
    
    const PromptManager = PromptManagerModule.PromptManager || PromptManagerModule.default;
    const pm = new PromptManager();
    expect(pm).toBeDefined();
    expect(pm.test()).toBe('test');
  });
});