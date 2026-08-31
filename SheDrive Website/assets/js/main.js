// SheDrive Official Web Platform Client Logic
document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION — Centralized API & APK URL Resolution
  // ═══════════════════════════════════════════════════════════════════════
  window.getWebsiteBackendBaseUrl = function() {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isLocal ? 'http://localhost:3000' : 'https://shedrive.onrender.com';
  };

  window.getWebsiteApiUrl = function() {
    return `${window.getWebsiteBackendBaseUrl()}/api/v1`;
  };

  const APK_DOWNLOAD_URL = 'https://github.com/abdulmannan18012005-hub/SheDrive/releases/latest/download/SheDrive.apk';

  // Sticky Header Effect
  const header = document.querySelector('.header');
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check on page load
  }

  // Mobile Navigation Slide-In Drawer Setup
  const setupMobileDrawer = () => {
    let drawerOverlay = document.querySelector('.mobile-drawer-overlay');
    let drawer = document.querySelector('.mobile-drawer');

    if (!drawer) {
      drawerOverlay = document.createElement('div');
      drawerOverlay.className = 'mobile-drawer-overlay';

      drawer = document.createElement('div');
      drawer.className = 'mobile-drawer';

      const navMenu = document.querySelector('.nav-menu');
      const navLinksHtml = navMenu ? navMenu.innerHTML : `
        <li><a href="index.html" class="nav-link">Home</a></li>
        <li><a href="passenger.html" class="nav-link">For Passengers</a></li>
        <li><a href="driver.html" class="nav-link">For Drivers</a></li>
        <li><a href="safety.html" class="nav-link">Safety Center</a></li>
        <li><a href="feedback.html" class="nav-link">Feedback</a></li>
        <li><a href="contact.html" class="nav-link">Support</a></li>
      `;

      drawer.innerHTML = `
        <div class="mobile-drawer-header">
          <a href="index.html" class="logo-group">
            <img src="assets/images/logo.png" alt="SheDrive" class="logo-img" style="width:36px;height:36px;">
            <span class="brand-name" style="font-size:1.3rem;">SheDrive</span>
          </a>
          <button class="mobile-drawer-close" aria-label="Close navigation menu">✕</button>
        </div>
        <ul class="mobile-drawer-links">
          ${navLinksHtml}
        </ul>
        <div class="mobile-drawer-footer" style="margin-top: 24px;">
          <a href="downloads.html" data-download-apk="true" class="btn btn-primary download-apk-btn" style="width:100%; justify-content:center; padding:14px; font-weight:700;">📥 Download App</a>
        </div>
      `;

      document.body.appendChild(drawerOverlay);
      document.body.appendChild(drawer);
    }

    const openDrawer = () => {
      document.body.classList.add('drawer-open');
      if (drawerOverlay) drawerOverlay.classList.add('active');
      if (drawer) drawer.classList.add('active');
    };

    const closeDrawer = () => {
      document.body.classList.remove('drawer-open');
      if (drawerOverlay) drawerOverlay.classList.remove('active');
      if (drawer) drawer.classList.remove('active');
    };

    const mobileToggles = document.querySelectorAll('.mobile-toggle');
    mobileToggles.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawer();
      });
    });

    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', closeDrawer);
    }

    const closeBtn = drawer.querySelector('.mobile-drawer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // Close on clicking any nav link in drawer
    const drawerLinks = drawer.querySelectorAll('a');
    drawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });
  };

  setupMobileDrawer();

  // Interactive Live Bidding Simulation Demo (inDrive Parity)
  const liveBids = [
    { name: 'Ayesha Khan', car: 'Suzuki Alto', rating: '4.9 ★', fare: 'Rs. 380' },
    { name: 'Fatima Noor', car: 'Toyota Vitz', rating: '5.0 ★', fare: 'Rs. 400' },
    { name: 'Zainab Bibi', car: 'Honda City', rating: '4.8 ★', fare: 'Rs. 420' },
    { name: 'Maryam Tariq', car: 'Suzuki Cultus', rating: '4.9 ★', fare: 'Rs. 390' }
  ];

  const bidsListEl = document.getElementById('liveBidsList');
  if (bidsListEl) {
    let index = 0;
    setInterval(() => {
      const bid = liveBids[index % liveBids.length];
      bidsListEl.innerHTML = `
        <div class="bid-item">
          <div class="driver-info-mini">
            <span class="driver-avatar">👩</span>
            <div>
              <div class="driver-name">${bid.name} • <span style="font-size:0.75rem; color:#64748B;">${bid.car}</span></div>
              <div class="driver-rating">${bid.rating} (Verified Driver)</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:800; color:#0D9488;">${bid.fare}</span>
            <button class="bid-action-btn" onclick="alert('SheDrive Fare Bidding: In the app, you can accept any driver\\'s bid or wait for counter-offers!')">Accept</button>
          </div>
        </div>
      `;
      index++;
    }, 4000);
  }

  // FAQ Accordion Handler (inDrive Parity)
  const faqItems = document.querySelectorAll('.faq-question');
  faqItems.forEach(item => {
    item.addEventListener('click', () => {
      const parent = item.parentElement;
      if (parent) {
        parent.classList.toggle('open');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GitHub Releases APK Download Manager
  // - Uses the single APK_DOWNLOAD_URL constant defined above.
  // - GitHub internally redirects to its CDN (objects.githubusercontent.com)
  //   which streams the binary directly to the browser.
  // - Double-click prevention with a downloading lock flag.
  // - Button states: original → "⌛ Starting download..." → "✅ Download started"
  // - Auto-restores button text after 4 seconds.
  // ═══════════════════════════════════════════════════════════════════════
  const apkDownloadBtns = document.querySelectorAll('.download-btn-apk, .download-apk-btn, a[data-download-apk]');
  let isDownloading = false;

  apkDownloadBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      // Double-click guard
      if (isDownloading) return;
      isDownloading = true;

      const originalText = btn.innerHTML;
      btn.innerHTML = '⌛ Starting download...';

      try {
        // Use a hidden anchor to trigger a native browser download.
        // GitHub's /releases/latest/download/ endpoint returns a 302 redirect
        // to objects.githubusercontent.com which serves the binary directly.
        // The browser handles the redirect chain transparently and begins
        // streaming the APK file without leaving the current page.
        const hiddenAnchor = document.createElement('a');
        hiddenAnchor.href = APK_DOWNLOAD_URL;
        hiddenAnchor.setAttribute('download', 'SheDrive.apk');
        hiddenAnchor.style.display = 'none';
        document.body.appendChild(hiddenAnchor);
        hiddenAnchor.click();
        document.body.removeChild(hiddenAnchor);

        // Short delay so the browser has time to initiate the request
        setTimeout(() => {
          btn.innerHTML = '✅ Download started';
        }, 600);

      } catch (err) {
        console.error('GitHub Releases download error:', err);
        // Fallback: direct navigation to the GitHub Release asset URL
        // The browser will still download the file (not show the repo page)
        // because the endpoint serves application/octet-stream with Content-Disposition.
        try {
          window.location.href = APK_DOWNLOAD_URL;
          btn.innerHTML = '✅ Download started';
        } catch (fallbackErr) {
          btn.innerHTML = '❌ Download failed — try again';
          console.error('Fallback download error:', fallbackErr);
        }
      }

      // Restore button text and unlock after 4 seconds
      setTimeout(() => {
        btn.innerHTML = originalText;
        isDownloading = false;
      }, 4000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INTERACTIVE 3D PERSPECTIVE TILT (Desktop / Pointer Devices)
  // ═══════════════════════════════════════════════════════════════════════
  if (window.matchMedia('(hover: hover) and (min-width: 992px)').matches) {
    const tiltCards = document.querySelectorAll('.audience-card, .safety-card, .zone-card, .value-card');
    tiltCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;
        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
});
