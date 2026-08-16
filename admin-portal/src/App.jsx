import React, { useState, useEffect } from 'react';

// If running on localhost/127.0.0.1 and custom VITE_API_BASE_URL is provided, use it. Otherwise, default to live Render backend.
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1')
  : 'https://shedrive.onrender.com/api/v1';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('shedrive_admin_token') || '');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    onlineDrivers: 0,
    completedRidesToday: 0,
    platformGrossRevenue: 0,
    pendingVerifications: 0,
    totalPassengers: 0,
    activeRides: 0,
  });

  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [verifiedDrivers, setVerifiedDrivers] = useState([]);
  const [rejectedDrivers, setRejectedDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [liveRides, setLiveRides] = useState([]);
  const [monthlyPayments, setMonthlyPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({
    totalPlatformIncome: 0,
    pendingSubmissionsCount: 0,
    paidCount: 0,
    overdueCount: 0,
    suspendedDriversCount: 0,
    expectedIncome: 0,
  });
  const [paymentFilterStatus, setPaymentFilterStatus] = useState('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [verificationSearchQuery, setVerificationSearchQuery] = useState('');
  const [driverRosterSearchQuery, setDriverRosterSearchQuery] = useState('');
  const [passengerSearchQuery, setPassengerSearchQuery] = useState('');
  const [paymentReviewModal, setPaymentReviewModal] = useState(null);
  const [adminPaymentNotes, setAdminPaymentNotes] = useState('');
  const [settings, setSettings] = useState({
    commission_pct: 5.0,
    sos_hotline: '+92 42 111 743 374',
    category_fares: [
      { id: 'bike', name: 'Bike / Scooty', baseFare: 60, perKmRate: 25, perMinuteRate: 2, minimumFare: 50 },
      { id: 'mini', name: 'SheDrive Mini', baseFare: 100, perKmRate: 40, perMinuteRate: 3, minimumFare: 80 },
      { id: 'sedan', name: 'SheDrive Sedan AC', baseFare: 150, perKmRate: 50, perMinuteRate: 4, minimumFare: 120 },
      { id: 'comfort', name: 'SheDrive Comfort AC', baseFare: 180, perKmRate: 60, perMinuteRate: 5, minimumFare: 150 },
      { id: 'premium', name: 'SheDrive Premium', baseFare: 250, perKmRate: 80, perMinuteRate: 6, minimumFare: 200 },
      { id: 'family', name: 'SheDrive Family XL', baseFare: 300, perKmRate: 90, perMinuteRate: 7, minimumFare: 250 },
    ],
  });

  const [selectedDriverDocs, setSelectedDriverDocs] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null); // For image preview modal
  const [confirmModal, setConfirmModal] = useState(null); // { driverId, driverName, actionType: 'approve' | 'reject' | 'block' | 'unblock' }
  const [rejectionReason, setRejectionReason] = useState('');

  // Admin Credential Settings state
  const [credCurrentPassword, setCredCurrentPassword] = useState('');
  const [credNewEmail, setCredNewEmail] = useState('');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch on mount, tab change, and every 5 seconds for live updates
  useEffect(() => {
    if (!token) return;
    fetchAdminData(true);
    const autoRefreshInterval = setInterval(() => {
      fetchAdminData(false); // Silent refresh — no loading spinner
    }, 5000);
    return () => clearInterval(autoRefreshInterval);
  }, [token, activeTab]);

  const fetchAdminData = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoadingData(true);
      const headers = { 
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };

      // Always fetch stats (drives all dashboard metric cards)
      const statsRes = await fetch(`${API_BASE_URL}/admin/stats?t=${Date.now()}`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Always fetch pending drivers (Verification Queue + Dashboard badge)
      const pendingRes = await fetch(`${API_BASE_URL}/admin/drivers/pending?t=${Date.now()}`, { headers });
      if (pendingRes.ok) {
        const pData = await pendingRes.json();
        setPendingDrivers(pData.pendingDrivers || []);
      }

      // Always fetch verified drivers roster (Approved Drivers tab)
      const drvRes = await fetch(`${API_BASE_URL}/admin/drivers?t=${Date.now()}`, { headers });
      if (drvRes.ok) {
        const dData = await drvRes.json();
        const allDrivers = dData.drivers || [];
        // Categorize drivers based on verification_status
        setVerifiedDrivers(allDrivers.filter(d => d.verification_status === 'approved'));
        setRejectedDrivers(allDrivers.filter(d => d.verification_status === 'rejected'));
      }

      // Always fetch passengers roster
      const passRes = await fetch(`${API_BASE_URL}/admin/passengers?t=${Date.now()}`, { headers });
      if (passRes.ok) {
        const passData = await passRes.json();
        setPassengers(passData.passengers || []);
      }

      // Always fetch live rides (Live Ride Monitor + Dashboard)
      const ridesRes = await fetch(`${API_BASE_URL}/admin/rides/live?t=${Date.now()}`, { headers });
      if (ridesRes.ok) {
        const rData = await ridesRes.json();
        setLiveRides(rData.liveRides || []);
      }

      // Always fetch monthly payments roster & summary stats
      const paymentsRes = await fetch(`${API_BASE_URL}/payments/admin/payments?t=${Date.now()}`, { headers });
      if (paymentsRes.ok) {
        const payData = await paymentsRes.json();
        setMonthlyPayments(payData.payments || []);
      }

      const paySumRes = await fetch(`${API_BASE_URL}/payments/admin/payments/summary?t=${Date.now()}`, { headers });
      if (paySumRes.ok) {
        const paySumData = await paySumRes.json();
        setPaymentSummary(paySumData);
      }

      // Always fetch platform settings (commission, fares)
      const setRes = await fetch(`${API_BASE_URL}/admin/settings?t=${Date.now()}`, { headers });
      if (setRes.ok) {
        const sData = await setRes.json();
        setSettings(prev => sData.settings || prev);
      }
    } catch (err) {
      console.error('Admin API fetch error:', err);
    } finally {
      if (showSpinner) setIsLoadingData(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setToken(data.token);
      localStorage.setItem('shedrive_admin_token', data.token);
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setLoginError(`Cannot connect to backend server at: ${API_BASE_URL}. Ensure the backend is running and accessible from this browser.`);
      } else {
        setLoginError(err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('shedrive_admin_token');
  };

  const executeVerifyDriver = async (driverId, approve) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approve, reason: approve ? null : rejectionReason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || (approve ? 'Driver approved!' : 'Driver rejected'));
        setSelectedDriverDocs(null);
        setConfirmModal(null);
        setRejectionReason('');
        fetchAdminData();
      } else {
        alert(data.error || 'Operation failed');
      }
    } catch (err) {
      alert('Failed to update driver status');
    }
  };

  const executeBlockDriver = async (driverId, block) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ block }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setConfirmModal(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Operation failed');
      }
    } catch (err) {
      alert('Failed to update driver block status');
    }
  };

  const executeBlockPassenger = async (passengerId, block) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/passengers/${passengerId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ block }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setConfirmModal(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Operation failed');
      }
    } catch (err) {
      alert('Failed to update passenger block status');
    }
  };

  const handleReviewPaymentSubmit = async () => {
    if (!paymentReviewModal) return;
    try {
      const res = await fetch(`${API_BASE_URL}/payments/admin/payments/${paymentReviewModal.id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: paymentReviewModal.action,
          adminNotes: adminPaymentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update payment status');
        return;
      }

      alert(data.message || 'Payment status updated successfully');
      setPaymentReviewModal(null);
      setAdminPaymentNotes('');
      fetchAdminData(true);
    } catch (err) {
      console.error('Review payment error:', err);
      alert('Failed to connect to backend server');
    }
  };

  const handleDownloadDriverDocs = (driver) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup blocked! Please allow popups for document download.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SheDrive Verification Bundle - ${driver.name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #181C32; }
          h1 { color: #E91E63; border-bottom: 2px solid #E91E63; padding-bottom: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8F9FA; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          .info-item { font-size: 14px; }
          .info-item strong { color: #5E6278; }
          .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .doc-card { border: 1px solid #E4E6EF; padding: 12px; border-radius: 8px; page-break-inside: avoid; }
          .doc-title { font-weight: bold; margin-bottom: 8px; color: #3F4254; font-size: 14px; }
          .doc-img { width: 100%; max-height: 250px; object-fit: contain; background: #F3F6F9; border-radius: 6px; }
          .no-img { padding: 40px; text-align: center; color: #A1A5B7; font-style: italic; background: #F3F6F9; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>🚗 SheDrive Driver Verification Document Bundle</h1>
        <div class="info-grid">
          <div class="info-item"><strong>Driver Name:</strong> ${driver.name}</div>
          <div class="info-item"><strong>Phone Number:</strong> ${driver.phone}</div>
          <div class="info-item"><strong>Email:</strong> ${driver.email || 'N/A'}</div>
          <div class="info-item"><strong>CNIC Number:</strong> ${driver.cnic || 'N/A'}</div>
          <div class="info-item"><strong>Date of Birth:</strong> ${driver.date_of_birth || 'N/A'}</div>
          <div class="info-item"><strong>Vehicle Category:</strong> ${driver.vehicle_category}</div>
          <div class="info-item"><strong>Vehicle Info:</strong> ${driver.vehicle_make} ${driver.vehicle_model} (${driver.vehicle_plate}) - ${driver.vehicle_year}</div>
          <div class="info-item"><strong>Color:</strong> ${driver.vehicle_color}</div>
        </div>

        <div class="doc-grid">
          <div class="doc-card">
            <div class="doc-title">CNIC Front</div>
            ${driver.cnic_front_url ? `<img class="doc-img" src="${driver.cnic_front_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">CNIC Back</div>
            ${driver.cnic_back_url ? `<img class="doc-img" src="${driver.cnic_back_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">Driving License Front</div>
            ${driver.license_front_url ? `<img class="doc-img" src="${driver.license_front_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">Driving License Back</div>
            ${driver.license_back_url ? `<img class="doc-img" src="${driver.license_back_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">Driver Profile Photo</div>
            ${driver.selfie_url ? `<img class="doc-img" src="${driver.selfie_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">Vehicle Photo (Number Plate Visible)</div>
            ${driver.vehicle_photo_url ? `<img class="doc-img" src="${driver.vehicle_photo_url}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
        </div>
      </body>
      </html>
    `;


    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      printWin.print();
    };
    printWin.onload = () => setTimeout(triggerPrint, 300);
    setTimeout(triggerPrint, 1500);
  };


  const handleSaveSettings = async (e) => {
    e.preventDefault();
    
    // Validation
    if (settings.commission_pct < 0 || settings.commission_pct > 100) {
      alert('Platform Commission must be between 0 and 100');
      return;
    }
    
    if (!settings.sos_hotline.trim()) {
      alert('Emergency SOS Number is required');
      return;
    }
    
    for (const cat of settings.category_fares) {
      if (cat.baseFare < 0) {
        alert(`${cat.name}: Base Fare cannot be negative`);
        return;
      }
      if (cat.perKmRate < 0) {
        alert(`${cat.name}: Rate per KM cannot be negative`);
        return;
      }
      if (cat.perMinuteRate < 0) {
        alert(`${cat.name}: Rate per Minute cannot be negative`);
        return;
      }
      if (cat.minimumFare < 0) {
        alert(`${cat.name}: Minimum Fare cannot be negative`);
        return;
      }
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          commissionPct: settings.commission_pct,
          sosHotline: settings.sos_hotline,
          categoryFares: settings.category_fares,
        }),
      });
      if (res.ok) {
        alert('System settings and category fares updated successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      alert('Error connecting to backend server');
    }
  };

  const updateCategoryFare = (catId, field, val) => {
    const updated = (settings.category_fares || []).map((cat) => {
      if (cat.id === catId) {
        return { ...cat, [field]: parseFloat(val) || 0 };
      }
      return cat;
    });
    setSettings({ ...settings, category_fares: updated });
  };

  // Handle Admin Credential Update
  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    if (!credCurrentPassword) {
      alert('Please enter your current password to verify authorization.');
      return;
    }
    if (!credNewEmail.trim() && !credNewPassword) {
      alert('Please enter a new email/username or a new password to update.');
      return;
    }
    if (credNewPassword && credNewPassword.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }
    setCredLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/credentials`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: credCurrentPassword,
          newEmail: credNewEmail.trim() || undefined,
          newPassword: credNewPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Admin credentials updated successfully! Please re-login with your new credentials.');
        setCredCurrentPassword('');
        setCredNewEmail('');
        setCredNewPassword('');
        handleLogout();
      } else {
        alert(data.error || 'Failed to update credentials');
      }
    } catch (err) {
      alert('Error connecting to backend server to update credentials');
    } finally {
      setCredLoading(false);
    }
  };

  // Login Screen View
  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <span style={{ fontSize: '48px', marginBottom: '12px' }}>🚗</span>
          <h2 style={styles.loginTitle}>SheDrive Admin Command Center</h2>
          <p style={styles.loginSub}>Enter administrator credentials to manage operations</p>

          {loginError && <div style={styles.loginErrorBox}>{loginError}</div>}

          <form onSubmit={handleAdminLogin} style={{ width: '100%', marginTop: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>Admin Email</label>
              <input
                type="email"
                placeholder="Enter admin email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={styles.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={styles.input}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px 8px',
                    color: '#666',
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" style={styles.btnSave} disabled={isLoggingIn}>
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Sidebar Navigation */}
      <aside style={styles.sidebar}>
        <div style={styles.logoSection}>
          <span style={styles.logoIcon}>🚗</span>
          <div>
            <h1 style={styles.logoTitle}>SheDrive</h1>
            <p style={styles.logoSubtitle}>Admin Command Center</p>
          </div>
        </div>

        <nav style={styles.navMenu}>
          <button
            style={activeTab === 'dashboard' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Analytics Dashboard
          </button>
          <button
            style={activeTab === 'verification' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('verification')}
          >
            🛡️ Verification Queue ({pendingDrivers.length})
          </button>
          <button
            style={activeTab === 'drivers' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('drivers')}
          >
            🚘 Approved Drivers
          </button>
          <button
            style={activeTab === 'rejected' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('rejected')}
          >
            ❌ Rejected Drivers ({rejectedDrivers.length})
          </button>
          <button
            style={activeTab === 'passengers' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('passengers')}
          >
            👩 Passengers Roster
          </button>
          <button
            style={activeTab === 'rides' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('rides')}
          >
            🛣️ Live Ride Monitor ({stats.activeRides || liveRides.length})
          </button>
          <button
            style={activeTab === 'payments' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('payments')}
          >
            💳 Monthly Payments {paymentSummary.pendingSubmissionsCount > 0 ? `(${paymentSummary.pendingSubmissionsCount})` : ''}
          </button>
          <button
            style={activeTab === 'settings' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ System Settings
          </button>
        </nav>

        <div style={styles.adminProfileCard}>
          <p style={styles.adminName}>Super Admin</p>
          <p style={styles.adminRole}>admin@shedrive.com</p>
          <button style={styles.btnLogout} onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* Top Header */}
        <header style={styles.topHeader}>
          <div>
            <h2 style={styles.headerTitle}>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'verification' && 'Driver Document Verification Center'}
              {activeTab === 'drivers' && 'Approved Driver Roster'}
              {activeTab === 'rejected' && 'Rejected Driver Applications'}
              {activeTab === 'passengers' && 'Registered Passenger Directory'}
              {activeTab === 'rides' && 'Live Ride Dispatch Monitor'}
              {activeTab === 'payments' && 'Monthly 5% Platform Fee & Payment Approvals'}
              {activeTab === 'settings' && 'Category Base Fare & Platform Controls'}
            </h2>
            <p style={styles.headerSub}>SheDrive Operating Network | 100% Real Database Connected</p>
          </div>
          <span style={styles.statusBadge}>🟢 Live DB Connected</span>
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>🚗</span>
                <div>
                  <p style={styles.metricLabel}>Active Drivers</p>
                  <h3 style={styles.metricValue}>{stats.onlineDrivers}</h3>
                </div>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>🛣️</span>
                <div>
                  <p style={styles.metricLabel}>Completed Rides</p>
                  <h3 style={styles.metricValue}>{stats.completedRidesToday}</h3>
                </div>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>💰</span>
                <div>
                  <p style={styles.metricLabel}>Platform Gross Revenue</p>
                  <h3 style={styles.metricValue}>PKR {stats.platformGrossRevenue.toLocaleString()}</h3>
                </div>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>🛡️</span>
                <div>
                  <p style={styles.metricLabel}>Pending Verifications</p>
                  <h3 style={styles.metricValue}>{stats.pendingVerifications}</h3>
                </div>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>⚡</span>
                <div>
                  <p style={styles.metricLabel}>Active Rides</p>
                  <h3 style={styles.metricValue}>{stats.activeRides || liveRides.length}</h3>
                </div>
              </div>
            </div>

            <div style={styles.cardContainer}>
              <h3 style={styles.cardHeader}>Recent Active Rides</h3>
              {liveRides.length === 0 ? (
                <p style={styles.emptyStateText}>No active rides currently in progress.</p>
              ) : (
                <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Ride ID</th>
                      <th>Passenger</th>
                      <th>Driver</th>
                      <th>Category</th>
                      <th>Pickup → Dropoff</th>
                      <th>Fare</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveRides.map((ride) => (
                      <tr key={ride.ride_id}>
                        <td>#{ride.ride_id.substring(0, 8)}</td>
                        <td>{ride.passenger_name}</td>
                        <td>{ride.driver_name || 'Unassigned'}</td>
                        <td>{ride.vehicle_category}</td>
                        <td>{ride.pickup_label} → {ride.dropoff_label}</td>
                        <td>PKR {ride.offered_fare}</td>
                        <td><span style={styles.statusYellow}>{ride.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div style={styles.cardContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={styles.cardHeader}>Pending Female Driver Applications ({pendingDrivers.length})</h3>
              <input
                type="text"
                placeholder="Search by Name, Phone, Email, CNIC, or ID..."
                value={verificationSearchQuery}
                onChange={(e) => setVerificationSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '320px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>
            {pendingDrivers.filter(d => {
              if (!verificationSearchQuery.trim()) return true;
              const q = verificationSearchQuery.toLowerCase();
              return (d.name || '').toLowerCase().includes(q) ||
                     (d.email || '').toLowerCase().includes(q) ||
                     (d.phone || '').toLowerCase().includes(q) ||
                     (d.cnic || '').toLowerCase().includes(q) ||
                     (d.id || '').toLowerCase().includes(q);
            }).length === 0 ? (
              <p style={styles.emptyStateText}>No matching pending driver applications found.</p>
            ) : (
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Applicant Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Vehicle Tier</th>
                    <th>CNIC Number</th>
                    <th>Date of Birth</th>
                    <th>Make / Model / Plate</th>
                    <th>Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDrivers
                    .filter(d => {
                      if (!verificationSearchQuery.trim()) return true;
                      const q = verificationSearchQuery.toLowerCase();
                      return (d.name || '').toLowerCase().includes(q) ||
                             (d.email || '').toLowerCase().includes(q) ||
                             (d.phone || '').toLowerCase().includes(q) ||
                             (d.cnic || '').toLowerCase().includes(q) ||
                             (d.id || '').toLowerCase().includes(q);
                    })
                    .map((driver) => (
                    <tr key={driver.id}>
                      <td><strong>{driver.name}</strong></td>
                      <td>{driver.phone}</td>
                      <td>{driver.email}</td>
                      <td>{driver.vehicle_category}</td>
                      <td>{driver.cnic || 'N/A'}</td>
                      <td>{driver.date_of_birth || 'N/A'}</td>
                      <td>{driver.vehicle_make} {driver.vehicle_model} ({driver.vehicle_plate})</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button style={styles.btnViewDocs} onClick={() => setSelectedDriverDocs(driver)}>
                          🔍 View
                        </button>
                        <button style={styles.btnDownloadPdf} onClick={() => handleDownloadDriverDocs(driver)} title="Download PDF Document Bundle">
                          📥 Download PDF
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={styles.btnApprove}
                            onClick={() =>
                              setConfirmModal({
                                driverId: driver.id,
                                driverName: driver.name,
                                actionType: 'approve',
                              })
                            }
                          >
                            ✓ Accept
                          </button>
                          <button
                            style={styles.btnReject}
                            onClick={() =>
                              setConfirmModal({
                                driverId: driver.id,
                                driverName: driver.name,
                                actionType: 'reject',
                              })
                            }
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <div style={styles.cardContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={styles.cardHeader}>Approved SheDrive Drivers ({verifiedDrivers.length})</h3>
              <input
                type="text"
                placeholder="Search by Name, Email, Phone, Plate, Make, Model, or ID..."
                value={driverRosterSearchQuery}
                onChange={(e) => setDriverRosterSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '340px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>
            {verifiedDrivers.filter(d => {
              if (!driverRosterSearchQuery.trim()) return true;
              const q = driverRosterSearchQuery.toLowerCase();
              return (d.name || '').toLowerCase().includes(q) ||
                     (d.email || '').toLowerCase().includes(q) ||
                     (d.phone || '').toLowerCase().includes(q) ||
                     (d.vehicle_plate || '').toLowerCase().includes(q) ||
                     (d.vehicle_make || '').toLowerCase().includes(q) ||
                     (d.vehicle_model || '').toLowerCase().includes(q) ||
                     (d.id || '').toLowerCase().includes(q);
            }).length === 0 ? (
              <p style={styles.emptyStateText}>No matching verified drivers found.</p>
            ) : (
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Driver ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Vehicle Make &amp; Model</th>
                    <th>Plate</th>
                    <th>Rating</th>
                    <th>Rides</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedDrivers
                    .filter(d => {
                      if (!driverRosterSearchQuery.trim()) return true;
                      const q = driverRosterSearchQuery.toLowerCase();
                      return (d.name || '').toLowerCase().includes(q) ||
                             (d.email || '').toLowerCase().includes(q) ||
                             (d.phone || '').toLowerCase().includes(q) ||
                             (d.vehicle_plate || '').toLowerCase().includes(q) ||
                             (d.vehicle_make || '').toLowerCase().includes(q) ||
                             (d.vehicle_model || '').toLowerCase().includes(q) ||
                             (d.id || '').toLowerCase().includes(q);
                    })
                    .map((d) => (
                    <tr key={d.id}>
                      <td>#{d.id.substring(0, 8)}</td>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.email}</td>
                      <td>{d.phone}</td>
                      <td>{d.vehicle_make} {d.vehicle_model}</td>
                      <td>{d.vehicle_plate}</td>
                      <td>⭐ {d.rating || '0.00'}</td>
                      <td>{d.total_rides || 0}</td>
                      <td>
                        {d.is_blocked ? (
                          <span style={styles.statusRed}>Blocked</span>
                        ) : d.is_verified ? (
                          <span style={styles.statusGreen}>Approved</span>
                        ) : (
                          <span style={styles.statusYellow}>Pending</span>
                        )}
                      </td>
                      <td>
                        {d.is_blocked ? (
                          <button
                            style={styles.btnUnblock}
                            onClick={() =>
                              setConfirmModal({
                                driverId: d.id,
                                driverName: d.name,
                                actionType: 'unblock',
                              })
                            }
                          >
                            🔓 Unblock
                          </button>
                        ) : (
                          <button
                            style={styles.btnBlock}
                            onClick={() =>
                              setConfirmModal({
                                driverId: d.id,
                                driverName: d.name,
                                actionType: 'block',
                              })
                            }
                          >
                            🚫 Block
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Rejected Drivers Tab */}
        {activeTab === 'rejected' && (
          <div style={styles.cardContainer}>
            <h3 style={styles.cardHeader}>Rejected Driver Applications ({rejectedDrivers.length})</h3>
            {rejectedDrivers.length === 0 ? (
              <p style={styles.emptyStateText}>No rejected driver applications.</p>
            ) : (
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Driver ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Vehicle Make & Model</th>
                    <th>Plate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedDrivers.map((d) => (
                    <tr key={d.id}>
                      <td>#{d.id.substring(0, 8)}</td>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.email}</td>
                      <td>{d.phone}</td>
                      <td>{d.vehicle_make} {d.vehicle_model}</td>
                      <td>{d.vehicle_plate}</td>
                      <td>
                        <span style={styles.statusRed}>Rejected</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Passengers Tab */}
        {activeTab === 'passengers' && (
          <div style={styles.cardContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={styles.cardHeader}>Registered Passengers Roster ({passengers.length})</h3>
              <input
                type="text"
                placeholder="Search by Passenger Name, Email, Phone, or ID..."
                value={passengerSearchQuery}
                onChange={(e) => setPassengerSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '320px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>
            {passengers.filter(p => {
              if (!passengerSearchQuery.trim()) return true;
              const q = passengerSearchQuery.toLowerCase();
              return (p.name || '').toLowerCase().includes(q) ||
                     (p.email || '').toLowerCase().includes(q) ||
                     (p.phone || '').toLowerCase().includes(q) ||
                     (p.id || '').toLowerCase().includes(q);
            }).length === 0 ? (
              <p style={styles.emptyStateText}>No matching registered passengers found.</p>
            ) : (
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Passenger ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>CNIC Number</th>
                    <th>Total Rides</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passengers
                    .filter(p => {
                      if (!passengerSearchQuery.trim()) return true;
                      const q = passengerSearchQuery.toLowerCase();
                      return (p.name || '').toLowerCase().includes(q) ||
                             (p.email || '').toLowerCase().includes(q) ||
                             (p.phone || '').toLowerCase().includes(q) ||
                             (p.id || '').toLowerCase().includes(q);
                    })
                    .map((p) => (
                    <tr key={p.id}>
                      <td>#{p.id.substring(0, 8)}</td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.email}</td>
                      <td>{p.phone}</td>
                      <td>{p.cnic || 'N/A'}</td>
                      <td>{p.total_rides || 0}</td>
                      <td>
                        {p.is_blocked ? (
                          <span style={styles.statusRed}>Blocked</span>
                        ) : (
                          <span style={styles.statusGreen}>Active</span>
                        )}
                      </td>
                      <td>
                        {p.is_blocked ? (
                          <button
                            style={styles.btnUnblock}
                            onClick={() =>
                              setConfirmModal({
                                passengerId: p.id,
                                passengerName: p.name,
                                actionType: 'unblock_passenger',
                              })
                            }
                          >
                            🔓 Unblock
                          </button>
                        ) : (
                          <button
                            style={styles.btnBlock}
                            onClick={() =>
                              setConfirmModal({
                                passengerId: p.id,
                                passengerName: p.name,
                                actionType: 'block_passenger',
                              })
                            }
                          >
                            🚫 Block
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Live Rides Tab */}
        {activeTab === 'rides' && (
          <div style={styles.cardContainer}>
            <h3 style={styles.cardHeader}>Ongoing Live Rides ({liveRides.length})</h3>
            {liveRides.length === 0 ? (
              <p style={styles.emptyStateText}>No ongoing rides currently active in database.</p>
            ) : (
              <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    <th>Passenger</th>
                    <th>Driver</th>
                    <th>Category</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Fare</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRides.map((r) => (
                    <tr key={r.ride_id}>
                      <td>#{r.ride_id.substring(0, 8)}</td>
                      <td>{r.passenger_name}</td>
                      <td>{r.driver_name || 'Finding Driver...'}</td>
                      <td>{r.vehicle_category}</td>
                      <td>{r.pickup_label}</td>
                      <td>{r.dropoff_label}</td>
                      <td>PKR {r.offered_fare}</td>
                      <td><span style={styles.statusYellow}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={styles.cardContainer}>
            <h3 style={styles.cardHeader}>Category Fare Configuration & Platform Settings</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Platform Settings */}
              <div style={{ backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, border: '1px solid #E4E6EF' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#181C32' }}>⚙️ Platform Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={styles.label}>Platform Commission (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={settings.commission_pct}
                      onChange={(e) => setSettings({ ...settings, commission_pct: parseFloat(e.target.value) })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Emergency SOS Number</label>
                    <input
                      type="text"
                      value={settings.sos_hotline}
                      onChange={(e) => setSettings({ ...settings, sos_hotline: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Category Fare Table */}
              <div style={{ backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, border: '1px solid #E4E6EF' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#181C32' }}>🚖 Vehicle Category Fare Structure</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', gap: 12, fontWeight: '700', fontSize: '13px', color: '#5E6278', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #E4E6EF' }}>
                  <div>Category</div>
                  <div>Base Fare (PKR)</div>
                  <div>Rate per KM (PKR)</div>
                  <div>Rate per Minute (PKR)</div>
                  <div>Minimum Fare (PKR)</div>
                </div>
                {(settings.category_fares || []).map((cat) => (
                  <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#3F4254' }}>{cat.name}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cat.baseFare}
                      onChange={(e) => updateCategoryFare(cat.id, 'baseFare', e.target.value)}
                      style={styles.input}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cat.perKmRate}
                      onChange={(e) => updateCategoryFare(cat.id, 'perKmRate', e.target.value)}
                      style={styles.input}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cat.perMinuteRate}
                      onChange={(e) => updateCategoryFare(cat.id, 'perMinuteRate', e.target.value)}
                      style={styles.input}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cat.minimumFare}
                      onChange={(e) => updateCategoryFare(cat.id, 'minimumFare', e.target.value)}
                      style={styles.input}
                      required
                    />
                  </div>
                ))}
              </div>

              <button type="submit" style={styles.btnSave}>
                💾 Save Configuration
              </button>
            </form>

            {/* Admin Account Credentials */}
            <div style={{ marginTop: '32px', backgroundColor: '#F8F9FA', padding: '24px', borderRadius: '16px', border: '1px solid #E4E6EF' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#181C32', fontWeight: '800' }}>🔑 Admin Account Credentials &amp; Security</h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#7E8299', lineHeight: 1.5 }}>
                Change your Admin Portal login email or password below. You must enter your current password to verify authorization. After updating, you will be logged out and must re-login with your new credentials.
              </p>
              <form onSubmit={handleUpdateCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={styles.label}>Current Password <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="password"
                    placeholder="Enter your current password"
                    value={credCurrentPassword}
                    onChange={(e) => setCredCurrentPassword(e.target.value)}
                    style={styles.input}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={styles.label}>New Email / Username</label>
                    <input
                      type="email"
                      placeholder="Enter new admin email (optional)"
                      value={credNewEmail}
                      onChange={(e) => setCredNewEmail(e.target.value)}
                      style={styles.input}
                      autoComplete="new-email"
                    />
                  </div>
                  <div>
                    <label style={styles.label}>New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password (min 6 chars, optional)"
                      value={credNewPassword}
                      onChange={(e) => setCredNewPassword(e.target.value)}
                      style={styles.input}
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={credLoading}
                    style={{
                      ...styles.btnSave,
                      background: 'linear-gradient(135deg, #7239EA 0%, #E91E63 100%)',
                      opacity: credLoading ? 0.6 : 1,
                      cursor: credLoading ? 'not-allowed' : 'pointer',
                      maxWidth: '280px',
                    }}
                  >
                    {credLoading ? '⏳ Updating...' : '🔒 Update Admin Credentials'}
                  </button>
                  <span style={{ fontSize: '12px', color: '#A1A5B7' }}>You will be logged out after update</span>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Monthly Platform Fee & Payments Tab */}
        {activeTab === 'payments' && (
          <div>
            {/* Summary Statistics Cards */}
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>💰</span>
                <div>
                  <p style={styles.metricLabel}>Total Platform Revenue (5%)</p>
                  <h3 style={{ ...styles.metricValue, color: '#10B981' }}>PKR {paymentSummary.totalPlatformIncome.toLocaleString()}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>⏳</span>
                <div>
                  <p style={styles.metricLabel}>Pending Approval Submissions</p>
                  <h3 style={{ ...styles.metricValue, color: '#F59E0B' }}>{paymentSummary.pendingSubmissionsCount}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>✓</span>
                <div>
                  <p style={styles.metricLabel}>Verified &amp; Paid Accounts</p>
                  <h3 style={{ ...styles.metricValue, color: '#10B981' }}>{paymentSummary.paidCount}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricIcon}>⚠️</span>
                <div>
                  <p style={styles.metricLabel}>Overdue &amp; Suspended Drivers</p>
                  <h3 style={{ ...styles.metricValue, color: '#EF4444' }}>{paymentSummary.suspendedDriversCount}</h3>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #E4E6EF', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#5E6278' }}>Filter Status:</span>
                <select
                  value={paymentFilterStatus}
                  onChange={(e) => setPaymentFilterStatus(e.target.value)}
                  style={{ ...styles.input, padding: '8px 14px', borderRadius: '10px', width: 'auto' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted (Under Review)</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                  <option value="overdue">Overdue</option>
                  <option value="pending">Pending Submission</option>
                </select>
              </div>

              <div style={{ flex: 1, maxWidth: '360px' }}>
                <input
                  type="text"
                  placeholder="Search by Driver Name, Email, Phone, Plate, or Transaction ID..."
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  style={{ ...styles.input, padding: '8px 14px', borderRadius: '10px' }}
                />
              </div>
            </div>

            {/* Payments Table */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={styles.cardHeader}>Monthly Platform Fee Records</h3>
                <span style={{ fontSize: '13px', color: '#7E8299', fontWeight: '600' }}>
                  Showing {
                    monthlyPayments.filter(p => {
                      if (paymentFilterStatus !== 'all' && p.status !== paymentFilterStatus) return false;
                      if (paymentSearchQuery.trim()) {
                        const q = paymentSearchQuery.toLowerCase();
                        const name = (p.driver_name || '').toLowerCase();
                        const email = (p.driver_email || '').toLowerCase();
                        const phone = (p.driver_phone || '').toLowerCase();
                        const tx = (p.transaction_id || '').toLowerCase();
                        const plate = (p.vehicle_plate || '').toLowerCase();
                        return name.includes(q) || email.includes(q) || phone.includes(q) || tx.includes(q) || plate.includes(q);
                      }
                      return true;
                    }).length
                  } records
                </span>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Driver Info</th>
                      <th>Vehicle Plate</th>
                      <th>Month</th>
                      <th>Completed Rides</th>
                      <th>Total Earnings</th>
                      <th>5% Platform Fee</th>
                      <th>Transaction ID</th>
                      <th>Receipt Proof</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPayments
                      .filter(p => {
                        if (paymentFilterStatus !== 'all' && p.status !== paymentFilterStatus) return false;
                        if (paymentSearchQuery.trim()) {
                          const q = paymentSearchQuery.toLowerCase();
                          const name = (p.driver_name || '').toLowerCase();
                          const email = (p.driver_email || '').toLowerCase();
                          const phone = (p.driver_phone || '').toLowerCase();
                          const tx = (p.transaction_id || '').toLowerCase();
                          const plate = (p.vehicle_plate || '').toLowerCase();
                          return name.includes(q) || email.includes(q) || phone.includes(q) || tx.includes(q) || plate.includes(q);
                        }
                        return true;
                      })
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ color: '#181C32' }}>{p.driver_name}</strong>
                            <div style={{ fontSize: '12px', color: '#7E8299', marginTop: '2px' }}>{p.driver_phone}</div>
                            <div style={{ fontSize: '11px', color: '#A1A5B7' }}>{p.driver_email}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '700', color: '#3F4254', backgroundColor: '#F3F6F9', padding: '4px 8px', borderRadius: '6px' }}>
                              {p.vehicle_plate || 'N/A'}
                            </span>
                          </td>
                          <td><strong style={{ color: '#181C32' }}>{p.month_year}</strong></td>
                          <td><span style={{ fontWeight: '700' }}>{p.total_rides}</span></td>
                          <td><strong style={{ color: '#181C32' }}>PKR {parseFloat(p.total_earnings).toLocaleString()}</strong></td>
                          <td><strong style={{ color: '#E91E63' }}>PKR {parseFloat(p.platform_fee).toLocaleString()}</strong></td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#3F4254' }}>
                              {p.transaction_id || '—'}
                            </span>
                          </td>
                          <td>
                            {p.receipt_url ? (
                              <button
                                style={{ ...styles.btnAction, backgroundColor: '#7239EA', color: '#FFFFFF', padding: '5px 10px', fontSize: '12px' }}
                                onClick={() => setSelectedImage(p.receipt_url)}
                              >
                                🖼️ View Receipt
                              </button>
                            ) : (
                              <span style={{ color: '#A1A5B7', fontSize: '12px' }}>No receipt</span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '800',
                                color: '#FFFFFF',
                                backgroundColor:
                                  p.status === 'paid' ? '#10B981' :
                                  p.status === 'submitted' ? '#F59E0B' :
                                  p.status === 'rejected' ? '#EF4444' :
                                  p.status === 'overdue' ? '#DC2626' : '#3B82F6'
                              }}
                            >
                              {p.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {p.status !== 'paid' && (
                                <button
                                  style={{ ...styles.btnApprove, padding: '5px 10px', fontSize: '12px' }}
                                  onClick={() => setPaymentReviewModal({ id: p.id, driverName: p.driver_name, action: 'paid' })}
                                >
                                  ✓ Approve
                                </button>
                              )}
                              {p.status !== 'rejected' && (
                                <button
                                  style={{ ...styles.btnReject, padding: '5px 10px', fontSize: '12px' }}
                                  onClick={() => setPaymentReviewModal({ id: p.id, driverName: p.driver_name, action: 'rejected' })}
                                >
                                  ✕ Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Popup Modal */}
      {confirmModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: confirmModal.actionType === 'reject' ? '500px' : '420px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800' }}>
              Confirm Action
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#5E6278', lineHeight: 1.5 }}>
              Are you sure you want to <strong>{confirmModal.actionType.toUpperCase()}</strong> driver{' '}
              <strong>{confirmModal.driverName}</strong>?
            </p>
            {confirmModal.actionType === 'reject' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#3F4254', marginBottom: '8px' }}>
                  Rejection Reason (Required)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please specify the reason for rejection (e.g., unclear documents, invalid license, etc.)"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px',
                    border: '1px solid #E4E6EF',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  required
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={styles.btnCancel} onClick={() => { setConfirmModal(null); setRejectionReason(''); }}>
                Cancel
              </button>
              <button
                style={
                  confirmModal.actionType === 'approve' || confirmModal.actionType === 'unblock' || confirmModal.actionType === 'unblock_passenger'
                    ? styles.btnApprove
                    : styles.btnReject
                }
                onClick={() => {
                  if (confirmModal.actionType === 'reject' && !rejectionReason.trim()) {
                    alert('Please provide a rejection reason');
                    return;
                  }
                  if (confirmModal.actionType === 'approve') executeVerifyDriver(confirmModal.driverId, true);
                  else if (confirmModal.actionType === 'reject') executeVerifyDriver(confirmModal.driverId, false);
                  else if (confirmModal.actionType === 'block') executeBlockDriver(confirmModal.driverId, true);
                  else if (confirmModal.actionType === 'unblock') executeBlockDriver(confirmModal.driverId, false);
                  else if (confirmModal.actionType === 'block_passenger') executeBlockPassenger(confirmModal.passengerId, true);
                  else if (confirmModal.actionType === 'unblock_passenger') executeBlockPassenger(confirmModal.passengerId, false);
                }}
              >
                Confirm {confirmModal.actionType.replace('_passenger', '').charAt(0).toUpperCase() + confirmModal.actionType.replace('_passenger', '').slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Review Modal */}
      {paymentReviewModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: '480px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800' }}>
              {paymentReviewModal.action === 'paid' ? 'Approve Platform Fee Payment' : 'Reject Platform Fee Payment'}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#5E6278', lineHeight: 1.5 }}>
              Are you sure you want to mark monthly payment for <strong>{paymentReviewModal.driverName}</strong> as{' '}
              <strong style={{ color: paymentReviewModal.action === 'paid' ? '#10B981' : '#EF4444' }}>
                {paymentReviewModal.action.toUpperCase()}
              </strong>?
              {paymentReviewModal.action === 'paid' && ' Approving will immediately remove any active fee suspension.'}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#3F4254', marginBottom: '8px' }}>
                Admin Notes (Optional for Approval, Required for Rejection)
              </label>
              <textarea
                value={adminPaymentNotes}
                onChange={(e) => setAdminPaymentNotes(e.target.value)}
                placeholder="Enter notes or rejection explanation for driver..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  border: '1px solid #E4E6EF',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                style={styles.btnSecondary}
                onClick={() => {
                  setPaymentReviewModal(null);
                  setAdminPaymentNotes('');
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.btnSave,
                  backgroundColor: paymentReviewModal.action === 'paid' ? '#10B981' : '#EF4444',
                }}
                onClick={handleReviewPaymentSubmit}
              >
                Confirm {paymentReviewModal.action === 'paid' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Document Review Modal */}
      {selectedDriverDocs && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                Document Review: {selectedDriverDocs.name}
              </h3>
              <button style={styles.btnDownloadPdf} onClick={() => handleDownloadDriverDocs(selectedDriverDocs)}>
                📥 Download PDF Bundle
              </button>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#757575' }}>
              Vehicle: {selectedDriverDocs.vehicle_make} {selectedDriverDocs.vehicle_model} ({selectedDriverDocs.vehicle_plate}) - {selectedDriverDocs.vehicle_color}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={styles.docBox}>
                <p style={styles.docLabel}>CNIC Front</p>
                {selectedDriverDocs.cnic_front_url ? (
                  <img 
                    src={selectedDriverDocs.cnic_front_url} 
                    alt="CNIC Front" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.cnic_front_url, title: 'CNIC Front' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>CNIC Back</p>
                {selectedDriverDocs.cnic_back_url ? (
                  <img 
                    src={selectedDriverDocs.cnic_back_url} 
                    alt="CNIC Back" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.cnic_back_url, title: 'CNIC Back' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>License Front</p>
                {selectedDriverDocs.license_front_url ? (
                  <img 
                    src={selectedDriverDocs.license_front_url} 
                    alt="License Front" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.license_front_url, title: 'License Front' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>License Back</p>
                {selectedDriverDocs.license_back_url ? (
                  <img 
                    src={selectedDriverDocs.license_back_url} 
                    alt="License Back" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.license_back_url, title: 'License Back' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>Profile Photo</p>
                {selectedDriverDocs.selfie_url ? (
                  <img 
                    src={selectedDriverDocs.selfie_url} 
                    alt="Profile Photo" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.selfie_url, title: 'Profile Photo' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>Vehicle Photo (Number Plate)</p>
                {selectedDriverDocs.vehicle_photo_url ? (
                  <img 
                    src={selectedDriverDocs.vehicle_photo_url} 
                    alt="Vehicle Photo" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.vehicle_photo_url, title: 'Vehicle Photo' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>
            </div>


            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={styles.btnReject}
                onClick={() =>
                  setConfirmModal({
                    driverId: selectedDriverDocs.id,
                    driverName: selectedDriverDocs.name,
                    actionType: 'reject',
                  })
                }
              >
                ✕ Reject Application
              </button>
              <button
                style={styles.btnApprove}
                onClick={() =>
                  setConfirmModal({
                    driverId: selectedDriverDocs.id,
                    driverName: selectedDriverDocs.name,
                    actionType: 'approve',
                  })
                }
              >
                ✓ Accept & Approve
              </button>
              <button style={styles.btnCancel} onClick={() => setSelectedDriverDocs(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div style={styles.modalOverlay} onClick={() => setSelectedImage(null)}>
          <div style={{ ...styles.modalContent, maxWidth: '90vw', maxHeight: '90vh', padding: '8px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{selectedImage.title}</h3>
              <button style={styles.btnCancel} onClick={() => setSelectedImage(null)}>✕</button>
            </div>
            <img src={selectedImage.url} alt={selectedImage.title} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loginContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0F0C20 0%, #1A103C 50%, #2A0826 100%)',
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
  },
  loginBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(20px)',
    padding: '48px 40px',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0px 20px 50px rgba(233, 30, 99, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
  },
  loginTitle: { margin: 0, fontSize: '22px', fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: '-0.5px' },
  loginSub: { margin: '8px 0 0 0', fontSize: '13px', color: '#666666', textAlign: 'center', lineHeight: '20px' },
  loginErrorBox: { backgroundColor: '#FFEBEE', color: '#C62828', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', width: '100%', marginTop: '16px', fontWeight: '600' },
  appContainer: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8F9FB', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" },
  sidebar: { width: '270px', backgroundColor: '#13111C', color: '#FFFFFF', padding: '28px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #232035' },
  logoSection: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px', paddingLeft: '6px' },
  logoIcon: { fontSize: '32px' },
  logoTitle: { margin: 0, fontSize: '22px', fontWeight: '900', color: '#E91E63', letterSpacing: '-0.5px' },
  logoSubtitle: { margin: '2px 0 0 0', fontSize: '11px', color: '#9D9BBE', letterSpacing: '0.5px', fontWeight: '600', textTransform: 'uppercase' },
  navMenu: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  navItem: { backgroundColor: 'transparent', color: '#9D9BBE', border: 'none', padding: '13px 18px', borderRadius: '14px', textAlign: 'left', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' },
  navItemActive: { backgroundColor: '#E91E63', color: '#FFFFFF', border: 'none', padding: '13px 18px', borderRadius: '14px', textAlign: 'left', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0px 8px 20px rgba(233, 30, 99, 0.35)' },
  adminProfileCard: { backgroundColor: '#1E1B2E', padding: '14px 18px', borderRadius: '16px', marginTop: 'auto', border: '1px solid #2A2640' },
  adminName: { margin: 0, fontWeight: '800', fontSize: '14px', color: '#FFFFFF' },
  adminRole: { margin: '2px 0 0 0', fontSize: '12px', color: '#9D9BBE' },
  btnLogout: { backgroundColor: 'transparent', color: '#FF5252', border: 'none', padding: 0, marginTop: '10px', fontSize: '12px', cursor: 'pointer', fontWeight: '800' },
  mainContent: { flex: 1, padding: '36px 40px', overflowY: 'auto' },
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  headerTitle: { margin: 0, fontSize: '26px', fontWeight: '900', color: '#1A1A1A', letterSpacing: '-0.5px' },
  headerSub: { margin: '4px 0 0 0', fontSize: '14px', color: '#666666', fontWeight: '500' },
  statusBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '800', border: '1px solid #C8E6C9' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '18px', marginBottom: '32px' },
  metricCard: { backgroundColor: '#FFFFFF', padding: '22px 18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.04)', border: '1px solid #EFEFF5' },
  metricIcon: { fontSize: '32px' },
  metricLabel: { margin: 0, fontSize: '12px', color: '#666666', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' },
  metricValue: { margin: '4px 0 0 0', fontSize: '22px', fontWeight: '900', color: '#1A1A1A' },
  cardContainer: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: '24px', 
    padding: '28px', 
    boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.04)', 
    border: '1px solid #EFEFF5',
    marginBottom: '24px',
  },
  cardHeader: { 
    margin: '0 0 24px 0', 
    fontSize: '19px', 
    fontWeight: '800', 
    color: '#1A1A1A', 
    letterSpacing: '-0.3px',
    borderBottom: '2px solid #F0F0F5',
    paddingBottom: '16px',
  },
  emptyStateText: { padding: '24px 0', color: '#888888', fontSize: '14px', fontWeight: '500' },
  // Table styling is handled by global index.css for pseudo-selector support (zebra striping, hover, etc.)
  statusGreen: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  statusYellow: { backgroundColor: '#FFF3E0', color: '#E65100', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  statusRed: { backgroundColor: '#FFEBEE', color: '#C62828', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  btnViewDocs: { backgroundColor: '#FFF0F5', color: '#E91E63', border: '1px solid #FFD1E3', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnDownloadPdf: { backgroundColor: '#F3E5F5', color: '#7B1FA2', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnApprove: { backgroundColor: '#4CAF50', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', boxShadow: '0px 4px 10px rgba(76, 175, 80, 0.25)' },
  btnReject: { backgroundColor: '#F44336', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', boxShadow: '0px 4px 10px rgba(244, 67, 54, 0.25)' },
  btnBlock: { backgroundColor: '#D32F2F', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnUnblock: { backgroundColor: '#388E3C', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnCancel: { backgroundColor: '#E4E6EF', color: '#3F4254', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
  label: { display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: '#1A1A1A', letterSpacing: '0.2px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #EFEFF5', fontSize: '14px', backgroundColor: '#FAFAFC', outline: 'none' },
  btnSave: { backgroundColor: '#E91E63', color: '#FFF', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', marginTop: '16px', width: '100%', boxShadow: '0px 8px 20px rgba(233, 30, 99, 0.35)', fontSize: '15px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 12, 32, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '24px', width: '660px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0px 25px 60px rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.5)' },
  docBox: { backgroundColor: '#FAFAFC', padding: '14px', borderRadius: '14px', border: '1px solid #EFEFF5' },
  docLabel: { margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' },
  docImg: { width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px' },
  noDoc: { color: '#B5B5C3', fontSize: '13px', fontWeight: '600' },
};
