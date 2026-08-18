// SheDrive Interactive Client Scripts
document.addEventListener('DOMContentLoaded', () => {
  // Sticky Header Effect
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Mobile Navigation Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  // Interactive Live Bidding Simulation Demo
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

  // FAQ Accordion Handler
  const faqItems = document.querySelectorAll('.faq-question');
  faqItems.forEach(item => {
    item.addEventListener('click', () => {
      const parent = item.parentElement;
      parent.classList.toggle('open');
    });
  });

  // Silent Background Download Handler for APK Links
  const apkDownloadBtns = document.querySelectorAll('a[href*="drive.usercontent.google.com"], .download-btn-apk, .download-apk-btn');
  apkDownloadBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const downloadUrl = btn.getAttribute('href');
      
      // Create or reuse hidden iframe to trigger browser background file download stream
      let iframe = document.getElementById('silentDownloadIframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'silentDownloadIframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
      }
      iframe.src = downloadUrl;

      // Subtle visual feedback on button
      const originalText = btn.innerHTML;
      btn.innerHTML = '⌛ Starting Download...';
      btn.style.opacity = '0.85';
      setTimeout(() => {
        btn.innerHTML = '✅ Download Started!';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.opacity = '1';
        }, 3000);
      }, 1500);
    });
  });
});

