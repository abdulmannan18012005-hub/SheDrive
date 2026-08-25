# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Phase 14: Comprehensive ProGuard rules for size optimization

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }

# Firebase
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# React Native Maps
-keep class com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**

# React Native Image Crop Picker
-keep class com.yalantis.ucrop.** { *; }
-dontwarn com.yalantis.ucrop.**

# React Native WebView
-keep class com.facebook.react.views.webview.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keep class org.unimodules.** { *; }

# General optimization
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep setters in Views so that animations can still work.
-keepclassmembers public class * extends android.view.View {
    void set*(***);
    *** get*();
}

# Keep activities
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep R classes
-keep class **.R$* { *; }

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
