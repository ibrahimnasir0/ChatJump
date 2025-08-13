(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    sidebarId: 'smart-index-sidebar',
    toggleButtonId: 'smart-index-toggle',
    debounceDelay: 300,
    scrollOffset: 80,
    maxTextLength: 100
  };
  
  // State management
  let sidebar = null;
  let toggleButton = null;
  let userMessages = [];
  let mutationObserver = null;
  let isVisible = false;
  let debounceTimer = null;
  let currentPlatform = null;
  
  /**
   * Initialize the Smart Index extension
   */
  function init() {
    // Wait for the page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    // Check if we're on a supported AI chat conversation page
    currentPlatform = detectPlatform();
    if (!currentPlatform) {
      console.log('📝 Not on a supported conversation page, skipping initialization.');
      return;
    }
    
    console.log(`🤖 Initializing AI Chat Smart Index for ${currentPlatform}...`);
    
    createToggleButton();
    createSidebar();
    setupMutationObserver();
    scanForUserMessages();
    
    // Handle page navigation (SPA routing)
    setupNavigationListener();
  }
  
  /**
   * Detect which AI platform we're on
   */
  function detectPlatform() {
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    // ChatGPT detection - Enhanced
    if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) {
      // Check if it's actually a conversation page, not just the homepage
      const isConversationPage = url.includes('/c/') || 
                                url.includes('/chat/') ||
                                document.querySelector('[data-testid="conversation-turn"]') ||
                                document.querySelector('[data-message-author-role]') ||
                                document.querySelector('main') ||
                                document.querySelector('.relative.flex.h-full');
      
      if (isConversationPage) {
        console.log('🤖 Detected ChatGPT conversation');
        return 'chatgpt';
      }
    }
    
    // Claude detection - Enhanced
    if (hostname.includes('claude.ai')) {
      // Check for multiple Claude indicators
      const isClaudeConversation = url.includes('/chat/') ||
                                  document.querySelector('[data-testid="user-message"]') ||
                                  document.querySelector('[data-testid="chat-input"]') ||
                                  document.querySelector('main[class*="conversation"]') ||
                                  document.querySelector('.font-claude-message') ||
                                  document.querySelector('[data-testid="send-button"]');
      
      if (isClaudeConversation) {
        console.log('🤖 Detected Claude conversation');
        return 'claude';
      }
    }

    // Gemini detection - Enhanced
    if (hostname.includes('gemini.google.com')) {
      // Wait a bit for Gemini to load its content
      setTimeout(() => {
        const hasConversationElements = document.querySelector('chat-app') ||
                                        document.querySelector('gemini-app') ||
                                        document.querySelector('[data-testid="input-text-field"]') ||
                                        document.querySelector('.conversation-container') ||
                                        document.querySelector('conversation-turn') ||
                                        document.querySelector('.user-query-bubble-with-background') ||
                                        document.querySelector('[jsname]') && document.querySelector('textarea');
        
        if (hasConversationElements) {
          console.log('🤖 Detected Gemini conversation');
          // Re-initialize if we detect Gemini after the initial check
          if (currentPlatform !== 'gemini') {
            currentPlatform = 'gemini';
            createToggleButton();
            createSidebar();
            setupMutationObserver();
            scanForUserMessages();
          }
        }
      }, 2000);
      
      // Return gemini immediately if we see basic indicators
      const basicGeminiElements = document.querySelector('gemini-app') || 
                                  document.querySelector('[data-testid="input-text-field"]') ||
                                  (document.title && document.title.includes('Gemini')) ||
                                  url.includes('/app');
      if (basicGeminiElements) {
        console.log('🤖 Detected Gemini (basic detection)');
        return 'gemini';
      }
    }
    
    return false;
  }
  
  /**
   * Create the toggle button
   */
  function createToggleButton() {
    // Remove existing button if any
    const existingButton = document.getElementById(CONFIG.toggleButtonId);
    if (existingButton) {
      existingButton.remove();
    }
    
    toggleButton = document.createElement('button');
    toggleButton.id = CONFIG.toggleButtonId;
    toggleButton.className = 'smart-index-toggle';
    // toggleButton.innerHTML = '📋';
    toggleButton.innerHTML = `
<svg width="20" height="20" viewBox="0 0 20 20">
  <g transform="translate(1,1)">
    <path d="M2 6 L10 5 L8 8 L13 6 L11 9 L10 8 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M3 3 L11 2 L9 5 L14 3 L12 6 L11 5 Z" fill="#ffffff" opacity="0.7"/>
    <path d="M14 12 L6 13 L8 10 L3 12 L5 9 L6 10 Z" fill="#ffffff" opacity="0.8"/>
  </g>
</svg>`;
    toggleButton.title = 'Toggle ChatJump';
    toggleButton.addEventListener('click', toggleSidebar);
    
    document.body.appendChild(toggleButton);
    console.log('✅ Toggle button created.');
  }
  
  /**
   * Create the sidebar
   */
  function createSidebar() {
    // Remove existing sidebar if any
    const existingSidebar = document.getElementById(CONFIG.sidebarId);
    if (existingSidebar) {
      existingSidebar.remove();
    }
    
    const platformName = currentPlatform === 'claude' ? 'Claude' : 
                        (currentPlatform === 'gemini' ? 'Gemini' : 'ChatGPT');
    
    sidebar = document.createElement('div');
    sidebar.id = CONFIG.sidebarId;
    sidebar.innerHTML = `
      <div class="smart-index-header">
        <h3 class="smart-index-title">
          ${platformName} ChatJump
          <div class="smart-index-header-buttons">
            <button class="smart-index-refresh" title="Refresh Index">🔄</button>
            <button class="smart-index-close" title="Close">×</button>
          </div>
        </h3>
      </div>
      <div class="smart-index-content">
        <ul class="smart-index-list"></ul>
      </div>
    `;
    
    // Add button event listeners
    const closeButton = sidebar.querySelector('.smart-index-close');
    const refreshButton = sidebar.querySelector('.smart-index-refresh');
    
    closeButton.addEventListener('click', hideSidebar);
    refreshButton.addEventListener('click', handleRefreshClick);
    
    // Add platform-specific styling
    document.body.setAttribute('data-platform', currentPlatform);
    
    document.body.appendChild(sidebar);
    console.log('✅ Sidebar created.');
  }
  
  /**
   * Toggle sidebar visibility
   */
  function toggleSidebar() {
    if (isVisible) {
      hideSidebar();
    } else {
      showSidebar();
    }
  }
  
  /**
   * Show sidebar
   */
  function showSidebar() {
    if (!sidebar) return;
    
    sidebar.classList.add('visible');
    document.body.classList.add('smart-index-active');
    isVisible = true;
    
    // Refresh the message list when showing
    scanForUserMessages();
  }
  
  /**
   * Hide sidebar
   */
  function hideSidebar() {
    if (!sidebar) return;
    
    sidebar.classList.remove('visible');
    document.body.classList.remove('smart-index-active');
    isVisible = false;
  }
  
  /**
   * Setup mutation observer to detect new messages
   */
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    const targetNode = document.body;
    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-testid']
    };
    
    mutationObserver = new MutationObserver(debounce(handleMutations, CONFIG.debounceDelay));
    mutationObserver.observe(targetNode, config);
    console.log('✅ MutationObserver configured.');
  }
  
  /**
   * Handle DOM mutations
   */
  function handleMutations(mutations) {
    let shouldUpdate = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (containsChatMessage(node)) {
              shouldUpdate = true;
              break;
            }
          }
        }
      }
      
      if (shouldUpdate) break;
    }
    
    if (shouldUpdate) {
      setTimeout(() => scanForUserMessages(), 500); // Add small delay for Gemini
    }
  }
  
  /**
   * Check if a node contains chat messages
   */
  function containsChatMessage(node) {
    // Enhanced message detection for all platforms
    const messageIndicators = [
      // ChatGPT
      '[data-message-author-role]',
      '.group.w-full',
      '[role="presentation"]',
      
      // Claude
      '[data-testid*="conversation"]',
      '[data-testid="user-message"]',
      '[data-is-author]',
      
      // Gemini - Enhanced selectors
      'conversation-turn',
      '.user-query-bubble-with-background',
      '.conversation-container',
      '[data-response-index]',
      'model-response-text',
      'user-query',
      '.query-text',
      
      // Common
      'p'
    ];
    
    for (const selector of messageIndicators) {
      if (node.matches && node.matches(selector)) {
        return true;
      }
      if (node.querySelector && node.querySelector(selector)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Scan the page for user messages
   */
  function scanForUserMessages() {
    const newMessages = findUserMessages();
    
    if (!arraysEqual(userMessages.map(m => m.text), newMessages.map(m => m.text))) {
      userMessages = newMessages;
      updateSidebarList();
    }
  }
  
  /**
   * Find user messages using robust detection
   */
  function findUserMessages() {
    console.log(`🔍 Scanning for user messages on ${currentPlatform}...`);
    
    if (currentPlatform === 'claude') {
      return findClaudeUserMessages();
    } else if (currentPlatform === 'chatgpt') {
      return findChatGPTUserMessages();
    } else if (currentPlatform === 'gemini') {
      return findGeminiUserMessages();
    }
    
    return [];
  }
  
  /**
   * Find user messages in Claude - Enhanced detection
   */
  function findClaudeUserMessages() {
    const messages = [];
    
    // Multiple selectors for different Claude layouts
    const selectors = [
      '[data-testid="user-message"] p',
      '[data-testid="user-message"]',
      '.font-user-message p',
      '[role="article"][data-is-streaming="false"] p',
      '.prose p'
    ];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`📊 Found ${elements.length} Claude elements with selector: ${selector}`);
        
        if (elements.length > 0) {
          elements.forEach((element) => {
            let text = '';
            
            if (element.tagName.toLowerCase() === 'p') {
              text = extractMessageText(element);
            } else {
              // If it's a container, find p tags inside
              const pElements = element.querySelectorAll('p');
              text = Array.from(pElements)
                .map(p => extractMessageText(p))
                .join(' ')
                .trim();
            }
            
            const cleanText = text.trim();
            if (cleanText.length > 10 && 
                !isClaudeChatListItem(cleanText) && 
                !isDuplicateMessage(messages, cleanText)) {
              messages.push({
                element: element,
                text: cleanText,
                index: messages.length + 1
              });
            }
          });
          
          // If we found messages with this selector, break
          if (messages.length > 0) {
            break;
          }
        }
      } catch (error) {
        console.warn(`Error with Claude selector ${selector}:`, error);
      }
    }
    
    console.log(`🎯 Found ${messages.length} Claude user messages.`);
    return messages;
  }

  /**
   * Find user messages in Gemini - Enhanced detection
   */
  function findGeminiUserMessages() {
    const messages = [];
    
    // Multiple selectors for different Gemini layouts
    const selectors = [
      // Primary selector for user messages
      'conversation-turn[data-is-user="true"]',
      
      // Alternative selectors
      '.user-query-bubble-with-background',
      'conversation-turn:has(.query-text)',
      
      // Fallback selectors
      '[data-testid*="user"] p',
      'user-query .query-text p',
    ];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`📊 Found ${elements.length} elements with selector: ${selector}`);
        
        if (elements.length > 0) {
          elements.forEach((element) => {
            let text = '';
            
            // Different text extraction methods for different selectors
            if (element.tagName.toLowerCase() === 'conversation-turn') {
              const textElements = element.querySelectorAll('.query-text p, p');
              text = Array.from(textElements)
                .map(p => extractMessageText(p))
                .join(' ')
                .trim();
            } else if (element.classList.contains('user-query-bubble-with-background')) {
              const textElements = element.querySelectorAll('.query-text p, p');
              text = Array.from(textElements)
                .map(p => extractMessageText(p))
                .join(' ')
                .trim();
            } else {
              text = extractMessageText(element);
            }
            
            if (text.length > 10 && !isDuplicateMessage(messages, text)) {
              messages.push({
                element: element,
                text: text,
                index: messages.length + 1
              });
            }
          });
          
          // If we found messages with this selector, break
          if (messages.length > 0) {
            break;
          }
        }
      } catch (error) {
        console.warn(`Error with selector ${selector}:`, error);
      }
    }
    
    console.log(`🎯 Final result: Found ${messages.length} Gemini user messages.`);
    return messages;
  }
  
  /**
   * Check for duplicate messages
   */
  function isDuplicateMessage(existingMessages, newText) {
    return existingMessages.some(msg => 
      msg.text === newText || 
      (msg.text.includes(newText) || newText.includes(msg.text)) && 
      Math.abs(msg.text.length - newText.length) < 50
    );
  }
  
  /**
   * Check if text is from Claude's chat list (to filter out)
   */
  function isClaudeChatListItem(text) {
    const chatListPatterns = [
      /last message \d+ (minute|hour|day)s? ago/i,
      /you have \d+ previous chats/i,
      /^(new chat|recent chats|today|yesterday|this week)/i,
      /^[a-f0-9-]{36}$/i,
      /^(chat|conversation|untitled)$/i,
      /^(send message|talk to claude|how can I help)/i,
      /^(claude|anthropic|model)/i,
      text.length < 30 && /^(home|settings|help|about)/i.test(text)
    ];
    
    return chatListPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(text);
      }
      return pattern;
    });
  }

  /**
   * Find user messages in ChatGPT
   */
  function findChatGPTUserMessages() {
    const messages = [];
    const elements = document.querySelectorAll('[data-message-author-role="user"]');
    
    elements.forEach((element, index) => {
      const text = extractMessageText(element);
      if (text.trim().length > 10) {
        messages.push({
          element: element,
          text: text.trim(),
          index: messages.length + 1
        });
      }
    });
    
    console.log(`🎯 Found ${messages.length} ChatGPT user messages.`);
    return messages;
  }
  
  /**
   * Extract text from a message element
   */
  function extractMessageText(element) {
    if (!element) return '';
    
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const elementsToRemove = clone.querySelectorAll(
      'code, pre, .code-block, .highlight, script, style, [data-testid*="copy"], button, svg, img, [role="button"]'
    );
    elementsToRemove.forEach(el => el.remove());
    
    return clone.textContent || clone.innerText || '';
  }
  
  /**
   * Update the sidebar list
   */
  function updateSidebarList() {
    if (!sidebar) return;
    
    const listElement = sidebar.querySelector('.smart-index-list');
    if (!listElement) return;
    
    if (userMessages.length === 0) {
      listElement.innerHTML = '<div class="smart-index-empty">No user messages found</div>';
      return;
    }
    
    const listHTML = userMessages.map(message => {
      const truncatedText = message.text.length > CONFIG.maxTextLength 
        ? message.text.substring(0, CONFIG.maxTextLength) + '...'
        : message.text;
      
      return `
        <li class="smart-index-item">
          <a href="#" class="smart-index-link" data-message-index="${message.index}">
            <span class="smart-index-number">${message.index}</span>
            <span class="smart-index-text" title="${escapeHtml(message.text)}">${escapeHtml(truncatedText)}</span>
          </a>
        </li>
      `;
    }).join('');
    
    listElement.innerHTML = listHTML;
    
    const links = listElement.querySelectorAll('.smart-index-link');
    links.forEach(link => {
      link.addEventListener('click', handleMessageClick);
    });
  }
  
  /**
   * Handle message click
   */
  function handleMessageClick(event) {
    event.preventDefault();
    
    const messageIndex = parseInt(event.currentTarget.getAttribute('data-message-index'));
    const message = userMessages.find(m => m.index === messageIndex);
    
    if (message && message.element) {
      message.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      
      highlightMessage(message.element);
      updateActiveLink(event.currentTarget);
    }
  }
  
  /**
   * Handle refresh button click
   */
  function handleRefreshClick() {
    console.log('🔄 Refreshing Smart Index...');
    
    // Show loading state
    const refreshButton = sidebar.querySelector('.smart-index-refresh');
    const originalText = refreshButton.innerHTML;
    refreshButton.innerHTML = '⏳';
    refreshButton.disabled = true;
    
    // Clear current messages and rescan
    userMessages = [];
    
    // Add a small delay to show the loading state
    setTimeout(() => {
      scanForUserMessages();
      
      // Reset button state
      refreshButton.innerHTML = originalText;
      refreshButton.disabled = false;
      
      console.log('✅ Smart Index refreshed!');
    }, 500);
  }
  
  /**
   * Highlight a message temporarily
   */
  function highlightMessage(element) {
    document.querySelectorAll('.smart-index-highlighted').forEach(el => {
      el.classList.remove('smart-index-highlighted');
    });
    
    element.classList.add('smart-index-highlighted');
    
    if (!document.getElementById('smart-index-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'smart-index-highlight-styles';
      style.textContent = `
        .smart-index-highlighted {
          background-color: #fff3cd !important;
          border: 2px solid #ffc107 !important;
          border-radius: 8px !important;
          transition: all 0.3s ease !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => {
      element.classList.remove('smart-index-highlighted');
    }, 3000);
  }
  
  /**
   * Update active link in sidebar
   */
  function updateActiveLink(activeLink) {
    document.querySelectorAll('.smart-index-link.active').forEach(link => {
      link.classList.remove('active');
    });
    
    activeLink.classList.add('active');
  }
  
  /**
   * Setup navigation listener for SPA routing
   */
  function setupNavigationListener() {
    let lastUrl = location.href;
    
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        
        userMessages = [];
        currentPlatform = detectPlatform();
        
        if (currentPlatform) {
          setTimeout(() => {
            createToggleButton();
            createSidebar();
            scanForUserMessages();
          }, 1500);
        } else {
          hideSidebar();
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  /**
   * Utility functions
   */
  function debounce(func, delay) {
    let timeoutId;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeoutId);
        func(...args);
      };
      clearTimeout(timeoutId);
      timeoutId = setTimeout(later, delay);
    };
  }
  
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Cleanup function
   */
  function cleanup() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    if (toggleButton && toggleButton.parentNode) {
      toggleButton.parentNode.removeChild(toggleButton);
    }
    
    if (sidebar && sidebar.parentNode) {
      sidebar.parentNode.removeChild(sidebar);
    }
    
    document.body.classList.remove('smart-index-active');
    document.body.removeAttribute('data-platform');
  }
  
  // Handle page unload
  window.addEventListener('beforeunload', cleanup);
  
  // Initialize the extension
  init();
  
})();