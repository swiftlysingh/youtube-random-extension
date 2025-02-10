(function() {
  let navigationObserver = null;
  let currentButtonObserver = null;

  function createRandomButton() {
    const wrapper = document.createElement('ytd-chip-cloud-chip-renderer');
    wrapper.className = 'style-scope ytd-feed-filter-chip-bar-renderer';
    wrapper.setAttribute('system-icons', '');
    wrapper.setAttribute('is-dark', '');
    wrapper.id = 'random-video-button-wrapper';

    wrapper.innerHTML = `
      <yt-chip-cloud-renderer class="style-scope ytd-chip-cloud-chip-renderer" is-dark system-icons>
        <div id="chip-container" class="style-scope yt-chip-cloud-renderer" role="button" tabindex="0">
          <div id="text" class="style-scope yt-chip-cloud-renderer" aria-label="Random">Random</div>
        </div>
      </yt-chip-cloud-renderer>
    `;

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
      if (document.getElementById('random-video-button')) {
        return;
      }

      // Wait for the sort buttons container
      const sortContainer = await waitForElement('ytd-feed-filter-chip-bar-renderer #chips-wrapper');
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

      const chipContainer = buttonElement.querySelector('#chip-container');
      chipContainer.addEventListener('click', async function(e) {
        e.preventDefault();
        if (chipContainer.disabled) return;
        
        try {
          chipContainer.disabled = true;
          chipContainer.querySelector('#text').textContent = 'Loading...';
          
          const success = await clickRandomVideo();
          
          if (!success) {
            throw new Error('No videos found');
          }
        } catch (error) {
          console.error('Random video error:', error);
          alert('Could not find videos. Please try again.');
          chipContainer.disabled = false;
          chipContainer.querySelector('#text').textContent = 'Random';
        }
      });

    } catch (error) {
      console.error('Failed to insert random button:', error);
    }
  }

  function init() {
    const ytdApp = document.querySelector('ytd-app');
    if (!ytdApp) {
      setTimeout(init, 100); // Use shorter timeout
      return;
    }

    let isProcessing = false;
    let timeout = null;

    const tryInsertButton = async () => {
      if (isProcessing) return;
      
      try {
        isProcessing = true;
        if (window.location.pathname.includes('/@')) {
          await insertButton();
        }
      } finally {
        isProcessing = false;
      }
    };

    navigationObserver = new MutationObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(tryInsertButton, 500);
    });

    navigationObserver.observe(ytdApp, {
      childList: true,
      subtree: true
    });

    // Initial insertion
    if (window.location.pathname.includes('/@')) {
      tryInsertButton();
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
