(function() {
  let navigationObserver = null;
  let currentButtonObserver = null;
  let lastUrl = '';

  function createRandomButton() {
    const wrapper = document.createElement('yt-chip-cloud-chip-renderer');
    wrapper.className = 'style-scope ytd-feed-filter-chip-bar-renderer';
    wrapper.setAttribute('modern', '');
    wrapper.setAttribute('aria-selected', 'false');
    wrapper.setAttribute('role', 'tab');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('chip-style', 'STYLE_DEFAULT');
    wrapper.id = 'random-video-button-wrapper';

    wrapper.innerHTML = `
      <div id="chip" class="style-scope yt-chip-cloud-chip-renderer" role="tab" aria-selected="false">
        <div class="text style-scope yt-chip-cloud-chip-renderer">Random</div>
      </div>
      <tp-yt-paper-tooltip class="style-scope yt-chip-cloud-chip-renderer" role="tooltip">Random</tp-yt-paper-tooltip>
    `;

    const chipElement = wrapper.querySelector('#chip');
    Object.assign(chipElement.style, {
      backgroundColor: 'var(--yt-spec-badge-chip-background)',
      color: 'var(--yt-spec-text-primary)',
      border: 'none',
      borderRadius: '8px',
      padding: '0 12px',
      height: '32px',
      lineHeight: '32px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px',
      fontFamily: 'Roboto, Arial, sans-serif',
      fontWeight: '500'  // Added font-weight to match YouTube's bold text
    });

    // Make the text element bold as well
    const textElement = wrapper.querySelector('.text');
    if (textElement) {
      textElement.style.fontWeight = '500';
    }

    return wrapper;
  }

  function waitForElement(selector) {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;

      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const elementObserver = new MutationObserver(() => {
        attempts++;
        const element = document.querySelector(selector);
        if (element) {
          elementObserver.disconnect();
          resolve(element);
        } else if (attempts >= maxAttempts) {
          elementObserver.disconnect();
          reject(new Error(`Element ${selector} not found after ${maxAttempts} attempts`));
        }
      });

      elementObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      currentButtonObserver = elementObserver;
    });
  }

  async function waitForVideosToLoad() {
    return new Promise((resolve) => {
      let attempts = 0;
      const checkVideos = () => {
        const videos = document.querySelectorAll('#contents ytd-grid-video-renderer');
        if (videos.length > 0) {
          resolve(videos);
        } else if (attempts < 10) {
          attempts++;
          setTimeout(checkVideos, 500);
        } else {
          resolve(null);
        }
      };
      checkVideos();
    });
  }

  async function navigateToVideosTab() {
    return new Promise(async (resolve) => {
      const currentURL = window.location.href;
      if (!currentURL.includes('/videos')) {
        const videosTab = document.querySelector('a[href*="/videos"]');
        if (videosTab) {
          const channelHandle = currentURL.match(/@[^/]+/)[0];
          window.location.href = `${channelHandle}/videos`;
          // Let the page load naturally instead of using click
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }
      resolve();
    });
  }

  function findVideoElements() {
    const selectors = [
      'ytd-grid-video-renderer #thumbnail[href*="/watch?v="]',
      'ytd-rich-item-renderer #thumbnail[href*="/watch?v="]',
      '#contents a[href*="/watch?v="]'
    ];
    
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector))
        .filter(el => el.href && el.href.includes('/watch?v='));
      if (elements.length > 0) return elements;
    }
    return null;
  }

  async function waitForVideosToAppear(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const videos = findVideoElements();
      if (videos && videos.length > 0) {
        return videos;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      window.scrollTo(0, window.scrollY + 300); // Scroll a bit to trigger loading
    }
    return null;
  }

  async function clickRandomVideo() {
    // If not on videos tab, navigate and wait
    if (!window.location.href.includes('/videos')) {
      const videosTab = document.querySelector('a[href*="/videos"]');
      if (videosTab) {
        videosTab.click();
        // Wait for navigation and content load
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Try to find videos immediately
    let videos = findVideoElements();
    
    // If no videos found, try scrolling once
    if (!videos || videos.length === 0) {
      window.scrollTo(0, 500); // Scroll down a bit
      await new Promise(resolve => setTimeout(resolve, 2000));
      videos = findVideoElements();
      window.scrollTo(0, 0); // Scroll back to top
    }

    if (!videos || videos.length === 0) {
      return false;
    }

    // Pick and navigate to random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    if (randomVideo?.href) {
      window.location.href = randomVideo.href;
      return true;
    }

    return false;
  }

  async function insertButton() {
    try {
      if (currentButtonObserver) {
        currentButtonObserver.disconnect();
        currentButtonObserver = null;
      }

      // Check if button already exists
      if (document.getElementById('random-video-button-wrapper')) {
        return;
      }

      // Wait for the sort buttons container and iron-selector
      const sortContainer = await waitForElement('#chips');
      if (!sortContainer) return;

      // Remove any existing buttons
      const existingButtons = sortContainer.querySelectorAll('[id^="random-video-button"]');
      existingButtons.forEach(btn => btn.remove());

      const buttonElement = createRandomButton();

      // Find the "Oldest" chip and insert after it
      const chips = Array.from(sortContainer.children);
      const oldestChip = chips.find(chip => 
        chip.textContent.trim().includes('Oldest')
      );

      if (oldestChip) {
        oldestChip.after(buttonElement);
      } else {
        sortContainer.appendChild(buttonElement);
      }

      const chipElement = buttonElement.querySelector('#chip');
      chipElement.addEventListener('click', async function(e) {
        e.preventDefault();
        if (this.disabled) return;
        
        try {
          this.disabled = true;
          this.style.opacity = '0.5';
          
          const success = await clickRandomVideo();
          
          if (!success) {
            throw new Error('No videos found');
          }
        } catch (error) {
          console.error('Random video error:', error);
          alert('Could not find videos. Please try again.');
          this.disabled = false;
          this.style.opacity = '1';
        }
      });

    } catch (error) {
      console.error('Failed to insert random button:', error);
    }
  }

  async function tryInsertButtonWithRetry() {
    let attempts = 0;
    const maxAttempts = 5;
    
    const attemptInsertion = async () => {
      try {
        await insertButton();
        return true;
      } catch (error) {
        console.error('Button insertion attempt failed:', error);
        return false;
      }
    };

    while (attempts < maxAttempts) {
      if (await attemptInsertion()) {
        break;
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  function isChannelPage() {
    return window.location.pathname.includes('/@') && 
           (window.location.pathname.endsWith('/videos') || 
            window.location.pathname.split('/').length === 2);
  }

  function init() {
    const ytdApp = document.querySelector('ytd-app');
    if (!ytdApp) {
      setTimeout(init, 100); // Use shorter timeout
      return;
    }

    let isProcessing = false;

    // Watch for URL changes
    const checkForUrlChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (isChannelPage()) {
          tryInsertButtonWithRetry();
        }
      }
    };

    // Create observer for URL changes
    const urlObserver = new MutationObserver(() => {
      if (!isProcessing) {
        isProcessing = true;
        checkForUrlChange();
        setTimeout(() => { isProcessing = false; }, 100);
      }
    });

    // Observe both navigation and content changes
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    navigationObserver = urlObserver;

    // Set initial URL
    lastUrl = window.location.href;

    // Initial check
    if (isChannelPage()) {
      tryInsertButtonWithRetry();
    }
  }

  // Start initialization only after page is fully loaded
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Cleanup when extension is unloaded
  window.addEventListener('unload', () => {
    if (navigationObserver) {
      navigationObserver.disconnect();
      navigationObserver = null;
    }
    if (currentButtonObserver) {
      currentButtonObserver.disconnect();
      currentButtonObserver = null;
    }
  }, { once: true });
})();
