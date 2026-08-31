import React, { useState, useEffect, useCallback, useRef } from 'react';
import adminApi, { getAuthToken, setAuthToken, clearAuthToken, cancelAllRequests } from './api/adminApi';
import { ToastContainer } from './components/Toast';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PaginationBar } from './components/PaginationBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useDebounce } from './hooks/useDebounce';
import { AnalyticsTab } from './components/analytics/AnalyticsTab';
import { SystemHealthTab } from './components/health/SystemHealthTab';
import { ComplianceTab } from './components/compliance/ComplianceTab';
import { DisputesTab } from './components/disputes/DisputesTab';

// Maps an admin audit-log action to a badge background color
const getActionColor = (action) => {
  switch (action) {
    case 'APPROVE_DRIVER':
      return '#10B981';
    case 'REJECT_DRIVER':
      return '#EF4444';
    case 'BLOCK_DRIVER':
    case 'BLOCK_PASSENGER':
      return '#F59E0B';
    case 'UPDATE_SETTINGS':
      return '#6366F1';
    default:
      return '#64748B';
  }
};

// Formats raw user-agent or device_info into a clean concise badge
const formatUserAgentBadge = (deviceInfo) => {
  if (!deviceInfo) return { label: 'Web', icon: '🌐', bg: '#F1F5F9', color: '#475569' };
  const str = String(deviceInfo).toLowerCase();
  if (str.includes('android')) return { label: 'Android App', icon: '🤖', bg: '#DCFCE7', color: '#15803D' };
  if (str.includes('iphone') || str.includes('ios') || str.includes('ipad')) return { label: 'iOS App', icon: '🍎', bg: '#EEF2FF', color: '#4338CA' };
  if (str.includes('windows')) return { label: 'Windows Web', icon: '🪟', bg: '#E0F2FE', color: '#0369A1' };
  if (str.includes('mac') || str.includes('darwin')) return { label: 'macOS Web', icon: '🍏', bg: '#F8FAFC', color: '#334155' };
  if (str.includes('mobile')) return { label: 'Mobile Web', icon: '📱', bg: '#CCFBF1', color: '#0F766E' };
  return { label: 'Web Visitor', icon: '🌐', bg: '#F1F5F9', color: '#475569' };
};

// Tab <-> Route Path mapping for complete browser refresh and URL persistence
const TAB_PATH_MAP = {
  dashboard: '/',
  analytics: '/analytics',
  systemHealth: '/system-health',
  compliance: '/compliance',
  disputes: '/disputes',
  verification: '/verification',
  drivers: '/drivers',
  rejected: '/rejected',
  passengers: '/passengers',
  rides: '/rides',
  payments: '/payments',
  sosAlerts: '/sos-alerts',
  auditLogs: '/audit-logs',
  feedback: '/feedback',
  supportTickets: '/support-tickets',
  rideHistory: '/ride-history',
  deactivatedAccounts: '/deactivated-accounts',
  notifications: '/notifications',
  settings: '/settings',
};

const PATH_TO_TAB_MAP = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/analytics': 'analytics',
  '/systemhealth': 'systemHealth',
  '/system-health': 'systemHealth',
  '/compliance': 'compliance',
  '/disputes': 'disputes',
  '/verification': 'verification',
  '/drivers': 'drivers',
  '/rejected': 'rejected',
  '/passengers': 'passengers',
  '/rides': 'rides',
  '/payments': 'payments',
  '/sosalerts': 'sosAlerts',
  '/sos-alerts': 'sosAlerts',
  '/auditlogs': 'auditLogs',
  '/audit-logs': 'auditLogs',
  '/feedback': 'feedback',
  '/supporttickets': 'supportTickets',
  '/support-tickets': 'supportTickets',
  '/ridehistory': 'rideHistory',
  '/ride-history': 'rideHistory',
  '/deactivatedaccounts': 'deactivatedAccounts',
  '/deactivated-accounts': 'deactivatedAccounts',
  '/notifications': 'notifications',
  '/settings': 'settings',
};

const resolveInitialTab = () => {
  try {
    // 1. URL search param: ?tab=drivers
    const urlParams = new URLSearchParams(window.location.search);
    const queryTab = urlParams.get('tab');
    if (queryTab && TAB_PATH_MAP[queryTab]) {
      return queryTab;
    }

    // 2. URL hash: #/drivers or #drivers
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (rawHash) {
      if (TAB_PATH_MAP[rawHash]) return rawHash;
      const normalizedHash = '/' + rawHash.toLowerCase();
      if (PATH_TO_TAB_MAP[normalizedHash]) return PATH_TO_TAB_MAP[normalizedHash];
      if (PATH_TO_TAB_MAP[normalizedHash.replace(/-/g, '')]) return PATH_TO_TAB_MAP[normalizedHash.replace(/-/g, '')];
    }

    // 3. URL pathname: /drivers or /admin-portal/drivers
    const pathname = window.location.pathname.toLowerCase();
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    if (lastSegment) {
      const normalizedPath = '/' + lastSegment;
      if (PATH_TO_TAB_MAP[normalizedPath]) return PATH_TO_TAB_MAP[normalizedPath];
      if (PATH_TO_TAB_MAP[normalizedPath.replace(/-/g, '')]) return PATH_TO_TAB_MAP[normalizedPath.replace(/-/g, '')];
    }

    // 4. Cached active tab in localStorage
    const savedTab = localStorage.getItem('shedrive_admin_active_tab');
    if (savedTab && TAB_PATH_MAP[savedTab]) {
      return savedTab;
    }
  } catch (err) {
    console.warn('[Router] Failed to resolve initial tab:', err);
  }
  return 'dashboard';
};

