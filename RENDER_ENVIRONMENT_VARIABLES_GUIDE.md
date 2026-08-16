# Render Environment Variables Configuration Guide

## Firebase FCM Environment Variables

Add these environment variables to your Render dashboard for the SheDrive backend service.

### Step 1: Go to Render Dashboard
1. Log in to [Render](https://render.com)
2. Navigate to your SheDrive backend service
3. Click on "Environment" tab

### Step 2: Add the Following Environment Variables

#### Firebase Admin SDK Variables

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `FIREBASE_PROJECT_ID` | `lahore-pink-rides` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@lahore-pink-rides.iam.gserviceaccount.com` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | See below | Firebase service account private key |

#### Firebase Private Key Format

The `FIREBASE_PRIVATE_KEY` value must be formatted with `\n` for line breaks:

```
-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvQgRb0f4YQShh\n2AODJBNPc33oIQZ3DbUIR5GyoWxG2vv4zTwR59hA1t1Azv/W0vs/nZtwFUDFCU/y\nRE7KtwhOY9FLmm+ewoKjyoAiD676V9SaoXVLI1F5Tfpd1wI61PuhlsGCpPv6yfMM\nqIwVQaQZ9dGbgcWVJIkL+7y0Yv9OLt6SDrNQsBNSm24Bn8ZfVWr1wma8JBuBHikz\npp8pxyoYes2Tyt5RzsjdL/G8elnhB3ca84WZuABPartJYHhVMeS8CNLs7rvjEEC9\n5AHuA/nVampigW2PmfHoFSh+TukUHFbU8qDuzueII3txo/SrfiWe7G4RDpZrTXbF\nRVVUXJ15AgMBAAECggEAHQn4ROqPip9JPKUZN+KDXJfLVeoa8yEPTPbm2k1K7pac\nR4ZiHKlouJ2hfXqPA55jyQ+pULIE0GERoRfWYlpfgvWhGUDWm9yo3tDP2FT27j4d\nWR3FnJSWjF3yTRgyI2Nk6kpbd/U0V0KdBgzrYR5GPZLwjy66eVLbbmPgyZbZrK9r\nFH97zshMYBZDJ6qjxjDobp55rFguelCBpfk9W212Z8bpC6SCjf5Uhfb1Ry0SZ2S3\nQAK645kUE1PN43ys2xdsaWpv7vZKkWSrIOq4hgVK2cArBeI1QOzy4G68vssS4BsD\nVaie4ADIn4nJURj5GX9l9SuohdGhbCn74pk6b+gzzQKBgQDh8U0q47Hijar2Y/ur\nTMAyY7ECawT4Lfwui5Yysgg6Jsb1aaCQRKd31pQ1BA3SMqds/5JQzst1sYRkhTO3\nNnhQ9fvfvUWCowjyn9z7ypsT3wQl6c0JjyCUiI9c2WgWOKeAZmeyq0GrTioBCsQN\n/h/X3PhayjRPOT3tRc2TeYiPiwKBgQDGkpkGJP4dtjCh6S4ORoCaEGJvfuJLmkI0\n+DKrle0NwsHmM8tXKbqlxUtjXknukx6mrKYYMEX4BLZ6DRQoXC2Z4iHCJBSYSbxf\nK/a5LBz9dzZeWwS1BpNBMS73Am13wnIv1et1GQHMZy56W4EyLTQSAWEFr7XTWm9Y\nKlwUVxmniwKBgQCMIgQRcM1YTTNWw+ZIdT7TQd98N3IKl0LMf4i1gpP1tS068rtC\nH0Ka4fxj8VK9JuuOf+h4s/me0m3hhnfvzxnKZPZF63ccMhAPozUE+cE7Dtvcw+iG\nYD39wcDg/no/Jf5Fdb4lI3CEVeNZaBr27sFDOerTLIxLAp609dEuAXfARwKBgQCe\n8nuQ4o2SZOKax9b40FBighj5HHyxfaHfWojcth7RdALXbMAoXhusU7fbq37MfHD9\ng5dUJ1fqhoM2QT/QarCJy+uvxkfB+svQ9pUAdiIidYlMj9i9uqymc2Mfj47mXPwf\n9EEMM18wKauXf6Vz76ENhJMQBS0rJ+mWjhm0ol/DrwKBgCRwoXXwxhjBQ9jt8qsF\n/6zWuDJOTEGx+NJhGwW+GFhoW8NX1xiSY3lCC0/n91VEVmZvgFIsq3+s/g8e8NWx\n9gFGtEx5eYKSz4drUCkHjLZvcw0rtwO8KO9cPYnDRnbpT366MCcGTt0Q/PUUrx8K\nGfOuKFGIX3JQ5ONJ+qxA7H9F\n-----END PRIVATE KEY-----\n
```

**Important Notes:**
- Copy the entire private key including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts
- Replace all actual newlines with `\n` (backslash-n) as shown above
- Do NOT add any extra spaces or quotes

### Step 3: Verify Existing Variables

Ensure these existing variables are still configured:

| Variable Name | Value |
|---------------|-------|
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | Your JWT secret key |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Your Gmail app password |
| `CLIENT_URL` | Your frontend URL |
| `PASSWORD_RESET_REDIRECT_URL` | Your password reset deep link URL |

### Step 4: Save and Deploy

1. Click "Save Changes" on the Render dashboard
2. Render will automatically redeploy your backend with the new environment variables
3. Wait for the deployment to complete (usually 2-3 minutes)

### Step 5: Verify Deployment

After deployment, test the FCM endpoint:

```bash
curl -X POST https://shedrive.onrender.com/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

If successful, you should see:
```json
{
  "message": "Test notification sent"
}
```

---

## Troubleshooting

### Issue: Private Key Format Error
**Error:** `FirebaseAppError: Failed to parse private key`

**Solution:** Ensure the private key has `\n` instead of actual newlines. Copy the exact format shown above.

### Issue: Authentication Failed
**Error:** `FirebaseAppError: Credential initialization failed`

**Solution:** Verify all three Firebase variables are set correctly:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Issue: Deployment Failed
**Error:** Build fails on Render

**Solution:** Check Render build logs for specific error messages. Common issues:
- Missing environment variables
- Invalid private key format
- Network connectivity issues

---

## Summary

After completing these steps:
1. ✅ Firebase Admin SDK variables configured on Render
2. ✅ Backend can send push notifications via FCM
3. ✅ Mobile app can receive notifications
4. ✅ Test endpoint available for verification

Your FCM implementation is now fully configured and ready for production use!
