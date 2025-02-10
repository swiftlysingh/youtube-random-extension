(function() {
  let navigationObserver = null;
  let currentButtonObserver = null;

  function createRandomButton() {
    const button = document.createElement('button');
    button.innerHTML = 'Random';
    button.className = 'yt-chip-cloud-chip-renderer style-scope ytd-feed-filter-chip-bar-renderer';
    button.style.cursor = 'pointer';
    return button;
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

      // Wait for the sort buttons container
      const sortContainer = await waitForElement('#chips-wrapper');
      if (!sortContainer) return;

      // Remove existing button if any
      const existingBtn = document.querySelector('.random-video-btn');
      if (existingBtn) {
        existingBtn.remove();
      }

      const randomBtn = createRandomButton();
      
      // Create wrapper similar to other sort buttons
      const wrapper = document.createElement('yt-chip-cloud-chip-renderer');
      wrapper.className = 'style-scope ytd-feed-filter-chip-bar-renderer';
      wrapper.appendChild(randomBtn);

      // Insert after the last sort button
      sortContainer.appendChild(wrapper);

      randomBtn.addEventListener('click', async function() {
        if (randomBtn.disabled) return;
        
        try {
          randomBtn.disabled = true;
          randomBtn.innerHTML = 'Loading...';
          
          const success = await clickRandomVideo();
          
          if (!success) {
            throw new Error('No videos found');
          }
        } catch (error) {
          console.error('Random video error:', error);
          alert('Could not find videos. Please try again.');
          randomBtn.disabled = false;
          randomBtn.innerHTML = 'Random';
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

    // More aggressive button insertion
    let retryCount = 0;
    const tryInsertButton = () => {
      if (window.location.pathname.includes('/@')) {
        insertButton().catch(() => {
          if (retryCount < 5) {
            retryCount++;
            setTimeout(tryInsertButton, 500);
          }
        });
      }
    };

    let timeout = null;
    navigationObserver = new MutationObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(tryInsertButton, 100);
    });

    navigationObserver.observe(ytdApp, {
      childList: true,
      subtree: true
    });

    // Initial insertion
    if (window.location.pathname.includes('/@')) {
      insertButton();
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
