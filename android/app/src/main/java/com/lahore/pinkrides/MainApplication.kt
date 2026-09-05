package com.lahore.pinkrides

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.media.AudioAttributes
import android.provider.Settings

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return PackageList(this).packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    createNotificationChannels()
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(NotificationManager::class.java) ?: return

      val defaultAudioAttributes = AudioAttributes.Builder()
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .build()

      // 1. Ride Alerts Channel (Heads-up banner + sound + vibration)
      val rideAlertsChannel = NotificationChannel(
        "ride_alerts",
        "Ride Alerts & Booking Updates",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifications for incoming ride requests, counter offers, driver arrival, and ride updates."
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, defaultAudioAttributes)
      }

      // 2. Chat Messages Channel (Heads-up banner + sound + vibration)
      val chatChannel = NotificationChannel(
        "chat_messages",
        "In-Ride Chat Messages",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Direct chat messages between passenger and driver during trips."
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, defaultAudioAttributes)
      }

      // 3. Safety & SOS Alerts Channel (Maximum importance)
      val safetyChannel = NotificationChannel(
        "safety_alerts",
        "Safety & Emergency SOS",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Emergency SOS alerts, safety warnings, and high-priority incident notifications."
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, defaultAudioAttributes)
      }

      // 4. Admin Broadcasts & Announcements Channel
      val adminChannel = NotificationChannel(
        "admin_broadcasts",
        "Platform Updates & Announcements",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Platform notices, verification updates, and important announcements."
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
        setSound(Settings.System.DEFAULT_NOTIFICATION_URI, defaultAudioAttributes)
      }

      notificationManager.createNotificationChannels(
        listOf(rideAlertsChannel, chatChannel, safetyChannel, adminChannel)
      )
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
