# Upload ZenDBX Logo to Google OAuth

## Your Logo Location
✅ **Found:** `frontend/public/logo.png`

## Steps to Upload

### Step 1: Prepare Your Logo

Google requires a **120x120 pixel** square logo. Let's prepare it:

**Option A: Use Online Tool (Easiest)**
1. Go to: https://www.iloveimg.com/resize-image
2. Upload `frontend/public/logo.png`
3. Select "By pixels"
4. Set: **120 x 120 pixels**
5. Keep aspect ratio: **OFF** (force square)
6. Download the resized image
7. Save as `zendbx-logo-120x120.png`

**Option B: Use Windows Paint**
1. Open `frontend/public/logo.png` in Paint
2. Click "Resize"
3. Uncheck "Maintain aspect ratio"
4. Set: **120 x 120 pixels**
5. Save as `zendbx-logo-120x120.png`

**Option C: Use Photoshop/GIMP**
1. Open `frontend/public/logo.png`
2. Image → Image Size
3. Set: **120 x 120 pixels**
4. Export as PNG
5. Save as `zendbx-logo-120x120.png`

### Step 2: Upload to Google Console

1. **Go to:** https://console.cloud.google.com/apis/credentials/consent

2. **Click "EDIT APP"** button (top right)

3. **Scroll to "App logo" section**

4. **Click "Choose File"** and select your `zendbx-logo-120x120.png`

5. **Preview:** You'll see a preview of how it looks

6. **Click "SAVE AND CONTINUE"** at the bottom

7. **Click "SAVE AND CONTINUE"** through remaining steps

### Step 3: Test

1. **Wait 1-2 minutes** for changes to propagate

2. **Clear browser cache** (Ctrl+Shift+Delete)

3. **Test OAuth again:**
   - Go to: http://localhost:3000/login
   - Click "Continue with Google"
   - **You should see your ZenDBX logo!** 🎉

## Logo Requirements Checklist

- ✅ **Format:** PNG (you have this)
- ✅ **Size:** 120 x 120 pixels (resize needed)
- ✅ **Max file size:** 1 MB (your logo is likely under this)
- ✅ **Square:** 1:1 aspect ratio (resize to square)
- ⚠️ **Background:** Solid color recommended (transparent OK but not ideal)

## What Users Will See

After uploading, the Google consent screen will show:

```
┌─────────────────────────────────┐
│  [Your ZenDBX Logo - 120x120]   │
│                                  │
│  Sign in with Google             │
│                                  │
│  to continue to zendbx           │
│                                  │
│  Choose an account               │
│  ├─ user@gmail.com              │
│  └─ Use another account          │
└─────────────────────────────────┘
```

## Troubleshooting

### Logo not showing?
- **Wait 2-5 minutes** - Google caches consent screens
- **Clear browser cache** - Old version might be cached
- **Try incognito mode** - Fresh session
- **Check file size** - Must be under 1 MB
- **Check format** - Must be PNG, JPG, or GIF

### Logo looks stretched?
- **Make it square first** - Resize to 120x120 exactly
- **Don't maintain aspect ratio** - Force square dimensions

### Logo looks blurry?
- **Use higher quality source** - Start with larger image
- **Export at 100% quality** - No compression
- **Use PNG format** - Better for logos than JPG

## Quick Resize Command (if you have ImageMagick)

```bash
# Install ImageMagick first, then:
magick frontend/public/logo.png -resize 120x120! zendbx-logo-120x120.png
```

The `!` forces exact dimensions (no aspect ratio preservation).

## Alternative: Use Your Existing Logo As-Is

If your logo is already square-ish:
1. Just upload `frontend/public/logo.png` directly
2. Google will auto-resize it
3. Might not look perfect but will work

---

**Next:** After uploading, test OAuth and you'll see your logo on the Google consent screen! 🎨
