
/**
 * PixelateReveal - Reusable image pixelation and reveal animation utility
 *
 * Usage:
 *
 * // Simple reveal animation
 * const reveal = new PixelateReveal('.my-image');
 * reveal.animate();
 *
 * // Custom configuration
 * const reveal = new PixelateReveal('.my-image', {
 *   initialPixelSize: 40,
 *   duration: 2000,
 *   easing: 'easeOutCubic'
 * });
 * reveal.animate();
 *
 * // Manual control
 * reveal.setPixelation(20); // Set specific pixel size
 * reveal.clear(); // Show original image
 */

class PixelateReveal {
  constructor(imageSelector, options = {}) {
    // Default configuration
    this.config = {
      initialPixelSize: 60,      // Starting pixel block size
      finalPixelSize: 1,         // Ending pixel size (1 = original)
      duration: 1500,            // Animation duration in ms
      easing: 'easeOutQuad',     // Easing function name
      autoStart: false,          // Start animation automatically
      delay: 0,                  // Delay before animation starts
      onComplete: null,          // Callback when animation completes
      ...options
    };

    // Get the image element
    this.img = typeof imageSelector === 'string'
      ? document.querySelector(imageSelector)
      : imageSelector;

    if (!this.img || this.img.tagName !== 'IMG') {
      throw new Error('PixelateReveal: Valid image element required');
    }

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Animation state
    this.isAnimating = false;
    this.animationFrame = null;

    // Initialize when image is loaded
    if (this.img.complete) {
      this.init();
    } else {
      this.img.addEventListener('load', () => this.init());
    }
  }

  init() {
    // Get device pixel ratio for sharp rendering on high-DPI screens
    const dpr = window.devicePixelRatio || 1;

    // Get display size
    const displayWidth = this.img.naturalWidth || this.img.width;
    const displayHeight = this.img.naturalHeight || this.img.height;

    // Set canvas internal size (scaled by DPR for sharpness)
    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;

    // Set canvas display size (CSS pixels)
    this.canvas.style.width = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';

    // Scale context to match DPR
    this.ctx.scale(dpr, dpr);

    // Store display dimensions for drawing
    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;

    // Copy image styles
    this.canvas.style.cssText = this.img.style.cssText;
    this.canvas.className = this.img.className;

    // Preserve display size after copying styles
    this.canvas.style.width = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';

    // Replace image with canvas
    this.img.style.display = 'none';
    this.img.parentNode.insertBefore(this.canvas, this.img.nextSibling);

    // Draw original image first
    this.drawOriginal();

    // Auto-start if configured
    if (this.config.autoStart) {
      this.animate();
    }
  }

  drawOriginal() {
    this.ctx.drawImage(this.img, 0, 0, this.displayWidth, this.displayHeight);
  }

  /**
   * Apply pixelation effect with given pixel size
   * @param {number} pixelSize - Size of pixel blocks (higher = more pixelated)
   */
  setPixelation(pixelSize) {
    if (pixelSize <= 1) {
      this.drawOriginal();
      return;
    }

    const width = this.displayWidth;
    const height = this.displayHeight;

    // Draw scaled-down version
    this.ctx.imageSmoothingEnabled = false;

    // Calculate scaled dimensions
    const scaledWidth = Math.ceil(width / pixelSize);
    const scaledHeight = Math.ceil(height / pixelSize);

    // Draw image small
    this.ctx.drawImage(this.img, 0, 0, scaledWidth, scaledHeight);

    // Scale back up to create pixelated effect
    this.ctx.drawImage(
      this.canvas,
      0, 0, scaledWidth, scaledHeight,
      0, 0, width, height
    );

    this.ctx.imageSmoothingEnabled = true;
  }

  /**
   * Easing functions for smooth animations
   */
  easingFunctions = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInCubic: t => t * t * t,
    easeInOutCubic: t => t < 0.5
      ? 4 * t * t * t
      : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  };

  /**
   * Animate from pixelated to clear
   */
  animate() {
    if (this.isAnimating) {
      this.stop();
    }

    return new Promise((resolve) => {
      const startTime = performance.now() + this.config.delay;
      const { initialPixelSize, finalPixelSize, duration, easing } = this.config;
      const easingFn = this.easingFunctions[easing] || this.easingFunctions.easeOutQuad;

      this.isAnimating = true;

      const animate = (currentTime) => {
        if (!this.isAnimating) {
          resolve();
          return;
        }

        const elapsed = currentTime - startTime;

        if (elapsed < 0) {
          // Still in delay period
          this.setPixelation(initialPixelSize);
          this.animationFrame = requestAnimationFrame(animate);
          return;
        }

        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFn(progress);

        // Interpolate pixel size from initial to final
        const currentPixelSize = initialPixelSize - (initialPixelSize - finalPixelSize) * easedProgress;

        this.setPixelation(currentPixelSize);

        if (progress < 1) {
          this.animationFrame = requestAnimationFrame(animate);
        } else {
          this.isAnimating = false;
          if (this.config.onComplete) {
            this.config.onComplete();
          }
          resolve();
        }
      };

      this.animationFrame = requestAnimationFrame(animate);
    });
  }

  /**
   * Animate from clear to pixelated (reverse)
   */
  animateReverse() {
    const originalConfig = { ...this.config };
    this.config.initialPixelSize = originalConfig.finalPixelSize;
    this.config.finalPixelSize = originalConfig.initialPixelSize;

    return this.animate().then(() => {
      this.config = originalConfig;
    });
  }

  /**
   * Stop current animation
   */
  stop() {
    this.isAnimating = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Clear pixelation and show original image
   */
  clear() {
    this.stop();
    this.drawOriginal();
  }

  /**
   * Reset to pixelated state
   */
  reset() {
    this.stop();
    this.setPixelation(this.config.initialPixelSize);
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stop();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.img) {
      this.img.style.display = '';
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PixelateReveal;
}

