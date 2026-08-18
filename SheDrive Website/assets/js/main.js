// SheDrive Official Web Platform Client Logic
document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIGURATION — Single source of truth for APK download URL
  // Uses GitHub Releases "latest" permalink so future releases auto-resolve.
  // To release a new APK: create a new GitHub Release and attach "SheDrive.apk".
  // ═══════════════════════════════════════════════════════════════════════
  const APK_DOWNLOAD_URL = 'https://github.com/abdulmannan18012005-hub/SheDrive/releases/latest/download/SheDrive.apk';

  // Sticky Header Effect
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Mobile Navigation Drawer Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('active');
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && e.target !== mobileToggle) {
        navMenu.classList.remove('active');
      }
    });
  }

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
            <span style="font-weight:800; color:#E91E63;">${bid.fare}</span>
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
});