export default function App() {
  const [token, setToken] = useState(getAuthToken());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTabState] = useState(resolveInitialTab);

  // Synchronized tab switcher that updates state, localStorage, and URL history
  const setActiveTab = useCallback((newTab) => {
    if (!TAB_PATH_MAP[newTab]) newTab = 'dashboard';
    setActiveTabState(newTab);
    try {
      localStorage.setItem('shedrive_admin_active_tab', newTab);
      const searchParams = new URLSearchParams(window.location.search);
      if (newTab === 'dashboard') {
        searchParams.delete('tab');
      } else {
        searchParams.set('tab', newTab);
      }
      const newQuery = searchParams.toString() ? `?${searchParams.toString()}` : '';
      const newUrl = `${window.location.pathname}${newQuery}`;
      window.history.replaceState({ tab: newTab }, '', newUrl);
    } catch (e) {
      console.warn('[Router] Error updating URL:', e);
    }
  }, []);

  // Listen to browser Back/Forward navigation and sync tab
  useEffect(() => {
    const handlePopState = () => {
      const currentTab = resolveInitialTab();
      setActiveTabState(currentTab);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    // Initial sync so URL reflects active tab on first load
    const initialTab = resolveInitialTab();
    setActiveTab(initialTab);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [setActiveTab]);
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    drivers: { page: 1, limit: 50, total: 0, totalPages: 1 },
    passengers: { page: 1, limit: 50, total: 0, totalPages: 1 },
    payments: { page: 1, limit: 50, total: 0, totalPages: 1 },
    feedback: { page: 1, limit: 50, total: 0, totalPages: 1 },
    auditLogs: { page: 1, limit: 50, total: 0, totalPages: 1 },
    supportTickets: { page: 1, limit: 50, total: 0, totalPages: 1 },
    deactivatedAccounts: { page: 1, limit: 50, total: 0, totalPages: 1 },
    rideHistory: { page: 1, limit: 50, total: 0, totalPages: 1 },
  });
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
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({
    total_feedback: 0,
    avg_rating: 5.0,
    driver_feedback_count: 0,
    passenger_feedback_count: 0,
  });
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState('');
  const [feedbackFilterCategory, setFeedbackFilterCategory] = useState('all');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsSearchQuery, setAuditLogsSearchQuery] = useState('');
  const [auditLogsFilterAction, setAuditLogsFilterAction] = useState('all');
  const [sosAlerts, setSOSAlerts] = useState([]);
  const [showSOSBanner, setShowSOSBanner] = useState(false);

  // Phase 7 States
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportTicketFilterStatus, setSupportTicketFilterStatus] = useState('all');
  const [supportTicketSearchQuery, setSupportTicketSearchQuery] = useState('');
  const [supportTicketScreenshotModal, setSupportTicketScreenshotModal] = useState(null);

  const [rideHistory, setRideHistory] = useState([]);
  const [rideHistoryFilterStatus, setRideHistoryFilterStatus] = useState('all');
  const [rideHistoryStartDate, setRideHistoryStartDate] = useState('');
  const [rideHistoryEndDate, setRideHistoryEndDate] = useState('');
  const [rideHistorySearchQuery, setRideHistorySearchQuery] = useState('');
  const [selectedRideDetails, setSelectedRideDetails] = useState(null);

  const [deactivatedAccounts, setDeactivatedAccounts] = useState([]);
  const [deactivatedSearchQuery, setDeactivatedSearchQuery] = useState('');
  const [reactivateConfirmModal, setReactivateConfirmModal] = useState(null);

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    body: '',
    target: 'all',
    userId: '',
    category: 'system',
  });
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [notificationConfirmModal, setNotificationConfirmModal] = useState(false);

  const [verificationDocFilter, setVerificationDocFilter] = useState('all'); // 'all' | 'new' | 're-review'

  // Phase 9 States
  const [sosInvestigateModal, setSosInvestigateModal] = useState(null);
  const [userWarningModal, setUserWarningModal] = useState(null);
  const [isSubmittingWarning, setIsSubmittingWarning] = useState(false);
  const [isSubmittingSOS, setIsSubmittingSOS] = useState(false);

  const [settings, setSettings] = useState({
    commission_pct: 7.0,
    sos_hotline: '+92 42 111 743 374',
    raast_id: '03001234567',
    raast_qr_url: '',
    bank_account_number: 'PK92MEZN0009988776655',
    iban: 'PK92MEZN000998877665544332211',
  });

  const [selectedDriverDocs, setSelectedDriverDocs] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null); // For image preview modal
  const [confirmModal, setConfirmModal] = useState(null); // { driverId, driverName, actionType: 'approve' | 'reject' | 'block' | 'unblock' }
  const [rejectionReason, setRejectionReason] = useState('');

  // Admin Credential Settings state
  const [credCurrentPassword, setCredCurrentPassword] = useState('');
  const [credNewEmail, setCredNewEmail] = useState('');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Ref for abort controllers
  const abortControllerRef = useRef(null);

  // Debounced search queries
  const debouncedVerificationSearch = useDebounce(verificationSearchQuery, 300);
  const debouncedDriverRosterSearch = useDebounce(driverRosterSearchQuery, 300);
  const debouncedPassengerSearch = useDebounce(passengerSearchQuery, 300);
  const debouncedPaymentSearch = useDebounce(paymentSearchQuery, 300);
  const debouncedFeedbackSearch = useDebounce(feedbackSearchQuery, 300);
  const debouncedAuditLogsSearch = useDebounce(auditLogsSearchQuery, 300);
  const debouncedSupportTicketSearch = useDebounce(supportTicketSearchQuery, 300);
  const debouncedRideHistorySearch = useDebounce(rideHistorySearchQuery, 300);
  const debouncedDeactivatedSearch = useDebounce(deactivatedSearchQuery, 300);

  // Fetch data based on active tab
  const fetchTabData = useCallback(async (showSpinner = true) => {
    if (!token) return;
    
    try {
      if (showSpinner) setIsLoadingData(true);
      
      // Always fetch stats and live rides (these are lightweight)
      const [statsData, liveRidesData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getLiveRides(),
      ]);
      
      setStats(statsData);
      setLiveRides(liveRidesData.liveRides || []);
      
      // Fetch tab-specific data
      switch (activeTab) {
        case 'dashboard':
          // Also fetch pending drivers for dashboard badge
          const pendingData = await adminApi.getPendingDrivers();
          setPendingDrivers(pendingData.pendingDrivers || []);
          break;
          
        case 'verification':
          const pendingDriversData = await adminApi.getPendingDrivers();
          setPendingDrivers(pendingDriversData.pendingDrivers || []);
          break;
          
        case 'drivers':
          const driversData = await adminApi.getDrivers({
            page: pagination.drivers.page,
            limit: pagination.drivers.limit,
            search: debouncedDriverRosterSearch,
            status: 'approved',
          });
          setVerifiedDrivers(driversData.drivers || []);
          if (driversData.pagination) {
            setPagination(prev => ({
              ...prev,
              drivers: driversData.pagination,
            }));
          }
          break;
          
        case 'rejected':
          const rejectedData = await adminApi.getDrivers({
            page: 1,
            limit: 100,
            status: 'rejected',
          });
          setRejectedDrivers(rejectedData.drivers || []);
          break;
          
        case 'passengers':
          const passengersData = await adminApi.getPassengers({
            page: pagination.passengers.page,
            limit: pagination.passengers.limit,
            search: debouncedPassengerSearch,
          });
          setPassengers(passengersData.passengers || []);
          if (passengersData.pagination) {
            setPagination(prev => ({
              ...prev,
              passengers: passengersData.pagination,
            }));
          }
          break;
          
        case 'rides':
          // Live rides already fetched above
          break;
          
        case 'settings':
          const settingsData = await adminApi.getSettings();
          setSettings(prev => settingsData.settings || prev);
          break;
          
        case 'payments':
          const [paymentsData, summaryData] = await Promise.all([
            adminApi.getPayments({
              page: pagination.payments.page,
              limit: pagination.payments.limit,
              status: paymentFilterStatus,
              search: debouncedPaymentSearch,
            }),
            adminApi.getPaymentSummary(),
          ]);
          setMonthlyPayments(paymentsData.payments || []);
          setPaymentSummary(summaryData);
          if (paymentsData.pagination) {
            setPagination(prev => ({
              ...prev,
              payments: paymentsData.pagination,
            }));
          }
          break;
          
        case 'feedback':
          const feedbackData = await adminApi.getFeedback({
            page: pagination.feedback.page,
            limit: pagination.feedback.limit,
            search: debouncedFeedbackSearch,
            category: feedbackFilterCategory,
          });
          setFeedbacks(feedbackData.feedbacks || []);
          if (feedbackData.stats) {
            setFeedbackStats(feedbackData.stats);
          }
          if (feedbackData.pagination) {
            setPagination(prev => ({
              ...prev,
              feedback: feedbackData.pagination,
            }));
          }
          break;

        case 'auditLogs':
          const auditLogsData = await adminApi.getAuditLogs({
            page: pagination.auditLogs.page,
            limit: pagination.auditLogs.limit,
            search: debouncedAuditLogsSearch,
            action: auditLogsFilterAction,
          });
          setAuditLogs(auditLogsData.logs || []);
          if (auditLogsData.pagination) {
            setPagination(prev => ({
              ...prev,
              auditLogs: auditLogsData.pagination,
            }));
          }
          break;

        case 'sosAlerts':
          const sosData = await adminApi.getSOSAlerts({ limit: 20 });
          setSOSAlerts(sosData.alerts || []);
          const activeSOS = sosData.alerts && sosData.alerts.filter(a => a.status === 'active').length > 0;
          setShowSOSBanner(activeSOS);
          break;

        case 'supportTickets':
          const ticketsData = await adminApi.getSupportTickets({
            page: pagination.supportTickets.page,
            limit: pagination.supportTickets.limit,
            search: debouncedSupportTicketSearch,
            status: supportTicketFilterStatus,
          });
          setSupportTickets(ticketsData.tickets || []);
          if (ticketsData.pagination) {
            setPagination(prev => ({
              ...prev,
              supportTickets: ticketsData.pagination,
            }));
          }
          break;

        case 'rideHistory':
          const historyData = await adminApi.getRideHistory({
            page: pagination.rideHistory.page,
            limit: pagination.rideHistory.limit,
            status: rideHistoryFilterStatus,
            startDate: rideHistoryStartDate ? new Date(rideHistoryStartDate).getTime().toString() : undefined,
            endDate: rideHistoryEndDate ? new Date(rideHistoryEndDate + 'T23:59:59').getTime().toString() : undefined,
          });
          setRideHistory(historyData.rides || []);
          if (historyData.pagination) {
            setPagination(prev => ({
              ...prev,
              rideHistory: historyData.pagination,
            }));
          }
          break;

        case 'deactivatedAccounts':
          const deactData = await adminApi.getDeactivatedAccounts({
            page: pagination.deactivatedAccounts.page,
            limit: pagination.deactivatedAccounts.limit,
            search: debouncedDeactivatedSearch,
          });
          setDeactivatedAccounts(deactData.deactivatedAccounts || []);
          if (deactData.pagination) {
            setPagination(prev => ({
              ...prev,
              deactivatedAccounts: deactData.pagination,
            }));
          }
          break;
      }
    } catch (err) {
      // 1. Ignore normal cancellation from debouncing or tab switching
      if (err?.message === 'Request cancelled') {
        return;
      }
      
      // 2. Handle unauthorized / session expiry smoothly
      if (err?.message && (err.message.includes('Session expired') || err.message.includes('unauthorized') || err.message.includes('401'))) {
        setToken('');
        clearAuthToken();
        addToast('Your session has expired. Please log in again.', 'warning');
        return;
      }

      console.error('Admin API fetch error:', err);
      // 3. Only show error toast on real unexpected network failures
      if (err?.message && !err.message.includes('Failed to fetch')) {
        addToast(err.message, 'error');
      } else {
        addToast('Server connection failed. Please check your internet connection.', 'error');
      }
    } finally {
      if (showSpinner) setIsLoadingData(false);
    }
  }, [token, activeTab, pagination, paymentFilterStatus, feedbackFilterCategory, auditLogsFilterAction, supportTicketFilterStatus, rideHistoryFilterStatus, rideHistoryStartDate, rideHistoryEndDate, debouncedDriverRosterSearch, debouncedPassengerSearch, debouncedPaymentSearch, debouncedFeedbackSearch, debouncedAuditLogsSearch, debouncedSupportTicketSearch, debouncedRideHistorySearch, debouncedDeactivatedSearch, addToast]);

  // Fetch on mount and tab change
  useEffect(() => {
    fetchTabData(true);
  }, [activeTab, token]);

  // Poll only live data (stats and live rides) every 5 seconds
  useEffect(() => {
    if (!token) return;
    
    const interval = setInterval(async () => {
      try {
        const [statsData, liveRidesData] = await Promise.all([
          adminApi.getStats(),
          adminApi.getLiveRides(),
        ]);
        setStats(statsData);
        setLiveRides(liveRidesData.liveRides || []);
      } catch (err) {
        console.error('Live data refresh error:', err);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [token]);

  // Refetch when debounced search changes
  useEffect(() => {
    if (activeTab === 'drivers' && debouncedDriverRosterSearch !== driverRosterSearchQuery) {
      setPagination(prev => ({ ...prev, drivers: { ...prev.drivers, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedDriverRosterSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'passengers' && debouncedPassengerSearch !== passengerSearchQuery) {
      setPagination(prev => ({ ...prev, passengers: { ...prev.passengers, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedPassengerSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'payments' && debouncedPaymentSearch !== paymentSearchQuery) {
      setPagination(prev => ({ ...prev, payments: { ...prev.payments, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedPaymentSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'feedback' && debouncedFeedbackSearch !== feedbackSearchQuery) {
      setPagination(prev => ({ ...prev, feedback: { ...prev.feedback, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedFeedbackSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'auditLogs' && debouncedAuditLogsSearch !== auditLogsSearchQuery) {
      setPagination(prev => ({ ...prev, auditLogs: { ...prev.auditLogs, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedAuditLogsSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'supportTickets' && debouncedSupportTicketSearch !== supportTicketSearchQuery) {
      setPagination(prev => ({ ...prev, supportTickets: { ...prev.supportTickets, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedSupportTicketSearch, activeTab]);

  useEffect(() => {
    if (activeTab === 'deactivatedAccounts' && debouncedDeactivatedSearch !== deactivatedSearchQuery) {
      setPagination(prev => ({ ...prev, deactivatedAccounts: { ...prev.deactivatedAccounts, page: 1 } }));
      fetchTabData(false);
    }
  }, [debouncedDeactivatedSearch, activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await adminApi.login(loginEmail.trim(), loginPassword);
      if (res.token) {
        setAuthToken(res.token);
        setToken(res.token);
        addToast('Welcome back, Admin!', 'success');
        const currentTab = resolveInitialTab();
        setActiveTab(currentTab);
      } else {
        setLoginError(res.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setLoginError(err.message || 'Failed to connect to server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setToken('');
    addToast('Logged out successfully', 'info');
  };

  // Helper function to get action color for audit logs
  const getActionColor = (action) => {
    const actionColors = {
      'APPROVE_DRIVER': '#10B981',
      'REJECT_DRIVER': '#EF4444',
      'BLOCK_DRIVER': '#F59E0B',
      'UNBLOCK_DRIVER': '#10B981',
      'BLOCK_PASSENGER': '#F59E0B',
      'UNBLOCK_PASSENGER': '#10B981',
      'UPDATE_SETTINGS': '#3B82F6',
    };
    return actionColors[action] || '#7E8299';
  };

  const executeVerifyDriver = async (driverId, approve, reason) => {
    try {
      const res = await adminApi.verifyDriver(driverId, approve, reason || (approve ? undefined : rejectionReason));
      addToast(res.message || (approve ? 'Driver approved successfully!' : 'Driver application rejected'), 'success');
      setSelectedDriverDocs(null);
      setConfirmModal(null);
      setRejectionReason('');
      fetchTabData(true);
    } catch (err) {
      addToast(err.message || 'Failed to update driver status', 'error');
    }
  };

  const executeBlockDriver = async (driverId, block) => {
    try {
      const res = await adminApi.blockDriver(driverId, block);
      addToast(res.message || `Driver account ${block ? 'suspended' : 'reactivated'} successfully!`, 'success');
      setConfirmModal(null);
      fetchTabData(true);
    } catch (err) {
      addToast(err.message || 'Failed to update driver status', 'error');
    }
  };

  const executeBlockPassenger = async (passengerId, block) => {
    try {
      const res = await adminApi.blockPassenger(passengerId, block);
      addToast(res.message || `Passenger account ${block ? 'suspended' : 'reactivated'} successfully!`, 'success');
      setConfirmModal(null);
      fetchTabData(true);
    } catch (err) {
      addToast(err.message || 'Failed to update passenger status', 'error');
    }
  };

  const handleReviewPaymentSubmit = async () => {
    if (!paymentReviewModal) return;
    try {
      const res = await adminApi.reviewPayment(paymentReviewModal.id, paymentReviewModal.action, adminPaymentNotes);
      addToast(res.message || 'Payment review status saved successfully!', 'success');
      setPaymentReviewModal(null);
      setAdminPaymentNotes('');
      fetchTabData(true);
    } catch (err) {
      console.error('Review payment error:', err);
      addToast(err.message || 'Failed to save payment status', 'error');
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
          h1 { color: #0D9488; border-bottom: 2px solid #0D9488; padding-bottom: 8px; }
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
            ${(driver.cnic_front_url || driver.cnicFrontUrl) ? `<img class="doc-img" src="${driver.cnic_front_url || driver.cnicFrontUrl}" />` : `<div class="no-img">Not Provided</div>`}
          </div>
          <div class="doc-card">
            <div class="doc-title">CNIC Back</div>
            ${(driver.cnic_back_url || driver.cnicBackUrl) ? `<img class="doc-img" src="${driver.cnic_back_url || driver.cnicBackUrl}" />` : `<div class="no-img">Not Provided</div>`}
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
      addToast('Platform Commission must be between 0 and 100%', 'warning');
      return;
    }
    
    if (!settings.sos_hotline || !settings.sos_hotline.trim()) {
      addToast('Emergency SOS Number is required', 'warning');
      return;
    }
    
    try {
      const res = await adminApi.saveSettings({
        commissionPct: settings.commission_pct,
        sosHotline: settings.sos_hotline,
        raastId: settings.raast_id,
        raastQrUrl: settings.raast_qr_url,
        bankAccountNumber: settings.bank_account_number,
        iban: settings.iban,
      });
      addToast(res.message || 'Platform settings saved successfully!', 'success');
      fetchTabData(true);
    } catch (err) {
      addToast(err.message || 'Failed to save settings', 'error');
    }
  };

  // Handle Admin Credential Update
  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    if (!credCurrentPassword) {
      addToast('Please enter your current password to verify authorization.', 'warning');
      return;
    }
    if (!credNewEmail.trim() && !credNewPassword) {
      addToast('Please enter a new email or password to update.', 'warning');
      return;
    }
    if (credNewPassword && credNewPassword.length < 6) {
      addToast('New password must be at least 6 characters long.', 'warning');
      return;
    }
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      addToast('New password and confirm password do not match.', 'warning');
      return;
    }
    setCredLoading(true);
    try {
      const res = await adminApi.updateCredentials({
        currentPassword: credCurrentPassword,
        newEmail: credNewEmail.trim() || undefined,
        newPassword: credNewPassword || undefined,
      });
      addToast(res.message || 'Admin credentials updated! Please re-login with your new credentials.', 'success');
      setCredCurrentPassword('');
      setCredNewEmail('');
      setCredNewPassword('');
      setCredConfirmPassword('');
      handleLogout();
    } catch (err) {
      addToast(err.message || 'Failed to update credentials', 'error');
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
            📊 Command Dashboard
          </button>
          <button
            style={activeTab === 'analytics' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Operational Intelligence
          </button>
          <button
            style={activeTab === 'systemHealth' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('systemHealth')}
          >
            🩺 System Health
          </button>
          <button
            style={activeTab === 'compliance' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('compliance')}
          >
            📋 Driver Compliance
          </button>
          <button
            style={activeTab === 'disputes' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('disputes')}
          >
            ⚖️ Ride Disputes
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
            style={activeTab === 'sosAlerts' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('sosAlerts')}
          >
            🚨 SOS Alerts {showSOSBanner ? '(ACTIVE)' : ''}
          </button>
          <button
            style={activeTab === 'auditLogs' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('auditLogs')}
          >
            📋 Audit Logs
          </button>
          <button
            style={activeTab === 'feedback' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('feedback')}
          >
            💬 Feedback ({feedbackStats.total_feedback})
          </button>
          <button
            style={activeTab === 'supportTickets' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('supportTickets')}
          >
            🎫 Support Tickets
          </button>
          <button
            style={activeTab === 'rideHistory' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('rideHistory')}
          >
            📜 Ride History
          </button>
          <button
            style={activeTab === 'deactivatedAccounts' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('deactivatedAccounts')}
          >
            🔒 Deactivated Accounts
          </button>
          <button
            style={activeTab === 'notifications' ? styles.navItemActive : styles.navItem}
            onClick={() => setActiveTab('notifications')}
          >
            📢 Send Notifications
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
              {activeTab === 'analytics' && 'Operational Intelligence & Analytics'}
              {activeTab === 'systemHealth' && 'System Health & Infrastructure Diagnostics'}
              {activeTab === 'compliance' && 'Driver Compliance & Document Expiry'}
              {activeTab === 'disputes' && 'Ride Dispute & Complaint Resolution'}
              {activeTab === 'verification' && 'Driver Document Verification Center'}
              {activeTab === 'drivers' && 'Approved Driver Roster'}
              {activeTab === 'rejected' && 'Rejected Driver Applications'}
              {activeTab === 'passengers' && 'Registered Passenger Directory'}
              {activeTab === 'rides' && 'Live Ride Dispatch Monitor'}
              {activeTab === 'payments' && 'Monthly Platform Fee & Payment Approvals'}
              {activeTab === 'sosAlerts' && 'Emergency SOS Alerts'}
              {activeTab === 'auditLogs' && 'Admin Audit Logs'}
              {activeTab === 'feedback' && 'User Feedback & Reviews'}
              {activeTab === 'supportTickets' && 'Support & Problem Dispute Tickets'}
              {activeTab === 'rideHistory' && 'Historical Ride Records & Analytics'}
              {activeTab === 'deactivatedAccounts' && 'Deactivated User Accounts & Reactivation'}
              {activeTab === 'notifications' && 'Broadcast & Direct User Notifications'}
              {activeTab === 'settings' && 'System Configuration'}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={styles.cardHeader}>Pending Female Driver Applications ({pendingDrivers.length})</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E4E6EF',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: verificationDocFilter === 'all' ? '#4A2060' : '#F9F9F9',
                      color: verificationDocFilter === 'all' ? '#FFFFFF' : '#5E6278',
                    }}
                    onClick={() => setVerificationDocFilter('all')}
                  >
                    All ({pendingDrivers.length})
                  </button>
                  <button
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E4E6EF',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: verificationDocFilter === 'new' ? '#4A2060' : '#F9F9F9',
                      color: verificationDocFilter === 'new' ? '#FFFFFF' : '#5E6278',
                    }}
                    onClick={() => setVerificationDocFilter('new')}
                  >
                    🆕 New ({pendingDrivers.filter(d => !d.is_verified).length})
                  </button>
                  <button
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E4E6EF',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: verificationDocFilter === 'rereview' ? '#E83D98' : '#F9F9F9',
                      color: verificationDocFilter === 'rereview' ? '#FFFFFF' : '#5E6278',
                    }}
                    onClick={() => setVerificationDocFilter('rereview')}
                  >
                    🔄 Re-Review ({pendingDrivers.filter(d => d.is_verified).length})
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search by Name, Phone, Email, CNIC, or ID..."
                value={verificationSearchQuery}
                onChange={(e) => setVerificationSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '320px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>
            {pendingDrivers
              .filter(d => {
                if (verificationDocFilter === 'new' && d.is_verified) return false;
                if (verificationDocFilter === 'rereview' && !d.is_verified) return false;
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
                    <th>Type</th>
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
                      if (verificationDocFilter === 'new' && d.is_verified) return false;
                      if (verificationDocFilter === 'rereview' && !d.is_verified) return false;
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
                      <td>
                        <strong>{driver.name}</strong>
                      </td>
                      <td>
                        {driver.is_verified ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#FDF2F8',
                            color: '#BE185D',
                            border: '1px solid #FBCFE8',
                          }}>
                            🔄 Re-Review
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                          }}>
                            🆕 New
                          </span>
                        )}
                      </td>
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
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#FEF3C7',
                              color: '#D97706',
                              border: '1px solid #FDE68A',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setUserWarningModal({
                                user: { id: d.id, name: d.name, role: 'driver', phone: d.phone },
                                warningType: 'cancellation_rate',
                                message: '',
                              })
                            }
                          >
                            ⚠️ Warn
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <PaginationBar
              currentPage={pagination.drivers.page}
              totalPages={pagination.drivers.totalPages}
              totalRecords={pagination.drivers.total}
              limit={pagination.drivers.limit}
              onPageChange={(p) => setPagination(prev => ({ ...prev, drivers: { ...prev.drivers, page: p } }))}
            />
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
                      return (p?.name || '').toLowerCase().includes(q) ||
                             (p?.email || '').toLowerCase().includes(q) ||
                             (p?.phone || '').toLowerCase().includes(q) ||
                             String(p?.id || '').toLowerCase().includes(q);
                    })
                    .map((p, idx) => (
                    <tr key={p?.id || `pass_${idx}`}>
                      <td>#{p?.id ? String(p.id).substring(0, 8) : 'N/A'}</td>
                      <td><strong>{p?.name || 'Unnamed Passenger'}</strong></td>
                      <td>{p?.email || 'N/A'}</td>
                      <td>{p?.phone || 'N/A'}</td>
                      <td>{p?.cnic || 'N/A'}</td>
                      <td>{p?.total_rides || 0}</td>
                      <td>
                        {p?.is_blocked ? (
                          <span style={styles.statusRed}>Blocked</span>
                        ) : (
                          <span style={styles.statusGreen}>Active</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#FEF3C7',
                              color: '#D97706',
                              border: '1px solid #FDE68A',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setUserWarningModal({
                                user: { id: p?.id, name: p?.name || 'Passenger', role: 'passenger', phone: p?.phone || '' },
                                warningType: 'cancellation_rate',
                                message: '',
                              })
                            }
                          >
                            ⚠️ Warn
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <PaginationBar
              currentPage={pagination.passengers.page}
              totalPages={pagination.passengers.totalPages}
              totalRecords={pagination.passengers.total}
              limit={pagination.passengers.limit}
              onPageChange={(p) => setPagination(prev => ({ ...prev, passengers: { ...prev.passengers, page: p } }))}
            />
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
            <div style={{ marginBottom: '24px' }}>
              <h3 style={styles.cardHeader}>System Settings &amp; Security</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Manage administrator credentials, operational platform commission, and emergency SOS hotline.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Section 1: Admin Credentials Update */}
              <div style={{ backgroundColor: '#F8F9FA', padding: '24px', borderRadius: '16px', border: '1px solid #E4E6EF' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#181C32', fontWeight: '800' }}>🔑 Section 1: Admin Account Credentials &amp; Security</h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#7E8299', lineHeight: 1.5 }}>
                  Update your Admin Portal login email or password. You must enter your current password to verify authorization. After updating, you will be logged out and must re-login with your new credentials.
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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
                        placeholder="Enter new password (min 6 chars)"
                        value={credNewPassword}
                        onChange={(e) => setCredNewPassword(e.target.value)}
                        style={styles.input}
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={credConfirmPassword}
                        onChange={(e) => setCredConfirmPassword(e.target.value)}
                        style={styles.input}
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <button
                      type="submit"
                      disabled={credLoading}
                      style={{
                        ...styles.btnSave,
                        background: 'linear-gradient(135deg, #6366F1 0%, #0D9488 100%)',
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

              {/* Section 2: Platform Commission & Emergency SOS Configuration */}
              <div style={{ backgroundColor: '#F8F9FA', padding: '24px', borderRadius: '16px', border: '1px solid #E4E6EF' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#181C32', fontWeight: '800' }}>⚙️ Section 2: Platform Commission &amp; Emergency SOS Configuration</h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#7E8299', lineHeight: 1.5 }}>
                  Configure the dynamic platform commission rate percentage, primary emergency SOS hotline, and bank settlement instructions for drivers.
                </p>
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={styles.label}>Platform Commission (%) <span style={{ color: '#EF4444' }}>*</span></label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={settings.commission_pct}
                        onChange={(e) => setSettings({ ...settings, commission_pct: parseFloat(e.target.value) || 0 })}
                        style={styles.input}
                        required
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Emergency SOS Number <span style={{ color: '#EF4444' }}>*</span></label>
                      <input
                        type="text"
                        value={settings.sos_hotline}
                        onChange={(e) => setSettings({ ...settings, sos_hotline: e.target.value })}
                        style={styles.input}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E4E6EF', paddingTop: '16px', marginTop: '4px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#3F4254', fontWeight: '700' }}>💳 Driver Monthly Fee Payment Details (Raast &amp; Bank)</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={styles.label}>Raast ID</label>
                        <input
                          type="text"
                          value={settings.raast_id || ''}
                          onChange={(e) => setSettings({ ...settings, raast_id: e.target.value })}
                          placeholder="e.g. 03001234567 or raast@shedrive"
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Bank Account Number</label>
                        <input
                          type="text"
                          value={settings.bank_account_number || ''}
                          onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value })}
                          placeholder="e.g. PK92MEZN0009988776655"
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.label}>IBAN</label>
                        <input
                          type="text"
                          value={settings.iban || ''}
                          onChange={(e) => setSettings({ ...settings, iban: e.target.value })}
                          placeholder="e.g. PK92MEZN000998877665544332211"
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Raast QR Image URL (Optional)</label>
                        <input
                          type="text"
                          value={settings.raast_qr_url || ''}
                          onChange={(e) => setSettings({ ...settings, raast_qr_url: e.target.value })}
                          placeholder="https://.../raast-qr.png"
                          style={styles.input}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" style={styles.btnSave}>
                      💾 Save Platform Settings
                    </button>
                  </div>
                </form>
              </div>
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
                  <p style={styles.metricLabel}>Total Platform Revenue (7%)</p>
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

              {monthlyPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7E8299' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>💳</span>
                  <strong style={{ fontSize: '16px', color: '#3F4254' }}>No Monthly Fee Payments Found</strong>
                  <p style={{ fontSize: '13px', marginTop: '6px' }}>
                    When drivers complete rides and settle their monthly platform fees, fee slips will appear here for review.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Driver Info</th>
                        <th>Vehicle Plate</th>
                        <th>Month</th>
                        <th>Completed Rides</th>
                        <th>Total Earnings</th>
                        <th>7% Platform Fee</th>
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
                            <td><strong style={{ color: '#0D9488' }}>PKR {parseFloat(p.platform_fee).toLocaleString()}</strong></td>
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
              )}
              <PaginationBar
                currentPage={pagination.payments.page}
                totalPages={pagination.payments.totalPages}
                totalRecords={pagination.payments.total}
                limit={pagination.payments.limit}
                onPageChange={(p) => setPagination(prev => ({ ...prev, payments: { ...prev.payments, page: p } }))}
              />
            </div>
          </div>
        )}

        {/* FEEDBACK & SUGGESTIONS TAB */}
        {activeTab === 'feedback' && (
          <div style={styles.tabContent}>
            <div style={styles.pageHeader}>
              <div>
                <h2 style={styles.pageTitle}>User & Driver Feedbacks 💬</h2>
                <p style={styles.pageSubtitle}>
                  Real-time reviews, suggestions, and feature requests submitted directly through the mobile app.
                </p>
              </div>
            </div>

            {/* Feedback Metric Stats */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statIcon}>⭐</span>
                <div>
                  <h3 style={styles.statValue}>{feedbackStats.avg_rating || '5.0'} / 5</h3>
                  <p style={styles.statLabel}>Average Community Rating</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>💬</span>
                <div>
                  <h3 style={styles.statValue}>{feedbackStats.total_feedback || feedbacks.length}</h3>
                  <p style={styles.statLabel}>Total Submissions</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>👩</span>
                <div>
                  <h3 style={styles.statValue}>{feedbackStats.passenger_feedback_count || 0}</h3>
                  <p style={styles.statLabel}>Passenger Reviews</p>
                </div>
              </div>

              <div style={styles.statCard}>
                <span style={styles.statIcon}>🚘</span>
                <div>
                  <h3 style={styles.statValue}>{feedbackStats.driver_feedback_count || 0}</h3>
                  <p style={styles.statLabel}>Driver Partner Reviews</p>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '180px' }}>
                <select
                  value={feedbackFilterCategory}
                  onChange={(e) => setFeedbackFilterCategory(e.target.value)}
                  style={{ ...styles.input, padding: '8px 14px', borderRadius: '10px' }}
                >
                  <option value="all">All Categories</option>
                  <option value="General Suggestion">General Suggestion</option>
                  <option value="App Performance">App Performance</option>
                  <option value="Safety & Security">Safety & Security</option>
                  <option value="Fare & Bidding">Fare & Bidding</option>
                  <option value="Driver Experience">Driver Experience</option>
                  <option value="New Feature Idea">New Feature Idea</option>
                </select>
              </div>

              <div style={{ flex: 1, maxWidth: '380px' }}>
                <input
                  type="text"
                  placeholder="Search by User Name, Phone, Email, or Comment..."
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  style={{ ...styles.input, padding: '8px 14px', borderRadius: '10px' }}
                />
              </div>
            </div>

            {/* Feedback Cards & Table */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={styles.cardHeader}>Recent Community Feedback</h3>
                <span style={{ fontSize: '13px', color: '#7E8299', fontWeight: '600' }}>
                  Showing {
                    feedbacks.filter(f => {
                      if (feedbackFilterCategory !== 'all' && f.category !== feedbackFilterCategory) return false;
                      if (feedbackSearchQuery.trim()) {
                        const q = feedbackSearchQuery.toLowerCase();
                        const name = (f.user_name || '').toLowerCase();
                        const phone = (f.user_phone || '').toLowerCase();
                        const email = (f.user_email || '').toLowerCase();
                        const comment = (f.comment || '').toLowerCase();
                        return name.includes(q) || phone.includes(q) || email.includes(q) || comment.includes(q);
                      }
                      return true;
                    }).length
                  } submissions
                </span>
              </div>

              {feedbacks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7E8299' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>💬</span>
                  <strong style={{ fontSize: '16px', color: '#3F4254' }}>No Feedback Submitted Yet</strong>
                  <p style={{ fontSize: '13px', marginTop: '6px' }}>
                    When riders or drivers submit feedback through the app, their reviews and suggestions will appear here.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>User Profile</th>
                        <th>Role</th>
                        <th>Rating</th>
                        <th>Topic</th>
                        <th>Feedback Message</th>
                        <th>Device / Version</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedbacks
                        .filter(f => {
                          if (feedbackFilterCategory !== 'all' && f.category !== feedbackFilterCategory) return false;
                          if (feedbackSearchQuery.trim()) {
                            const q = feedbackSearchQuery.toLowerCase();
                            const name = (f.user_name || '').toLowerCase();
                            const phone = (f.user_phone || '').toLowerCase();
                            const email = (f.user_email || '').toLowerCase();
                            const comment = (f.comment || '').toLowerCase();
                            return name.includes(q) || phone.includes(q) || email.includes(q) || comment.includes(q);
                          }
                          return true;
                        })
                        .map((f) => {
                          const dev = formatUserAgentBadge(f.device_info);
                          return (
                          <tr key={f.id}>
                            <td>
                              <strong style={{ color: '#181C32' }}>{f.user_name || 'Community Member'}</strong>
                              <div style={{ fontSize: '12px', color: '#7E8299' }}>
                                {f.user_phone ? f.user_phone : (f.user_email ? f.user_email : 'Website Visitor')}
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  color: '#FFFFFF',
                                  backgroundColor: f.user_role === 'driver' ? '#6366F1' : (f.user_role === 'passenger' ? '#0D9488' : '#64748B'),
                                }}
                              >
                                {f.user_role === 'driver' ? '🚘 DRIVER' : (f.user_role === 'passenger' ? '👩 PASSENGER' : '🌐 VISITOR')}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#FFB800', fontSize: '16px', fontWeight: '800' }}>
                                {'★'.repeat(f.rating || 5)}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  backgroundColor: '#F3F6F9',
                                  color: '#3F4254',
                                }}
                              >
                                {f.category || 'General'}
                              </span>
                            </td>
                            <td style={{ maxWidth: '340px' }}>
                              <p style={{ margin: 0, fontSize: '13px', color: '#3F4254', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {f.comment}
                              </p>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  backgroundColor: dev.bg,
                                  color: dev.color,
                                }}
                                title={f.device_info || 'Unknown device'}
                              >
                                <span>{dev.icon}</span>
                                <span>{dev.label}</span>
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#7E8299' }}>
                                {f.created_at ? new Date(Number(f.created_at)).toLocaleString() : 'Recent'}
                              </span>
                            </td>
                          </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar
                currentPage={pagination.feedback.page}
                totalPages={pagination.feedback.totalPages}
                totalRecords={pagination.feedback.total}
                limit={pagination.feedback.limit}
                onPageChange={(p) => setPagination(prev => ({ ...prev, feedback: { ...prev.feedback, page: p } }))}
              />
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === 'auditLogs' && (
          <div style={styles.tabContent}>
            <div style={styles.pageHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#181C32' }}>Audit Logs</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7E8299' }}>
                  Track all admin actions including approvals, rejections, blocks, and settings updates.
                </p>
              </div>
            </div>

            <div style={styles.filterBar}>
              <input
                type="text"
                placeholder="Search by action, details, or admin email..."
                value={auditLogsSearchQuery}
                onChange={(e) => setAuditLogsSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              <select
                value={auditLogsFilterAction}
                onChange={(e) => setAuditLogsFilterAction(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Actions</option>
                <option value="APPROVE_DRIVER">Approve Driver</option>
                <option value="REJECT_DRIVER">Reject Driver</option>
                <option value="BLOCK_DRIVER">Block Driver</option>
                <option value="BLOCK_PASSENGER">Block Passenger</option>
                <option value="UPDATE_SETTINGS">Update Settings</option>
              </select>
            </div>

            {auditLogs.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Audit Logs Found</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
                  Audit logs will appear here as you perform admin actions.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {log.timestamp ? new Date(Number(log.timestamp)).toLocaleString() : 'Recent'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32' }}>{log.admin_name || 'Admin'}</strong>
                          {log.admin_email && <div style={{ fontSize: '11px', color: '#7E8299' }}>{log.admin_email}</div>}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              backgroundColor: getActionColor(log.action),
                              color: '#FFFFFF',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ maxWidth: '400px' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: '#3F4254', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {log.details}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationBar
              currentPage={pagination.auditLogs.page}
              totalPages={pagination.auditLogs.totalPages}
              totalRecords={pagination.auditLogs.total}
              limit={pagination.auditLogs.limit}
              onPageChange={(p) => setPagination(prev => ({ ...prev, auditLogs: { ...prev.auditLogs, page: p } }))}
            />
          </div>
        )}

        {/* SOS Alerts Tab */}
        {activeTab === 'sosAlerts' && (
          <div>
            <div style={styles.pageHeader}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>Emergency SOS Alerts</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Real-time emergency alerts from passengers and drivers
              </p>
            </div>

            {sosAlerts.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚨</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Active SOS Alerts</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
                  Emergency alerts will appear here when users trigger SOS.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Ride ID</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sosAlerts.map((alert) => (
                      <tr key={alert.id} style={alert.status === 'active' ? { backgroundColor: '#FEF2F2' } : {}}>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {alert.created_at ? new Date(Number(alert.created_at)).toLocaleString() : 'Recent'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32' }}>{alert.user_name || 'Unknown'}</strong>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: alert.user_role === 'driver' ? '#E3F2FD' : '#FCE4EC',
                            color: alert.user_role === 'driver' ? '#1565C0' : '#C2185B',
                          }}>
                            {alert.user_role || 'passenger'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#3F4254' }}>
                            {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {alert.ride_id || 'None'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: alert.status === 'active' ? '#FEE2E2' : '#D1FAE5',
                            color: alert.status === 'active' ? '#DC2626' : '#059669',
                          }}>
                            {alert.status}
                          </span>
                        </td>
                        <td>
                          {alert.status === 'active' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setSosInvestigateModal({
                                  alert,
                                  severity: 'medium',
                                  resolutionNotes: '',
                                  policeContacted: false,
                                })}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#7C3AED',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                }}
                              >
                                🔍 Investigate
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await adminApi.resolveSOSAlert(alert.id);
                                    addToast('SOS alert resolved', 'success');
                                    fetchTabData(false);
                                  } catch (err) {
                                    addToast('Failed to resolve SOS alert', 'error');
                                  }
                                }}
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#059669',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                              >
                                Quick Resolve
                              </button>
                            </div>
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

        {/* Phase 7 Tab 1: Support Tickets Tab */}
        {activeTab === 'supportTickets' && (
          <div>
            <div style={styles.pageHeader}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>Support & Problem Tickets</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Manage user complaints, disputes, safety inquiries, and support tickets
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'open', 'in_progress', 'resolved'].map((st) => (
                  <button
                    key={st}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E4E6EF',
                      fontSize: '12px',
                      fontWeight: '700',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                      backgroundColor: supportTicketFilterStatus === st ? '#4A2060' : '#FFFFFF',
                      color: supportTicketFilterStatus === st ? '#FFFFFF' : '#5E6278',
                    }}
                    onClick={() => {
                      setSupportTicketFilterStatus(st);
                      setPagination(prev => ({ ...prev, supportTickets: { ...prev.supportTickets, page: 1 } }));
                    }}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search by Subject, Category, User, or Email..."
                value={supportTicketSearchQuery}
                onChange={(e) => setSupportTicketSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '320px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>

            {supportTickets.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎫</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Support Tickets Found</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
                  Support tickets submitted via the mobile app will appear here.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>User</th>
                      <th>Category</th>
                      <th>Subject & Message</th>
                      <th>Attachment</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportTickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4A2060' }}>
                            #{ticket.id ? ticket.id.substring(0, 8) : 'TICKET'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32', display: 'block' }}>{ticket.user_name || 'User'}</strong>
                          <span style={{ fontSize: '11px', color: '#7E8299' }}>{ticket.user_phone || ticket.user_email || ticket.user_id}</span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#F3E8FF',
                            color: '#7E22CE',
                          }}>
                            {ticket.category || 'General'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '280px' }}>
                          <strong style={{ fontSize: '13px', color: '#181C32', display: 'block', marginBottom: '2px' }}>
                            {ticket.subject}
                          </strong>
                          <p style={{ margin: 0, fontSize: '12px', color: '#5E6278', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticket.message}
                          </p>
                        </td>
                        <td>
                          {ticket.screenshot_url ? (
                            <button
                              onClick={() => setSupportTicketScreenshotModal(ticket.screenshot_url)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#EFF6FF',
                                color: '#2563EB',
                                border: '1px solid #BFDBFE',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                            >
                              🖼️ View Image
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#A1A5B7' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {ticket.created_at ? new Date(Number(ticket.created_at)).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor:
                              ticket.status === 'resolved' ? '#D1FAE5' :
                              ticket.status === 'in_progress' ? '#FEF3C7' : '#FEE2E2',
                            color:
                              ticket.status === 'resolved' ? '#059669' :
                              ticket.status === 'in_progress' ? '#D97706' : '#DC2626',
                          }}>
                            {ticket.status}
                          </span>
                        </td>
                        <td>
                          <select
                            value={ticket.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                await adminApi.updateTicketStatus(ticket.id, newStatus);
                                addToast(`Ticket status updated to ${newStatus}`, 'success');
                                fetchTabData(false);
                              } catch (err) {
                                addToast(err.message || 'Failed to update ticket status', 'error');
                              }
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #E4E6EF',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  currentPage={pagination.supportTickets.page}
                  totalPages={pagination.supportTickets.totalPages}
                  totalItems={pagination.supportTickets.total}
                  itemsPerPage={pagination.supportTickets.limit}
                  onPageChange={(page) => {
                    setPagination(prev => ({ ...prev, supportTickets: { ...prev.supportTickets, page } }));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Phase 7 Tab 2: Ride History Tab */}
        {activeTab === 'rideHistory' && (
          <div>
            <div style={styles.pageHeader}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>Completed & Cancelled Ride Archive</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Search and audit historical passenger trips, completed fares, and cancellation reasons
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {['all', 'completed', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E4E6EF',
                      fontSize: '12px',
                      fontWeight: '700',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                      backgroundColor: rideHistoryFilterStatus === st ? '#4A2060' : '#FFFFFF',
                      color: rideHistoryFilterStatus === st ? '#FFFFFF' : '#5E6278',
                    }}
                    onClick={() => {
                      setRideHistoryFilterStatus(st);
                      setPagination(prev => ({ ...prev, rideHistory: { ...prev.rideHistory, page: 1 } }));
                    }}
                  >
                    {st}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#7E8299', fontWeight: '600' }}>From:</span>
                  <input
                    type="date"
                    value={rideHistoryStartDate}
                    onChange={(e) => setRideHistoryStartDate(e.target.value)}
                    style={{ ...styles.input, padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                  />
                  <span style={{ fontSize: '12px', color: '#7E8299', fontWeight: '600' }}>To:</span>
                  <input
                    type="date"
                    value={rideHistoryEndDate}
                    onChange={(e) => setRideHistoryEndDate(e.target.value)}
                    style={{ ...styles.input, padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                  />
                </div>
              </div>
            </div>

            {rideHistory.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📜</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Historical Rides Found</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
                  Completed and cancelled rides will be archived here.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Ride ID</th>
                      <th>Passenger</th>
                      <th>Driver</th>
                      <th>Tier</th>
                      <th>Pickup → Destination</th>
                      <th>Fare</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rideHistory.map((ride) => (
                      <tr key={ride.ride_id}>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4A2060' }}>
                            #{ride.ride_id ? ride.ride_id.substring(0, 8) : 'RIDE'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32', display: 'block' }}>{ride.passenger_name || 'Passenger'}</strong>
                          <span style={{ fontSize: '11px', color: '#7E8299' }}>{ride.passenger_phone || ''}</span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32', display: 'block' }}>{ride.driver_name || 'Unassigned'}</strong>
                          <span style={{ fontSize: '11px', color: '#7E8299' }}>{ride.driver_phone || ''}</span>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#E0E7FF',
                            color: '#3730A3',
                          }}>
                            {ride.vehicle_category || 'Sedan'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '240px' }}>
                          <div style={{ fontSize: '12px', color: '#181C32', fontWeight: '600' }}>
                            📍 {ride.pickup_address || `${ride.pickup_latitude?.toFixed(3)}, ${ride.pickup_longitude?.toFixed(3)}`}
                          </div>
                          <div style={{ fontSize: '12px', color: '#5E6278' }}>
                            🎯 {ride.dropoff_address || `${ride.dropoff_latitude?.toFixed(3)}, ${ride.dropoff_longitude?.toFixed(3)}`}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#10B981', fontSize: '14px' }}>
                            PKR {ride.final_fare || ride.offered_fare || ride.estimated_fare || 0}
                          </strong>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                          }}>
                            {ride.payment_method || 'Cash'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: ride.status === 'completed' ? '#D1FAE5' : '#FEE2E2',
                            color: ride.status === 'completed' ? '#059669' : '#DC2626',
                          }}>
                            {ride.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {ride.created_at ? new Date(Number(ride.created_at)).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedRideDetails(ride)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#F3F4F6',
                              color: '#374151',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            👁️ Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  currentPage={pagination.rideHistory.page}
                  totalPages={pagination.rideHistory.totalPages}
                  totalItems={pagination.rideHistory.total}
                  itemsPerPage={pagination.rideHistory.limit}
                  onPageChange={(page) => {
                    setPagination(prev => ({ ...prev, rideHistory: { ...prev.rideHistory, page } }));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Phase 7 Tab 3: Deactivated Accounts Tab */}
        {activeTab === 'deactivatedAccounts' && (
          <div>
            <div style={styles.pageHeader}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>Deactivated Accounts & Reactivation</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Review users who deactivated their accounts and restore account access
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <input
                type="text"
                placeholder="Search by Name, Email, Phone, or CNIC..."
                value={deactivatedSearchQuery}
                onChange={(e) => setDeactivatedSearchQuery(e.target.value)}
                style={{ ...styles.input, width: '320px', padding: '8px 14px', borderRadius: '10px' }}
              />
            </div>

            {deactivatedAccounts.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Deactivated Accounts</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
                  All user accounts are currently active.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Contact</th>
                      <th>CNIC</th>
                      <th>Deactivation Reason</th>
                      <th>Deactivated Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deactivatedAccounts.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4A2060' }}>
                            #{user.id ? user.id.substring(0, 8) : 'USER'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#181C32' }}>{user.name}</strong>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: user.role === 'driver' ? '#E3F2FD' : '#FCE4EC',
                            color: user.role === 'driver' ? '#1565C0' : '#C2185B',
                          }}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', color: '#181C32' }}>{user.phone || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: '#7E8299' }}>{user.email || 'N/A'}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#5E6278' }}>{user.cnic || 'N/A'}</span>
                        </td>
                        <td style={{ maxWidth: '240px' }}>
                          <span style={{ fontSize: '12px', color: '#DC2626', fontStyle: 'italic' }}>
                            {user.deactivation_reason || 'Self-deactivated by user'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#7E8299' }}>
                            {user.deactivated_at ? new Date(Number(user.deactivated_at)).toLocaleString() : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setReactivateConfirmModal({ userId: user.id, userName: user.name })}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            🔓 Reactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  currentPage={pagination.deactivatedAccounts.page}
                  totalPages={pagination.deactivatedAccounts.totalPages}
                  totalItems={pagination.deactivatedAccounts.total}
                  itemsPerPage={pagination.deactivatedAccounts.limit}
                  onPageChange={(page) => {
                    setPagination(prev => ({ ...prev, deactivatedAccounts: { ...prev.deactivatedAccounts, page } }));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Phase 7 Tab 4: Send Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            <div style={styles.pageHeader}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>Broadcast & User Notifications</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
                Compose and send instant push and in-app system notifications to riders and drivers
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
              {/* Compose Form */}
              <div style={styles.cardContainer}>
                <h3 style={{ ...styles.cardHeader, marginBottom: '20px' }}>📢 Compose Notification</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
                      addToast('Please provide both Title and Message body', 'warning');
                      return;
                    }
                    if (notificationForm.target === 'specific' && !notificationForm.userId.trim()) {
                      addToast('Please provide a specific User ID', 'warning');
                      return;
                    }
                    setNotificationConfirmModal(true);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#181C32', marginBottom: '8px' }}>
                      Target Audience *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { id: 'all', label: '👥 All Users (Riders & Drivers)' },
                        { id: 'drivers', label: '🚘 Drivers Only' },
                        { id: 'passengers', label: '👩 Passengers Only' },
                        { id: 'specific', label: '🎯 Specific User ID' },
                      ].map((t) => (
                        <label
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${notificationForm.target === t.id ? '#4A2060' : '#E4E6EF'}`,
                            backgroundColor: notificationForm.target === t.id ? '#FBF7FC' : '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                          }}
                        >
                          <input
                            type="radio"
                            name="target"
                            checked={notificationForm.target === t.id}
                            onChange={() => setNotificationForm(prev => ({ ...prev, target: t.id }))}
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {notificationForm.target === 'specific' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#181C32', marginBottom: '6px' }}>
                        Target User ID *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. usr_1787518952630_lclx"
                        value={notificationForm.userId}
                        onChange={(e) => setNotificationForm(prev => ({ ...prev, userId: e.target.value }))}
                        style={styles.input}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#181C32', marginBottom: '6px' }}>
                      Notification Category *
                    </label>
                    <select
                      value={notificationForm.category}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, category: e.target.value }))}
                      style={{
                        ...styles.input,
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                      }}
                    >
                      <option value="system">⚙️ Platform & Maintenance Updates (System)</option>
                      <option value="ride">🚗 Ride Updates & Booking Status (Ride)</option>
                      <option value="safety">🛡️ Safety & Security Alerts (Safety)</option>
                      <option value="payment">💳 Payments, Invoices & Wallet (Payment)</option>
                      <option value="promo">🎁 Promotions & Exclusive Offers (Promo)</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#181C32' }}>
                        Notification Title *
                      </label>
                      <span style={{ fontSize: '11px', color: '#7E8299' }}>{notificationForm.title.length}/100</span>
                    </div>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Special Weekend Fare Discount or Safety Advisory"
                      value={notificationForm.title}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                      style={styles.input}
                      required
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#181C32' }}>
                        Message Body *
                      </label>
                      <span style={{ fontSize: '11px', color: '#7E8299' }}>{notificationForm.body.length}/500</span>
                    </div>
                    <textarea
                      maxLength={500}
                      rows={5}
                      placeholder="Type the message body that will be sent to users' notifications..."
                      value={notificationForm.body}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, body: e.target.value }))}
                      style={{ ...styles.input, minHeight: '120px', resize: 'vertical' }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingNotification}
                    style={{
                      ...styles.btnSave,
                      backgroundColor: '#E83D98',
                      color: '#FFFFFF',
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '800',
                    }}
                  >
                    {isSendingNotification ? 'Broadcasting Notification...' : '🚀 Review & Send Broadcast'}
                  </button>
                </form>
              </div>

              {/* Mobile Push Preview Card */}
              <div>
                <div style={styles.cardContainer}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: '#181C32' }}>
                    📱 Mobile Push Preview
                  </h4>
                  <div style={{
                    backgroundColor: '#1E1B4B',
                    borderRadius: '16px',
                    padding: '16px',
                    color: '#FFFFFF',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '18px' }}>🚗</span>
                      <strong style={{ fontSize: '13px', fontWeight: '800', color: '#F472B6' }}>SheDrive</strong>
                      <span style={{ fontSize: '10px', color: '#9CA3AF', marginLeft: 'auto' }}>now</span>
                    </div>
                    <h5 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#FFFFFF' }}>
                      {notificationForm.title || 'Notification Title'}
                    </h5>
                    <p style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: 1.4 }}>
                      {notificationForm.body || 'Your broadcast message preview will appear here in real-time as you type.'}
                    </p>
                  </div>

                  <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      ℹ️ Delivery Channels:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#64748B', lineHeight: 1.6 }}>
                      <li>Firebase Cloud Messaging (FCM) Push Alert</li>
                      <li>In-App Mobile Notification Center</li>
                      <li>Logged to SheDrive Admin Audit Trail</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 8: Operational Intelligence & Advanced Analytics Tab */}
        {activeTab === 'analytics' && (
          <AnalyticsTab onShowToast={addToast} />
        )}

        {/* Phase 9: System Health & Infrastructure Diagnostics Tab */}
        {activeTab === 'systemHealth' && (
          <SystemHealthTab onShowToast={addToast} />
        )}

        {/* Phase 9: Driver Compliance & Document Expiry Tab */}
        {activeTab === 'compliance' && (
          <ComplianceTab onShowToast={addToast} />
        )}

        {/* Phase 9: Ride Dispute & Complaint Resolution Tab */}
        {activeTab === 'disputes' && (
          <DisputesTab onShowToast={addToast} />
        )}
      </main>

      {/* Support Ticket Screenshot Modal */}
      {supportTicketScreenshotModal && (
        <div style={styles.modalOverlay} onClick={() => setSupportTicketScreenshotModal(null)}>
          <div style={{ ...styles.modalContent, width: '600px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800' }}>Support Ticket Attachment</h3>
            <img
              src={supportTicketScreenshotModal}
              alt="Support Attachment"
              style={{ maxWidth: '100%', maxHeight: '480px', borderRadius: '8px', objectFit: 'contain' }}
            />
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button style={styles.btnSecondary} onClick={() => setSupportTicketScreenshotModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ride Details Modal */}
      {selectedRideDetails && (
        <div style={styles.modalOverlay} onClick={() => setSelectedRideDetails(null)}>
          <div style={{ ...styles.modalContent, width: '560px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#181C32' }}>
              Ride Details #{selectedRideDetails.ride_id?.substring(0, 8)}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div><strong>Passenger:</strong> {selectedRideDetails.passenger_name} ({selectedRideDetails.passenger_phone || 'N/A'})</div>
              <div><strong>Driver:</strong> {selectedRideDetails.driver_name || 'Unassigned'} ({selectedRideDetails.driver_phone || 'N/A'})</div>
              <div><strong>Vehicle Tier:</strong> {selectedRideDetails.vehicle_category}</div>
              <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: '700' }}>{selectedRideDetails.status}</span></div>
              <div><strong>Final Fare:</strong> PKR {selectedRideDetails.final_fare || selectedRideDetails.offered_fare || 0}</div>
              <div><strong>Payment Method:</strong> {selectedRideDetails.payment_method || 'Cash'}</div>
              <div><strong>Created:</strong> {selectedRideDetails.created_at ? new Date(Number(selectedRideDetails.created_at)).toLocaleString() : 'N/A'}</div>
              <div><strong>Completed:</strong> {selectedRideDetails.completed_at ? new Date(Number(selectedRideDetails.completed_at)).toLocaleString() : 'N/A'}</div>
            </div>
            {selectedRideDetails.is_scheduled && selectedRideDetails.scheduled_for && (
              <div style={{ padding: '10px 14px', backgroundColor: '#EEF2FF', borderRadius: '8px', color: '#4338CA', fontSize: '12px', marginBottom: '16px', fontWeight: '600' }}>
                🕒 Scheduled Departure: {new Date(Number(selectedRideDetails.scheduled_for)).toLocaleString()}
              </div>
            )}
            {selectedRideDetails.cancellation_reason && (
              <div style={{ padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '8px', color: '#DC2626', fontSize: '12px', marginBottom: '16px' }}>
                <strong>Cancellation Reason:</strong> {selectedRideDetails.cancellation_reason}
              </div>
            )}
            <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div><strong>Pickup:</strong> {selectedRideDetails.pickup_address || `${selectedRideDetails.pickup_latitude}, ${selectedRideDetails.pickup_longitude}`}</div>
              {selectedRideDetails.stops && selectedRideDetails.stops.length > 0 && selectedRideDetails.stops.map((s, idx) => (
                <div key={s.id || idx} style={{ marginTop: '4px', color: s.completed ? '#059669' : '#D97706' }}>
                  <strong>Stop #{s.stopOrder || idx + 1}:</strong> {s.label} ({s.completed ? 'Completed' : 'Pending'})
                </div>
              ))}
              <div style={{ marginTop: '4px' }}><strong>Dropoff:</strong> {selectedRideDetails.dropoff_address || `${selectedRideDetails.dropoff_latitude}, ${selectedRideDetails.dropoff_longitude}`}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button style={styles.btnSecondary} onClick={() => setSelectedRideDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivated Account Reactivate Modal */}
      {reactivateConfirmModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: '420px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800' }}>
              Reactivate Account
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#5E6278', lineHeight: 1.5 }}>
              Are you sure you want to reactivate the account for <strong>{reactivateConfirmModal.userName}</strong>? They will be able to log in and use SheDrive immediately.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={styles.btnCancel} onClick={() => setReactivateConfirmModal(null)}>
                Cancel
              </button>
              <button
                style={styles.btnApprove}
                onClick={async () => {
                  try {
                    await adminApi.reactivateAccount(reactivateConfirmModal.userId);
                    addToast(`Account for ${reactivateConfirmModal.userName} reactivated!`, 'success');
                    setReactivateConfirmModal(null);
                    fetchTabData(false);
                  } catch (err) {
                    addToast(err.message || 'Failed to reactivate account', 'error');
                  }
                }}
              >
                Confirm Reactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Confirmation Modal */}
      {notificationConfirmModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: '480px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800' }}>
              Confirm Broadcast Notification
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#5E6278', lineHeight: 1.5 }}>
              Are you sure you want to broadcast this <strong>{notificationForm.category.toUpperCase()}</strong> notification to <strong>{notificationForm.target.toUpperCase()}</strong>?
            </p>
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#4A2060', textTransform: 'uppercase', marginBottom: '4px' }}>
                Category: {notificationForm.category}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#181C32', marginBottom: '4px' }}>{notificationForm.title}</div>
              <div style={{ fontSize: '12px', color: '#5E6278' }}>{notificationForm.body}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={styles.btnCancel} onClick={() => setNotificationConfirmModal(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.btnSave, backgroundColor: '#E83D98', color: '#FFFFFF', padding: '8px 18px' }}
                onClick={async () => {
                  setIsSendingNotification(true);
                  try {
                    const res = await adminApi.sendAdminNotification(
                      notificationForm.title,
                      notificationForm.body,
                      notificationForm.target,
                      notificationForm.target === 'specific' ? notificationForm.userId : undefined,
                      notificationForm.category
                    );
                    addToast(res.message || 'Broadcast notification sent successfully!', 'success');
                    setNotificationConfirmModal(false);
                    setNotificationForm({ title: '', body: '', target: 'all', userId: '', category: 'system' });
                  } catch (err) {
                    addToast(err.message || 'Failed to send notification', 'error');
                  } finally {
                    setIsSendingNotification(false);
                  }
                }}
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

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
                {(selectedDriverDocs.cnic_front_url || selectedDriverDocs.cnicFrontUrl) ? (
                  <img 
                    src={selectedDriverDocs.cnic_front_url || selectedDriverDocs.cnicFrontUrl} 
                    alt="CNIC Front" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.cnic_front_url || selectedDriverDocs.cnicFrontUrl, title: 'CNIC Front' })}
                  />
                ) : <p style={styles.noDoc}>Not Uploaded</p>}
              </div>

              <div style={styles.docBox}>
                <p style={styles.docLabel}>CNIC Back</p>
                {(selectedDriverDocs.cnic_back_url || selectedDriverDocs.cnicBackUrl) ? (
                  <img 
                    src={selectedDriverDocs.cnic_back_url || selectedDriverDocs.cnicBackUrl} 
                    alt="CNIC Back" 
                    style={{ ...styles.docImg, cursor: 'pointer' }}
                    onClick={() => setSelectedImage({ url: selectedDriverDocs.cnic_back_url || selectedDriverDocs.cnicBackUrl, title: 'CNIC Back' })}
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

      {/* Phase 9: SOS Investigation Modal */}
      {sosInvestigateModal && (
        <div style={styles.modalOverlay} onClick={() => setSosInvestigateModal(null)}>
          <div style={{ ...styles.modalContent, width: '520px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#181C32' }}>
              🚨 Investigate SOS Incident
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#7E8299' }}>
              Alert for <strong>{sosInvestigateModal.alert.user_name}</strong> ({sosInvestigateModal.alert.user_role})
            </p>

            <div style={{ padding: '10px 12px', backgroundColor: '#FEF2F2', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#DC2626' }}>
              <div><strong>GPS Location:</strong> {sosInvestigateModal.alert.latitude?.toFixed(4)}, {sosInvestigateModal.alert.longitude?.toFixed(4)}</div>
              <div><strong>Ride ID:</strong> {sosInvestigateModal.alert.ride_id || 'None'}</div>
              <div><strong>Time:</strong> {sosInvestigateModal.alert.created_at ? new Date(Number(sosInvestigateModal.alert.created_at)).toLocaleString() : 'Recent'}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>Incident Severity *</label>
              <select
                style={{ ...styles.input, backgroundColor: '#FFF' }}
                value={sosInvestigateModal.severity}
                onChange={(e) => setSosInvestigateModal(m => ({ ...m, severity: e.target.value }))}
              >
                <option value="low">Low — False alarm / Test trigger</option>
                <option value="medium">Medium — Route deviation / General concern</option>
                <option value="high">High — Verbal dispute / Urgent assistance</option>
                <option value="critical">Critical — Immediate danger / Emergency</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="policeContacted"
                checked={sosInvestigateModal.policeContacted}
                onChange={(e) => setSosInvestigateModal(m => ({ ...m, policeContacted: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="policeContacted" style={{ fontSize: '13px', fontWeight: '600', color: '#181C32', cursor: 'pointer' }}>
                Local Police (15) Contacted / Dispatched
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={styles.label}>Investigation & Case Resolution Notes *</label>
              <textarea
                style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }}
                placeholder="Detail the investigation findings, rider/driver check-in outcome, and action taken…"
                value={sosInvestigateModal.resolutionNotes}
                onChange={(e) => setSosInvestigateModal(m => ({ ...m, resolutionNotes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button style={styles.btnCancel} onClick={() => setSosInvestigateModal(null)} disabled={isSubmittingSOS}>
                Cancel
              </button>
              <button
                style={{ ...styles.btnSave, backgroundColor: '#7C3AED', color: '#FFF' }}
                disabled={isSubmittingSOS}
                onClick={async () => {
                  if (!sosInvestigateModal.resolutionNotes.trim()) {
                    addToast('Investigation notes are required', 'error');
                    return;
                  }
                  try {
                    setIsSubmittingSOS(true);
                    await adminApi.investigateSOS(sosInvestigateModal.alert.id, {
                      resolutionNotes: sosInvestigateModal.resolutionNotes.trim(),
                      severity: sosInvestigateModal.severity,
                      policeContacted: sosInvestigateModal.policeContacted,
                    });
                    addToast('SOS incident investigated and case resolved', 'success');
                    setSosInvestigateModal(null);
                    fetchTabData(false);
                  } catch (err) {
                    addToast(err?.message || 'Failed to investigate SOS alert', 'error');
                  } finally {
                    setIsSubmittingSOS(false);
                  }
                }}
              >
                {isSubmittingSOS ? 'Saving…' : '✓ Resolve Incident Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 9: User Policy Warning Modal */}
      {userWarningModal && (
        <div style={styles.modalOverlay} onClick={() => setUserWarningModal(null)}>
          <div style={{ ...styles.modalContent, width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#181C32' }}>
              ⚠️ Issue Official Policy Warning
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#7E8299' }}>
              Dispatch warning notice to <strong>{userWarningModal.user.name}</strong> ({userWarningModal.user.role})
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>Warning Category *</label>
              <select
                style={{ ...styles.input, backgroundColor: '#FFF' }}
                value={userWarningModal.warningType}
                onChange={(e) => setUserWarningModal(w => ({ ...w, warningType: e.target.value }))}
              >
                <option value="cancellation_rate">Excessive Ride Cancellation Rate</option>
                <option value="behavior">Community Guidelines / Unprofessional Conduct</option>
                <option value="policy_violation">Safety or Platform Policy Breach</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={styles.label}>Warning Notice Message *</label>
              <textarea
                style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }}
                placeholder="Explain the reason for this warning and expected corrective action…"
                value={userWarningModal.message}
                onChange={(e) => setUserWarningModal(w => ({ ...w, message: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button style={styles.btnCancel} onClick={() => setUserWarningModal(null)} disabled={isSubmittingWarning}>
                Cancel
              </button>
              <button
                style={{ ...styles.btnSave, backgroundColor: '#D97706', color: '#FFF' }}
                disabled={isSubmittingWarning}
                onClick={async () => {
                  if (!userWarningModal.message.trim()) {
                    addToast('Warning message cannot be empty', 'error');
                    return;
                  }
                  try {
                    setIsSubmittingWarning(true);
                    await adminApi.issueUserWarning(userWarningModal.user.id, {
                      warningType: userWarningModal.warningType,
                      message: userWarningModal.message.trim(),
                    });
                    addToast(`Official warning dispatched to ${userWarningModal.user.name}`, 'success');
                    setUserWarningModal(null);
                  } catch (err) {
                    addToast(err?.message || 'Failed to dispatch warning', 'error');
                  } finally {
                    setIsSubmittingWarning(false);
                  }
                }}
              >
                {isSubmittingWarning ? 'Sending…' : '⚠️ Issue Warning Notice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification System */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
  appContainer: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" },
  sidebar: { width: '270px', backgroundColor: '#0F172A', color: '#FFFFFF', padding: '28px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1E293B' },
  logoSection: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px', paddingLeft: '6px' },
  logoIcon: { fontSize: '32px' },
  logoTitle: { margin: 0, fontSize: '22px', fontWeight: '900', color: '#0D9488', letterSpacing: '-0.5px' },
  logoSubtitle: { margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8', letterSpacing: '0.5px', fontWeight: '600', textTransform: 'uppercase' },
  navMenu: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  navItem: { backgroundColor: 'transparent', color: '#94A3B8', border: 'none', padding: '13px 18px', borderRadius: '14px', textAlign: 'left', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' },
  navItemActive: { backgroundColor: '#0D9488', color: '#FFFFFF', border: 'none', padding: '13px 18px', borderRadius: '14px', textAlign: 'left', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0px 8px 20px rgba(13, 148, 136, 0.35)' },
  adminProfileCard: { backgroundColor: '#1E293B', padding: '14px 18px', borderRadius: '16px', marginTop: 'auto', border: '1px solid #334155' },
  adminName: { margin: 0, fontWeight: '800', fontSize: '14px', color: '#FFFFFF' },
  adminRole: { margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' },
  btnLogout: { backgroundColor: 'transparent', color: '#EF4444', border: 'none', padding: 0, marginTop: '10px', fontSize: '12px', cursor: 'pointer', fontWeight: '800' },
  mainContent: { flex: 1, padding: '36px 40px', overflowY: 'auto' },
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  headerTitle: { margin: 0, fontSize: '26px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' },
  headerSub: { margin: '4px 0 0 0', fontSize: '14px', color: '#64748B', fontWeight: '500' },
  statusBadge: { backgroundColor: '#ECFDF5', color: '#059669', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '800', border: '1px solid #A7F3D0' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '18px', marginBottom: '32px' },
  metricCard: { backgroundColor: '#FFFFFF', padding: '22px 18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.04)', border: '1px solid #E2E8F0' },
  metricIcon: { fontSize: '32px' },
  metricLabel: { margin: 0, fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' },
  metricValue: { margin: '4px 0 0 0', fontSize: '22px', fontWeight: '900', color: '#0F172A' },
  cardContainer: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: '24px', 
    padding: '28px', 
    boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.04)', 
    border: '1px solid #E2E8F0',
    marginBottom: '24px',
  },
  cardHeader: { 
    margin: '0 0 24px 0', 
    fontSize: '19px', 
    fontWeight: '800', 
    color: '#0F172A', 
    letterSpacing: '-0.3px',
    borderBottom: '2px solid #F1F5F9',
    paddingBottom: '16px',
  },
  emptyStateText: { padding: '24px 0', color: '#94A3B8', fontSize: '14px', fontWeight: '500' },
  // Table styling is handled by global index.css for pseudo-selector support (zebra striping, hover, etc.)
  statusGreen: { backgroundColor: '#ECFDF5', color: '#059669', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  statusYellow: { backgroundColor: '#FFFBEB', color: '#D97706', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  statusRed: { backgroundColor: '#FEF2F2', color: '#DC2626', padding: '6px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '800' },
  btnViewDocs: { backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px solid #CCFBF1', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnDownloadPdf: { backgroundColor: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnApprove: { backgroundColor: '#10B981', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', boxShadow: '0px 4px 10px rgba(16, 185, 129, 0.25)' },
  btnReject: { backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px', boxShadow: '0px 4px 10px rgba(239, 68, 68, 0.25)' },
  btnBlock: { backgroundColor: '#DC2626', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnUnblock: { backgroundColor: '#059669', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' },
  btnCancel: { backgroundColor: '#E2E8F0', color: '#334155', border: 'none', padding: '8px 14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' },
  label: { display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: '#0F172A', letterSpacing: '0.2px' },
  input: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', backgroundColor: '#F8FAFC', outline: 'none' },
  btnSave: { backgroundColor: '#0D9488', color: '#FFF', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', marginTop: '16px', width: '100%', boxShadow: '0px 8px 20px rgba(13, 148, 136, 0.35)', fontSize: '15px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 12, 32, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '24px', width: '660px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0px 25px 60px rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.5)' },
  docBox: { backgroundColor: '#FAFAFC', padding: '14px', borderRadius: '14px', border: '1px solid #EFEFF5' },
  docLabel: { margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' },
  docImg: { width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px' },
  noDoc: { color: '#B5B5C3', fontSize: '13px', fontWeight: '600' },
};
