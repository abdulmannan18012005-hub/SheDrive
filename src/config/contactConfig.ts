/**
 * SheDrive Contact and Social Media Configuration
 * Centralized configuration for all contact information and social media links
 */

export const CONTACT_INFO = {
  // Support Email
  supportEmail: 'shedrive.support@gmail.com',
  
  // Legal Email
  legalEmail: 'shedrive.support@gmail.com',
  
  // Privacy Email
  privacyEmail: 'shedrive.support@gmail.com',
  
  // Phone Numbers
  supportPhone: '+92 300 1234567',
  emergencyHotline: '+92 42 111 743 374',
  
  // Official Website
  websiteUrl: 'https://shedrive.great-site.net',

  // Office Address
  officeAddress: 'Lahore, Punjab, Pakistan',
  
  // Office Hours
  officeHours: {
    weekdays: '9:00 AM - 6:00 PM',
    saturday: '10:00 AM - 4:00 PM',
    sunday: 'Closed',
  },
  
  // Response Times
  responseTimes: {
    email: 'Within 24 hours',
    phone: 'Immediate during office hours',
    socialMedia: 'Within 12 hours',
    legal: 'Within 14 business days',
  },
};

export const SOCIAL_MEDIA = {
  facebook: {
    name: 'SheDrive',
    url: 'https://www.facebook.com/share/19LKH6jThh/',
    icon: '📘',
    color: '#1877F2',
  },
  instagram: {
    name: 'SheDrive.Official',
    url: 'https://www.instagram.com/shedrive.official?igsh=aTYwczR2ZGt2eHNt',
    icon: '📷',
    color: '#E4405F',
  },
};

export const SOCIAL_LINKS = Object.values(SOCIAL_MEDIA);
