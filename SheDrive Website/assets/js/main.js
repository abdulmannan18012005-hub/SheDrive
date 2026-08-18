// SheDrive Official Web Platform Client Logic
document.addEventListener('DOMContentLoaded', () => {
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

  /**
   * Cloudflare R2 Dedicated Object Storage APK Download Manager
   * Solves 80 MB APK file limit issues with 0 egress fees & direct HTTPS streaming payload.
   */
  const CLOUDFLARE_R2_CDN_URL = 'https://download.shedrive.great-site.net/SheDrive-latest.apk';
  const BACKEND_R2_REDIRECT = 'https://shedrive.onrender.com/api/v1/app/download';

  const apkDownloadBtns = document.querySelectorAll('.download-btn-apk, .download-apk-btn, a[data-download-apk]');

  apkDownloadBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const originalText = btn.innerHTML;
      btn.innerHTML = '⌛ Starting download...';

      let targetUrl = btn.getAttribute('href');
      if (!targetUrl || targetUrl === '#' || targetUrl.includes('drive.google.com') || targetUrl.includes('drive.usercontent.google.com') || targetUrl.includes('supabase.co')) {
        targetUrl = CLOUDFLARE_R2_CDN_URL;
      }

      try {
        // Native browser 1-click download trigger without navigating away from current page
        const hiddenAnchor = document.createElement('a');
        hiddenAnchor.href = targetUrl;
        hiddenAnchor.setAttribute('download', 'SheDrive-latest.apk');
        hiddenAnchor.setAttribute('target', '_self');
        hiddenAnchor.style.display = 'none';
        document.body.appendChild(hiddenAnchor);
        hiddenAnchor.click();
        document.body.removeChild(hiddenAnchor);

        btn.innerHTML = '✅ Download started';
      } catch (err) {
        console.error('Cloudflare R2 Download Error:', err);
        try {
          window.location.assign(BACKEND_R2_REDIRECT);
          btn.innerHTML = '✅ Download started';
        } catch (fallbackErr) {
          btn.innerHTML = '❌ Download failed — try again';
        }
      }

      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 4000);
    });
  });
});
